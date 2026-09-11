import './style.css';
import './product.css';
import './adaptive.js';

// ── Currency Formatter (Senegal / FCFA) ──────────────────────────────────────
function formatFCFA(amount) {
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

// ── Fallback Seed Products with Multi-Color Variants ──────────────────────────
const SEED_PRODUCTS = [
  {
    id: 1,
    name: 'Solo Obsidian Backpack',
    price: 35000,
    comparePrice: 45000,
    category: 'Bags',
    desc: 'Sac à dos en cuir mat haut de gamme conçu pour les minimalistes. Résistant aux intempéries et idéal pour un usage quotidien à Dakar.',
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
    desc: 'L’esthétique sombre rencontre l’ingénierie de précision. Une montre minimaliste avec finition de prestige.',
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

// ── Read URL Query & Find Product ────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const productId = parseInt(params.get('id')) || 1;

let products = loadProducts();
let product = products.find(p => p.id === productId) || (productId === 1 ? products[0] : null);

const loadingEl   = document.getElementById('pdp-loading');
const contentEl   = document.getElementById('pdp-content');

// Sync from backend server
async function fetchLiveProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      const serverProds = data.products || (Array.isArray(data) ? data : []);
      if (serverProds.length > 0) {
        localStorage.setItem('solo_products', JSON.stringify(serverProds));
        if (!product) {
          const found = serverProds.find(p => p.id === productId);
          if (found) window.location.reload();
        }
      }
    }
  } catch (err) {
    console.warn('Could not sync product from server:', err);
  }
}
fetchLiveProducts();

if (!product) {
  loadingEl.innerHTML = `
    <h2>Recherche du produit…</h2>
    <p style="color:var(--text-muted);margin:1rem 0;">Chargement des données en direct depuis le serveur…</p>
  `;
  fetch(`/api/products?id=${productId}`)
    .then(r => r.json())
    .then(p => {
      if (p && p.id) {
        const s = localStorage.getItem('solo_products');
        const list = s ? JSON.parse(s) : [];
        const idx = list.findIndex(item => item.id === p.id);
        if (idx !== -1) list[idx] = p;
        else list.push(p);
        localStorage.setItem('solo_products', JSON.stringify(list));
        window.location.reload();
      } else {
        loadingEl.innerHTML = `
          <h2>Produit non trouvé</h2>
          <p style="color:var(--text-muted);margin:1rem 0;">Ce produit n'est plus disponible ou a été déplacé.</p>
          <a href="/" class="btn btn-primary">← Retour à la boutique</a>
        `;
      }
    })
    .catch(() => {
      loadingEl.innerHTML = `
        <h2>Produit non trouvé</h2>
        <p style="color:var(--text-muted);margin:1rem 0;">Ce produit n'est plus disponible ou a été déplacé.</p>
        <a href="/" class="btn btn-primary">← Retour à la boutique</a>
      `;
    });
} else {
  // Page Title & Meta
  document.title = `${product.name} | Adounas`;

  // Breadcrumbs
  const bcCategory = document.getElementById('bc-category');
  const bcTitle = document.getElementById('bc-title');
  if (bcCategory) bcCategory.textContent = product.category || 'Boutique';
  if (bcTitle) bcTitle.textContent = product.name;

  // Title, Category & Vendor
  document.getElementById('pdp-title').textContent = product.name;
  document.getElementById('pdp-category').textContent = product.category || 'Solo';
  
  const vendorEl = document.getElementById('pdp-vendor');
  if (vendorEl) {
    vendorEl.textContent = product.vendor ? `· ${product.vendor}` : '· Adounas';
  }

  // SKU
  const skuEl = document.getElementById('pdp-sku');
  if (skuEl) {
    if (product.sku) {
      skuEl.textContent = `SKU: ${product.sku}`;
      skuEl.style.display = 'block';
    } else {
      skuEl.style.display = 'none';
    }
  }

  // Stock Status
  const stockTextEl = document.getElementById('pdp-stock-text');
  const stockStatusEl = document.getElementById('pdp-stock-status');
  function updateStockUI(currentStock) {
    if (!stockTextEl) return;
    if (currentStock === 0) {
      stockTextEl.textContent = 'Rupture de stock';
      stockStatusEl.style.color = '#DC2626';
      stockStatusEl.style.background = '#FEE2E2';
    } else if (currentStock <= 5) {
      stockTextEl.textContent = `Plus que ${currentStock} articles disponibles !`;
      stockStatusEl.style.color = '#D97706';
      stockStatusEl.style.background = '#FEF3C7';
    } else {
      stockTextEl.textContent = 'En stock (Livraison 24h à Dakar)';
      stockStatusEl.style.color = '#15803D';
      stockStatusEl.style.background = '#DCFCE7';
    }
  }

  updateStockUI(product.stock !== undefined ? product.stock : 20);

  // Pricing & Sale Badge
  const priceEl = document.getElementById('pdp-price');
  const compareEl = document.getElementById('pdp-compare-price');
  const saleBadge = document.getElementById('pdp-sale-badge');
  const floatBadge = document.getElementById('pdp-promo-badge-float');

  function updatePriceDisplay(currentPrice, comparePrice) {
    if (priceEl) priceEl.textContent = formatFCFA(currentPrice);
    
    if (comparePrice && Number(comparePrice) > Number(currentPrice)) {
      if (compareEl) {
        compareEl.textContent = formatFCFA(comparePrice);
        compareEl.style.display = 'inline-block';
      }
      const pct = Math.round(((comparePrice - currentPrice) / comparePrice) * 100);
      const discountText = `${pct}% PROMO`;
      if (saleBadge) {
        saleBadge.textContent = discountText;
        saleBadge.style.display = 'inline-block';
      }
      if (floatBadge) {
        floatBadge.textContent = discountText;
        floatBadge.style.display = 'block';
      }
    } else {
      if (compareEl) compareEl.style.display = 'none';
      if (saleBadge) saleBadge.style.display = 'none';
      if (floatBadge) floatBadge.style.display = 'none';
    }

    // Update sticky price
    const stickyPriceEl = document.getElementById('sticky-price');
    if (stickyPriceEl) stickyPriceEl.textContent = formatFCFA(currentPrice);
  }

  let activePrice = product.price;
  let activeStock = product.stock !== undefined ? product.stock : 20;
  let selectedVariant = null;

  updatePriceDisplay(product.price, product.comparePrice);

  // Description
  const descEl = document.getElementById('pdp-desc');
  if (descEl) descEl.textContent = product.desc || 'Produit de qualité supérieure certifié Adounas.';

  // Gallery
  const mainImage = document.getElementById('pdp-main-image');
  const rawImages = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
  const images = rawImages.length > 0 ? rawImages : ['https://placehold.co/600x600/F0EFFF/4F46E5?text=Adounas'];

  if (mainImage) mainImage.src = images[0];

  // Update sticky thumbnail
  const stickyThumb = document.getElementById('sticky-bar-thumb');
  const stickyTitle = document.getElementById('sticky-title');
  if (stickyThumb) stickyThumb.src = images[0];
  if (stickyTitle) stickyTitle.textContent = product.name;

  // Variants Selector (Options: Couleur, Taille, Capacité, Bracelet)
  const variantsContainer = document.getElementById('pdp-variants-container');
  if (product.hasVariants && product.options && product.options.length > 0 && product.variants && product.variants.length > 0) {
    variantsContainer.style.display = 'flex';
    const selectedOptions = {};

    product.options.forEach(opt => {
      selectedOptions[opt.name] = (opt.values && opt.values[0]) || '';
    });

    function matchVariant() {
      const comboTitle = Object.values(selectedOptions).join(' / ');
      const match = product.variants.find(v => v.title === comboTitle) || product.variants[0];
      if (match) {
        selectedVariant = match;
        activePrice = match.price !== undefined ? match.price : product.price;
        activeStock = match.stock !== undefined ? match.stock : product.stock;
        updatePriceDisplay(activePrice, product.comparePrice);
        updateStockUI(activeStock);
        if (skuEl && match.sku) {
          skuEl.textContent = `SKU: ${match.sku}`;
          skuEl.style.display = 'block';
        }
        if (match.image && mainImage) {
          mainImage.src = match.image;
          if (stickyThumb) stickyThumb.src = match.image;
        }
      }
      updateWhatsAppLink();
    }

    variantsContainer.innerHTML = product.options.map(opt => {
      const isColor = /(couleur|color|teinte|coloris)/i.test(opt.name);
      
      if (isColor) {
        return `
          <div class="pdp-option-group" data-option="${opt.name}">
            <div class="pdp-option-header">${opt.name}: <span class="pdp-option-selected-val" style="font-weight:700;color:var(--accent);">${selectedOptions[opt.name]}</span></div>
            <div class="pdp-color-swatches-grid">
              ${(opt.values || []).map((val, idx) => {
                const hex = detectColorHex(val);
                const isSelected = idx === 0;
                return `
                  <button type="button" class="pdp-color-swatch-pill ${isSelected ? 'active' : ''}" data-option="${opt.name}" data-val="${val}" aria-label="Couleur ${val}">
                    <span class="swatch-color-dot" style="background-color: ${hex};"></span>
                    <span class="swatch-name">${val}</span>
                    <span class="swatch-check">✓</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="pdp-option-group" data-option="${opt.name}">
          <div class="pdp-option-header">${opt.name}: <span class="pdp-option-selected-val" style="font-weight:700;color:var(--accent);">${selectedOptions[opt.name]}</span></div>
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

    // Attach click listeners for both standard pills and color swatches
    variantsContainer.querySelectorAll('.pdp-option-pill, .pdp-color-swatch-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const optName = btn.dataset.option;
        const optVal = btn.dataset.val;
        selectedOptions[optName] = optVal;

        const group = btn.closest('.pdp-option-group');
        group.querySelectorAll('.pdp-option-pill, .pdp-color-swatch-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        group.querySelector('.pdp-option-selected-val').textContent = optVal;

        matchVariant();
      });
    });

    matchVariant();
  }

  const thumbsEl = document.getElementById('pdp-thumbnails');
  if (images.length > 1 && thumbsEl) {
    thumbsEl.innerHTML = images.map((img, i) => `
      <img src="${img}" class="pdp-thumb ${i === 0 ? 'active' : ''}" data-src="${img}" alt="${product.name} ${i + 1}">
    `).join('');

    thumbsEl.querySelectorAll('.pdp-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        if (mainImage) mainImage.src = thumb.dataset.src;
        thumbsEl.querySelectorAll('.pdp-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  } else if (thumbsEl) {
    thumbsEl.style.display = 'none';
  }

  // Quantity controls
  let qty = 1;
  const qtyVal = document.getElementById('pdp-qty-val');
  const qtyMinus = document.getElementById('pdp-qty-minus');
  const qtyPlus = document.getElementById('pdp-qty-plus');

  if (activeStock === 0) {
    if (qtyMinus) qtyMinus.disabled = true;
    if (qtyPlus) qtyPlus.disabled = true;
    if (qtyVal) qtyVal.textContent = 0;
  } else {
    if (qtyMinus) {
      qtyMinus.addEventListener('click', () => {
        if (qty > 1) { qty--; if (qtyVal) qtyVal.textContent = qty; updateWhatsAppLink(); }
      });
    }
    if (qtyPlus) {
      qtyPlus.addEventListener('click', () => {
        if (activeStock !== undefined && activeStock !== null && qty >= activeStock) {
          alert(`Désolé, seulement ${activeStock} unités sont disponibles en stock.`);
          return;
        }
        qty++;
        if (qtyVal) qtyVal.textContent = qty;
        updateWhatsAppLink();
      });
    }
  }

  // WhatsApp Button updater
  const waBtn = document.getElementById('pdp-whatsapp-btn');
  function updateWhatsAppLink() {
    if (!waBtn) return;
    const variantText = selectedVariant ? ` (${selectedVariant.title})` : '';
    const msg = encodeURIComponent(`Bonjour Adounas! Je souhaite commander le produit *${product.name}${variantText}* (Quantité: ${qty}, Prix: ${formatFCFA(activePrice * qty)}). Pouvez-vous me livrer à Dakar?`);
    waBtn.href = `https://wa.me/221770000000?text=${msg}`;
  }
  updateWhatsAppLink();

  // Add to cart helper
  function addItemToCart(shouldOpenDrawer = false) {
    const cart = getCart();
    const itemKey = selectedVariant ? `${product.id}_${selectedVariant.title}` : product.id;
    const existing = cart.find(c => (c.variantKey ? c.variantKey === itemKey : c.id === product.id));
    const currentQty = existing ? existing.qty : 0;

    if (activeStock !== undefined && activeStock !== null && currentQty + qty > activeStock) {
      alert(`Désolé, vous avez déjà ${currentQty} article(s) dans votre panier et il ne reste que ${activeStock} unité(s).`);
      return false;
    }

    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        id: product.id,
        variantKey: itemKey,
        variantTitle: selectedVariant ? selectedVariant.title : null,
        price: activePrice,
        name: selectedVariant ? `${product.name} (${selectedVariant.title})` : product.name,
        image: images[0] || product.image,
        qty
      });
    }

    saveCart(cart);

    if (shouldOpenDrawer) {
      openCart();
    }
    return true;
  }

  // Add to Cart Button
  const addBtn = document.getElementById('pdp-add-btn');
  const buyNowBtn = document.getElementById('pdp-buynow-btn');
  const stickyBuyBtn = document.getElementById('sticky-buy-btn');

  if (activeStock === 0) {
    if (addBtn) {
      addBtn.textContent = 'Rupture de Stock';
      addBtn.disabled = true;
    }
    if (buyNowBtn) buyNowBtn.style.display = 'none';
    if (stickyBuyBtn) stickyBuyBtn.disabled = true;
  } else {
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (addItemToCart(false)) {
          const orig = addBtn.innerHTML;
          addBtn.innerHTML = '<span>✓ Ajouté au Panier !</span>';
          addBtn.style.background = '#10B981';
          addBtn.style.color = '#FFFFFF';
          setTimeout(() => {
            addBtn.innerHTML = orig;
            addBtn.style.background = '';
            addBtn.style.color = '';
          }, 1400);
        }
      });
    }

    // Direct Buy Now Button (1-Click Direct Purchase)
    if (buyNowBtn) {
      buyNowBtn.addEventListener('click', () => {
        if (addItemToCart(true)) {
          const nameInput = document.getElementById('delivery-name');
          if (nameInput) nameInput.focus();
        }
      });
    }

    if (stickyBuyBtn) {
      stickyBuyBtn.addEventListener('click', () => {
        if (addItemToCart(true)) {
          const nameInput = document.getElementById('delivery-name');
          if (nameInput) nameInput.focus();
        }
      });
    }
  }

  // ── Related Products ─────────────────────────────────────────────────────────
  const relatedSection = document.getElementById('pdp-related-section');
  const relatedGrid = document.getElementById('pdp-related-grid');
  const otherProducts = products.filter(p => p.id !== product.id);

  if (otherProducts.length > 0 && relatedSection && relatedGrid) {
    relatedSection.style.display = 'block';
    relatedGrid.innerHTML = otherProducts.slice(0, 4).map(p => {
      const pImg = (p.images && p.images[0]) || p.image || 'https://placehold.co/400x400';
      const hasPromo = p.comparePrice && Number(p.comparePrice) > Number(p.price);
      return `
        <div class="product-card">
          <a href="/product.html?id=${p.id}" class="product-image-link">
            <div class="product-image-wrapper">
              <img src="${pImg}" alt="${p.name}" loading="lazy">
              ${hasPromo ? '<span class="promo-badge">PROMO</span>' : ''}
            </div>
          </a>
          <div class="product-info">
            <span class="product-category">${p.category || 'Solo'}</span>
            <h3 class="product-title"><a href="/product.html?id=${p.id}">${p.name}</a></h3>
            <div class="product-price-row">
              <span class="product-price">${formatFCFA(p.price)}</span>
              ${hasPromo ? `<span class="product-compare-price">${formatFCFA(p.comparePrice)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Show Main Container
  loadingEl.style.display = 'none';
  contentEl.style.display = 'grid';
}

// ── Sticky Mobile Bar Scroll Observer ─────────────────────────────────────────
const stickyBar = document.getElementById('sticky-buy-bar');
const actionsCard = document.querySelector('.pdp-actions-card');

if (stickyBar && actionsCard) {
  window.addEventListener('scroll', () => {
    const rect = actionsCard.getBoundingClientRect();
    if (rect.bottom < 0) {
      stickyBar.classList.add('visible');
    } else {
      stickyBar.classList.remove('visible');
    }
  }, { passive: true });
}

// ── Cart Sidebar & Badge Management for PDP ──────────────────────────────────
const cartSidebar   = document.getElementById('cart-sidebar');
const overlay       = document.getElementById('overlay');
const cartIconEl    = document.getElementById('cart-icon');
const closeCartBtn  = document.getElementById('close-cart');
const cartCountEl   = document.getElementById('cart-count');
const cartItemsEl   = document.getElementById('cart-items');
const cartTotalEl   = document.getElementById('cart-total-price');
const cartQtyLabel  = document.getElementById('cart-qty-label');
const checkoutBtn   = document.getElementById('checkout-btn');

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('solo_cart') || '[]');
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('solo_cart', JSON.stringify(cart));
  updatePDPcartUI();
}

function openCart() {
  if (cartSidebar) cartSidebar.classList.add('open');
  if (overlay) overlay.classList.add('visible');
}

function closeCart() {
  if (cartSidebar) cartSidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
}

window.openCartFn = openCart;
window.closeCartFn = closeCart;

function updatePDPcartUI() {
  const cart = getCart();
  const totalCount = cart.reduce((s, i) => s + (i.qty || 1), 0);
  
  if (cartCountEl) {
    cartCountEl.textContent = totalCount;
    cartCountEl.classList.toggle('visible', totalCount > 0);
  }
  if (cartQtyLabel) {
    cartQtyLabel.textContent = `${totalCount} article${totalCount > 1 ? 's' : ''}`;
  }

  if (!cartItemsEl) return;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="empty-cart">
        <div class="empty-icon">🛍️</div>
        <p>Votre panier est vide</p>
      </div>`;
    if (cartTotalEl) cartTotalEl.textContent = formatFCFA(0);
    return;
  }

  let totalAmount = 0;
  cartItemsEl.innerHTML = cart.map((item, index) => {
    const itemTotal = Number(item.price || 0) * (item.qty || 1);
    totalAmount += itemTotal;
    const variantBadge = item.variantTitle ? `<span class="cart-variant-tag">${item.variantTitle}</span>` : '';
    return `
      <div class="cart-item">
        <img src="${item.image || 'https://placehold.co/100x100'}" alt="${item.name || 'Produit'}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name || 'Produit'}</div>
          ${variantBadge}
          <div class="cart-item-price">${formatFCFA(item.price || 0)}</div>
          <div class="cart-qty-stepper">
            <button type="button" class="stepper-btn pdp-cart-dec" data-idx="${index}">−</button>
            <span>${item.qty || 1}</span>
            <button type="button" class="stepper-btn pdp-cart-inc" data-idx="${index}">+</button>
          </div>
        </div>
        <button type="button" class="cart-item-remove pdp-cart-remove" data-idx="${index}" aria-label="Supprimer">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
  }).join('');

  if (cartTotalEl) {
    cartTotalEl.textContent = formatFCFA(totalAmount);
  }

  cartItemsEl.querySelectorAll('.pdp-cart-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const currentCart = getCart();
      if (currentCart[idx]) {
        if (currentCart[idx].qty > 1) {
          currentCart[idx].qty--;
        } else {
          currentCart.splice(idx, 1);
        }
        saveCart(currentCart);
      }
    });
  });

  cartItemsEl.querySelectorAll('.pdp-cart-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const currentCart = getCart();
      if (currentCart[idx]) {
        currentCart[idx].qty = (currentCart[idx].qty || 1) + 1;
        saveCart(currentCart);
      }
    });
  });

  cartItemsEl.querySelectorAll('.pdp-cart-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const currentCart = getCart();
      if (currentCart[idx]) {
        currentCart.splice(idx, 1);
        saveCart(currentCart);
      }
    });
  });
}

window.updateCartUI = updatePDPcartUI;

if (cartIconEl) cartIconEl.addEventListener('click', openCart);
if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
if (overlay) overlay.addEventListener('click', closeCart);

// Checkout handler on PDP (with 100% Guest Checkout)
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', async () => {
    const cart = getCart();
    if (cart.length === 0) {
      alert('Votre panier est vide.');
      return;
    }

    const locInput   = document.getElementById('delivery-location');
    const phoneInput = document.getElementById('delivery-phone');
    const nameInput  = document.getElementById('delivery-name');

    const location = locInput   ? locInput.value.trim()   : '';
    const phone    = phoneInput ? phoneInput.value.trim()  : '';
    const custName = nameInput  ? nameInput.value.trim()   : '';

    if (!custName) {
      alert('Veuillez entrer votre nom complet.');
      if (nameInput) nameInput.focus();
      return;
    }
    if (!phone) {
      alert('Veuillez entrer votre numéro de téléphone (WhatsApp).');
      if (phoneInput) phoneInput.focus();
      return;
    }
    if (!location) {
      alert('Veuillez entrer votre adresse de livraison.');
      if (locInput) locInput.focus();
      return;
    }

    const origText = checkoutBtn.textContent;
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = '⏳ Envoi de la commande…';

    const items = cart.map(c => ({
      id: c.id,
      name: c.name,
      price: c.price,
      qty: c.qty || 1,
      image: c.image || ''
    }));
    const total = items.reduce((s, i) => s + (i.price * i.qty), 0);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: custName, phone, location },
          items,
          total
        })
      });

      const data = await res.json();
      if (res.ok && (data.ok || data.orderId)) {
        const orderId = data.orderId || (data.order && data.order.id);
        localStorage.removeItem('solo_cart');
        updatePDPcartUI();
        closeCart();
        window.location.href = `/suivi.html?id=${orderId}`;
      } else {
        throw new Error(data.error || 'Erreur lors de la commande');
      }
    } catch (err) {
      alert(`⚠️ Erreur: ${err.message || 'Impossible de valider la commande'}`);
    } finally {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = origText;
    }
  });
}

// Initial badge update
updatePDPcartUI();

// ── GPS Geolocation Helper ───────────────────────────────────────────────────
const btnGps = document.getElementById('btn-gps');
const locInput = document.getElementById('delivery-location');
const gpsStatus = document.getElementById('gps-status');
const gpsText = document.getElementById('btn-gps-text');

if (btnGps && locInput) {
  btnGps.addEventListener('click', () => {
    if (!navigator.geolocation) {
      if (gpsStatus) {
        gpsStatus.style.display = 'block';
        gpsStatus.className = 'gps-status error';
        gpsStatus.textContent = '❌ La géolocalisation n’est pas supportée par votre navigateur.';
      }
      return;
    }

    btnGps.classList.add('loading');
    if (gpsText) gpsText.textContent = 'Localisation…';
    if (gpsStatus) {
      gpsStatus.style.display = 'block';
      gpsStatus.className = 'gps-status';
      gpsStatus.textContent = '📡 Détection de votre position en cours…';
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
              gpsStatus.textContent = '✅ Adresse détectée avec succès !';
              setTimeout(() => { if (gpsStatus) gpsStatus.style.display = 'none'; }, 3500);
            }
          }
        } catch {
          locInput.value = `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
          if (gpsStatus) {
            gpsStatus.textContent = '✅ Coordonnées GPS enregistrées.';
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
          gpsStatus.textContent = '⚠️ Accès à la position refusé ou indisponible.';
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}
