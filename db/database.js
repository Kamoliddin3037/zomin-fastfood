const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Resolve database path: allow environment override for cloud persistent disks
const DB_DIR = path.resolve(process.env.DB_DIR || path.join(__dirname, '../data'));
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'fastfood.sqlite');
const LEGACY_JSON_PATH = path.join(DB_DIR, 'database.json');

// Initialize SQLite database instance
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize Schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      image TEXT NOT NULL,
      images_json TEXT,
      is_available INTEGER DEFAULT 1,
      badge TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      table_number INTEGER,
      location_json TEXT,
      order_type TEXT NOT NULL DEFAULT 'delivery',
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_status TEXT DEFAULT 'pending',
      total_amount INTEGER NOT NULL,
      delivery_fee INTEGER DEFAULT 0,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      tg_user_json TEXT,
      source TEXT DEFAULT 'web',
      assigned_staff_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS restaurant_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// Password hashing helpers
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

// Seed default users if empty
function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO users (username, password_hash, salt, role, full_name, phone, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const defaultUsers = [
      {
        username: 'admin',
        password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',
        role: 'admin',
        full_name: 'Bosh Administrator',
        phone: '+998 90 123 45 67'
      },
      {
        username: 'oshpaz',
        password: 'oshpaz123',
        role: 'cook',
        full_name: 'Bosh Oshpaz (Oshxona KDS)',
        phone: '+998 91 234 56 78'
      },
      {
        username: 'kuryer',
        password: 'kuryer123',
        role: 'courier',
        full_name: 'Tezkor Kuryer (Yetkazuvchi)',
        phone: '+998 93 345 67 89'
      },
      {
        username: 'kassir',
        password: 'kassir123',
        role: 'cashier',
        full_name: 'Kassa Operator (Zal / Ofitsiant)',
        phone: '+998 94 456 78 90'
      }
    ];

    for (const u of defaultUsers) {
      const { hash, salt } = hashPassword(u.password);
      insert.run(u.username, hash, salt, u.role, u.full_name, u.phone, now);
    }
    console.log('✅ Standart xodim foydalanuvchilari (admin, oshpaz, kuryer, kassir) SQLite bazasiga kiritildi.');
  }
}

// Migrate data from legacy database.json if categories or products table is empty
function migrateFromLegacyJson() {
  const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (prodCount > 0) return; // already migrated

  if (!fs.existsSync(LEGACY_JSON_PATH)) return;

  try {
    const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
    const legacy = JSON.parse(raw);

    // 1. Categories
    if (Array.isArray(legacy.categories)) {
      const insertCat = db.prepare('INSERT OR REPLACE INTO categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)');
      legacy.categories.forEach((cat, index) => {
        insertCat.run(cat.id, cat.name, cat.icon || '🍽', index);
      });
    }

    // 2. Products
    if (Array.isArray(legacy.products)) {
      const insertProd = db.prepare(`
        INSERT INTO products (id, category_id, name, description, price, image, images_json, is_available, badge, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      legacy.products.forEach(p => {
        const imagesJson = JSON.stringify(p.images || [p.image || '']);
        insertProd.run(
          p.id,
          p.categoryId || 'lavash',
          p.name,
          p.description || '',
          p.price || 0,
          p.image || '',
          imagesJson,
          p.isAvailable === false ? 0 : 1,
          p.badge || '',
          new Date().toISOString()
        );
      });
    }

    // 3. Restaurant Settings
    if (legacy.restaurant && typeof legacy.restaurant === 'object') {
      const insertSetting = db.prepare('INSERT OR REPLACE INTO restaurant_settings (key, value) VALUES (?, ?)');
      for (const [key, val] of Object.entries(legacy.restaurant)) {
        insertSetting.run(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
      }
    }

    // 4. Historical Orders
    if (Array.isArray(legacy.orders)) {
      const insertOrder = db.prepare(`
        INSERT OR REPLACE INTO orders (
          id, customer_name, phone, address, table_number, location_json,
          order_type, payment_method, payment_status, total_amount, delivery_fee,
          note, status, tg_user_json, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, name, price, quantity, image)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      legacy.orders.forEach(o => {
        insertOrder.run(
          o.id,
          o.customerName || 'Mijoz',
          o.phone || '',
          o.address || '',
          o.tableNumber || null,
          o.location ? JSON.stringify(o.location) : null,
          o.orderType || 'delivery',
          o.paymentMethod || 'cash',
          o.paymentStatus || (o.status === 'completed' ? 'paid' : 'pending'),
          o.totalAmount || 0,
          o.deliveryFee || 0,
          o.note || '',
          o.status || 'pending',
          o.tgUser ? JSON.stringify(o.tgUser) : null,
          o.source || 'web',
          o.createdAt || new Date().toISOString(),
          o.updatedAt || o.createdAt || new Date().toISOString()
        );

        if (Array.isArray(o.items)) {
          o.items.forEach(item => {
            insertItem.run(
              o.id,
              item.productId || item.id || null,
              item.name,
              item.price,
              item.quantity || 1,
              item.image || ''
            );
          });
        }
      });
    }

    console.log('✅ database.json faylidagi barcha ma\'lumotlar muvaffaqiyatli SQLite bazasiga ko\'chirildi!');
  } catch (err) {
    console.error('Legacy migration error:', err);
  }
}

// Run DB setup
initSchema();
seedUsers();
migrateFromLegacyJson();

// ==========================================
// DATA ACCESS LAYER (DAL) METHODS
// ==========================================

const databaseService = {
  // Raw handle
  db,

  // --- Users & Roles ---
  getUsers() {
    return db.prepare('SELECT id, username, role, full_name, phone, is_active, created_at FROM users ORDER BY id ASC').all();
  },

  getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  },

  getUserById(id) {
    return db.prepare('SELECT id, username, role, full_name, phone, is_active, created_at FROM users WHERE id = ?').get(id);
  },

  createUser({ username, password, role, full_name, phone }) {
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash, salt, role, full_name, phone, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username.trim(), hash, salt, role, full_name.trim(), phone || '', now);
    return this.getUserById(result.lastInsertRowid);
  },

  deleteUser(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  updateUserStatus(id, isActive) {
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
    return this.getUserById(id);
  },

  verifyPassword,
  hashPassword,

  // --- Categories ---
  getCategories() {
    return db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
  },

  // --- Products ---
  getProducts(categoryId = null) {
    let rows;
    if (categoryId && categoryId !== 'all') {
      rows = db.prepare('SELECT * FROM products WHERE category_id = ? ORDER BY id ASC').all(categoryId);
    } else {
      rows = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
    }

    return rows.map(r => ({
      id: r.id,
      categoryId: r.category_id,
      name: r.name,
      description: r.description,
      price: r.price,
      image: r.image,
      images: r.images_json ? JSON.parse(r.images_json) : [r.image],
      isAvailable: Boolean(r.is_available),
      badge: r.badge,
      createdAt: r.created_at
    }));
  },

  getProductById(id) {
    const r = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id));
    if (!r) return null;
    return {
      id: r.id,
      categoryId: r.category_id,
      name: r.name,
      description: r.description,
      price: r.price,
      image: r.image,
      images: r.images_json ? JSON.parse(r.images_json) : [r.image],
      isAvailable: Boolean(r.is_available),
      badge: r.badge,
      createdAt: r.created_at
    };
  },

  createProduct({ categoryId, name, description, price, image, images, isAvailable, badge }) {
    const imagesJson = JSON.stringify((images && images.length) ? images : [image || '']);
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO products (category_id, name, description, price, image, images_json, is_available, badge, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      categoryId || 'lavash',
      name,
      description || '',
      Number(price) || 0,
      image || (images && images[0]) || '',
      imagesJson,
      isAvailable === false ? 0 : 1,
      badge || '',
      now
    );
    return this.getProductById(result.lastInsertRowid);
  },

  updateProduct(id, fields) {
    const existing = this.getProductById(id);
    if (!existing) return null;

    const categoryId = fields.categoryId !== undefined ? fields.categoryId : existing.categoryId;
    const name = fields.name !== undefined ? fields.name : existing.name;
    const description = fields.description !== undefined ? fields.description : existing.description;
    const price = fields.price !== undefined ? Number(fields.price) : existing.price;
    const images = fields.images !== undefined ? fields.images : existing.images;
    const image = fields.image !== undefined ? fields.image : (images && images[0]) || existing.image;
    const imagesJson = JSON.stringify(images);
    const isAvailable = fields.isAvailable !== undefined ? (fields.isAvailable ? 1 : 0) : (existing.isAvailable ? 1 : 0);
    const badge = fields.badge !== undefined ? fields.badge : existing.badge;

    db.prepare(`
      UPDATE products
      SET category_id = ?, name = ?, description = ?, price = ?, image = ?, images_json = ?, is_available = ?, badge = ?
      WHERE id = ?
    `).run(categoryId, name, description, price, image, imagesJson, isAvailable, badge, Number(id));

    return this.getProductById(id);
  },

  deleteProduct(id) {
    return db.prepare('DELETE FROM products WHERE id = ?').run(Number(id));
  },

  // --- Orders ---
  getOrders(filters = {}) {
    let sql = 'SELECT * FROM orders';
    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }
    if (filters.orderType) {
      conditions.push('order_type = ?');
      params.push(filters.orderType);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const orderRows = db.prepare(sql).all(...params);
    const itemRows = db.prepare('SELECT * FROM order_items').all();

    const itemsByOrder = {};
    itemRows.forEach(item => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push({
        id: item.id,
        productId: item.product_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      });
    });

    return orderRows.map(o => ({
      id: o.id,
      customerName: o.customer_name,
      phone: o.phone,
      address: o.address,
      tableNumber: o.table_number,
      location: o.location_json ? JSON.parse(o.location_json) : null,
      orderType: o.order_type,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      totalAmount: o.total_amount,
      deliveryFee: o.delivery_fee,
      note: o.note,
      status: o.status,
      tgUser: o.tg_user_json ? JSON.parse(o.tg_user_json) : null,
      source: o.source,
      assignedStaffId: o.assigned_staff_id,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      items: itemsByOrder[o.id] || []
    }));
  },

  getOrderById(id) {
    const o = db.prepare('SELECT * FROM orders WHERE id = ? COLLATE NOCASE').get(id);
    if (!o) return null;

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id).map(item => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image
    }));

    return {
      id: o.id,
      customerName: o.customer_name,
      phone: o.phone,
      address: o.address,
      tableNumber: o.table_number,
      location: o.location_json ? JSON.parse(o.location_json) : null,
      orderType: o.order_type,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      totalAmount: o.total_amount,
      deliveryFee: o.delivery_fee,
      note: o.note,
      status: o.status,
      tgUser: o.tg_user_json ? JSON.parse(o.tg_user_json) : null,
      source: o.source,
      assignedStaffId: o.assigned_staff_id,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      items
    };
  },

  createOrder({
    customerName,
    phone,
    address,
    tableNumber,
    location,
    orderType = 'delivery',
    paymentMethod = 'cash',
    paymentStatus = 'pending',
    totalAmount,
    deliveryFee = 0,
    note = '',
    status = 'pending',
    tgUser = null,
    source = 'web',
    items = []
  }) {
    // Generate next order ID
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM orders').get();
    const orderId = 'ORD-' + (1000 + countRow.cnt + 1);
    const now = new Date().toISOString();

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id, customer_name, phone, address, table_number, location_json,
        order_type, payment_method, payment_status, total_amount, delivery_fee,
        note, status, tg_user_json, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrder.run(
      orderId,
      customerName || 'Zomin Xaridori',
      phone || '',
      address || (orderType === 'takeaway' ? 'Olib ketish' : 'Zomin tumani'),
      tableNumber || null,
      location ? JSON.stringify(location) : null,
      orderType,
      paymentMethod,
      paymentStatus,
      totalAmount,
      deliveryFee,
      note || '',
      status,
      tgUser ? JSON.stringify(tgUser) : null,
      source,
      now,
      now
    );

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, price, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        orderId,
        item.productId || item.id || null,
        item.name,
        item.price,
        item.quantity || 1,
        item.image || ''
      );
    }

    return this.getOrderById(orderId);
  },

  updateOrderStatus(id, status, assignedStaffId = null) {
    const now = new Date().toISOString();
    let paymentStatus = null;
    if (status === 'completed') paymentStatus = 'paid';

    if (assignedStaffId !== null) {
      if (paymentStatus) {
        db.prepare('UPDATE orders SET status = ?, payment_status = ?, assigned_staff_id = ?, updated_at = ? WHERE id = ?')
          .run(status, paymentStatus, assignedStaffId, now, id);
      } else {
        db.prepare('UPDATE orders SET status = ?, assigned_staff_id = ?, updated_at = ? WHERE id = ?')
          .run(status, assignedStaffId, now, id);
      }
    } else {
      if (paymentStatus) {
        db.prepare('UPDATE orders SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?')
          .run(status, paymentStatus, now, id);
      } else {
        db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
          .run(status, now, id);
      }
    }

    return this.getOrderById(id);
  },

  // --- Restaurant Settings ---
  getRestaurantSettings() {
    const rows = db.prepare('SELECT * FROM restaurant_settings').all();
    const settings = {
      isOpen: true,
      deliveryFee: 10000,
      cardNumber: '8600 4910 2841 9012',
      cardHolder: 'ZOMIN FASTFOOD HUB (SARDOR R.)',
      phone: '+998 90 123 45 67',
      address: 'Zomin tumani, Mustaqillik shox ko\'chasi, 12-uy',
      workHours: '09:00 - 23:00',
      telegramBot: '@ZominFastFoodBot'
    };

    rows.forEach(r => {
      if (r.key === 'isOpen') settings.isOpen = r.value === 'true' || r.value === '1';
      else if (r.key === 'deliveryFee') settings.deliveryFee = Number(r.value) || 10000;
      else settings[r.key] = r.value;
    });

    return settings;
  },

  updateRestaurantSettings(newSettings) {
    const insert = db.prepare('INSERT OR REPLACE INTO restaurant_settings (key, value) VALUES (?, ?)');
    for (const [key, val] of Object.entries(newSettings)) {
      insert.run(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
    }
    return this.getRestaurantSettings();
  },

  // --- CRM Registered Customers ---
  getCustomers() {
    const orders = this.getOrders();
    const customerMap = {};

    orders.forEach(order => {
      const phone = order.phone || 'Noma\'lum';
      if (!customerMap[phone]) {
        customerMap[phone] = {
          phone,
          customerName: order.customerName,
          orderCount: 0,
          totalSpent: 0,
          lastOrderDate: order.createdAt,
          lastOrderId: order.id,
          tgUser: order.tgUser || null,
          preferredType: order.orderType
        };
      }

      customerMap[phone].orderCount += 1;
      if (order.status !== 'cancelled') {
        customerMap[phone].totalSpent += order.totalAmount;
      }
      if (new Date(order.createdAt) > new Date(customerMap[phone].lastOrderDate)) {
        customerMap[phone].lastOrderDate = order.createdAt;
        customerMap[phone].lastOrderId = order.id;
        customerMap[phone].customerName = order.customerName;
      }
    });

    return Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
  },

  // --- Reports & Financial Analytics ---
  getReports(period = 'all') {
    const orders = this.getOrders();
    const now = new Date();

    const filtered = orders.filter(o => {
      if (!o.createdAt) return true;
      const orderDate = new Date(o.createdAt);
      if (period === 'today') {
        return orderDate.toDateString() === now.toDateString();
      } else if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= weekAgo;
      } else if (period === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return orderDate >= monthAgo;
      }
      return true;
    });

    const successfulOrders = filtered.filter(o => o.status === 'completed');
    const totalRevenue = successfulOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const avgOrderValue = successfulOrders.length > 0 ? Math.round(totalRevenue / successfulOrders.length) : 0;

    const paymentMethods = { cash: 0, click: 0, payme: 0 };
    filtered.forEach(o => {
      const pm = (o.paymentMethod || 'cash').toLowerCase();
      if (paymentMethods[pm] !== undefined) paymentMethods[pm] += 1;
    });

    const productSales = {};
    filtered.forEach(o => {
      if (o.status !== 'cancelled' && Array.isArray(o.items)) {
        o.items.forEach(item => {
          if (!productSales[item.name]) {
            productSales[item.name] = { name: item.name, quantity: 0, total: 0 };
          }
          productSales[item.name].quantity += item.quantity;
          productSales[item.name].total += item.price * item.quantity;
        });
      }
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      period,
      totalOrders: filtered.length,
      successfulOrders: successfulOrders.length,
      totalRevenue,
      avgOrderValue,
      paymentMethods,
      topProducts
    };
  }
};

module.exports = databaseService;
