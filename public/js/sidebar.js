(() => {
  const sidebar = document.querySelector('.admin-sidebar, .service-sidebar');
  const toggle = document.querySelector('#mobileToggleSidebarBtn, .sidebar-open-control');
  const close = document.querySelector('#closeSidebarBtn, .sidebar-close-control');
  if (!sidebar || !toggle) return;
  const mobile = window.matchMedia('(max-width: 992px)');
  let collapsed = false;
  try { collapsed = localStorage.getItem('zomin_sidebar_collapsed') === 'true'; } catch (_) {}
  const backdrop = document.createElement('button');
  backdrop.className = 'sidebar-backdrop';
  backdrop.setAttribute('aria-label', 'Menyuni yopish');
  backdrop.hidden = true;
  document.body.appendChild(backdrop);
  function update() {
    const open = mobile.matches ? sidebar.classList.contains('open') : !collapsed;
    document.body.classList.toggle('sidebar-collapsed', !mobile.matches && collapsed);
    toggle.setAttribute('aria-expanded', String(open));
    sidebar.inert = !open;
    backdrop.hidden = !(mobile.matches && open);
  }
  function hide() {
    if (mobile.matches) sidebar.classList.remove('open');
    else { collapsed = true; try { localStorage.setItem('zomin_sidebar_collapsed', 'true'); } catch (_) {} }
    update(); toggle.focus();
  }
  toggle.addEventListener('click', () => {
    if (mobile.matches) sidebar.classList.toggle('open');
    else { collapsed = !collapsed; try { localStorage.setItem('zomin_sidebar_collapsed', String(collapsed)); } catch (_) {} }
    update();
  });
  close?.addEventListener('click', hide);
  backdrop.addEventListener('click', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  sidebar.addEventListener('click', event => {
    if (mobile.matches && event.target.closest('a, [data-tab]')) hide();
  });
  mobile.addEventListener('change', () => { sidebar.classList.remove('open'); update(); });
  update();
})();
