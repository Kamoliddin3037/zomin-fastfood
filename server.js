const express = require('express');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const dbService = require('./db/database.js');
const { signToken, authMiddleware, requireAuth, requireRole } = require('./auth/auth.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

// Disable static caching during development so changes appear immediately
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

// Cloud & Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'zomin-fastfood-api',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: 'sqlite-connected'
  });
});

// ==========================================
// TELEGRAM BOT SETUP
// ==========================================
const BOT_TOKEN = process.env.BOT_TOKEN || '';
let bot = null;

if (BOT_TOKEN) {
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('🤖 Telegram Bot is running...');

    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const firstName = msg.from.first_name || 'Hurmatli xaridor';

      const welcomeText = `👋 Assalomu alaykum, <b>${firstName}</b>!\n\n` +
        `🍔 <b>Zomin FastFood Hub</b> rasmiy botiga xush kelibsiz!\n\n` +
        `Bu yerdan siz Zomin bo'yicha eng mazzali tandir lavash, shinam burger va pitssalarni tezkor etkazib berish bilan buyurtma qilishingiz mumkin. ✨\n\n` +
        `👇 <i>Menyuni ochish va buyurtma berish uchun quyidagi tugmani bosing:</i>`;

      const webAppUrl = process.env.WEB_APP_URL || `http://localhost:${PORT}`;

      bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🍔 Menyuni ochish / Buyurtma berish', web_app: { url: webAppUrl } }],
            [{ text: '📞 Biz bilan bog\'lanish', callback_data: 'contact_info' }]
          ]
        }
      });
    });

    bot.on('callback_query', (query) => {
      if (query.data === 'contact_info') {
        const info = dbService.getRestaurantSettings();
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(query.message.chat.id, 
          `📞 <b>Telefon:</b> ${info.phone || '+998 90 123 45 67'}\n` +
          `📍 <b>Manzil:</b> ${info.address || 'Zomin tumani'}\n` +
          `⏰ <b>Ish vaqti:</b> ${info.workHours || '09:00 - 23:00'}`,
          { parse_mode: 'HTML' }
        );
      } else if (query.data.startsWith('status_')) {
        const parts = query.data.split('_');
        const orderId = parts[1];
        const newStatus = parts[2];

        const updated = dbService.updateOrderStatus(orderId, newStatus);
        if (updated) {
          const statusLabels = {
            pending: '⏳ Kutilmoqda',
            preparing: '👨‍🍳 Tayyorlanmoqda',
            ready: '🔔 Buyurtma tayyor',
            delivering: '🚚 Yo\'lda',
            completed: '✅ Etkazildi',
            cancelled: '❌ Bekor qilindi'
          };

          bot.answerCallbackQuery(query.id, { text: `Status o'zgardi: ${statusLabels[newStatus] || newStatus}` });
          bot.editMessageText(query.message.text + `\n\n<b>Yangi holat:</b> ${statusLabels[newStatus] || newStatus}`, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
          });
        }
      }
    });

  } catch (err) {
    console.error('Telegram Bot init error:', err.message);
  }
} else {
  console.log('⚠️ BOT_TOKEN topilmadi. Telegram Bot sinov rejimida ishlamoqda.');
}

// Function to notify Telegram Admin Group / Chat
function notifyAdminNewOrder(order) {
  const adminChatId = process.env.ADMIN_CHAT_ID;
  if (!bot || !adminChatId) return;

  const itemsList = order.items.map(i => `• ${i.name} x${i.quantity} - ${(i.price * i.quantity).toLocaleString('uz-UZ')} UZS`).join('\n');
  const typeText = order.orderType === 'dinein' ? '🍽 Zal • Stol ' + order.tableNumber : order.orderType === 'delivery' ? '🚚 Etkazib berish' : '🛍 Olib ketish';
  const payText = (order.paymentMethod || 'CASH').toUpperCase();

  const text = `🚨 <b>YANGI BUYURTMA! #${order.id}</b>\n\n` +
    `👤 <b>Mijoz:</b> ${order.customerName}\n` +
    `📞 <b>Tel:</b> ${order.phone}\n` +
    `📍 <b>Manzil:</b> ${order.address}\n` +
    `📦 <b>Turi:</b> ${typeText}\n` +
    `💳 <b>To'lov:</b> ${payText}\n\n` +
    `🛒 <b>Tarkibi:</b>\n${itemsList}\n\n` +
    `💰 <b>Jami summa:</b> <b>${order.totalAmount.toLocaleString('uz-UZ')} UZS</b>\n` +
    (order.note ? `📝 <b>Izoh:</b> <i>${order.note}</i>\n` : '');

  bot.sendMessage(adminChatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👨‍🍳 Tayyorlash', callback_data: `status_${order.id}_preparing` },
          { text: '🔔 Tayyor bo\'ldi', callback_data: `status_${order.id}_ready` }
        ],
        [
          { text: '🚚 Yo\'lga chiqarish', callback_data: `status_${order.id}_delivering` },
          { text: '✅ Topshirildi', callback_data: `status_${order.id}_completed` }
        ]
      ]
    }
  });
}

// ==========================================
// AUTHENTICATION & RBAC ROUTES
// ==========================================

// Login with username & password
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Foydalanuvchi nomi va parol kiritilishi shart' });
  }

  const user = dbService.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol noto\'g\'ri' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Ushbu profil ma\'muriyat tomonidan bloklangan' });
  }

  const isMatch = dbService.verifyPassword(password, user.salt, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol noto\'g\'ri' });
  }

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
    phone: user.phone
  });

  res.cookie('zomin_token', token, {
    httpOnly: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      phone: user.phone
    }
  });
});

// Check current session
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }
  res.json({
    authenticated: true,
    user: req.user
  });
});

// Staff Management (Admin only)
app.get('/api/auth/staff', requireRole(['admin']), (req, res) => {
  const users = dbService.getUsers();
  res.json(users);
});

app.post('/api/auth/staff', requireRole(['admin']), (req, res) => {
  const { username, password, role, full_name, phone } = req.body;
  if (!username || !password || !role || !full_name) {
    return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' });
  }

  if (!['admin', 'cook', 'courier', 'cashier'].includes(role)) {
    return res.status(400).json({ error: 'Noto\'g\'ri rol tanlandi' });
  }

  const existing = dbService.getUserByUsername(username);
  if (existing) {
    return res.status(400).json({ error: 'Bunday foydalanuvchi nomi allaqachon mavjud' });
  }

  try {
    const newUser = dbService.createUser({ username, password, role, full_name, phone });
    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ error: 'Xodim qo\'shishda xatolik yuz berdi' });
  }
});

app.delete('/api/auth/staff/:id', requireRole(['admin']), (req, res) => {
  const id = Number(req.params.id);
  if (req.user.id === id) {
    return res.status(400).json({ error: 'O\'zingizning profilingizni o\'chira olmaysiz' });
  }
  dbService.deleteUser(id);
  res.json({ success: true });
});

app.put('/api/auth/staff/:id/status', requireRole(['admin']), (req, res) => {
  const id = Number(req.params.id);
  const { isActive } = req.body;
  const updated = dbService.updateUserStatus(id, isActive);
  res.json({ success: true, user: updated });
});

// ==========================================
// RESTAURANT SETTINGS & REQUISITES
// ==========================================
app.get('/api/restaurant', (req, res) => {
  const settings = dbService.getRestaurantSettings();
  res.json(settings);
});

app.post('/api/restaurant', requireRole(['admin']), (req, res) => {
  const updated = dbService.updateRestaurantSettings(req.body);
  res.json({ success: true, restaurant: updated });
});

// ==========================================
// FOOD CATEGORIES & PRODUCTS
// ==========================================
app.get('/api/categories', (req, res) => {
  const categories = dbService.getCategories();
  res.json(categories);
});

app.get('/api/products', (req, res) => {
  const products = dbService.getProducts(req.query.category);
  res.json(products);
});

app.post('/api/products', requireRole(['admin']), (req, res) => {
  const { categoryId, name, description, price, image, images, isAvailable, badge } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'Nomi va narxi kiritilishi shart' });
  }

  const newProduct = dbService.createProduct({
    categoryId,
    name,
    description,
    price,
    image,
    images,
    isAvailable,
    badge
  });

  res.status(201).json({ success: true, product: newProduct });
});

app.put('/api/products/:id', requireRole(['admin']), (req, res) => {
  const id = Number(req.params.id);
  const updated = dbService.updateProduct(id, req.body);
  if (updated) {
    res.json({ success: true, product: updated });
  } else {
    res.status(404).json({ error: 'Mahsulot topilmadi' });
  }
});

app.delete('/api/products/:id', requireRole(['admin']), (req, res) => {
  const id = Number(req.params.id);
  dbService.deleteProduct(id);
  res.json({ success: true });
});

// ==========================================
// ORDERS MANAGEMENT
// ==========================================

// Hall / Waiter orders
app.post('/api/waiter/orders', (req, res) => {
  const tableNumber = Number(req.body.tableNumber);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 999) {
    return res.status(400).json({ error: 'Stol raqami 1–999 oralig\'ida bo‘lishi kerak' });
  }
  if (!Array.isArray(req.body.items) || !req.body.items.length) {
    return res.status(400).json({ error: 'Savat bo‘sh' });
  }

  const items = [];
  for (const item of req.body.items) {
    const product = dbService.getProductById(Number(item.productId));
    if (!product || !product.isAvailable) {
      return res.status(400).json({ error: 'Taom menyuda mavjud emas' });
    }
    items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image || product.images?.[0] || '',
      quantity: Math.min(99, Math.max(1, Number(item.quantity) || 1))
    });
  }

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = dbService.createOrder({
    customerName: 'Stol ' + tableNumber,
    phone: '',
    address: 'Zal • Stol ' + tableNumber,
    tableNumber,
    location: null,
    items,
    orderType: 'dinein',
    paymentMethod: 'cash',
    deliveryFee: 0,
    totalAmount,
    note: String(req.body.note || '').slice(0, 1000),
    status: 'pending',
    source: 'waiter'
  });

  notifyAdminNewOrder(order);
  res.status(201).json({ success: true, order });
});

// Customer Web / Telegram orders
app.get('/api/orders', (req, res) => {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.source) filters.source = req.query.source;
  if (req.query.orderType) filters.orderType = req.query.orderType;

  const orders = dbService.getOrders(filters);
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const { customerName, phone, address, location, items, orderType, paymentMethod, note, tgUser } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Savat bo\'sh' });
  }

  const restaurantSettings = dbService.getRestaurantSettings();
  const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = orderType === 'delivery' ? (restaurantSettings.deliveryFee || 10000) : 0;
  const totalAmount = itemsTotal + deliveryFee;

  const newOrder = dbService.createOrder({
    customerName: customerName || 'Zomin Xaridori',
    phone: phone || '+998 90 123 45 67',
    address: address || (orderType === 'takeaway' ? 'Olib ketish' : 'Zomin markazi'),
    location: location || null,
    items,
    orderType: orderType || 'delivery',
    paymentMethod: paymentMethod || 'cash',
    paymentStatus: 'pending',
    totalAmount,
    deliveryFee,
    note: note || '',
    status: 'pending',
    tgUser: tgUser || null,
    source: 'web'
  });

  notifyAdminNewOrder(newOrder);
  res.json({ success: true, order: newOrder });
});

app.get('/api/orders/:id', (req, res) => {
  const id = (req.params.id || '').trim();
  const order = dbService.getOrderById(id);
  if (order) {
    res.json({ success: true, order });
  } else {
    res.status(404).json({ error: 'Buyurtma topilmadi' });
  }
});

// Update order status (with optional assigned staff)
app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, assignedStaffId } = req.body;
  const validStatuses = ['pending', 'preparing', 'ready', 'delivering', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Holat noto‘g‘ri' });
  }

  const staffId = assignedStaffId || (req.user ? req.user.id : null);
  const order = dbService.updateOrderStatus(id, status, staffId);
  if (order) {
    res.json({ success: true, order });
  } else {
    res.status(404).json({ error: 'Buyurtma topilmadi' });
  }
});

// ==========================================
// CRM & CUSTOMERS
// ==========================================
app.get('/api/customers', requireRole(['admin']), (req, res) => {
  const customers = dbService.getCustomers();
  res.json(customers);
});

// ==========================================
// FINANCIAL REPORTS & KPI
// ==========================================
app.get('/api/reports', requireRole(['admin']), (req, res) => {
  const period = req.query.period || 'all';
  const reports = dbService.getReports(period);
  res.json(reports);
});

app.get('/api/reports/export', requireRole(['admin']), (req, res) => {
  const orders = dbService.getOrders();

  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += "Buyurtma ID,Mijoz Ismi,Telefon,Manzil,Buyurtma Turi,To'lov Usuli,Summa (UZS),Holati,Sana\n";

  orders.forEach(o => {
    const formattedDate = new Date(o.createdAt).toLocaleString('uz-UZ');
    const typeLabel = o.orderType === 'dinein' ? 'Zal • Stol ' + o.tableNumber : o.orderType === 'delivery' ? 'Etkazib berish' : 'Olib ketish';
    const statusLabel = o.status.toUpperCase();
    const nameClean = (o.customerName || '').replace(/,/g, ' ');
    const addressClean = (o.address || '').replace(/,/g, ' ');

    csvContent += `"${o.id}","${nameClean}","${o.phone}","${addressClean}","${typeLabel}","${(o.paymentMethod || 'cash').toUpperCase()}","${o.totalAmount}","${statusLabel}","${formattedDate}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="zomin_fastfood_hisobot.csv"');
  res.status(200).send(csvContent);
});

app.get('/api/stats', (req, res) => {
  const orders = dbService.getOrders();
  const products = dbService.getProducts();

  const totalRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  const totalOrders = orders.length;
  const activeProducts = products.filter(p => p.isAvailable).length;

  res.json({
    totalRevenue,
    pendingOrders,
    totalOrders,
    activeProducts
  });
});

// Graceful Shutdown for Cloud Containers (SIGTERM / SIGINT)
function shutdown(signal) {
  console.log(`\n🛑 Qabul qilingan signal: ${signal}. Server to'xtatilmoqda...`);
  if (bot && typeof bot.stopPolling === 'function') {
    bot.stopPolling();
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Zomin FastFood Hub SQLite + RBAC server is running at http://localhost:${PORT}`);
});
