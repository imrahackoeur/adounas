import './style.css';
import './product.css';

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
  loadingEl.innerHTML = `<h2>Product not found</h2><a href="/" style="color:var(--accent)">← Back to Store</a>`;
} else {
  // Populate meta tags for SEO (client side simulation)
  document.title = `${product.name} | Solo`;

  // Render product details
  document.getElementById('pdp-title').textContent = product.name;
  document.getElementById('pdp-price').textContent = `$${Number(product.price).toFixed(2)}`;
  document.getElementById('pdp-category').textContent = product.category || '';
  document.getElementById('pdp-desc').textContent = product.desc || '';

  // Gallery
  const mainImage = document.getElementById('pdp-main-image');
  // ensure images is an array, default to single image if old product
  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  
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
      if (product.stock !== undefined && product.stock !== null && qty >= product.stock) {
        alert(`Sorry, only ${product.stock} units available in stock.`);
        return;
      }
      qty++; qtyVal.textContent = qty;
    });
  }

  // Add to cart (interacts with main.js which listens to localStorage or we can dispatch a custom event)
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
      const existing = cart.find(c => c.id === product.id);
      const currentQty = existing ? existing.qty : 0;
      
      if (product.stock !== undefined && product.stock !== null && currentQty + qty > product.stock) {
        alert(`Sorry, you already have ${currentQty} in your cart, and only ${product.stock} are available.`);
        return;
      }

      if (existing) existing.qty += qty;
      else cart.push({ id: product.id, qty });
      
      localStorage.setItem('solo_cart', JSON.stringify(cart));
      
      // Animate button
      const orig = addBtn.textContent;
      addBtn.textContent = '✓ Added to Cart';
      addBtn.style.background = 'var(--success)';
      setTimeout(() => {
        addBtn.textContent = orig;
        addBtn.style.background = '';
      }, 1200);

      // Call global function exposed from main.js to update UI
      if (window.updateCartUI) window.updateCartUI();
      if (window.openCartFn) window.openCartFn();
    });
  }

  loadingEl.style.display = 'none';
  contentEl.style.display = 'grid';
}
