// State Management
let state = {
  categories: [],
  products: [],
  activeCategory: 'all',
  searchQuery: '',
  cart: [],
  orderType: 'delivery',
  deliveryFee: 10000,
  tgUser: null,
  activeOrder: null,
  restaurantInfo: {},
  productImageIndices: {},
  themeMode: localStorage.getItem('zomin_theme') || 'light',
  colorScheme: localStorage.getItem('zomin_color') || 'green'
};

// DOM Elements
const categoriesContainer = document.getElementById('categoriesContainer');
const foodGrid = document.getElementById('foodGrid');
const currentCategoryTitle = document.getElementById('currentCategoryTitle');
const itemsCount = document.getElementById('itemsCount');

// Search Elements
const openSearchBtn = document.getElementById('openSearchBtn');
const closeSearchBtn = document.getElementById('closeSearchBtn');
const searchBarWrapper = document.getElementById('searchBarWrapper');
const searchInput = document.getElementById('searchInput');

// Theme Picker Elements
const openThemeBtn = document.getElementById('openThemeBtn');
const closeThemeBtn = document.getElementById('closeThemeBtn');
const themeModalOverlay = document.getElementById('themeModalOverlay');
const btnModeLight = document.getElementById('btnModeLight');
const btnModeDark = document.getElementById('btnModeDark');
const swatchBtns = document.querySelectorAll('.swatch-btn');

// Cart Elements
const floatingCartBar = document.getElementById('floatingCartBar');
const cartBadgeCount = document.getElementById('cartBadgeCount');
const cartBarTotal = document.getElementById('cartBarTotal');
const openCartBtn = document.getElementById('openCartBtn');
const navCartBadge = document.getElementById('navCartBadge');

// Navigation Items
const navHomeBtn = document.getElementById('navHomeBtn');
const navCategoriesBtn = document.getElementById('navCategoriesBtn');
const navCartBtn = document.getElementById('navCartBtn');
const navTrackerBtn = document.getElementById('navTrackerBtn');

// Modal Elements
const cartModalOverlay = document.getElementById('cartModalOverlay');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartDrawerBody = document.getElementById('cartDrawerBody');
const cartItemsList = document.getElementById('cartItemsList');
const emptyCartView = document.getElementById('emptyCartView');
const checkoutSection = document.getElementById('checkoutSection');
const drawerFooter = document.getElementById('drawerFooter');

// Checkout Form Elements
const tabDelivery = document.getElementById('tabDelivery');
const tabTakeaway = document.getElementById('tabTakeaway');
const custNameInput = document.getElementById('custName');
const custPhoneInput = document.getElementById('custPhone');
const custAddressInput = document.getElementById('custAddress');
const custNoteInput = document.getElementById('custNote');
const addressFormGroup = document.getElementById('addressFormGroup');
const getLocationBtn = document.getElementById('getLocationBtn');
const locationStatusText = document.getElementById('locationStatusText');
const submitOrderBtn = document.getElementById('submitOrderBtn');

// Summary Totals
const summaryItemsTotal = document.getElementById('summaryItemsTotal');
const summaryDeliveryFee = document.getElementById('summaryDeliveryFee');
const deliveryFeeRow = document.getElementById('deliveryFeeRow');
const summaryGrandTotal = document.getElementById('summaryGrandTotal');

// Online Payment Modal Elements
const onlinePaymentModalOverlay = document.getElementById('onlinePaymentModalOverlay');
const payModalBadge = document.getElementById('payModalBadge');
const payModalTitle = document.getElementById('payModalTitle');
const payModalOrderId = document.getElementById('payModalOrderId');
const payModalAmount = document.getElementById('payModalAmount');
const payModalCardNumber = document.getElementById('payModalCardNumber');
const payModalCardHolder = document.getElementById('payModalCardHolder');
const copyCardBtn = document.getElementById('copyCardBtn');
const directPayAppBtn = document.getElementById('directPayAppBtn');
const payAppBtnText = document.getElementById('payAppBtnText');
const confirmPaymentDoneBtn = document.getElementById('confirmPaymentDoneBtn');

// Status Modal & Live Tracker Elements
const statusModalOverlay = document.getElementById('statusModalOverlay');
const closeStatusBtn = document.getElementById('closeStatusBtn');
const successOrderId = document.getElementById('successOrderId');
const activeTrackerBanner = document.getElementById('activeTrackerBanner');
const bannerOrderId = document.getElementById('bannerOrderId');
const bannerStatusText = document.getElementById('bannerStatusText');
const openBannerTrackerBtn = document.getElementById('openBannerTrackerBtn');
const trackerMainTitle = document.getElementById('trackerMainTitle');
const trackerLineProgress = document.getElementById('trackerLineProgress');
const trackerBadgeText = document.getElementById('trackerBadgeText');
const trackerDescText = document.getElementById('trackerDescText');
const stepPending = document.getElementById('stepPending');
const stepPreparing = document.getElementById('stepPreparing');
const stepDelivering = document.getElementById('stepDelivering');
const stepCompleted = document.getElementById('stepCompleted');
const trackerAddress = document.getElementById('trackerAddress');
const trackerTotalAmount = document.getElementById('trackerTotalAmount');
const trackerItemsSummary = document.getElementById('trackerItemsSummary');
const trackerSearchBarBox = document.getElementById('trackerSearchBarBox');
const manualOrderIdInput = document.getElementById('manualOrderIdInput');
const findOrderBtn = document.getElementById('findOrderBtn');
let trackerPollInterval = null;

// Status Configuration Dictionary
const STATUS_CONFIG = {
  pending: {
    title: 'Buyurtmangiz Qabul Qilindi!',
    badge: '⏳ Qabul qilindi',
    desc: 'Operatorimiz buyurtmangizni qabul qildi va navbatga qo\'ydi.',
    progress: '15%',
    stepIndex: 0
  },
  preparing: {
    title: 'Buyurtmangiz Tayyorlanmoqda!',
    badge: '👨‍🍳 Oshxonada tayyorlanmoqda',
    desc: 'Oshpazlarimiz taomingizni mehr bilan pishirmoqda.',
    progress: '45%',
    stepIndex: 1
  },
  ready: {
    title: 'Buyurtmangiz Tayyor!',
    badge: '🔔 Buyurtma tayyor',
    desc: 'Taom tayyor bo\'ldi va kuryerga topshirilmoqda.',
    progress: '70%',
    stepIndex: 2
  },
  delivering: {
    title: 'Kuryer Manzilingiz Tomon Yo\'lda!',
    badge: '🛵 Kuryer yo\'lda',
    desc: 'Tezkor kuryerimiz taomingizni issiq holda yetkazib bermoqda.',
    progress: '75%',
    stepIndex: 2
  },
  completed: {
    title: 'Buyurtma Muvaffaqiyatli Yetkazildi!',
    badge: '✅ Yetkazildi / Topshirildi',
    desc: 'Buyurtma yetkazildi. Yoqimli ishtaha tilaymiz!',
    progress: '100%',
    stepIndex: 3
  },
  cancelled: {
    title: 'Buyurtma Bekor Qilindi',
    badge: '❌ Bekor qilingan',
    desc: 'Ushbu buyurtma ma\'muriyat tomonidan bekor qilingan.',
    progress: '0%',
    stepIndex: -1
  }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  applyThemeAndColor();
  initTelegramWebApp();
  fetchInitialData();
  setupEventListeners();
  loadSavedCart();
  loadSavedActiveOrder();
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

// Keep open customer tabs in sync with the admin background preference.
window.addEventListener('storage', (event) => {
  if (event.key === 'zomin_theme' || event.key === 'zomin_color' || event.key === null) {
    state.themeMode = localStorage.getItem('zomin_theme') === 'dark' ? 'dark' : 'light';
    state.colorScheme = localStorage.getItem('zomin_color') || 'green';
    applyThemeAndColor();
  }
});

function syncTelegramTheme() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) return;
  const background = state.themeMode === 'dark' ? '#0B0F17' : '#F4F6F8';
  const secondary = state.themeMode === 'dark' ? '#111827' : '#FFFFFF';
  if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
    tg.setHeaderColor(secondary);
    tg.setBackgroundColor(background);
  }
  if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.10')) tg.setBottomBarColor(secondary);
}

// Theme Management Functions
function applyThemeAndColor() {
  document.documentElement.setAttribute('data-theme', state.themeMode);
  document.documentElement.setAttribute('data-color-scheme', state.colorScheme);
  document.documentElement.style.colorScheme = state.themeMode;
  syncTelegramTheme();

  if (btnModeLight && btnModeDark) {
    btnModeLight.classList.toggle('active', state.themeMode === 'light');
    btnModeDark.classList.toggle('active', state.themeMode === 'dark');
  }

  swatchBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === state.colorScheme);
  });
}

function setThemeMode(mode) {
  state.themeMode = mode;
  localStorage.setItem('zomin_theme', mode);
  applyThemeAndColor();
  showToast(`Fon rejimi: ${mode === 'light' ? '☀️ Oq fon' : '🌙 Qora fon'} o'rnatildi`, 'info');
}

function setColorScheme(color) {
  state.colorScheme = color;
  localStorage.setItem('zomin_color', color);
  applyThemeAndColor();
  showToast(`Mavzu rangi: ${color.toUpperCase()} tanlandi`, 'info');
}

// Telegram WebApp Setup with Auto-Fill
function initTelegramWebApp() {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    if (tg.initData && !localStorage.getItem('zomin_theme')) {
      state.themeMode = tg.colorScheme === 'dark' ? 'dark' : 'light';
      applyThemeAndColor();
    }
    tg.onEvent('themeChanged', () => {
      if (!localStorage.getItem('zomin_theme')) state.themeMode = tg.colorScheme === 'dark' ? 'dark' : 'light';
      applyThemeAndColor();
    });
    syncTelegramTheme();

    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      state.tgUser = tg.initDataUnsafe.user;
      const fullName = `${state.tgUser.first_name || ''} ${state.tgUser.last_name || ''}`.trim();
      if (custNameInput && fullName) {
        custNameInput.value = fullName;
      }
    }
  }
}

// Fetch Categories & Products
async function fetchInitialData() {
  try {
    const [resRest, resCats, resProds] = await Promise.all([
      fetch('/api/restaurant').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/products').then(r => r.json())
    ]);

    state.restaurantInfo = resRest;
    state.deliveryFee = resRest.deliveryFee || 10000;
    state.categories = resCats;
    state.products = resProds;

    renderCategories();
    renderProducts();
  } catch (err) {
    console.error('Data fetch error:', err);
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Mobile Nav Listeners
  if (navHomeBtn) {
    navHomeBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (navCategoriesBtn) {
    navCategoriesBtn.addEventListener('click', () => {
      categoriesContainer.scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (navCartBtn) {
    navCartBtn.addEventListener('click', openCartModal);
  }
  if (navTrackerBtn) {
    navTrackerBtn.addEventListener('click', () => {
      if (trackerSearchBarBox) trackerSearchBarBox.classList.remove('hidden');
      if (state.activeOrder) {
        openLiveTracker(state.activeOrder.id);
      } else {
        const savedId = localStorage.getItem('zomin_active_order_id');
        if (savedId) {
          openLiveTracker(savedId);
        } else {
          statusModalOverlay.classList.remove('hidden');
          showToast('Kuzatish uchun buyurtma raqamini kiriting', 'info');
        }
      }
    });
  }

  // Active floating banner button
  if (openBannerTrackerBtn) {
    openBannerTrackerBtn.addEventListener('click', () => {
      if (state.activeOrder) {
        openLiveTracker(state.activeOrder.id);
      } else {
        const savedId = localStorage.getItem('zomin_active_order_id');
        if (savedId) openLiveTracker(savedId);
      }
    });
  }

  // Manual search order ID
  if (findOrderBtn && manualOrderIdInput) {
    findOrderBtn.addEventListener('click', () => {
      const val = manualOrderIdInput.value.trim();
      if (val) openLiveTracker(val);
      else showToast('Buyurtma raqamini kiriting (masalan: ORD-1004)', 'info');
    });
    manualOrderIdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = manualOrderIdInput.value.trim();
        if (val) openLiveTracker(val);
      }
    });
  }

  // Theme Picker Listeners
  openThemeBtn.addEventListener('click', () => themeModalOverlay.classList.remove('hidden'));
  closeThemeBtn.addEventListener('click', () => themeModalOverlay.classList.add('hidden'));
  themeModalOverlay.addEventListener('click', (e) => {
    if (e.target === themeModalOverlay) themeModalOverlay.classList.add('hidden');
  });

  btnModeLight.addEventListener('click', () => setThemeMode('light'));
  btnModeDark.addEventListener('click', () => setThemeMode('dark'));

  swatchBtns.forEach(btn => {
    btn.addEventListener('click', () => setColorScheme(btn.dataset.color));
  });

  // Search toggle
  openSearchBtn.addEventListener('click', () => {
    searchBarWrapper.classList.remove('hidden');
    searchInput.focus();
  });
  closeSearchBtn.addEventListener('click', () => {
    searchBarWrapper.classList.add('hidden');
    state.searchQuery = '';
    searchInput.value = '';
    renderProducts();
  });
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderProducts();
  });

  // Cart Drawer open/close
  openCartBtn.addEventListener('click', openCartModal);
  closeCartBtn.addEventListener('click', closeCartModal);
  cartModalOverlay.addEventListener('click', (e) => {
    if (e.target === cartModalOverlay) closeCartModal();
  });

  // Clear cart button & Return to menu button
  const clearCartBtn = document.getElementById('clearCartBtn');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      if (state.cart.length === 0) return;
      if (confirm('Savatingizni tozalashni xohlaysizmi?')) {
        state.cart = [];
        updateCart();
        showToast('🗑️ Savat tozalandi', 'info');
      }
    });
  }

  const returnMenuBtn = document.getElementById('returnMenuBtn');
  if (returnMenuBtn) {
    returnMenuBtn.addEventListener('click', () => {
      closeCartModal();
    });
  }

  // Payment method selection listeners
  document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.pay-option').forEach(opt => opt.classList.remove('active'));
      const activeOption = radio.closest('.pay-option');
      if (activeOption) activeOption.classList.add('active');
    });
  });

  // Delivery / Takeaway Tabs
  tabDelivery.addEventListener('click', () => setDeliveryType('delivery'));
  tabTakeaway.addEventListener('click', () => setDeliveryType('takeaway'));

  // GPS Location button
  getLocationBtn.addEventListener('click', handleGPSLocation);

  // Submit Order
  submitOrderBtn.addEventListener('click', handleOrderSubmission);

  // Online Payment Copy Card & Confirm
  copyCardBtn.addEventListener('click', () => {
    const cardNum = payModalCardNumber.textContent.replace(/\s+/g, '');
    navigator.clipboard.writeText(cardNum).then(() => {
      showToast('📋 Karta raqami nusxalandi!', 'success');
      copyCardBtn.innerHTML = '<i class="fa-solid fa-check"></i> Nusxalandi!';
      setTimeout(() => {
        copyCardBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Nusxalash';
      }, 2000);
    });
  });

  confirmPaymentDoneBtn.addEventListener('click', () => {
    onlinePaymentModalOverlay.classList.add('hidden');
    if (state.activeOrder) {
      openLiveTracker(state.activeOrder.id);
    }
  });

  // Status Modal Close & Polling Cleanup
  closeStatusBtn.addEventListener('click', () => {
    statusModalOverlay.classList.add('hidden');
    stopTrackerPolling();
  });
  statusModalOverlay.addEventListener('click', (e) => {
    if (e.target === statusModalOverlay) {
      statusModalOverlay.classList.add('hidden');
      stopTrackerPolling();
    }
  });
}

// Render Category Pills
function renderCategories() {
  categoriesContainer.innerHTML = '';
  state.categories.forEach(cat => {
    const pill = document.createElement('button');
    pill.className = `category-pill ${cat.id === state.activeCategory ? 'active' : ''}`;
    pill.innerHTML = `<span>${cat.icon}</span> ${cat.name}`;
    pill.addEventListener('click', () => {
      state.activeCategory = cat.id;
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderProducts();
    });
    categoriesContainer.appendChild(pill);
  });
}

// Render Products Grid with 3D Tilt & Multi-Image Gallery
function renderProducts() {
  foodGrid.innerHTML = '';

  let filtered = state.products.filter(p => p.isAvailable);

  if (state.activeCategory !== 'all') {
    filtered = filtered.filter(p => p.categoryId === state.activeCategory);
  }

  if (state.searchQuery) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(state.searchQuery) ||
      p.description.toLowerCase().includes(state.searchQuery)
    );
  }

  // Update Section Title & Count
  const currentCatObj = state.categories.find(c => c.id === state.activeCategory);
  currentCategoryTitle.textContent = currentCatObj ? currentCatObj.name : 'Barcha Taomlar';
  itemsCount.textContent = `${filtered.length} taom`;

  if (filtered.length === 0) {
    foodGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 32px; margin-bottom: 10px;"></i>
        <p>Afsuski, mos keladigan taom topilmadi.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'food-card';

    const imageList = (prod.images && prod.images.length > 0) ? prod.images : [prod.image];
    if (state.productImageIndices[prod.id] === undefined) {
      state.productImageIndices[prod.id] = 0;
    }
    const activeImgIndex = state.productImageIndices[prod.id];
    const currentImgUrl = imageList[activeImgIndex];

    const formattedPrice = prod.price.toLocaleString('uz-UZ') + ' UZS';

    let dotsHtml = '';
    if (imageList.length > 1) {
      dotsHtml = `<div class="img-dots-container">` +
        imageList.map((_, idx) => `<span class="img-dot ${idx === activeImgIndex ? 'active' : ''}" data-idx="${idx}"></span>`).join('') +
        `</div>`;
    }

    card.innerHTML = `
      <div class="card-image-box">
        <img src="${currentImgUrl}" alt="${prod.name}" id="img-prod-${prod.id}">
        ${prod.badge ? `<span class="card-badge">${prod.badge}</span>` : ''}
        ${imageList.length > 1 ? `
          <button class="img-nav-btn img-nav-prev" title="Oldingi rasm"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="img-nav-btn img-nav-next" title="Keyingi rasm"><i class="fa-solid fa-chevron-right"></i></button>
          ${dotsHtml}
        ` : ''}
      </div>
      <div class="card-content">
        <h4 class="card-title">${prod.name}</h4>
        <p class="card-desc">${prod.description}</p>
        <div class="card-footer">
          <span class="card-price">${formattedPrice}</span>
          <button class="add-btn" data-id="${prod.id}">
            <i class="fa-solid fa-plus"></i> Qo'shish
          </button>
        </div>
      </div>
    `;

    if (imageList.length > 1) {
      const prevBtn = card.querySelector('.img-nav-prev');
      const nextBtn = card.querySelector('.img-nav-next');
      const imgEl = card.querySelector(`#img-prod-${prod.id}`);

      const switchImage = (newIdx) => {
        state.productImageIndices[prod.id] = newIdx;
        imgEl.style.opacity = '0.4';
        setTimeout(() => {
          imgEl.src = imageList[newIdx];
          imgEl.style.opacity = '1';
        }, 150);

        card.querySelectorAll('.img-dot').forEach((dot, idx) => {
          dot.classList.toggle('active', idx === newIdx);
        });
      };

      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          let nextIdx = (state.productImageIndices[prod.id] - 1 + imageList.length) % imageList.length;
          switchImage(nextIdx);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          let nextIdx = (state.productImageIndices[prod.id] + 1) % imageList.length;
          switchImage(nextIdx);
        });
      }
      card.querySelectorAll('.img-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          switchImage(Number(dot.dataset.idx));
        });
      });
    }

    if (window.matchMedia('(hover: hover)').matches) {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
      });
    }

    card.querySelector('.add-btn').addEventListener('click', () => addToCart(prod));
    foodGrid.appendChild(card);
  });
}

// Cart Operations
function addToCart(product) {
  const existing = state.cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ ...product, quantity: 1 });
  }
  updateCartUI();
  saveCart();
  showToast(`🛒 ${product.name} savatga qo'shildi!`, 'success');

  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
  }
}

function updateCartQuantity(productId, delta) {
  const item = state.cart.find(i => i.id === productId);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter(i => i.id !== productId);
    }
  }
  updateCartUI();
  saveCart();
}

function updateCartUI() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const itemsTotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  cartBadgeCount.textContent = totalItems;
  cartBarTotal.textContent = itemsTotal.toLocaleString('uz-UZ') + ' UZS';

  if (navCartBadge) {
    navCartBadge.textContent = totalItems;
    if (totalItems > 0) navCartBadge.classList.remove('hidden');
    else navCartBadge.classList.add('hidden');
  }

  if (totalItems > 0) {
    floatingCartBar.classList.remove('hidden');
  } else {
    floatingCartBar.classList.add('hidden');
    closeCartModal();
  }

  renderCartItems();
  updateSummaryTotals();
}

function renderCartItems() {
  cartItemsList.innerHTML = '';

  const totalItemsCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartHeaderSubtitle = document.getElementById('cartHeaderSubtitle');
  const cartItemsHeader = document.getElementById('cartItemsHeader');

  if (cartHeaderSubtitle) {
    cartHeaderSubtitle.textContent = state.cart.length > 0
      ? `${totalItemsCount} ta taom savatda jamlangan`
      : 'Taomlar ro\'yxati va buyurtma rasmiylashtirish';
  }

  if (state.cart.length === 0) {
    if (cartItemsHeader) cartItemsHeader.style.display = 'none';
    emptyCartView.classList.remove('hidden');
    checkoutSection.classList.add('hidden');
    drawerFooter.classList.add('hidden');
    return;
  }

  if (cartItemsHeader) cartItemsHeader.style.display = 'flex';
  emptyCartView.classList.add('hidden');
  checkoutSection.classList.remove('hidden');
  drawerFooter.classList.remove('hidden');

  state.cart.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cart-item-card';
    const itemTotalFormatted = (item.price * item.quantity).toLocaleString('uz-UZ') + ' UZS';
    const singlePriceFormatted = Number(item.price || 0).toLocaleString('uz-UZ') + ' UZS';
    const isSingle = item.quantity <= 1;
    const imgSrc = item.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80';

    el.innerHTML = `
      <div class="cart-item-thumb">
        <img src="${imgSrc}" alt="${item.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80'">
      </div>
      <div class="cart-item-details">
        <div class="cart-item-title-row">
          <h4 class="cart-item-title">${item.name}</h4>
          ${item.badge ? `<span class="cart-item-pill">${item.badge}</span>` : ''}
        </div>
        <div class="cart-item-pricing">
          <span class="unit-price">${singlePriceFormatted} / dona</span>
          <span class="subtotal-price">${itemTotalFormatted}</span>
        </div>
      </div>
      <div class="cart-item-stepper">
        <button class="step-btn minus ${isSingle ? 'is-trash' : ''}" data-action="minus" aria-label="${isSingle ? 'O\'chirish' : 'Kamaytirish'}" title="${isSingle ? 'O\'chirish' : 'Kamaytirish'}">
          <i class="fa-solid ${isSingle ? 'fa-trash-can' : 'fa-minus'}"></i>
        </button>
        <span class="step-count">${item.quantity}</span>
        <button class="step-btn plus" data-action="plus" aria-label="Ko'paytirish" title="Ko'paytirish">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    `;

    el.querySelector('[data-action="minus"]').addEventListener('click', () => updateCartQuantity(item.id, -1));
    el.querySelector('[data-action="plus"]').addEventListener('click', () => updateCartQuantity(item.id, 1));
    cartItemsList.appendChild(el);
  });
}

function setDeliveryType(type) {
  state.orderType = type;
  if (type === 'delivery') {
    tabDelivery.classList.add('active');
    tabTakeaway.classList.remove('active');
    addressFormGroup.style.display = 'block';
    custAddressInput.required = true;
    deliveryFeeRow.style.display = 'flex';
  } else {
    tabTakeaway.classList.add('active');
    tabDelivery.classList.remove('active');
    addressFormGroup.style.display = 'none';
    custAddressInput.required = false;
    deliveryFeeRow.style.display = 'none';
  }
  updateSummaryTotals();
}

function updateSummaryTotals() {
  const itemsTotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = state.orderType === 'delivery' ? state.deliveryFee : 0;
  const grandTotal = itemsTotal + deliveryFee;

  summaryItemsTotal.textContent = itemsTotal.toLocaleString('uz-UZ') + ' UZS';
  summaryDeliveryFee.textContent = deliveryFee.toLocaleString('uz-UZ') + ' UZS';
  summaryGrandTotal.textContent = grandTotal.toLocaleString('uz-UZ') + ' UZS';
}

function openCartModal() {
  renderCartItems();
  updateSummaryTotals();
  cartModalOverlay.classList.remove('hidden');
}
function closeCartModal() {
  cartModalOverlay.classList.add('hidden');
}

// GPS Location
function handleGPSLocation() {
  if (!navigator.geolocation) {
    showToast('Brazeringiz geolokatsiyani qo\'llab-quvvatlamaydi', 'error');
    return;
  }

  locationStatusText.textContent = '📍 Joylashuvingiz aniqlanmoqda...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      custAddressInput.value = `Zomin GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      locationStatusText.textContent = '✅ Geolokatsiya aniqlandi!';
      showToast('📍 Joylashuvingiz aniqlandi!', 'success');
    },
    (err) => {
      console.warn('Geolocation error:', err);
      locationStatusText.textContent = '⚠️ Joylashuvni avto-aniqlab bo\'lmadi. Manzilni qo\'lda kiriting.';
      showToast('Manzilni qo\'lda kiriting', 'info');
    }
  );
}

// Submit Order with Smart Fallback Auto-Fill
async function handleOrderSubmission() {
  let name = custNameInput.value.trim();
  let phone = custPhoneInput.value.trim();
  let address = custAddressInput.value.trim();
  const note = custNoteInput.value.trim();
  const payMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cash';

  if (!name) {
    if (state.tgUser && state.tgUser.first_name) {
      name = `${state.tgUser.first_name} ${state.tgUser.last_name || ''}`.trim();
    } else {
      name = 'Zomin Xaridori';
    }
    custNameInput.value = name;
  }

  if (!phone) {
    phone = '+998 90 123 45 67';
    custPhoneInput.value = phone;
  }

  if (state.orderType === 'delivery' && !address) {
    address = 'Zomin markazi (Birlamchi manzil)';
    custAddressInput.value = address;
  }

  submitOrderBtn.disabled = true;
  submitOrderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yuborilmoqda...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: name,
        phone: phone,
        address: state.orderType === 'delivery' ? address : 'Olib ketish',
        items: state.cart,
        orderType: state.orderType,
        paymentMethod: payMethod,
        note: note,
        tgUser: state.tgUser
      })
    });

    const data = await res.json();

    if (data.success) {
      state.activeOrder = data.order;
      localStorage.setItem('zomin_active_order_id', data.order.id);
      state.cart = [];
      saveCart();
      updateCartUI();
      closeCartModal();

      if (payMethod === 'click' || payMethod === 'payme') {
        openOnlinePaymentModal(data.order, payMethod);
      } else {
        openLiveTracker(data.order.id);
        showToast('🎉 Buyurtmangiz muvaffaqiyatli qabul qilindi!', 'success');
      }

      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } else {
      showToast(data.error || 'Xatolik yuz berdi', 'error');
    }
  } catch (err) {
    console.error('Order submit error:', err);
    showToast('Tarmoqda xatolik yuz berdi. Qayta urinib ko\'ring.', 'error');
  } finally {
    submitOrderBtn.disabled = false;
    submitOrderBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Buyurtmani Tasdiqlash';
  }
}

// Open Online Click / Payme Interactive Payment Modal
function openOnlinePaymentModal(order, provider) {
  payModalOrderId.textContent = `#${order.id}`;
  payModalAmount.textContent = `${order.totalAmount.toLocaleString('uz-UZ')} UZS`;
  payModalCardNumber.textContent = state.restaurantInfo.cardNumber || '8600 4910 2841 9012';
  payModalCardHolder.textContent = state.restaurantInfo.cardHolder || 'ZOMIN FASTFOOD HUB (SARDOR R.)';

  if (provider === 'click') {
    payModalBadge.className = 'provider-logo-badge provider-click';
    payModalBadge.textContent = '🔵 CLICK';
    payModalTitle.textContent = 'Click Orqali To\'lov';
    directPayAppBtn.className = 'direct-pay-app-btn click-btn';
    payAppBtnText.textContent = 'ClickUp Ilovasini Ochish va To\'lash';
    const clickServiceId = state.restaurantInfo.clickServiceId || '34910';
    const clickMerchantId = state.restaurantInfo.clickMerchantId || '18492';
    directPayAppBtn.href = `https://my.click.uz/services/pay?service_id=${clickServiceId}&merchant_id=${clickMerchantId}&amount=${order.totalAmount}&transaction_param=${order.id}`;
  } else {
    payModalBadge.className = 'provider-logo-badge provider-payme';
    payModalBadge.textContent = '🟢 PAYME';
    payModalTitle.textContent = 'Payme Orqali To\'lov';
    directPayAppBtn.className = 'direct-pay-app-btn payme-btn';
    payAppBtnText.textContent = 'Payme Ilovasida To\'lash';
    const paymeMerchantId = state.restaurantInfo.paymeMerchantId || '65ab9128f01c8293';
    directPayAppBtn.href = `https://payme.uz/checkout/${paymeMerchantId}?amount=${order.totalAmount * 100}&account[order_id]=${order.id}`;
  }

  onlinePaymentModalOverlay.classList.remove('hidden');
}

// LocalStorage helpers
function saveCart() { localStorage.setItem('zomin_cart', JSON.stringify(state.cart)); }
function loadSavedCart() {
  try {
    const saved = localStorage.getItem('zomin_cart');
    if (saved) {
      state.cart = JSON.parse(saved);
      updateCartUI();
    }
  } catch (e) {}
}

// ==========================================
// REAL-TIME ORDER TRACKER & POLLING SYSTEM
// ==========================================

function updateTrackerUI(order) {
  if (!order) return;
  state.activeOrder = order;
  localStorage.setItem('zomin_active_order_id', order.id);

  const status = order.status || 'pending';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  if (trackerMainTitle) trackerMainTitle.textContent = cfg.title;
  if (successOrderId) successOrderId.textContent = `#${order.id}`;
  if (trackerBadgeText) trackerBadgeText.textContent = cfg.badge;
  if (trackerDescText) trackerDescText.textContent = cfg.desc;
  if (trackerLineProgress) trackerLineProgress.style.width = cfg.progress;

  // Update Stepper icons and classes
  const steps = [
    { el: stepPending, index: 0 },
    { el: stepPreparing, index: 1 },
    { el: stepDelivering, index: 2 },
    { el: stepCompleted, index: 3 }
  ];

  steps.forEach(({ el, index }) => {
    if (!el) return;
    el.classList.remove('step-done', 'step-active');
    if (cfg.stepIndex === -1) {
      // Cancelled status
    } else if (index < cfg.stepIndex) {
      el.classList.add('step-done');
    } else if (index === cfg.stepIndex) {
      if (index === 3) {
        el.classList.add('step-done');
      } else {
        el.classList.add('step-active');
      }
    }
  });

  // Update Address & Total in modal details
  if (trackerAddress) {
    trackerAddress.textContent = order.orderType === 'takeaway' ? '🛍 Olib ketish' : (order.address || 'Zomin tumani');
  }
  if (trackerTotalAmount) {
    trackerTotalAmount.textContent = `${(order.totalAmount || 0).toLocaleString('uz-UZ')} UZS`;
  }

  // Update Items List in modal details
  if (trackerItemsSummary && order.items && order.items.length > 0) {
    trackerItemsSummary.innerHTML = order.items.map(item => `
      <div class="tracker-item-line">
        <span>${item.name} × ${item.quantity}</span>
        <strong>${(item.price * item.quantity).toLocaleString('uz-UZ')} UZS</strong>
      </div>
    `).join('');
  }

  // Update Floating Bottom Banner
  if (activeTrackerBanner) {
    bannerOrderId.textContent = `Buyurtma #${order.id}`;
    bannerStatusText.textContent = cfg.badge;
    activeTrackerBanner.classList.remove('hidden');
  }
}

async function fetchOrderTracker(orderId) {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    const data = await res.json();
    if (data.success && data.order) {
      updateTrackerUI(data.order);
      if (data.order.status === 'completed' || data.order.status === 'cancelled') {
        stopTrackerPolling();
      }
      return data.order;
    } else {
      showToast('Buyurtma topilmadi. Raqamni tekshirib ko\'ring.', 'error');
    }
  } catch (err) {
    console.warn('Tracker fetch error:', err);
  }
  return null;
}

async function openLiveTracker(orderId) {
  stopTrackerPolling();
  const cleanId = (orderId || '').replace('#', '').trim();
  if (!cleanId) return;

  statusModalOverlay.classList.remove('hidden');
  const order = await fetchOrderTracker(cleanId);
  if (order && order.status !== 'completed' && order.status !== 'cancelled') {
    trackerPollInterval = setInterval(() => {
      fetchOrderTracker(cleanId);
    }, 3000);
  }
}

function stopTrackerPolling() {
  if (trackerPollInterval) {
    clearInterval(trackerPollInterval);
    trackerPollInterval = null;
  }
}

async function loadSavedActiveOrder() {
  const savedId = localStorage.getItem('zomin_active_order_id');
  if (savedId) {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(savedId)}`);
      const data = await res.json();
      if (data.success && data.order) {
        state.activeOrder = data.order;
        if (activeTrackerBanner) {
          const cfg = STATUS_CONFIG[data.order.status] || STATUS_CONFIG.pending;
          bannerOrderId.textContent = `Buyurtma #${data.order.id}`;
          bannerStatusText.textContent = cfg.badge;
          activeTrackerBanner.classList.remove('hidden');
        }
      }
    } catch (e) {
      console.warn('Failed to load saved order:', e);
    }
  }
}

