// Zomin FastFood Hub - Unified Client-Side Auth & Role Guard

const Auth = {
  getToken() {
    return localStorage.getItem('zomin_auth_token') || null;
  },

  getUser() {
    try {
      const u = localStorage.getItem('zomin_auth_user');
      return u ? JSON.parse(u) : null;
    } catch (_) {
      return null;
    }
  },

  setAuth(token, user) {
    localStorage.setItem('zomin_auth_token', token);
    localStorage.setItem('zomin_auth_user', JSON.stringify(user));
    // Also set document cookie for direct page navigations
    document.cookie = `zomin_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  },

  clearAuth() {
    localStorage.removeItem('zomin_auth_token');
    localStorage.removeItem('zomin_auth_user');
    document.cookie = 'zomin_token=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/login.html';
  },

  async fetch(url, options = {}) {
    const token = this.getToken();
    const headers = {
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      console.warn('Unauthorized session. Redirecting to login...');
      this.clearAuth();
      throw new Error('Sessiya muddati tugadi');
    }
    return res;
  },

  async requireRole(allowedRoles = []) {
    const token = this.getToken();
    const user = this.getUser();

    if (!token || !user) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      alert(`Sizning rolingiz (${user.role}) ushbu sahifaga kirish huquqiga ega emas.`);
      // Redirect to their respective dashboard
      if (user.role === 'cook') window.location.href = '/kitchen.html';
      else if (user.role === 'courier') window.location.href = '/courier.html';
      else if (user.role === 'cashier') window.location.href = '/waiter.html';
      else window.location.href = '/login.html';
      return null;
    }

    return user;
  },

  renderUserWidget(targetElementId = 'userProfileWidget') {
    const user = this.getUser();
    const el = document.getElementById(targetElementId);
    if (!el || !user) return;

    const roleBadges = {
      admin: { label: '🛡 Administrator', class: 'badge-admin' },
      cook: { label: '👨‍🍳 Oshpaz', class: 'badge-cook' },
      courier: { label: '🛵 Kuryer', class: 'badge-courier' },
      cashier: { label: '👔 Kassir', class: 'badge-cashier' }
    };

    const badge = roleBadges[user.role] || { label: user.role, class: 'badge-default' };

    el.innerHTML = `
      <div class="user-auth-pill">
        <div class="user-avatar-circle">${(user.fullName || user.username || 'U')[0].toUpperCase()}</div>
        <div class="user-meta-info">
          <span class="user-name-text">${user.fullName || user.username}</span>
          <span class="user-role-badge ${badge.class}">${badge.label}</span>
        </div>
        <button class="user-logout-btn" id="headerLogoutBtn" title="Tizimdan chiqish">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    `;

    const logoutBtn = document.getElementById('headerLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Tizimdan chiqmoqchimisiz?')) {
          Auth.clearAuth();
        }
      });
    }
  }
};

window.Auth = Auth;
