import './style.css'
import './adaptive.js'
import { initAuth, getCurrentUser, openAuthModal, updateAuthUI } from './auth.js'

// ── Currency Formatter (Senegal / FCFA) ──────────────────────────────────────
export function formatFCFA(amount) {
  const num = Math.round(Number(amount) || 0);
  return `${num.toLocaleString('fr-FR')} FCFA`;
}

// ── Seed Products (FCFA) ──────────────────────────────────────────────────────
const SEED_PRODUCTS = [
  { id: 1, name: 'Solo Obsidian Backpack', price: 35000, comparePrice: 45000, category: 'Bags',
    desc: 'Sac à dos en cuir mat haut de gamme conçu pour les minimalistes. Résistant aux intempéries et idéal pour un usage quotidien.',
    image: '/bag.png', stock: 25, status: 'active', vendor: 'Solo Dakar' },
  { id: 2, name: 'Solo Chronos Watch', price: 55000, comparePrice: 65000, category: 'Accessories',
    desc: 'L’esthétique sombre rencontre l’ingénierie de précision. Une montre minimaliste avec une finition noir furtif.',
    image: '/watch.png', stock: 15, status: 'active', vendor: 'Solo Dakar' }
];

// ── Store ─────────────────────────────────────────────────────────────────────
function loadProducts() {
  const s = localStorage.getItem('solo_products');
  if (s) {
    let prods = JSON.parse(s);
    // Convert old USD seed prices (< 1000) to FCFA
    let migrated = false;
    prods = prods.map(p => {
      if (p.price && p.price < 1000) {
        migrated = true;
        return {
          ...p,
          price: Math.round(p.price * 600),
          comparePrice: p.comparePrice ? Math.round(p.comparePrice * 600) : null
        };
      }
      return p;
    });
    if (migrated) localStorage.setItem('solo_products', JSON.stringify(prods));
    return prods;
  }
  localStorage.setItem('solo_products', JSON.stringify(SEED_PRODUCTS));
  return SEED_PRODUCTS;
}

// cart = [{id, qty}]
function loadCart() {
  return JSON.parse(localStorage.getItem('solo_cart') || '[]');
}
function saveCart(c) {
  localStorage.setItem('solo_cart', JSON.stringify(c));
}

let products = loadProducts();
let cart     = loadCart();
let activeCategory = 'all';
let qvQty = 1;
let qvProductId = null;

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const productGrid      = $('product-grid');
const cartIconEl       = $('cart-icon');
const cartSidebar      = $('cart-sidebar');
const closeCartBtn     = $('close-cart');
const overlay          = $('overlay');
const cartItemsEl      = $('cart-items');
const cartCountEl      = $('cart-count');
const cartQtyLabel     = $('cart-qty-label');
const cartTotalPriceEl = $('cart-total-price');
const filterTabs       = $('filter-tabs');
const searchToggle     = $('search-toggle');
const searchWrapper    = $('search-bar-wrapper');
const searchInput      = $('search-input');
const searchClear      = $('search-clear');
const hamburger        = $('hamburger');
const mobileDrawer     = $('mobile-drawer');
const qvOverlay        = $('qv-overlay');
const qvClose          = $('qv-close');
const qvQtyMinus       = $('qv-qty-minus');
const qvQtyPlus        = $('qv-qty-plus');
const qvQtyVal         = $('qv-qty-val');
const qvAddBtn         = $('qv-add-btn');
const checkoutBtn      = $('checkout-btn');

// ── Categories ────────────────────────────────────────────────────────────────
function buildFilterTabs() {
  if (!filterTabs) return;
  const cats = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  filterTabs.innerHTML = cats.map(c => `
    <button class="filter-tab ${c === activeCategory ? 'active' : ''}" data-cat="${c}">
      ${c === 'all' ? 'All' : c}
    </button>`).join('');
  filterTabs.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      buildFilterTabs();
      renderProducts();
    });
  });
}

// ── Render Products ───────────────────────────────────────────────────────────
function renderProducts() {
  if (!productGrid) return; // Only on index
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  let filtered = products.filter(p => {
    if (p.status === 'draft') return false;
    const matchCat   = activeCategory === 'all' || p.category === activeCategory;
    const matchQuery = !query || p.name.toLowerCase().includes(query) || (p.desc || '').toLowerCase().includes(query);
    return matchCat && matchQuery;
  });

  if (filtered.length === 0) {
    productGrid.innerHTML = `<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;font-size:1.1rem;padding:3rem 0">
      No products found. <a href="/admin.html" style="color:var(--accent);font-weight:700">Add some in Admin →</a></p>`;
    return;
  }

  productGrid.innerHTML = filtered.map(p => {
    const isSale = p.comparePrice && Number(p.comparePrice) > Number(p.price);
    const compareHtml = isSale ? `<span style="text-decoration:line-through; color:var(--text-light); font-size:0.85rem; margin-left:0.35rem;">${formatFCFA(p.comparePrice)}</span>` : '';

    return `
    <div class="product-card" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${p.name}">
      <div class="img-container">
        ${p.stock === 0 ? `<div class="img-badge out-of-stock-badge" style="background:var(--danger); color:white;">Épuisé</div>` : (isSale ? `<div class="img-badge" style="background:#6D28D9; color:white; font-weight:700;">PROMO</div>` : (p.category ? `<div class="img-badge">${p.category}</div>` : ''))}
        <img src="${(p.images && p.images[0]) || p.image || ''}" alt="${p.name}" class="product-image"
          onerror="this.src='https://placehold.co/600x400/F0EFFF/4F46E5?text=Solo'" style="${p.stock === 0 ? 'opacity: 0.5; filter: grayscale(1);' : ''}">
      </div>
      <div class="product-info">
        ${p.category ? `<div class="product-category">${p.category}</div>` : ''}
        <h3 class="product-title">${p.name}</h3>
        <p class="product-desc">${p.desc || ''}</p>
        <div class="product-footer">
          <div class="product-price">${formatFCFA(p.price)} ${compareHtml}</div>
          ${p.stock === 0 ? `<button class="add-to-cart-btn disabled" disabled style="background:var(--border); color:var(--text-muted); cursor:not-allowed;">Épuisé</button>` : `<button class="add-to-cart-btn" data-id="${p.id}">+ Panier</button>`}
        </div>
      </div>
    </div>`;
  }).join('');

  // Card click → product detail page
  productGrid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', e => {
      if (!e.target.classList.contains('add-to-cart-btn')) {
        window.location.href = `/product.html?id=${card.dataset.id}`;
      }
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter') window.location.href = `/product.html?id=${card.dataset.id}`;
    });
  });

  // Add to cart inline button
  productGrid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      addToCart(parseInt(btn.dataset.id), 1);
      animateBtn(btn);
    });
  });

  // Scroll-in animation
  const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  productGrid.querySelectorAll('.product-card').forEach(c => observer.observe(c));
}

function animateBtn(btn) {
  const orig = btn.textContent;
  btn.textContent = '✓ Ajouté!';
  btn.style.background = 'var(--accent)';
  btn.style.color = 'white';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = '';
    btn.style.color = '';
  }, 1200);
}

// ── Cart Logic ────────────────────────────────────────────────────────────────
function addToCart(productId, qty = 1) {
  const p = products.find(p => p.id === productId);
  if (!p) return;

  const existing = cart.find(c => c.id === productId);
  const currentQty = existing ? existing.qty : 0;
  
  // Check stock limit
  if (p.stock !== undefined && p.stock !== null) {
    if (currentQty + qty > p.stock) {
      alert(`Désolé, seulement ${p.stock} unités disponibles en stock.`);
      qty = p.stock - currentQty;
      if (qty <= 0) return;
    }
  }

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: productId, price: p.price, name: p.name, image: p.image, qty });
  }
  saveCart(cart);
  updateCartUI();
  openCart();
}

function setCartQty(productId, qty) {
  const p = products.find(p => p.id === productId);
  if (!p) return;

  if (p.stock !== undefined && p.stock !== null && qty > p.stock) {
    alert(`Désolé, seulement ${p.stock} unités disponibles en stock.`);
    qty = p.stock;
  }

  if (qty <= 0) {
    cart = cart.filter(c => c.id !== productId);
  } else {
    const item = cart.find(c => c.id === productId);
    if (item) item.qty = qty;
  }
  saveCart(cart);
  updateCartUI();
}

function updateCartUI() {
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);

  // Count badge
  cartCountEl.textContent = totalQty;
  cartCountEl.classList.toggle('visible', totalQty > 0);
  cartQtyLabel.textContent = totalQty > 0 ? `(${totalQty})` : '';

  // Items list
  if (cart.length === 0) {
    cartItemsEl.innerHTML = `<div class="empty-cart">
      <div class="empty-icon">🛒</div>
      <p>Votre panier est vide.</p>
    </div>`;
  } else {
    cartItemsEl.innerHTML = cart.map(c => {
      const p = products.find(p => p.id === c.id);
      const itemName = c.name || (p ? p.name : 'Produit');
      const itemPrice = c.price || (p ? p.price : 0);
      const itemImg = c.image || (p ? p.image : '');

      return `<div class="cart-item">
        <img src="${itemImg}" alt="${itemName}"
             onerror="this.src='https://placehold.co/72x72/F0EFFF/4F46E5?text=?'">
        <div class="cart-item-info">
          <div class="cart-item-name">${itemName}</div>
          <div class="cart-item-price">${formatFCFA(Number(itemPrice) * c.qty)}</div>
          <div class="cart-qty-stepper">
            <button class="stepper-btn" data-action="dec" data-id="${c.id}">−</button>
            <span class="stepper-qty">${c.qty}</span>
            <button class="stepper-btn" data-action="inc" data-id="${c.id}">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-id="${c.id}" aria-label="Supprimer ${itemName}">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>`;
    }).join('');

    // Stepper listeners
    cartItemsEl.querySelectorAll('.stepper-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const item = cart.find(c => c.id === id);
        if (!item) return;
        setCartQty(id, item.qty + (btn.dataset.action === 'inc' ? 1 : -1));
      });
    });

    // Remove listeners
    cartItemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => setCartQty(parseInt(btn.dataset.id), 0));
    });
  }

  // Total
  const total = cart.reduce((s, c) => {
    const p = products.find(p => p.id === c.id);
    const itemPrice = c.price || (p ? p.price : 0);
    return s + (Number(itemPrice) * c.qty);
  }, 0);
  cartTotalPriceEl.textContent = formatFCFA(total);
}

// ── Quick-View ────────────────────────────────────────────────────────────────
function openQuickView(id) {
  const p = products.find(p => p.id === id);
  if (!p) return;
  qvProductId = id;
  qvQty = 1;
  $('qv-qty-val').textContent = 1;
  $('qv-image').src = (p.images && p.images[0]) || p.image || '';
  $('qv-name').textContent = p.name;
  $('qv-desc').textContent = p.desc || '';
  $('qv-price').textContent = formatFCFA(p.price);
  $('qv-category').textContent = p.category || '';
  qvOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeQuickView() {
  qvOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

qvClose.addEventListener('click', closeQuickView);
qvOverlay.addEventListener('click', e => { if (e.target === qvOverlay) closeQuickView(); });
qvQtyMinus.addEventListener('click', () => { if (qvQty > 1) { qvQty--; qvQtyVal.textContent = qvQty; } });
qvQtyPlus.addEventListener('click',  () => { qvQty++; qvQtyVal.textContent = qvQty; });
qvAddBtn.addEventListener('click', () => {
  if (qvProductId) {
    addToCart(qvProductId, qvQty);
    closeQuickView();
  }
});

// ── Cash on Delivery Checkout ─────────────────────────────────────────────────
async function executeOrder(user) {
  const locInput   = document.getElementById('delivery-location');
  const phoneInput = document.getElementById('delivery-phone');
  const nameInput  = document.getElementById('delivery-name');

  const location = locInput   ? locInput.value.trim()   : '';
  const phone    = phoneInput ? phoneInput.value.trim()  : '';
  const custName = nameInput  ? nameInput.value.trim()   : (user ? user.name : '');

  // Build order payload
  const items = cart.map(c => {
    const p = products.find(p => p.id === c.id);
    if (!p) return null;
    return { id: p.id, name: p.name, price: p.price, qty: c.qty, image: p.image || '' };
  }).filter(Boolean);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const origText = checkoutBtn.textContent;
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = '⏳ Placing order…';

  try {
    const res  = await fetch('/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          name: custName,
          phone,
          location,
          email: user ? user.email : '',
          userId: user ? user.id || user.userId : ''
        },
        items,
        total
      }),
    });
    const data = await res.json();

    if (data.orderId) {
      saveCart([]);
      cart = [];
      window.location.href = `/suivi.html?id=${data.orderId}`;
    } else {
      throw new Error(data.error || 'Order failed.');
    }
  } catch (err) {
    console.error('Order error:', err);
    showCartToast('⚠️ Could not place order. Please try again.');
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = origText;
  }
}

checkoutBtn.addEventListener('click', async () => {
  if (cart.length === 0) return;

  const locInput   = document.getElementById('delivery-location');
  const phoneInput = document.getElementById('delivery-phone');
  const nameInput  = document.getElementById('delivery-name');

  const location = locInput   ? locInput.value.trim()   : '';
  const phone    = phoneInput ? phoneInput.value.trim()  : '';
  const custName = nameInput  ? nameInput.value.trim()   : '';

  if (!custName) {
    showCartToast('⚠️ Veuillez entrer votre nom complet.');
    if (nameInput) nameInput.focus();
    return;
  }
  if (!phone) {
    showCartToast('⚠️ Veuillez entrer votre numéro de téléphone (WhatsApp).');
    if (phoneInput) phoneInput.focus();
    return;
  }
  if (!location) {
    showCartToast('⚠️ Veuillez entrer votre adresse de livraison.');
    if (locInput) locInput.focus();
    return;
  }

  // Allow guest checkout directly (attach user session if logged in)
  const user = getCurrentUser();
  await executeOrder(user);
});

function showCartToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'2rem', left:'50%', transform:'translateX(-50%)',
    background:'#EF4444', color:'white', padding:'0.85rem 1.75rem',
    borderRadius:'999px', fontFamily:'inherit', fontWeight:'700',
    fontSize:'0.9rem', zIndex:'9999', boxShadow:'0 8px 24px rgba(239,68,68,0.3)',
    transition:'opacity 0.3s'
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}

// ── Cart UI Toggles ───────────────────────────────────────────────────────────
function openCart() {
  const user = getCurrentUser();
  const nameInput = document.getElementById('delivery-name');
  if (user && user.name && nameInput && !nameInput.value) {
    nameInput.value = user.name;
  }
  cartSidebar.classList.add('open');
  overlay.classList.add('visible');
}
function closeCart() {
  cartSidebar.classList.remove('open');
  overlay.classList.remove('visible');
}
window.closeCartFn = closeCart; // expose for inline onclick
window.openCartFn = openCart;
window.updateCartUI = () => {
  cart = loadCart(); // refresh from storage
  updateCartUI();
};

cartIconEl.addEventListener('click', openCart);
closeCartBtn.addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);

// ── Search ────────────────────────────────────────────────────────────────────
let searchOpen = false;
if (searchToggle) {
  searchToggle.addEventListener('click', () => {
    searchOpen = !searchOpen;
    searchWrapper.classList.toggle('open', searchOpen);
    if (searchOpen) { setTimeout(() => searchInput.focus(), 50); }
    else { searchInput.value = ''; searchClear.classList.remove('visible'); if (productGrid) renderProducts(); }
  });
  searchInput.addEventListener('input', () => {
    searchClear.classList.toggle('visible', searchInput.value.length > 0);
    if (productGrid) renderProducts();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !productGrid) {
      window.location.href = `/?search=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = ''; searchClear.classList.remove('visible'); searchInput.focus(); if (productGrid) renderProducts();
  });
}

// ── Mobile Menu ───────────────────────────────────────────────────────────────
if (hamburger) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileDrawer.classList.toggle('open');
  });
  // Close drawer on link click
  mobileDrawer.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileDrawer.classList.remove('open');
    });
  });
}

// ── Navbar shadow on scroll ───────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,0.08)' : '';
  }, { passive: true });
}

// ── GPS Geolocation Helper ───────────────────────────────────────────────────
function initGPSLocation() {
  const btnGps = document.getElementById('btn-gps');
  const locInput = document.getElementById('delivery-location');
  const gpsStatus = document.getElementById('gps-status');
  const gpsText = document.getElementById('btn-gps-text');
  if (!btnGps || !locInput) return;

  btnGps.addEventListener('click', () => {
    if (!navigator.geolocation) {
      if (gpsStatus) {
        gpsStatus.style.display = 'block';
        gpsStatus.className = 'gps-status error';
        gpsStatus.textContent = '❌ Geolocation is not supported by your browser.';
      }
      return;
    }

    btnGps.classList.add('loading');
    if (gpsText) gpsText.textContent = 'Locating…';
    if (gpsStatus) {
      gpsStatus.style.display = 'block';
      gpsStatus.className = 'gps-status';
      gpsStatus.textContent = '📡 Detecting your current location…';
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (data && data.address) {
            locInput.value = data.address;
            if (gpsStatus) {
              gpsStatus.className = 'gps-status';
              gpsStatus.textContent = '✅ Location detected successfully!';
              setTimeout(() => { if (gpsStatus) gpsStatus.style.display = 'none'; }, 3500);
            }
          }
        } catch {
          locInput.value = `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
          if (gpsStatus) {
            gpsStatus.textContent = '✅ GPS coordinates captured.';
          }
        } finally {
          btnGps.classList.remove('loading');
          if (gpsText) gpsText.textContent = 'GPS';
        }
      },
      () => {
        btnGps.classList.remove('loading');
        if (gpsText) gpsText.textContent = 'GPS';
        if (gpsStatus) {
          gpsStatus.style.display = 'block';
          gpsStatus.className = 'gps-status error';
          gpsStatus.textContent = '⚠️ Location permission denied or unavailable.';
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('search') && searchInput) {
  searchInput.value = urlParams.get('search');
  searchOpen = true;
  if (searchWrapper) searchWrapper.classList.add('open');
  if (searchClear) searchClear.classList.add('visible');
}

buildFilterTabs();
renderProducts();
updateCartUI();
initAuth();
initGPSLocation();
