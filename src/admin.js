import './admin.css';

// ── Secure Server-Side Admin Authentication ──────────────────────────────────
const TOKEN_KEY = 'solo_admin_token';

const pwGate      = document.getElementById('pw-gate');
const adminContent= document.getElementById('admin-content');
const pwForm      = document.getElementById('pw-form');
const pwInput     = document.getElementById('pw-input');
const pwError     = document.getElementById('pw-error');
const pwToggle    = document.getElementById('pw-toggle');
const btnLogout   = document.getElementById('btn-logout');

function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

async function adminFetch(url, options = {}) {
  const token = getAdminToken();
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    lock();
    pwError.textContent = '🔒 Session expired. Please log in again.';
    throw new Error('Unauthorized');
  }
  return res;
}

function unlock(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  pwGate.style.display = 'none';
  adminContent.style.display = 'block';
}

function lock() {
  sessionStorage.removeItem(TOKEN_KEY);
  pwGate.style.display = 'flex';
  adminContent.style.display = 'none';
  pwInput.value = '';
}

// Check saved token with backend on page load
(async function checkExistingAuth() {
  const token = getAdminToken();
  if (token) {
    try {
      const res = await fetch('/api/admin/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        unlock();
      } else {
        lock();
      }
    } catch {
      lock();
    }
  } else {
    lock();
  }
})();

// Toggle password visibility
pwToggle.addEventListener('click', () => {
  pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
  pwToggle.textContent = pwInput.type === 'password' ? '👁' : '🙈';
});

// Submit password to backend
pwForm.addEventListener('submit', async e => {
  e.preventDefault();
  const password = pwInput.value.trim();
  if (!password) return;

  const submitBtn = pwForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying...';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      pwError.textContent = '';
      unlock(data.token);
      // Load initial data
      if (tabOrders.classList.contains('active')) loadOrders();
      if (tabMessages.classList.contains('active')) loadChatList();
    } else {
      pwError.textContent = '❌ ' + (data.error || 'Incorrect password.');
      pwInput.value = '';
      pwInput.focus();
      pwInput.closest('.pw-input-wrap').style.animation = 'shake 0.35s ease';
      setTimeout(() => pwInput.closest('.pw-input-wrap').style.animation = '', 400);
    }
  } catch(err) {
    pwError.textContent = '⚠️ Could not connect to authentication server.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Unlock';
  }
});

// Add shake keyframe
const style = document.createElement('style');
style.textContent = `@keyframes shake {
  0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)}
}`;
document.head.appendChild(style);

// Logout
btnLogout.addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAdminToken()}` }
    });
  } catch {}
  lock();
});

// ── Store Helpers ─────────────────────────────────────────────────────────────
function loadProducts() { return JSON.parse(localStorage.getItem('solo_products') || '[]'); }
function saveProducts(p) { localStorage.setItem('solo_products', JSON.stringify(p)); }

// ── State ─────────────────────────────────────────────────────────────────────
let products  = loadProducts();
let editingId = null;

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const form           = document.getElementById('product-form');
const nameInput      = document.getElementById('prod-name');
const priceInput     = document.getElementById('prod-price');
const stockInput     = document.getElementById('prod-stock');
const categoryInput  = document.getElementById('prod-category');
const descInput      = document.getElementById('prod-desc');
const imageUrlInput  = document.getElementById('prod-image-url');
const fileInput      = document.getElementById('prod-image-file');
const imgPreview     = document.getElementById('img-preview');
const imgPlaceholder = document.getElementById('img-placeholder');
const formTitle      = document.getElementById('form-title');
const submitBtn      = document.getElementById('submit-btn');
const cancelBtn      = document.getElementById('cancel-btn');
const productList    = document.getElementById('admin-product-list');
const productCount   = document.getElementById('product-count');

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Image Preview ─────────────────────────────────────────────────────────────
function updatePreview(src) {
  if (src) {
    imgPreview.src = src;
    imgPreview.style.display = 'block';
    imgPlaceholder.style.display = 'none';
  } else {
    imgPreview.style.display = 'none';
    imgPlaceholder.style.display = 'flex';
  }
}

imageUrlInput.addEventListener('input', () => {
  const val = imageUrlInput.value.split(',')[0].trim();
  updatePreview(val);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { imageUrlInput.value = ''; updatePreview(e.target.result); };
  reader.readAsDataURL(file);
});

document.getElementById('drop-zone').addEventListener('click', () => fileInput.click());

// ── Render List ───────────────────────────────────────────────────────────────
function renderList() {
  productCount.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

  if (products.length === 0) {
    productList.innerHTML = `<div class="empty-state">
      <span class="icon">📦</span>
      <p>No products yet. Add your first one using the form!</p>
    </div>`;
    return;
  }

  productList.innerHTML = products.map(p => `
    <div class="admin-product-card">
      <img src="${p.image || ''}" alt="${p.name}"
           onerror="this.src='https://placehold.co/76x76/F0EFFF/4F46E5?text=?'">
      <div class="admin-product-info">
        ${p.category ? `<div class="admin-product-cat">${p.category}</div>` : ''}
        <div class="admin-product-name">${p.name}</div>
        <div class="admin-product-price">$${Number(p.price).toFixed(2)}</div>
        <div class="admin-product-desc">${p.desc || ''}</div>
        <div style="font-size: 0.8rem; margin-top: 0.4rem; font-weight: 600; color: ${p.stock === 0 ? 'var(--danger)' : 'var(--success)'}">
          ${p.stock !== undefined && p.stock !== null && p.stock !== '' ? `Stock: ${p.stock}` : 'Stock: Unlimited'}
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-edit"   data-id="${p.id}">Edit</button>
        <button class="btn-delete" data-id="${p.id}">Delete</button>
      </div>
    </div>`).join('');

  productList.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', () => deleteProduct(parseInt(btn.dataset.id))));
  productList.querySelectorAll('.btn-edit').forEach(btn =>
    btn.addEventListener('click', () => startEdit(parseInt(btn.dataset.id))));
}

// ── Add / Update ──────────────────────────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const name     = nameInput.value.trim();
  const price    = parseFloat(priceInput.value);
  const stockRaw = stockInput.value.trim();
  const stock    = stockRaw === '' ? null : parseInt(stockRaw);
  const category = categoryInput.value.trim();
  const desc     = descInput.value.trim();
  const rawImages = imageUrlInput.value.split(',').map(s => s.trim()).filter(Boolean);
  let images = [];
  if (fileInput.files[0]) {
    images = [imgPreview.src, ...rawImages];
  } else {
    images = rawImages;
  }
  const image = images[0] || '';

  if (!name || isNaN(price) || price <= 0) {
    showToast('Please fill in a valid name and price.', 'error');
    return;
  }

  if (editingId !== null) {
    products = products.map(p =>
      p.id === editingId ? { ...p, name, price, stock, category, desc, image, images } : p);
    saveProducts(products);
    showToast('✅ Product updated!');
    cancelEdit();
  } else {
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ id: newId, name, price, stock, category, desc, image, images });
    saveProducts(products);
    showToast('🎉 Product added!');
    resetForm();
  }
  renderList();
});

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  products = products.filter(p => p.id !== id);
  saveProducts(products);
  if (editingId === id) cancelEdit();
  renderList();
  showToast('🗑️ Product deleted.');
}

// ── Edit ──────────────────────────────────────────────────────────────────────
function startEdit(id) {
  const p = products.find(p => p.id === id);
  if (!p) return;
  editingId            = id;
  nameInput.value      = p.name;
  priceInput.value     = p.price;
  stockInput.value     = (p.stock !== undefined && p.stock !== null) ? p.stock : '';
  categoryInput.value  = p.category || '';
  descInput.value      = p.desc     || '';
  imageUrlInput.value  = (p.images && p.images.length > 0) ? p.images.join(', ') : (p.image || '');
  updatePreview(p.image || '');
  formTitle.textContent    = '✏️ Edit Product';
  submitBtn.textContent    = 'Save Changes';
  cancelBtn.style.display  = 'flex';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() { editingId = null; resetForm(); }

function resetForm() {
  form.reset();
  editingId              = null;
  formTitle.textContent  = '➕ Add New Product';
  submitBtn.textContent  = 'Add Product';
  cancelBtn.style.display = 'none';
  updatePreview('');
}

cancelBtn.addEventListener('click', cancelEdit);

// ── Init ──────────────────────────────────────────────────────────────────────
renderList();

// ── Tab Switching ─────────────────────────────────────────────────────────────
const tabProducts = document.getElementById('tab-products');
const tabMessages = document.getElementById('tab-messages');
const tabOrders   = document.getElementById('tab-orders');
const panelProducts = document.getElementById('panel-products');
const panelMessages = document.getElementById('panel-messages');
const panelOrders   = document.getElementById('panel-orders');

function setTab(active) {
  [tabProducts, tabMessages, tabOrders].forEach(t => t.classList.remove('active'));
  [panelProducts, panelMessages, panelOrders].forEach(p => p.style.display = 'none');
  stopChatPolling();
  active.classList.add('active');
}

tabProducts.addEventListener('click', () => {
  setTab(tabProducts);
  panelProducts.style.display = '';
});

tabMessages.addEventListener('click', () => {
  setTab(tabMessages);
  panelMessages.style.display = 'grid';
  loadChatList();
  startChatPolling();
});

tabOrders.addEventListener('click', () => {
  setTab(tabOrders);
  panelOrders.style.display = '';
  loadOrders();
});

// ── Admin Orders ──────────────────────────────────────────────────────────────
const ordersListEl    = document.getElementById('orders-list');
const ordersFilterEl  = document.getElementById('orders-filter');
const adminOrdersBadge = document.getElementById('admin-orders-badge');
let allOrders = [];

const STATUS_LABELS = { pending:'⏳ Pending', confirmed:'✅ Confirmed', delivered:'📦 Delivered', cancelled:'❌ Cancelled' };

function fmtDate(ts) {
  return new Date(ts).toLocaleString([], { dateStyle:'medium', timeStyle:'short' });
}

function escO(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderOrders() {
  const filter = ordersFilterEl.value;
  const orders = filter === 'all' ? allOrders : allOrders.filter(o => o.status === filter);

  // Badge for pending orders
  const pending = allOrders.filter(o => o.status === 'pending').length;
  if (pending > 0) {
    adminOrdersBadge.style.display = '';
    adminOrdersBadge.textContent = pending;
  } else {
    adminOrdersBadge.style.display = 'none';
  }

  if (orders.length === 0) {
    ordersListEl.innerHTML = `<p style="color:var(--text-muted);padding:2rem">No orders yet.</p>`;
    return;
  }

  ordersListEl.innerHTML = orders.map(o => {
    const rawPhone = (o.customer.phone || '').trim();
    const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
    const waMsg = encodeURIComponent(`Hello ${o.customer.name}! This is Adounas store regarding your order #${o.orderId} ($${Number(o.total).toFixed(2)}). Your delivery to ${o.customer.location} is being prepared!`);
    const waUrl = cleanDigits ? `https://wa.me/${cleanDigits}?text=${waMsg}` : '#';
    const telUrl = rawPhone ? `tel:${rawPhone}` : '#';

    return `
    <div class="order-card">
      <div class="order-info">
        <div class="order-id-label">Order</div>
        <div class="order-id-val">${escO(o.orderId)}</div>
        <div class="order-date">${fmtDate(o.createdAt)}</div>
        <div class="order-customer">
          <strong>${escO(o.customer.name)}</strong> · ${escO(o.customer.phone)} · ${escO(o.customer.location)}
          ${o.customer.email ? ` · <span style="color:var(--accent)">✉️ ${escO(o.customer.email)}</span>` : ''}
        </div>
        <div class="order-items-list">
          ${o.items.map(i => `${escO(i.name)} × ${i.qty}`).join(' &nbsp;|&nbsp; ')}
        </div>
        <div class="order-total">$${Number(o.total).toFixed(2)} <small style="font-size:0.75rem;font-weight:600;color:#16A34A">💵 COD</small></div>
        
        <div class="order-actions-row">
          ${cleanDigits ? `<a href="${waUrl}" target="_blank" rel="noopener" class="btn-wa">💬 WhatsApp Customer</a>` : ''}
          ${rawPhone ? `<a href="${telUrl}" class="btn-call">📞 Call</a>` : ''}
        </div>
      </div>
      <div class="order-status-col">
        <span class="order-status-badge status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
        <select class="order-status-select" data-id="${escO(o.orderId)}" onchange="updateOrderStatus('${escO(o.orderId)}', this.value)">
          <option value="pending"   ${o.status==='pending'   ? 'selected':''}>Pending</option>
          <option value="confirmed" ${o.status==='confirmed' ? 'selected':''}>Confirmed</option>
          <option value="delivered" ${o.status==='delivered' ? 'selected':''}>Delivered</option>
          <option value="cancelled" ${o.status==='cancelled' ? 'selected':''}>Cancelled</option>
        </select>
      </div>
    </div>`;
  }).join('');
}

async function loadOrders() {
  try {
    const res = await adminFetch('/api/orders');
    allOrders = await res.json();
    renderOrders();
  } catch(e) {
    ordersListEl.innerHTML = `<p style="color:var(--danger);padding:2rem">⚠️ Could not load orders. Make sure you are logged in.</p>`;
  }
}

window.updateOrderStatus = async (orderId, status) => {
  try {
    await adminFetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await loadOrders();
    showToast(`✅ Order updated to "${status}"`);
  } catch(e) {
    showToast('⚠️ Could not update order status.', 'error');
  }
};

ordersFilterEl.addEventListener('change', renderOrders);

// Test Telegram Alert
const btnTgTest = document.getElementById('btn-tg-test');
if (btnTgTest) {
  btnTgTest.addEventListener('click', async () => {
    btnTgTest.disabled = true;
    btnTgTest.textContent = 'Sending test…';
    try {
      const res = await adminFetch('/api/admin/test-telegram', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast('📱 Test alert sent to your Telegram!');
      } else {
        alert(data.error || 'Could not send Telegram test. Please make sure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set.');
      }
    } catch (e) {
      alert('⚠️ Error testing Telegram connection.');
    } finally {
      btnTgTest.disabled = false;
      btnTgTest.textContent = 'Test Telegram Alert';
    }
  });
}

// Periodically check for new orders when on Orders tab
setInterval(async () => {
  if (tabOrders.classList.contains('active') && getAdminToken()) {
    await loadOrders();
  }
}, 10000);


// ── Admin Chat ────────────────────────────────────────────────────────────────
const chatListEl       = document.getElementById('admin-chat-list');
const chatThreadEl     = document.getElementById('admin-chat-thread');
const threadMsgsEl     = document.getElementById('admin-thread-messages');
const threadInputEl    = document.getElementById('admin-thread-input');
const replyInput       = document.getElementById('admin-reply-input');
const replyBtn         = document.getElementById('admin-reply-btn');
const adminMsgBadge    = document.getElementById('admin-msg-badge');

let activeChatId   = null;
let chatPollTimer  = null;

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

async function loadChatList() {
  try {
    const res   = await adminFetch('/api/chat/all');
    const chats = await res.json();

    // Badge count
    const totalUnread = chats.reduce((s, c) => s + (c.unread || 0), 0);
    if (totalUnread > 0) {
      adminMsgBadge.style.display = '';
      adminMsgBadge.textContent   = totalUnread;
    } else {
      adminMsgBadge.style.display = 'none';
    }

    if (chats.length === 0) {
      chatListEl.innerHTML = '<div class="admin-chat-empty">No conversations yet.</div>';
      return;
    }

    chatListEl.innerHTML = chats.map(c => `
      <div class="admin-chat-item ${c.chatId === activeChatId ? 'active' : ''}" data-id="${c.chatId}">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="admin-chat-name">${escHtml(c.name)}</div>
          ${c.unread > 0 ? `<span class="admin-chat-unread">${c.unread}</span>` : ''}
        </div>
        <div class="admin-chat-preview">${escHtml(c.lastMsg)}</div>
      </div>`).join('');

    chatListEl.querySelectorAll('.admin-chat-item').forEach(el => {
      el.addEventListener('click', () => openThread(el.dataset.id));
    });
  } catch(e) { console.warn('Chat list error:', e); }
}

async function openThread(chatId) {
  activeChatId = chatId;
  chatListEl.querySelectorAll('.admin-chat-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === chatId);
  });

  try {
    const res  = await adminFetch(`/api/chat/thread?chatId=${chatId}`);
    const chat = await res.json();

    chatThreadEl.querySelector('.admin-chat-placeholder') && (chatThreadEl.querySelector('.admin-chat-placeholder').style.display = 'none');
    threadMsgsEl.style.display  = 'flex';
    threadInputEl.style.display = 'flex';

    let header = chatThreadEl.querySelector('.admin-thread-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'admin-thread-header';
      chatThreadEl.insertBefore(header, threadMsgsEl);
    }
    header.textContent = `💬 ${chat.name}`;

    renderThreadMessages(chat.messages);
    replyInput.focus();
    loadChatList();
  } catch(e) { console.warn('Thread error:', e); }
}

function renderThreadMessages(msgs) {
  threadMsgsEl.innerHTML = '';
  msgs.forEach(m => {
    const div = document.createElement('div');
    div.className = `chat-msg ${m.sender === 'admin' ? 'admin' : 'customer'}`;
    div.innerHTML = `${escHtml(m.text)}<span class="chat-msg-time">${fmtTime(m.ts)}</span>`;
    threadMsgsEl.appendChild(div);
  });
  threadMsgsEl.scrollTop = threadMsgsEl.scrollHeight;
}

async function sendAdminReply() {
  const text = replyInput.value.trim();
  if (!text || !activeChatId) return;
  replyInput.value = '';
  try {
    await adminFetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: activeChatId, sender: 'admin', text }),
    });
    const res  = await adminFetch(`/api/chat/thread?chatId=${activeChatId}`);
    const chat = await res.json();
    renderThreadMessages(chat.messages);
  } catch(e) { console.warn('Reply error:', e); }
}

replyBtn.addEventListener('click', sendAdminReply);
replyInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendAdminReply(); });

function startChatPolling() {
  if (chatPollTimer) return;
  chatPollTimer = setInterval(async () => {
    if (!getAdminToken()) return;
    await loadChatList();
    if (activeChatId) {
      try {
        const res  = await adminFetch(`/api/chat/sync?chatId=${activeChatId}`);
        const data = await res.json();
        renderThreadMessages(data.messages || []);
      } catch(e) {}
    }
  }, 4000);
}


function stopChatPolling() {
  clearInterval(chatPollTimer);
  chatPollTimer = null;
}
