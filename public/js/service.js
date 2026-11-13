const kitchen = document.body.dataset.page === 'kitchen';
const labels = {pending:'⏳ Yangi buyurtma',preparing:'👨‍🍳 Tayyorlanmoqda',ready:'🔔 Buyurtma tayyor',completed:'🍽 Stolga berildi'};
const cart = new Map();
let products = [], previousReady = null, busy = false, audio = null;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function theme() {
  document.documentElement.dataset.theme = localStorage.getItem('zomin_theme') || 'light';
  document.documentElement.dataset.colorScheme = localStorage.getItem('zomin_color') || 'green';
}
theme(); window.addEventListener('storage', theme);
async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Server xatosi');
  return data;
}
function itemPhoto(item) {
  const product = products.find(p => p.id === (item.productId || item.id) || p.name === item.name);
  const url = item.image || product?.image || product?.images?.[0] || '';
  if (!/^(https?:\/\/|\/(?!\/))/.test(url)) return '<span class="order-photo-placeholder">🍽</span>';
  return `<img class="order-photo" src="${escapeHTML(url)}" alt="${escapeHTML(item.name)}" loading="lazy" referrerpolicy="no-referrer">`;
}
function message(text) { $('message').textContent = text; }
function renderCart() {
  $('cart').innerHTML = [...cart].map(([id, quantity]) => {
    const p = products.find(p => p.id === id);
    return `<div class="cart-row">${itemPhoto(p)}<span>${escapeHTML(p.name)} × ${quantity}</span><button type="button" data-remove="${id}" aria-label="Miqdorni kamaytirish">−</button></div>`;
  }).join('') || '<p>Savat bo‘sh</p>';
  $('total').textContent = [...cart].reduce((sum,[id,q]) => sum + products.find(p=>p.id===id).price*q,0).toLocaleString('uz-UZ') + ' UZS';
}
if (!kitchen) {
  $('menu').addEventListener('click', event => {
    const button = event.target.closest('[data-add]'); if (!button) return;
    const id = Number(button.dataset.add); cart.set(id, Math.min(99,(cart.get(id)||0)+1)); renderCart();
  });
  $('cart').addEventListener('click', event => {
    const button = event.target.closest('[data-remove]'); if (!button) return;
    const id = Number(button.dataset.remove), quantity = cart.get(id)-1;
    if (quantity) cart.set(id,quantity); else cart.delete(id); renderCart();
  });
  $('orderForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (!cart.size) return message('Avval taom tanlang');
    busy = true; $('send').disabled = true;
    try {
      const data = await request('/api/waiter/orders', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tableNumber:Number($('table').value),note:$('note').value,items:[...cart].map(([productId,quantity])=>({productId,quantity}))})});
      cart.clear(); renderCart(); $('note').value = ''; message(`${data.order.id} — Stol ${data.order.tableNumber}: oshxonaga yuborildi`); await poll();
    } catch(error) { message(error.message); }
    finally { busy=false; $('send').disabled=false; }
  });
  request('/api/products').then(data => {
    products=data.filter(p=>p.isAvailable);
    $('menu').innerHTML=products.map(p=>`<button type="button" data-add="${p.id}">${itemPhoto(p)}<strong>${escapeHTML(p.name)}</strong><span>${p.price.toLocaleString('uz-UZ')} UZS · + Qo‘shish</span></button>`).join('');
  }).catch(error=>message(error.message));
}
$('sound').addEventListener('click', async () => {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); await audio.resume(); $('sound').textContent='🔊 Ovoz yoqilgan'; }
  catch (_) { message('Bu brauzerda ovozni yoqib bo‘lmadi'); }
});
function beep() {
  if (!audio || audio.state !== 'running') return;
  const oscillator=audio.createOscillator(), gain=audio.createGain(); oscillator.connect(gain);gain.connect(audio.destination);
  oscillator.frequency.value=880;gain.gain.value=.15;oscillator.start();oscillator.stop(audio.currentTime+.5);
}
$('orders').addEventListener('click', async event => {
  const button=event.target.closest('[data-status]');if(!button)return;
  button.disabled=true;
  try {await request(`/api/orders/${encodeURIComponent(button.dataset.id)}/status`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:button.dataset.status})});await poll();}
  catch(error){message(error.message);button.disabled=false;}
});
async function poll() {
  try {
    const all=await request('/api/orders');
    const orders=all.filter(o=>kitchen ? ['pending','preparing','ready'].includes(o.status) : (o.source==='waiter' && ['pending','preparing','ready'].includes(o.status)));
    const ready=new Set(orders.filter(o=>o.status==='ready').map(o=>o.id));
    if(previousReady && [...ready].some(id=>!previousReady.has(id))) {beep();message('🔔 Buyurtma tayyor! Stolga olib boring.');}
    previousReady=ready;
    orders.sort((a,b)=>kitchen?new Date(a.createdAt)-new Date(b.createdAt):(b.status==='ready')-(a.status==='ready'));
    $('orders').innerHTML=orders.map(o=>{
      const title = o.orderType === 'dinein' ? `Stol ${escapeHTML(o.tableNumber)}` : (o.orderType === 'delivery' ? `🛵 Yetkazish · ${escapeHTML(o.customerName || 'Mijoz')}` : `🛍 Olib ketish · ${escapeHTML(o.customerName || 'Mijoz')}`);
      return `<article class="service-order ${o.status}"><h2>${title} <small>${escapeHTML(o.id)}</small></h2><strong class="status">${labels[o.status] || o.status}</strong><p>${new Date(o.createdAt).toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'})}</p><ul>${o.items.map(i=>`<li class="order-item-photo">${itemPhoto(i)}<span>${escapeHTML(i.name)} <b>× ${i.quantity}</b></span></li>`).join('')}</ul>${o.note?`<p class="note">📝 ${escapeHTML(o.note)}</p>`:''}<p>${o.totalAmount.toLocaleString('uz-UZ')} UZS</p>${kitchen && o.status!=='ready'?`<button data-id="${escapeHTML(o.id)}" data-status="${o.status==='pending'?'preparing':'ready'}">${o.status==='pending'?'👨‍🍳 Tayyorlashni boshlash':'🔔 Buyurtma tayyor'}</button>`:''}${!kitchen && o.status==='ready'?`<button data-id="${escapeHTML(o.id)}" data-status="completed">🍽 Stolga berildi</button>`:''}</article>`;
    }).join('') || '<p class="empty">Faol buyurtmalar yo‘q</p>';
    $('connection').textContent='● Ulangan · '+new Date().toLocaleTimeString('uz-UZ');
  } catch(error) {$('connection').textContent='⚠ Aloqa uzildi — qayta ulanmoqda';message(error.message);}
}
(async () => { if (kitchen) { try { products = await request('/api/products'); } catch (_) {} } await poll(); })().finally(()=>setTimeout(async function refresh(){await poll();setTimeout(refresh,3000);},3000));
