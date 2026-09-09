import './style.css';
import './product.css';

function formatFCFA(amount) {
  const num = Math.round(Number(amount) || 0);
  return `${num.toLocaleString('fr-FR')} FCFA`;
}

// Reuse localStorage getters from main logic via global if needed, but best to re-import or redefine
function loadProducts() {
  const s = localStorage.getItem('solo_products');
  return s ? JSON.parse(s) : [];
}

const params = new URLSearchParams(window.location.search);
const productId = parseInt(params.get('id'));

const products = loadProducts();
const product = products.find(p => p.id === productId);

const loadingEl = document.getElementById('pdp-loading');
const contentEl = document.getElementById('pdp-content');

if (!product) {
  loadingEl.innerHTML = `<h2>Produit non trouvé</h2><a href="/" style="color:var(--accent)">← Retour à la boutique</a>`;
} else {
  // Populate meta tags for SEO (client side simulation)
  document.title = `${product.name} | Solo`;

  // Render product details
  document.getElementById('pdp-title').textContent = product.name;
  
  // Category & Vendor
  document.getElementById('pdp-category').textContent = product.category || '';
  const vendorEl = document.getElementById('pdp-vendor');
  if (product.vendor && vendorEl) {
    vendorEl.textContent = `· ${product.vendor}`;
  }

  // SKU
  const skuEl = document.getElementById('pdp-sku');
  if (product.sku && skuEl) {
    skuEl.textContent = `SKU: ${product.sku}`;
    skuEl.style.display = 'block';
  }

  // Pricing & Sale Badge
  const priceEl = document.getElementById('pdp-price');
  const compareEl = document.getElementById('pdp-compare-price');
  const saleBadge = document.getElementById('pdp-sale-badge');

  function updatePriceDisplay(currentPrice, comparePrice) {
    priceEl.textContent = formatFCFA(currentPrice);
    if (comparePrice && Number(comparePrice) > Number(currentPrice)) {
      compareEl.textContent = formatFCFA(comparePrice);
      compareEl.style.display = 'block';
      const pct = Math.round(((comparePrice - currentPrice) / comparePrice) * 100);
      saleBadge.textContent = `${pct}% PROMO`;
      saleBadge.style.display = 'inline-block';
    } else {
      compareEl.style.display = 'none';
      saleBadge.style.display = 'none';
    }
  }

  let activePrice = product.price;
  let activeStock = product.stock;
  let selectedVariant = null;

  updatePriceDisplay(product.price, product.comparePrice);

  // Description
  document.getElementById('pdp-desc').textContent = product.desc || '';

  // Variants Selector (Shopify Options)
  const variantsContainer = document.getElementById('pdp-variants-container');
  if (product.hasVariants && product.options && product.options.length > 0 && product.variants && product.variants.length > 0) {
    variantsContainer.style.display = 'flex';
    const selectedOptions = {};

    // Default to first value for each option
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
        if (skuEl && match.sku) skuEl.textContent = `SKU: ${match.sku}`;
      }
    }

    variantsContainer.innerHTML = product.options.map(opt => `
      <div class="pdp-option-group" data-option="${opt.name}">
        <div class="pdp-option-header">${opt.name}: <span class="pdp-option-selected-val" style="font-weight:700;">${selectedOptions[opt.name]}</span></div>
        <div class="pdp-option-pills">
          ${(opt.values || []).map((val, idx) => `
            <button type="button" class="pdp-option-pill ${idx === 0 ? 'active' : ''}" data-option="${opt.name}" data-val="${val}">
              ${val}
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    variantsContainer.querySelectorAll('.pdp-option-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const optName = pill.dataset.option;
        const optVal = pill.dataset.val;
        selectedOptions[optName] = optVal;

        const group = pill.closest('.pdp-option-group');
        group.querySelectorAll('.pdp-option-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        group.querySelector('.pdp-option-selected-val').textContent = optVal;

        matchVariant();
      });
    });

    matchVariant();
  }

  // Gallery
  const mainImage = document.getElementById('pdp-main-image');
  const images = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
  
  mainImage.src = images[0] || 'https://placehold.co/600x600/F0EFFF/4F46E5?text=No+Image';

  const thumbsEl = document.getElementById('pdp-thumbnails');
  if (images.length > 1) {
    thumbsEl.innerHTML = images.map((img, i) => `
      <img src="${img}" class="pdp-thumb ${i===0?'active':''}" data-src="${img}" alt="Thumbnail ${i}">
    `).join('');

    thumbsEl.querySelectorAll('.pdp-thumb').forEach(thumb => {
      thumb.addEventListener('click', e => {
        mainImage.src = thumb.dataset.src;
        thumbsEl.querySelectorAll('.pdp-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  } else {
    thumbsEl.style.display = 'none';
  }

  // Quantity controls
  let qty = 1;
  const qtyVal = document.getElementById('pdp-qty-val');
  
  if (product.stock === 0) {
    document.getElementById('pdp-qty-minus').disabled = true;
    document.getElementById('pdp-qty-plus').disabled = true;
    qtyVal.textContent = 0;
  } else {
    document.getElementById('pdp-qty-minus').addEventListener('click', () => {
      if (qty > 1) { qty--; qtyVal.textContent = qty; }
    });
    document.getElementById('pdp-qty-plus').addEventListener('click', () => {
      if (activeStock !== undefined && activeStock !== null && qty >= activeStock) {
        alert(`Sorry, only ${activeStock} units available in stock.`);
        return;
      }
      qty++; qtyVal.textContent = qty;
    });
  }

  // Add to cart
  const addBtn = document.getElementById('pdp-add-btn');
  if (product.stock === 0) {
    addBtn.textContent = 'Sold Out';
    addBtn.disabled = true;
    addBtn.style.background = 'var(--border)';
    addBtn.style.color = 'var(--text-muted)';
    addBtn.style.cursor = 'not-allowed';
  } else {
    addBtn.addEventListener('click', () => {
      const cart = JSON.parse(localStorage.getItem('solo_cart') || '[]');
      const itemKey = selectedVariant ? `${product.id}_${selectedVariant.title}` : product.id;
      const existing = cart.find(c => (c.variantKey ? c.variantKey === itemKey : c.id === product.id));
      const currentQty = existing ? existing.qty : 0;
      
      if (activeStock !== undefined && activeStock !== null && currentQty + qty > activeStock) {
        alert(`Sorry, you already have ${currentQty} in your cart, and only ${activeStock} are available.`);
        return;
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
      
      localStorage.setItem('solo_cart', JSON.stringify(cart));
      
      // Animate button
      const orig = addBtn.textContent;
      addBtn.textContent = '✓ Added to Cart';
      addBtn.style.background = 'var(--success)';
      setTimeout(() => {
        addBtn.textContent = orig;
        addBtn.style.background = '';
      }, 1200);

      if (window.updateCartUI) window.updateCartUI();
      if (window.openCartFn) window.openCartFn();
    });
  }

  loadingEl.style.display = 'none';
  contentEl.style.display = 'grid';
}

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

