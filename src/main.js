import './style.css'
import './adaptive.js'
import { initAuth, getCurrentUser, openAuthModal, updateAuthUI } from './auth.js'

// ── Currency Formatter (Senegal / FCFA) ──────────────────────────────────────
export function formatFCFA(amount) {
  const num = Math.round(Number(amount) || 0);
  return `${num.toLocaleString('fr-FR')} FCFA`;
}

// ── Color Swatch Dictionary & Helper ──────────────────────────────────────────
const COLOR_MAP = {
  'noir': '#111827',
  'black': '#111827',
  'noir mat': '#1F2937',
  'noir furtif': '#0F172A',
  'blanc': '#FFFFFF',
  'white': '#FFFFFF',
  'blanc pur': '#FFFFFF',
  'gris': '#6B7280',
  'grey': '#6B7280',
  'anthracite': '#374151',
  'argent': '#CBD5E1',
  'argent pur': '#E2E8F0',
  'silver': '#E2E8F0',
  'marron': '#78350F',
  'brown': '#78350F',
  'marron cuir': '#854D0E',
  'cognac': '#9A3412',
  'cuir': '#92400E',
  'cuir véritable': '#78350F',
  'caramel': '#B45309',
  'beige': '#F5F5DC',
  'taupe': '#8B8589',
  'camel': '#C19A6B',
  'bleu': '#1E40AF',
  'blue': '#1E40AF',
  'bleu nuit': '#0F172A',
  'navy': '#1E3A8A',
  'bleu marine': '#172554',
  'bleu ciel': '#60A5FA',
  'or': '#F59E0B',
  'gold': '#F59E0B',
  'or royal': '#D97706',
  'rose gold': '#E0A899',
  'bronze': '#CD7F32',
  'vert': '#15803D',
  'green': '#15803D',
  'vert olive': '#556B2F',
  'rouge': '#DC2626',
  'red': '#DC2626',
  'bordeaux': '#881337',
  'acier inox': '#94A3B8',
  'acier': '#64748B'
};

function detectColorHex(colorName) {
  if (!colorName) return '#374151';
  const clean = colorName.trim().toLowerCase();
  if (COLOR_MAP[clean]) return COLOR_MAP[clean];
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (clean.includes(key)) return hex;
  }
  return '#4F46E5';
}

// ── Seed Products (FCFA) with Color & Option Variants ─────────────────────────
const SEED_PRODUCTS = [
  {
    id: 1,
    name: 'Solo Obsidian Backpack',
    price: 35000,
    comparePrice: 45000,
    category: 'Bags',
    desc: 'Sac à dos en cuir mat haut de gamme conçu pour les minimalistes. Résistant aux intempéries et idéal pour un usage quotidien.',
    image: '/bag.png',
    images: ['/bag.png'],
    stock: 25,
    status: 'active',
    vendor: 'Solo Dakar',
    sku: 'SLO-BP-001',
    hasVariants: true,
    options: [
      { name: 'Couleur', values: ['Noir Mat', 'Marron Cuir', 'Bleu Nuit'] },
      { name: 'Capacité', values: ['20 Litres', '25 Litres'] }
    ],
    variants: [
      { title: 'Noir Mat / 20 Litres', price: 35000, stock: 12, sku: 'SLO-BP-BLK-20', image: '/bag.png' },
      { title: 'Noir Mat / 25 Litres', price: 39000, stock: 8, sku: 'SLO-BP-BLK-25', image: '/bag.png' },
      { title: 'Marron Cuir / 20 Litres', price: 37000, stock: 7, sku: 'SLO-BP-BRN-20', image: '/bag.png' },
      { title: 'Marron Cuir / 25 Litres', price: 42000, stock: 5, sku: 'SLO-BP-BRN-25', image: '/bag.png' },
      { title: 'Bleu Nuit / 20 Litres', price: 35000, stock: 6, sku: 'SLO-BP-BLU-20', image: '/bag.png' },
      { title: 'Bleu Nuit / 25 Litres', price: 39000, stock: 4, sku: 'SLO-BP-BLU-25', image: '/bag.png' }
    ]
  },
  {
    id: 2,
    name: 'Solo Chronos Watch',
    price: 55000,
    comparePrice: 65000,
    category: 'Accessories',
    desc: 'L’esthétique sombre rencontre l’ingénierie de précision. Une montre minimaliste avec une finition noir furtif.',
    image: '/watch.png',
    images: ['/watch.png'],
    stock: 15,
    status: 'active',
    vendor: 'Solo Dakar',
    sku: 'SLO-WT-002',
    hasVariants: true,
    options: [
      { name: 'Couleur', values: ['Noir Furtif', 'Argent Pur', 'Or Royal'] },
      { name: 'Bracelet', values: ['Cuir Véritable', 'Acier Inox'] }
    ],
    variants: [
      { title: 'Noir Furtif / Cuir Véritable', price: 55000, stock: 8, sku: 'SLO-WT-BLK-LTR', image: '/watch.png' },
      { title: 'Noir Furtif / Acier Inox', price: 60000, stock: 4, sku: 'SLO-WT-BLK-STL', image: '/watch.png' },
      { title: 'Argent Pur / Cuir Véritable', price: 55000, stock: 6, sku: 'SLO-WT-SLV-LTR', image: '/watch.png' },
      { title: 'Argent Pur / Acier Inox', price: 60000, stock: 5, sku: 'SLO-WT-SLV-STL', image: '/watch.png' },
      { title: 'Or Royal / Cuir Véritable', price: 65000, stock: 4, sku: 'SLO-WT-GLD-LTR', image: '/watch.png' },
      { title: 'Or Royal / Acier Inox', price: 70000, stock: 3, sku: 'SLO-WT-GLD-STL', image: '/watch.png' }
    ]
  }
];

// ── Store ─────────────────────────────────────────────────────────────────────
function loadProducts() {
  const s = localStorage.getItem('solo_products');
  if (s) {
    try {
      let prods = JSON.parse(s);
      let migrated = false;
      prods = prods.map(p => {
        if (p.price && p.price < 1000) {
          migrated = true;
          p.price = Math.round(p.price * 600);
          p.comparePrice = p.comparePrice ? Math.round(p.comparePrice * 600) : null;
        }
        if ((p.id === 1 || p.id === 2) && (!p.options || p.options.length === 0)) {
          const seed = SEED_PRODUCTS.find(sp => sp.id === p.id);
          if (seed) {
            p.options = seed.options;
            p.variants = seed.variants;
            p.hasVariants = seed.hasVariants;
            migrated = true;
          }
        }
        return p;
      });
      if (migrated) localStorage.setItem('solo_products', JSON.stringify(prods));
      if (prods.length > 0) return prods;
    } catch {}
  }
  localStorage.setItem('solo_products', JSON.stringify(SEED_PRODUCTS));
  return SEED_PRODUCTS;
}

// cart = [{id, variantKey, variantTitle, price, name, image, qty}]
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('solo_cart') || '[]');
  } catch {
    return [];
  }
}
function saveCart(c) {
  localStorage.setItem('solo_cart', JSON.stringify(c));
}

let products = loadProducts();
let cart     = loadCart();
let activeCategory = 'all';
let qvQty = 1;
let qvProductId = null;
let qvSelectedVariant = null;

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
const qvVariants       = $('qv-variants');
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
      const pId = parseInt(btn.dataset.id);
      const p = products.find(prod => prod.id === pId);
      if (p && p.hasVariants && p.variants && p.variants.length > 0) {
        openQuickView(pId);
      } else {
        addToCart(pId, 1);
        animateBtn(btn);
      }
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
function addToCart(productId, qty = 1, variant = null) {
  const p = products.find(p => p.id === productId);
  if (!p) return;

  const itemKey = variant ? `${p.id}_${variant.title}` : p.id;
  const existing = cart.find(c => (c.variantKey ? c.variantKey === itemKey : c.id === p.id && !c.variantKey));
  const currentQty = existing ? existing.qty : 0;
  
  const effectiveStock = (variant && variant.stock !== undefined) ? variant.stock : (p.stock !== undefined ? p.stock : 20);
  const effectivePrice = (variant && variant.price !== undefined) ? variant.price : p.price;
  const effectiveName  = variant ? `${p.name} (${variant.title})` : p.name;
  const effectiveImg   = (variant && variant.image) || (p.images && p.images[0]) || p.image || '';

  // Check stock limit
  if (effectiveStock !== undefined && effectiveStock !== null) {
    if (currentQty + qty > effectiveStock) {
      alert(`Désolé, seulement ${effectiveStock} unités disponibles en stock.`);
      qty = effectiveStock - currentQty;
      if (qty <= 0) return;
    }
  }

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: productId,
      variantKey: itemKey,
      variantTitle: variant ? variant.title : null,
      price: effectivePrice,
      name: effectiveName,
      image: effectiveImg,
      qty
    });
  }
  saveCart(cart);
  updateCartUI();
  openCart();
}

function updateCartUI() {
  const totalQty = cart.reduce((s, c) => s + (c.qty || 1), 0);

  // Count badge
  if (cartCountEl) {
    cartCountEl.textContent = totalQty;
    cartCountEl.classList.toggle('visible', totalQty > 0);
  }
  if (cartQtyLabel) {
    cartQtyLabel.textContent = totalQty > 0 ? `(${totalQty})` : '';
  }

  // Items list
  if (!cartItemsEl) return;
  if (cart.length === 0) {
    cartItemsEl.innerHTML = `<div class="empty-cart">
      <div class="empty-icon">🛒</div>
      <p>Votre panier est vide.</p>
    </div>`;
  } else {
    cartItemsEl.innerHTML = cart.map((c, idx) => {
      const p = products.find(p => p.id === c.id);
      const itemName = c.name || (p ? p.name : 'Produit');
      const itemPrice = c.price || (p ? p.price : 0);
      const itemImg = c.image || (p ? p.image : '');
      const variantTag = c.variantTitle ? `<span class="cart-variant-tag">${c.variantTitle}</span>` : '';

      return `<div class="cart-item">
        <img src="${itemImg}" alt="${itemName}"
             onerror="this.src='https://placehold.co/72x72/F0EFFF/4F46E5?text=?'">
        <div class="cart-item-info">
          <div class="cart-item-name">${itemName}</div>
          ${variantTag}
          <div class="cart-item-price">${formatFCFA(Number(itemPrice) * (c.qty || 1))}</div>
          <div class="cart-qty-stepper">
            <button class="stepper-btn" data-action="dec" data-idx="${idx}">−</button>
            <span class="stepper-qty">${c.qty || 1}</span>
            <button class="stepper-btn" data-action="inc" data-idx="${idx}">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-idx="${idx}" aria-label="Supprimer ${itemName}">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>`;
    }).join('');

    // Stepper listeners
    cartItemsEl.querySelectorAll('.stepper-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        if (!cart[idx]) return;
        const newQty = (cart[idx].qty || 1) + (btn.dataset.action === 'inc' ? 1 : -1);
        if (newQty <= 0) {
          cart.splice(idx, 1);
        } else {
          cart[idx].qty = newQty;
        }
        saveCart(cart);
        updateCartUI();
      });
    });

    // Remove listeners
    cartItemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        if (cart[idx]) {
          cart.splice(idx, 1);
          saveCart(cart);
          updateCartUI();
        }
      });
    });
  }

  // Total
  const total = cart.reduce((s, c) => {
    const p = products.find(p => p.id === c.id);
    const itemPrice = c.price || (p ? p.price : 0);
    return s + (Number(itemPrice) * (c.qty || 1));
  }, 0);
  if (cartTotalPriceEl) cartTotalPriceEl.textContent = formatFCFA(total);
}

// ── Quick-View ────────────────────────────────────────────────────────────────
function openQuickView(id) {
  const p = products.find(p => p.id === id);
  if (!p) return;
  qvProductId = id;
  qvQty = 1;
  qvSelectedVariant = null;

  $('qv-qty-val').textContent = 1;
  $('qv-image').src = (p.images && p.images[0]) || p.image || '';
  $('qv-name').textContent = p.name;
  $('qv-desc').textContent = p.desc || '';
  $('qv-price').textContent = formatFCFA(p.price);
  $('qv-category').textContent = p.category || '';

  // Render Variants & Color Swatches if available
  if (qvVariants) {
    if (p.hasVariants && p.options && p.options.length > 0 && p.variants && p.variants.length > 0) {
      qvVariants.style.display = 'flex';
      const selectedOpts = {};
      p.options.forEach(opt => {
        selectedOpts[opt.name] = (opt.values && opt.values[0]) || '';
      });

      function updateQVVariant() {
        const combo = Object.values(selectedOpts).join(' / ');
        const match = p.variants.find(v => v.title === combo) || p.variants[0];
        if (match) {
          qvSelectedVariant = match;
          const pr = match.price !== undefined ? match.price : p.price;
          $('qv-price').textContent = formatFCFA(pr);
          if (match.image) $('qv-image').src = match.image;
        }
      }

      qvVariants.innerHTML = p.options.map(opt => {
        const isColor = /(couleur|color|teinte|coloris)/i.test(opt.name);
        if (isColor) {
          return `
            <div class="pdp-option-group" data-option="${opt.name}">
              <div class="pdp-option-header">${opt.name}: <span class="pdp-option-selected-val" style="font-weight:700;color:var(--accent);">${selectedOpts[opt.name]}</span></div>
              <div class="pdp-color-swatches-grid">
                ${(opt.values || []).map((val, idx) => `
                  <button type="button" class="pdp-color-swatch-pill ${idx === 0 ? 'active' : ''}" data-option="${opt.name}" data-val="${val}">
                    <span class="swatch-color-dot" style="background-color: ${detectColorHex(val)};"></span>
                    <span class="swatch-name">${val}</span>
                    <span class="swatch-check">✓</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `;
        }
        return `
          <div class="pdp-option-group" data-option="${opt.name}">
            <div class="pdp-option-header">${opt.name}: <span class="pdp-option-selected-val" style="font-weight:700;color:var(--accent);">${selectedOpts[opt.name]}</span></div>
            <div class="pdp-option-pills">
              ${(opt.values || []).map((val, idx) => `
                <button type="button" class="pdp-option-pill ${idx === 0 ? 'active' : ''}" data-option="${opt.name}" data-val="${val}">
                  ${val}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

      qvVariants.querySelectorAll('.pdp-option-pill, .pdp-color-swatch-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const optName = btn.dataset.option;
          const optVal = btn.dataset.val;
          selectedOpts[optName] = optVal;

          const group = btn.closest('.pdp-option-group');
          group.querySelectorAll('.pdp-option-pill, .pdp-color-swatch-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          group.querySelector('.pdp-option-selected-val').textContent = optVal;

          updateQVVariant();
        });
      });

      updateQVVariant();
    } else {
      qvVariants.style.display = 'none';
      qvVariants.innerHTML = '';
    }
  }

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
    addToCart(qvProductId, qvQty, qvSelectedVariant);
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
    return {
      id: p.id,
      name: c.name || p.name,
      variantTitle: c.variantTitle || null,
      price: c.price || p.price,
      qty: c.qty || 1,
      image: c.image || p.image || ''
    };
  }).filter(Boolean);

  const total = items.reduce((s, i) => s + (i.price * i.qty), 0);

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

function saveProducts(p) {
  localStorage.setItem('solo_products', JSON.stringify(p));
}

async function syncProductsFromServer() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      const serverProds = data.products || (Array.isArray(data) ? data : []);
      if (serverProds.length > 0) {
        products = serverProds;
        saveProducts(serverProds);
        buildFilterTabs();
        renderProducts();
      }
    }
  } catch (err) {
    console.warn('Could not sync products from server:', err);
  }
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
syncProductsFromServer();
