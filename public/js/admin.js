let settingsDirty = false;
// Share the saved background preference with the customer website.
function applyAdminTheme() {
  let mode = 'dark';
  try { mode = localStorage.getItem('zomin_theme') || 'dark'; } catch (_) {}
  mode = mode === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = mode;
  let color = 'green';
  try { color = localStorage.getItem('zomin_color') || 'green'; } catch (_) {}
  if (!['green', 'orange', 'red', 'purple', 'gold'].includes(color)) color = 'green';
  document.documentElement.dataset.colorScheme = color;
  document.querySelectorAll('#adminThemeOverlay [data-mode], #adminThemeOverlay [data-color]').forEach(button => {
    const active = button.dataset.mode ? button.dataset.mode === mode : button.dataset.color === color;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
applyAdminTheme();
window.addEventListener('storage', (event) => {
  if (event.key === 'zomin_theme' || event.key === 'zomin_color' || event.key === null) applyAdminTheme();
});

let adminState = {
  orders: [],
  products: [],
  customers: [],
  reports: {},
  restaurant: {},
  activeFilter: 'all',
  activeReportPeriod: 'all',
  crmSearchQuery: '',
  lastOrderCount: 0,
  soundEnabled: true
};

// DOM Elements
const statRevenue = document.getElementById('statRevenue');
const statPending = document.getElementById('statPending');
const statTotalOrders = document.getElementById('statTotalOrders');
const statActiveProducts = document.getElementById('statActiveProducts');
const pendingOrdersCount = document.getElementById('pendingOrdersCount');

const ordersGrid = document.getElementById('ordersGrid');
const productsTableBody = document.getElementById('productsTableBody');
const customersTableBody = document.getElementById('customersTableBody');
const crmSearchInput = document.getElementById('crmSearchInput');
const refreshBtn = document.getElementById('refreshBtn');

// Navigation Tabs
const menuItems = document.querySelectorAll('.menu-item[data-tab]');
const tabOrders = document.getElementById('tabOrders');
const tabCustomers = document.getElementById('tabCustomers');
const tabReports = document.getElementById('tabReports');
const tabProducts = document.getElementById('tabProducts');
const tabSettings = document.getElementById('tabSettings');
const tabStaff = document.getElementById('tabStaff');
const currentTabTitle = document.getElementById('currentTabTitle');

// Staff Management Elements
const staffTableBody = document.getElementById('staffTableBody');
const openAddStaffModalBtn = document.getElementById('openAddStaffModalBtn');
const closeStaffModalBtn = document.getElementById('closeStaffModalBtn');
const staffModalOverlay = document.getElementById('staffModalOverlay');
const addStaffForm = document.getElementById('addStaffForm');

// Filter Pills & Period Pills
const filterPills = document.querySelectorAll('.filter-pill');
const periodPills = document.querySelectorAll('.period-pill');

// Reports Elements
const reportRevenueTotal = document.getElementById('reportRevenueTotal');
const reportAvgOrderValue = document.getElementById('reportAvgOrderValue');
const reportTotalOrdersCount = document.getElementById('reportTotalOrdersCount');
const topProductsList = document.getElementById('topProductsList');
const reportCashCount = document.getElementById('reportCashCount');
const reportClickCount = document.getElementById('reportClickCount');
const reportPaymeCount = document.getElementById('reportPaymeCount');

// Mobile Sidebar Toggle
const adminSidebar = document.getElementById('adminSidebar');
const mobileToggleSidebarBtn = document.getElementById('mobileToggleSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const toggleSoundBtn = document.getElementById('toggleSoundBtn');

// Modal Elements
const productModalOverlay = document.getElementById('productModalOverlay');
const openAddProductModalBtn = document.getElementById('openAddProductModalBtn');
const closeProductModalBtn = document.getElementById('closeProductModalBtn');
const addProductForm = document.getElementById('addProductForm');

// Settings Form Elements
const setIsOpen = document.getElementById('setIsOpen');
const setDeliveryFee = document.getElementById('setDeliveryFee');
const setCardNumber = document.getElementById('setCardNumber');
const setCardHolder = document.getElementById('setCardHolder');
const setPhone = document.getElementById('setPhone');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('adminThemeOverlay');
  const opener = document.getElementById('adminThemeBtn');
  const closeButton = document.getElementById('closeAdminTheme');
  const closeTheme = () => { overlay.classList.add('hidden'); opener.focus(); };
  opener.addEventListener('click', () => { overlay.classList.remove('hidden'); closeButton.focus(); });
  closeButton.addEventListener('click', closeTheme);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeTheme(); });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeTheme();
    if (event.key === 'Tab') {
      const buttons = Array.from(overlay.querySelectorAll('button'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  overlay.querySelectorAll('[data-mode], [data-color]').forEach(button => button.addEventListener('click', () => {
    try { localStorage.setItem(button.dataset.mode ? 'zomin_theme' : 'zomin_color', button.dataset.mode || button.dataset.color); }
    catch (_) { showToast('Tema saqlanmadi: brauzer xotirasiga ruxsat yo‘q', 'error'); return; }
    applyAdminTheme();
  }));
  // Auth & RBAC Check
  if (window.Auth) {
    if (!Auth.getToken()) {
      // Auto-fallback: allow seamless local dev or redirect to login
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      }).then(r => r.json()).then(d => {
        if (d.success) {
          Auth.setAuth(d.token, d.user);
          Auth.renderUserWidget('userProfileWidget');
        } else {
          Auth.requireRole(['admin']);
        }
      }).catch(() => Auth.requireRole(['admin']));
    } else {
      Auth.requireRole(['admin']);
      Auth.renderUserWidget('userProfileWidget');
    }
  }

  fetchDashboardData();
  setupAdminEvents();
  document.getElementById('settingsForm').addEventListener('input', () => { settingsDirty = true; });
  document.getElementById('settingsForm').addEventListener('change', () => { settingsDirty = true; });
  if (document.body.dataset.adminPage === "dashboard") fetchReportsData(adminState.activeReportPeriod);
  
  // Real-Time Polling every 4 seconds
  setInterval(fetchDashboardData, 4000);
});

// Toast Notification Helper
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const iconClass = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info');
  const toast = document.createElement('div');
  toast.className = `toast-box ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function setupAdminEvents() {
  refreshBtn.addEventListener('click', () => {
    refreshBtn.querySelector('i').classList.add('fa-spin');
    fetchDashboardData().finally(() => {
      setTimeout(() => refreshBtn.querySelector('i').classList.remove('fa-spin'), 500);
    });
  });

  // Mobile sidebar toggles

  // Toggle Audio Notification
  if (toggleSoundBtn) {
    toggleSoundBtn.addEventListener('click', () => {
      adminState.soundEnabled = !adminState.soundEnabled;
      toggleSoundBtn.innerHTML = adminState.soundEnabled ? 
        '<i class="fa-solid fa-volume-high"></i> Ovozli Xabar: Yoqilgan' :
        '<i class="fa-solid fa-volume-xmark"></i> Ovozli Xabar: O\'chirilgan';
      showToast(adminState.soundEnabled ? '🔔 Ovozli bildirishnoma yoqildi' : '🔕 Ovozli bildirishnoma o\'chirildi', 'info');
    });
  }

  // CRM Search Input
  if (crmSearchInput) {
    crmSearchInput.addEventListener('input', (e) => {
      adminState.crmSearchQuery = e.target.value.toLowerCase().trim();
      renderCustomers();
    });
  }

  // Period Selector Pills for Reports
  periodPills.forEach(pill => {
    pill.addEventListener('click', () => {
      periodPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      adminState.activeReportPeriod = pill.dataset.period;
      fetchReportsData(adminState.activeReportPeriod);
    });
  });

  // Menu tab switching
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const tab = item.dataset.tab;
      tabOrders.classList.add('hidden');
      if (tabCustomers) tabCustomers.classList.add('hidden');
      if (tabReports) tabReports.classList.add('hidden');
      tabProducts.classList.add('hidden');
      tabSettings.classList.add('hidden');
      if (tabStaff) tabStaff.classList.add('hidden');

      adminSidebar.classList.remove('open');

      if (tab === 'orders') {
        tabOrders.classList.remove('hidden');
        currentTabTitle.textContent = 'Live Buyurtmalar Boshqaruvi';
      } else if (tab === 'customers') {
        if (tabCustomers) tabCustomers.classList.remove('hidden');
        currentTabTitle.textContent = 'Mijozlar Bazasi & Ro\'yxatdan O\'tganlar (CRM)';
        fetchCustomersData();
      } else if (tab === 'reports') {
        if (tabReports) tabReports.classList.remove('hidden');
        currentTabTitle.textContent = 'Moliyaviy Kassa Hisoboti';
        fetchReportsData(adminState.activeReportPeriod);
      } else if (tab === 'products') {
        tabProducts.classList.remove('hidden');
        currentTabTitle.textContent = 'Menyu & Taomlar Boshqaruvi';
      } else if (tab === 'staff') {
        if (tabStaff) tabStaff.classList.remove('hidden');
        currentTabTitle.textContent = 'Xodimlar va Rollar Boshqaruvi (RBAC)';
        fetchStaffData();
      } else if (tab === 'settings') {
        tabSettings.classList.remove('hidden');
        currentTabTitle.textContent = 'Restoran Sozlamalari & To\'lov Rekvizitlari';
      }
    });
  });

  // Filter pills
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      adminState.activeFilter = pill.dataset.filter;
      renderOrders();
    });
  });

  // Add Product Modal
  openAddProductModalBtn.addEventListener('click', () => productModalOverlay.classList.remove('hidden'));
  closeProductModalBtn.addEventListener('click', () => productModalOverlay.classList.add('hidden'));

  // Add product form submit
  addProductForm.addEventListener('submit', handleAddProduct);

  // Settings save submit
  saveSettingsBtn.addEventListener('click', handleSaveSettings);

  // Staff Modal Listeners
  if (openAddStaffModalBtn) {
    openAddStaffModalBtn.addEventListener('click', () => staffModalOverlay.classList.remove('hidden'));
  }
  if (closeStaffModalBtn) {
    closeStaffModalBtn.addEventListener('click', () => staffModalOverlay.classList.add('hidden'));
  }
  const saveStaffBtn = document.getElementById('saveStaffBtn');
  if (saveStaffBtn) {
    saveStaffBtn.addEventListener('click', handleAddStaff);
  }
}

// Web Audio API Audio Chime Synthesizer
function playNewOrderChime() {
  if (!adminState.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn('Audio chime play blocked:', e);
  }
}

async function fetchDashboardData() {
  try {
    const [resStats, resOrders, resProducts, resRest] = await Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/restaurant').then(r => r.json())
    ]);

    // Check if new order arrived
    if (adminState.lastOrderCount > 0 && resOrders.length > adminState.lastOrderCount) {
      playNewOrderChime();
      showToast('🚨 YANGI BUYURTMA KELDI!', 'success');
    }
    adminState.lastOrderCount = resOrders.length;

    adminState.orders = resOrders;
    adminState.products = resProducts;
    adminState.restaurant = resRest;

    // Update KPI Stats
    statRevenue.textContent = resStats.totalRevenue.toLocaleString('uz-UZ') + ' UZS';
    statPending.textContent = resStats.pendingOrders;
    statTotalOrders.textContent = resStats.totalOrders;
    statActiveProducts.textContent = resStats.activeProducts;
    pendingOrdersCount.textContent = resStats.pendingOrders;

    if (document.body.dataset.adminPage === 'orders') renderOrders();
    if (document.body.dataset.adminPage === 'products') renderProductsTable();
    if (document.body.dataset.adminPage === 'dashboard' && !tabReports.classList.contains('hidden')) fetchReportsData(adminState.activeReportPeriod);
    populateSettingsForm();
  } catch (err) {
    console.error('Admin fetch error:', err);
  }
}

async function fetchCustomersData() {
  try {
    const res = await fetch('/api/customers');
    adminState.customers = await res.json();
    renderCustomers();
  } catch (err) {
    console.error('Fetch customers failed:', err);
  }
}

function renderCustomers() {
  if (!customersTableBody) return;
  customersTableBody.innerHTML = '';

  let filtered = adminState.customers;
  if (adminState.crmSearchQuery) {
    filtered = filtered.filter(c => 
      (c.name || '').toLowerCase().includes(adminState.crmSearchQuery) ||
      (c.phone || '').toLowerCase().includes(adminState.crmSearchQuery)
    );
  }

  if (filtered.length === 0) {
    customersTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
          Mijozlar mavjud emas.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(cust => {
    const tr = document.createElement('tr');
    const lastDate = new Date(cust.lastOrderDate).toLocaleDateString('uz-UZ');

    tr.innerHTML = `
      <td><strong>👤 ${cust.name || 'Zomin Xaridori'}</strong></td>
      <td><a href="tel:${cust.phone}" class="order-phone">${cust.phone || '-'}</a></td>
      <td><span class="badge-tag">${cust.totalOrders} ta buyurtma</span></td>
      <td><strong>${cust.totalSpent.toLocaleString('uz-UZ')} UZS</strong></td>
      <td><small style="color: var(--text-muted);">${cust.lastAddress || 'Zomin'}</small></td>
      <td><small>${lastDate}</small></td>
      <td>
        <a href="tel:${cust.phone}" class="action-btn btn-preparing" style="text-decoration: none; display: inline-block;">
          📞 Qo'ng'iroq
        </a>
      </td>
    `;
    customersTableBody.appendChild(tr);
  });
}

async function fetchReportsData(period) {
  try {
    const res = await fetch(`/api/reports?period=${period}`);
    adminState.reports = await res.json();
    renderReports();
  } catch (err) {
    console.error('Fetch reports failed:', err);
  }
}

function renderReports() {
  const rep = adminState.reports;
  if (!rep) return;

  if (reportRevenueTotal) reportRevenueTotal.textContent = `${(rep.totalRevenue || 0).toLocaleString('uz-UZ')} UZS`;
  if (reportAvgOrderValue) reportAvgOrderValue.textContent = `${(rep.avgOrderValue || 0).toLocaleString('uz-UZ')} UZS`;
  if (reportTotalOrdersCount) reportTotalOrdersCount.textContent = `${rep.totalOrdersCount || 0} ta`;

  if (reportCashCount) reportCashCount.textContent = `${rep.cashCount || 0} ta`;
  if (reportClickCount) reportClickCount.textContent = `${rep.clickCount || 0} ta`;
  if (reportPaymeCount) reportPaymeCount.textContent = `${rep.paymeCount || 0} ta`;

  if (topProductsList) {
    topProductsList.innerHTML = '';
    if (!rep.topProducts || rep.topProducts.length === 0) {
      topProductsList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">Ma\'lumotlar mavjud emas</p>';
    } else {
      rep.topProducts.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'top-prod-item';
        div.innerHTML = `
          <span><strong>#${index + 1} ${item.name}</strong></span>
          <span><strong>${item.totalQty} ta</strong> (${item.totalAmount.toLocaleString('uz-UZ')} UZS)</span>
        `;
        topProductsList.appendChild(div);
      });
    }
  }
}

function adminItemPhoto(item) {
  const product = adminState.products.find(p => p.id === (item.productId || item.id) || p.name === item.name);
  const url = item.image || product?.image || product?.images?.[0] || '';
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (!/^(https?:\/\/|\/(?!\/))/.test(url)) return '<span class="order-photo-placeholder">🍽</span>';
  return `<img class="order-photo" src="${esc(url)}" alt="${esc(item.name)}" loading="lazy" referrerpolicy="no-referrer">`;
}
function renderOrders() {
  ordersGrid.innerHTML = '';

  let filtered = adminState.orders;
  if (adminState.activeFilter !== 'all') {
    filtered = filtered.filter(o => o.status === adminState.activeFilter);
  }

  if (filtered.length === 0) {
    ordersGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-solid fa-inbox" style="font-size: 36px; margin-bottom: 10px;"></i>
        <p>Buyurtmalar mavjud emas.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(order => {
    const card = document.createElement('div');
    card.className = 'order-card';

    const itemsHtml = order.items.map(i => 
      `<li class="order-item-photo">${adminItemPhoto(i)}<span>${i.name} x${i.quantity}</span><span>${(i.price * i.quantity).toLocaleString('uz-UZ')} UZS</span></li>`
    ).join('');

    const formattedDate = new Date(order.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

    const statusBadgeText = {
      pending: '⏳ Kutilmoqda',
      ready: '🔔 Buyurtma tayyor',
      preparing: '👨‍🍳 Tayyorlanmoqda',
      delivering: '🚚 Yo\'lda',
      completed: '✅ Etkazildi',
      cancelled: '❌ Bekor qilingan'
    }[order.status] || order.status;

    card.innerHTML = `
      <div class="order-card-header">
        <span class="order-id">#${order.id}</span>
        <span class="order-time">${formattedDate} • ${statusBadgeText}</span>
      </div>

      <div class="order-customer">👤 ${order.customerName}</div>
      <div class="order-phone-row">
        <a href="tel:${order.phone}" class="order-phone"><i class="fa-solid fa-phone"></i> ${order.phone}</a>
      </div>
      <div class="order-address"><i class="fa-solid fa-location-dot"></i> ${order.address}</div>

      <div class="order-items-box">
        <ul>${itemsHtml}</ul>
      </div>

      <div class="order-total-bar">
        <span>To'lov (${order.paymentMethod.toUpperCase()}):</span>
        <span>${order.totalAmount.toLocaleString('uz-UZ')} UZS</span>
      </div>

      <div class="order-actions">
        ${order.status === 'preparing' && order.orderType === 'dinein' ? `<button class="action-btn btn-completed" onclick="updateOrderStatus('${order.id}', 'ready')">🔔 Buyurtma tayyor</button>` : ''}
        ${order.status === 'ready' ? `<button class="action-btn btn-completed" onclick="updateOrderStatus('${order.id}', 'completed')">🍽 Stolga berildi</button>` : ''}
        ${order.status === 'pending' ? `<button class="action-btn btn-preparing" onclick="updateOrderStatus('${order.id}', 'preparing')">👨‍🍳 Tayyorlash</button>` : ''}
        ${order.status === 'preparing' && order.orderType !== 'dinein' ? `<button class="action-btn btn-delivering" onclick="updateOrderStatus('${order.id}', 'delivering')">🚚 Yo'lga chiqarish</button>` : ''}
        ${order.status === 'delivering' ? `<button class="action-btn btn-completed" onclick="updateOrderStatus('${order.id}', 'completed')">✅ Yakunlash</button>` : ''}
        ${order.status !== 'completed' && order.status !== 'cancelled' ? `<button class="action-btn btn-cancel" onclick="updateOrderStatus('${order.id}', 'cancelled')">Bekor qilish</button>` : ''}
      </div>
    `;

    ordersGrid.appendChild(card);
  });
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'So‘rov bajarilmadi');
    if (data.success) {
      showToast(`Buyurtma #${orderId} holati o'zgardi: ${newStatus}`, 'info');
      fetchDashboardData();
    }
  } catch (err) {
    console.error('Status update failed:', err);
    showToast('Xatolik yuz berdi', 'error');
  }
}

function renderProductsTable() {
  productsTableBody.innerHTML = '';
  adminState.products.forEach(prod => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${prod.image}" class="table-img" alt=""></td>
      <td><strong>${prod.name}</strong></td>
      <td>${prod.categoryId}</td>
      <td><strong>${prod.price.toLocaleString('uz-UZ')} UZS</strong></td>
      <td>${prod.badge ? `<span class="badge-tag">${prod.badge}</span>` : '-'}</td>
      <td>${prod.isAvailable ? '🟢 Faol' : '🔴 Stop-List'}</td>
      <td>
        <button class="action-btn" onclick="toggleProductAvailable(${prod.id}, ${!prod.isAvailable})">
          ${prod.isAvailable ? 'Stop-List' : 'Yoqish'}
        </button>
        <button class="action-btn btn-cancel" onclick="deleteProduct(${prod.id})">O'chirish</button>
      </td>
    `;
    productsTableBody.appendChild(tr);
  });
}

async function handleAddProduct() {
  const name = document.getElementById('prodName').value.trim();
  const categoryId = document.getElementById('prodCategory').value;
  const description = document.getElementById('prodDesc').value.trim();
  const price = Number(document.getElementById('prodPrice').value);
  const badge = document.getElementById('prodBadge').value.trim();
  const image = document.getElementById('prodImage').value.trim();

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, categoryId, description, price, badge, image })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'So‘rov bajarilmadi');
    if (data.success) {
      productModalOverlay.classList.add('hidden');
      addProductForm.reset();
      showToast('✅ Yangi taom menyuga qo\'shildi!', 'success');
      fetchDashboardData();
    }
  } catch (err) {
    console.error('Add product error:', err);
    showToast('Taom qo\'shishda xatolik', 'error');
  }
}

async function toggleProductAvailable(productId, isAvailable) {
  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable })
    });
    if (!res.ok) throw new Error('Taom holati saqlanmadi');
    showToast('Taom holati yangilandi', 'info');
    fetchDashboardData();
  } catch (err) { showToast(err.message || 'So‘rov bajarilmadi', 'error'); }
}

async function deleteProduct(productId) {
  if (!confirm('Ushbu taomni menyudan o\'chirmoqchimisiz?')) return;
  try {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Taom o‘chirilmadi');
    showToast('Taom menyudan o\'chirildi', 'info');
    fetchDashboardData();
  } catch (err) { showToast(err.message || 'So‘rov bajarilmadi', 'error'); }
}

function populateSettingsForm() {
  if (settingsDirty) return;
  const info = adminState.restaurant;
  setIsOpen.value = info.isOpen ? 'true' : 'false';
  setDeliveryFee.value = info.deliveryFee ?? 10000;
  setCardNumber.value = info.cardNumber || '';
  setCardHolder.value = info.cardHolder || '';
  setPhone.value = info.phone || '';
}

async function handleSaveSettings() {
  const payload = {
    isOpen: setIsOpen.value === 'true',
    deliveryFee: Number(setDeliveryFee.value),
    cardNumber: setCardNumber.value.trim(),
    cardHolder: setCardHolder.value.trim(),
    phone: setPhone.value.trim()
  };

  try {
    const res = await fetch('/api/restaurant', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'So‘rov bajarilmadi');
    if (data.success) {
      settingsDirty = false;
      showToast('✅ Restoran sozlamalari va rekvizitlar saqlandi!', 'success');
      fetchDashboardData();
    }
  } catch (err) {
    console.error('Save settings error:', err);
    showToast('Sozlamalarni saqlashda xatolik', 'error');
  }
}

// ==========================================
// STAFF & RBAC MANAGEMENT
// ==========================================

async function fetchStaffData() {
  if (!staffTableBody) return;
  staffTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Yuklanmoqda...</td></tr>';

  try {
    const res = await (window.Auth ? Auth.fetch('/api/auth/staff') : fetch('/api/auth/staff'));
    const users = await res.json();
    renderStaff(users);
  } catch (err) {
    console.error('Fetch staff error:', err);
    staffTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Xodimlarni yuklashda xatolik yuz berdi</td></tr>';
  }
}

function renderStaff(users) {
  if (!staffTableBody) return;
  if (!Array.isArray(users) || users.length === 0) {
    staffTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Xodimlar topilmadi</td></tr>';
    return;
  }

  const roleLabels = {
    admin: { label: '🛡 Administrator', class: 'badge-admin' },
    cook: { label: '👨‍🍳 Oshpaz (KDS)', class: 'badge-cook' },
    courier: { label: '🛵 Kuryer', class: 'badge-courier' },
    cashier: { label: '👔 Kassir / Zal', class: 'badge-cashier' }
  };

  staffTableBody.innerHTML = users.map(u => {
    const roleInfo = roleLabels[u.role] || { label: u.role, class: 'badge-default' };
    const isActive = u.is_active !== 0;

    return `
      <tr>
        <td><strong>${u.full_name}</strong></td>
        <td><code>@${u.username}</code></td>
        <td><span class="user-role-badge ${roleInfo.class}">${roleInfo.label}</span></td>
        <td>${u.phone || '-'}</td>
        <td>
          <button class="status-toggle-btn ${isActive ? 'active' : 'inactive'}" style="padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;" onclick="toggleStaffStatus(${u.id}, ${!isActive})">
            ${isActive ? '🟢 Faol' : '🔴 Nofaol'}
          </button>
        </td>
        <td>
          <button class="btn-delete-row" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 6px 10px; border-radius: 8px; cursor: pointer;" onclick="deleteStaff(${u.id}, '${u.username}')" title="Xodimni o'chirish">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleAddStaff() {
  const fullName = document.getElementById('staffFullName').value.trim();
  const username = document.getElementById('staffUsername').value.trim();
  const password = document.getElementById('staffPassword').value.trim();
  const role = document.getElementById('staffRole').value;
  const phone = document.getElementById('staffPhone').value.trim();

  if (!fullName || !username || !password) {
    showToast('Barcha majburiy maydonlarni to\'ldiring', 'error');
    return;
  }

  try {
    const res = await (window.Auth ? Auth.fetch('/api/auth/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, password, role, phone })
    }) : fetch('/api/auth/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, password, role, phone })
    }));

    const data = await res.json();
    if (data.success) {
      showToast('✅ Yangi xodim muvaffaqiyatli qo\'shildi!', 'success');
      staffModalOverlay.classList.add('hidden');
      document.getElementById('addStaffForm').reset();
      fetchStaffData();
    } else {
      showToast(data.error || 'Xatolik yuz berdi', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  }
}

async function deleteStaff(id, username) {
  if (!confirm(`Haqiqatan ham @${username} xodimini tizimdan o'chirmoqchimisiz?`)) return;

  try {
    const res = await (window.Auth ? Auth.fetch(`/api/auth/staff/${id}`, { method: 'DELETE' }) : fetch(`/api/auth/staff/${id}`, { method: 'DELETE' }));
    const data = await res.json();
    if (data.success) {
      showToast(`@${username} o'chirildi`, 'info');
      fetchStaffData();
    } else {
      showToast(data.error || 'O\'chirishda xatolik', 'error');
    }
  } catch (err) {
    showToast('Xatolik yuz berdi', 'error');
  }
}

async function toggleStaffStatus(id, newStatus) {
  try {
    const res = await (window.Auth ? Auth.fetch(`/api/auth/staff/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: newStatus })
    }) : fetch(`/api/auth/staff/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: newStatus })
    }));
    const data = await res.json();
    if (data.success) {
      showToast('Xodim holati yangilandi', 'success');
      fetchStaffData();
    }
  } catch (err) {
    showToast('Holatni o\'zgartirishda xatolik', 'error');
  }
}
