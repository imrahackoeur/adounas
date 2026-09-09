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
  renderProductsTable();
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

const style = document.createElement('style');
style.textContent = `@keyframes shake {
  0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 60%{transform:translateX(8px)}
}`;
document.head.appendChild(style);

btnLogout.addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAdminToken()}` }
    });
  } catch {}
  lock();
});

// ── Toast Notification ────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Currency Formatter (Senegal / FCFA) ──────────────────────────────────────
function formatFCFA(amount) {
  const num = Math.round(Number(amount) || 0);
  return `${num.toLocaleString('fr-FR')} FCFA`;
}

// ── Store Helpers ─────────────────────────────────────────────────────────────
function loadProducts() {
  const s = localStorage.getItem('solo_products');
  if (!s) return [];
  let prods = JSON.parse(s);
  // Migrate any old USD values (< 1000) to FCFA
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
function saveProducts(p) {
  localStorage.setItem('solo_products', JSON.stringify(p));
}

let products = loadProducts();
let editingId = null;
let editorImages = [];
let editorTags = [];
let editorOptions = []; // [{ name: 'Size', values: ['S', 'M', 'L'] }]
let editorVariants = []; // [{ title: 'S / Black', price: 100, stock: 10, sku: '' }]
let currentTableFilter = 'all';

// ── DOM References ────────────────────────────────────────────────────────────
// Views
const productsListView   = document.getElementById('products-list-view');
const productEditorView  = document.getElementById('product-editor-view');
const btnAddProduct      = document.getElementById('btn-add-product');
const btnBackToProducts  = document.getElementById('btn-back-to-products');
const btnSaveProduct     = document.getElementById('btn-save-product');
const btnDiscardProduct  = document.getElementById('btn-discard-product');
const editorTitle        = document.getElementById('editor-title');
const editorStatusPill   = document.getElementById('editor-status-pill');

// Table DOM
const shopifyProductsTbody = document.getElementById('shopify-products-tbody');
const adminProductSearch   = document.getElementById('admin-product-search');
const productCountSummary  = document.getElementById('product-count-summary');
const tableTabs            = document.querySelectorAll('.table-tab');

// Quick Importer Drawer
const btnQuickImport       = document.getElementById('btn-quick-import');
const quickImportDrawer    = document.getElementById('quick-import-drawer');
const btnCloseImportDrawer = document.getElementById('btn-close-import-drawer');
const importUrlInputQuick  = document.getElementById('import-url-input-quick');
const btnImportQuick       = document.getElementById('btn-import-quick');
const importerStatusQuick  = document.getElementById('importer-status-quick');

// Editor Form Fields
const spTitle           = document.getElementById('sp-title');
const spDesc            = document.getElementById('sp-desc');
const spPrice           = document.getElementById('sp-price');
const spComparePrice    = document.getElementById('sp-compare-price');
const spCost            = document.getElementById('sp-cost');
const metricProfit      = document.getElementById('metric-profit');
const metricMargin      = document.getElementById('metric-margin');
const metricDiscount    = document.getElementById('metric-discount');

const spSku             = document.getElementById('sp-sku');
const spBarcode         = document.getElementById('sp-barcode');
const spTrackQty        = document.getElementById('sp-track-qty');
const spStock           = document.getElementById('sp-stock');
const spQtyGroup        = document.getElementById('sp-qty-group');
const spContinueSelling = document.getElementById('sp-continue-selling');

const spHasVariants     = document.getElementById('sp-has-variants');
const spVariantsBuilder = document.getElementById('sp-variants-builder');
const spOptionsList     = document.getElementById('sp-options-list');
const btnAddOption      = document.getElementById('btn-add-option');
const spVariantsTbody   = document.getElementById('sp-variants-tbody');

const spStatus          = document.getElementById('sp-status');
const spCategory        = document.getElementById('sp-category');
const spProductType     = document.getElementById('sp-product-type');
const spVendor          = document.getElementById('sp-vendor');
const spTagContainer    = document.getElementById('sp-tag-container');
const spTagsPills       = document.getElementById('sp-tags-pills');
const spTagInput        = document.getElementById('sp-tag-input');

// Media DOM
const shopifyDropzone   = document.getElementById('shopify-dropzone');
const spFileInput       = document.getElementById('sp-file-input');
const btnAddMediaUrl    = document.getElementById('btn-add-media-url');
const mediaUrlWrap      = document.getElementById('media-url-wrap');
const spMediaUrlInput   = document.getElementById('sp-media-url-input');
const btnConfirmMediaUrl= document.getElementById('btn-confirm-media-url');
const spMediaGrid       = document.getElementById('sp-media-grid');

// SEO Preview
const seoPreviewTitle   = document.getElementById('seo-preview-title');
const seoPreviewUrl     = document.getElementById('seo-preview-url');
const seoPreviewDesc    = document.getElementById('seo-preview-desc');

// Sidebar Importer
const importUrlInputSide= document.getElementById('import-url-input-side');
const btnImportSide     = document.getElementById('btn-import-side');
const importerStatusSide= document.getElementById('importer-status-side');

// ── 1. PRODUCTS LIST VIEW (Shopify Table) ─────────────────────────────────────
function renderProductsTable() {
  products = loadProducts();
  const search = (adminProductSearch.value || '').trim().toLowerCase();

  let filtered = products.filter(p => {
    // Status filter tab
    if (currentTableFilter === 'active' && p.status === 'draft') return false;
    if (currentTableFilter === 'draft' && p.status !== 'draft') return false;
    if (currentTableFilter === 'low_stock') {
      const isLow = (p.stock !== undefined && p.stock !== null && p.stock <= 5);
      if (!isLow) return false;
    }
    // Search query
    if (search) {
      const matchName = (p.name || '').toLowerCase().includes(search);
      const matchCat  = (p.category || '').toLowerCase().includes(search);
      const matchVen  = (p.vendor || '').toLowerCase().includes(search);
      const matchSku  = (p.sku || '').toLowerCase().includes(search);
      if (!matchName && !matchCat && !matchVen && !matchSku) return false;
    }
    return true;
  });

  productCountSummary.textContent = `${products.length} product${products.length !== 1 ? 's' : ''} total (${filtered.length} showing)`;

  if (filtered.length === 0) {
    shopifyProductsTbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📦</div>
          <p style="font-weight: 600; font-size: 1rem;">No products found</p>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Try adjusting your search or click "+ Add Product" to create one.</p>
        </td>
      </tr>
    `;
    return;
  }

  shopifyProductsTbody.innerHTML = filtered.map(p => {
    const isDraft = (p.status === 'draft');
    const isOutOfStock = (p.stock !== undefined && p.stock !== null && p.stock === 0);
    const isLowStock = (p.stock !== undefined && p.stock !== null && p.stock > 0 && p.stock <= 5);
    
    let inventoryBadge = '';
    if (p.stock === null || p.stock === undefined || p.stock === '') {
      inventoryBadge = `<span style="color: var(--text-muted); font-size:0.82rem;">Not tracked</span>`;
    } else if (isOutOfStock) {
      inventoryBadge = `<span class="badge-status-pill badge-stock-out">0 in stock</span>`;
    } else if (isLowStock) {
      inventoryBadge = `<span class="badge-status-pill badge-stock-low">${p.stock} in stock</span>`;
    } else {
      inventoryBadge = `<span style="font-weight:600; font-size:0.85rem;">${p.stock} in stock</span>`;
    }

    const priceFormatted = formatFCFA(p.price || 0);
    const compareFormatted = p.comparePrice ? `<span style="text-decoration:line-through; color:var(--text-light); font-size:0.75rem; margin-left:4px;">${formatFCFA(p.comparePrice)}</span>` : '';
    const saleTag = (p.comparePrice && Number(p.comparePrice) > Number(p.price)) ? `<span class="badge-status-pill badge-sale" style="font-size:0.65rem; padding:0.1rem 0.35rem; margin-left:4px;">PROMO</span>` : '';

    const firstImage = (p.images && p.images.length > 0) ? p.images[0] : (p.image || '');

    return `
      <tr>
        <td>
          <img src="${firstImage}" alt="${p.name}" class="table-prod-img" onerror="this.src='https://placehold.co/88x88/F0EFFF/4F46E5?text=?'">
        </td>
        <td>
          <div class="table-prod-title">
            <a href="#" class="prod-link" data-id="${p.id}" style="color:var(--text);">${p.name}</a>
          </div>
          <div class="table-prod-sub">${p.productType || p.sku || 'Solo Store'}</div>
        </td>
        <td>
          <span class="badge-status-pill ${isDraft ? 'badge-draft' : 'badge-active'}">
            ${isDraft ? 'Draft' : 'Active'}
          </span>
        </td>
        <td>${inventoryBadge}</td>
        <td>${p.category || '—'}</td>
        <td>${p.vendor || '—'}</td>
        <td>
          <div style="font-weight: 700;">${priceFormatted} ${compareFormatted} ${saleTag}</div>
        </td>
        <td>
          <div class="table-actions-cell">
            <button type="button" class="btn-table-action btn-edit-prod" data-id="${p.id}" title="Edit product">Edit</button>
            <button type="button" class="btn-table-action btn-dup-prod" data-id="${p.id}" title="Duplicate product">Duplicate</button>
            <a href="/product.html?id=${p.id}" target="_blank" class="btn-table-action" title="View in storefront">View ↗</a>
            <button type="button" class="btn-table-action btn-table-delete btn-del-prod" data-id="${p.id}" title="Delete product">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Table Action Listeners
  shopifyProductsTbody.querySelectorAll('.btn-edit-prod, .prod-link').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      openProductEditor(parseInt(btn.dataset.id));
    });
  });

  shopifyProductsTbody.querySelectorAll('.btn-dup-prod').forEach(btn => {
    btn.addEventListener('click', () => duplicateProduct(parseInt(btn.dataset.id)));
  });

  shopifyProductsTbody.querySelectorAll('.btn-del-prod').forEach(btn => {
    btn.addEventListener('click', () => deleteProduct(parseInt(btn.dataset.id)));
  });
}

// Table Search & Filter Handlers
adminProductSearch.addEventListener('input', renderProductsTable);

tableTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tableTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTableFilter = tab.dataset.filter;
    renderProductsTable();
  });
});

// Quick Importer Drawer toggle
btnQuickImport.addEventListener('click', () => {
  quickImportDrawer.style.display = quickImportDrawer.style.display === 'none' ? 'block' : 'none';
  if (quickImportDrawer.style.display === 'block') {
    importUrlInputQuick.focus();
  }
});

btnCloseImportDrawer.addEventListener('click', () => {
  quickImportDrawer.style.display = 'none';
});

// ── 2. SHOPIFY PRODUCT EDITOR ────────────────────────────────────────────────
function openProductEditor(id = null) {
  editingId = id;
  productsListView.style.display = 'none';
  productEditorView.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (id) {
    const p = products.find(prod => prod.id === id);
    if (!p) return;

    editorTitle.textContent = `Edit product`;
    editorStatusPill.textContent = (p.status === 'draft' ? 'Draft' : 'Active');
    editorStatusPill.className = `badge-status-pill ${p.status === 'draft' ? 'badge-draft' : 'badge-active'}`;

    spTitle.value = p.name || '';
    spDesc.value  = p.desc || '';
    spPrice.value = p.price !== undefined ? p.price : '';
    spComparePrice.value = p.comparePrice !== undefined ? p.comparePrice : '';
    spCost.value  = p.cost !== undefined ? p.cost : '';

    spSku.value   = p.sku || '';
    spBarcode.value = p.barcode || '';
    spTrackQty.checked = p.trackQuantity !== false;
    spStock.value = (p.stock !== undefined && p.stock !== null) ? p.stock : '';
    spContinueSelling.checked = !!p.continueSelling;

    spStatus.value = p.status || 'active';
    spCategory.value = p.category || '';
    spProductType.value = p.productType || '';
    spVendor.value = p.vendor || '';

    editorImages = (p.images && p.images.length > 0) ? [...p.images] : (p.image ? [p.image] : []);
    editorTags   = Array.isArray(p.tags) ? [...p.tags] : [];

    spHasVariants.checked = !!p.hasVariants;
    editorOptions  = Array.isArray(p.options) ? JSON.parse(JSON.stringify(p.options)) : [];
    editorVariants = Array.isArray(p.variants) ? JSON.parse(JSON.stringify(p.variants)) : [];
  } else {
    // New product defaults
    editorTitle.textContent = 'Add product';
    editorStatusPill.textContent = 'Active';
    editorStatusPill.className = 'badge-status-pill badge-active';

    spTitle.value = '';
    spDesc.value = '';
    spPrice.value = '';
    spComparePrice.value = '';
    spCost.value = '';
    spSku.value = '';
    spBarcode.value = '';
    spTrackQty.checked = true;
    spStock.value = '10';
    spContinueSelling.checked = false;
    spStatus.value = 'active';
    spCategory.value = '';
    spProductType.value = '';
    spVendor.value = 'Solo Store';

    editorImages = [];
    editorTags = [];
    spHasVariants.checked = false;
    editorOptions = [];
    editorVariants = [];
  }

  // Update UI components
  renderMediaGrid();
  renderTags();
  renderVariantsUI();
  calculatePricingMetrics();
  updateSeoPreview();
  toggleQtyGroup();
}

function closeProductEditor() {
  editingId = null;
  productEditorView.style.display = 'none';
  productsListView.style.display = 'block';
  renderProductsTable();
}

btnAddProduct.addEventListener('click', () => openProductEditor(null));
btnBackToProducts.addEventListener('click', closeProductEditor);
btnDiscardProduct.addEventListener('click', () => {
  if (confirm('Discard unsaved changes and go back to products?')) {
    closeProductEditor();
  }
});

// ── 3. PRICING & PROFIT CALCULATOR ───────────────────────────────────────────
function calculatePricingMetrics() {
  const price = parseFloat(spPrice.value) || 0;
  const compare = parseFloat(spComparePrice.value) || 0;
  const cost = parseFloat(spCost.value) || 0;

  // Profit & Margin
  if (price > 0 && cost > 0) {
    const profit = price - cost;
    const margin = (profit / price) * 100;
    metricProfit.textContent = formatFCFA(profit);
    metricProfit.className = profit >= 0 ? 'metric-val text-success' : 'metric-val text-danger';
    metricMargin.textContent = `${margin.toFixed(1)}%`;
  } else {
    metricProfit.textContent = '0 FCFA';
    metricMargin.textContent = '0%';
  }

  // Sale Discount
  if (compare > price && price > 0) {
    const discountAmt = compare - price;
    const discountPct = Math.round((discountAmt / compare) * 100);
    metricDiscount.textContent = `${discountPct}% PROMO (Économie ${formatFCFA(discountAmt)})`;
    metricDiscount.className = 'metric-val text-success';
  } else {
    metricDiscount.textContent = 'Aucune réduction';
    metricDiscount.className = 'metric-val';
  }
}

spPrice.addEventListener('input', () => { calculatePricingMetrics(); updateVariantsPrice(); });
spComparePrice.addEventListener('input', calculatePricingMetrics);
spCost.addEventListener('input', calculatePricingMetrics);

// ── 4. MEDIA GALLERY & DROPZONE ───────────────────────────────────────────────
function renderMediaGrid() {
  if (editorImages.length === 0) {
    spMediaGrid.innerHTML = '';
    return;
  }

  spMediaGrid.innerHTML = editorImages.map((img, idx) => `
    <div class="media-card" data-index="${idx}">
      <img src="${img}" alt="Media ${idx}" onerror="this.src='https://placehold.co/200x200/F0EFFF/4F46E5?text=?'">
      ${idx === 0 ? '<span class="media-badge-primary">Primary</span>' : ''}
      <button type="button" class="btn-media-delete" data-index="${idx}" title="Remove image">✕</button>
    </div>
  `).join('');

  spMediaGrid.querySelectorAll('.btn-media-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      editorImages.splice(index, 1);
      renderMediaGrid();
    });
  });
}

// Click Dropzone to open file dialog
shopifyDropzone.addEventListener('click', () => spFileInput.click());

// Handle local file uploads
spFileInput.addEventListener('change', () => {
  const files = Array.from(spFileInput.files || []);
  if (files.length === 0) return;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      editorImages.push(e.target.result);
      renderMediaGrid();
    };
    reader.readAsDataURL(file);
  });
});

// Drag & drop support
shopifyDropzone.addEventListener('dragover', e => {
  e.preventDefault();
  shopifyDropzone.style.borderColor = 'var(--accent)';
});
shopifyDropzone.addEventListener('dragleave', () => {
  shopifyDropzone.style.borderColor = '';
});
shopifyDropzone.addEventListener('drop', e => {
  e.preventDefault();
  shopifyDropzone.style.borderColor = '';
  const files = Array.from(e.dataTransfer.files || []);
  files.forEach(file => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = evt => {
        editorImages.push(evt.target.result);
        renderMediaGrid();
      };
      reader.readAsDataURL(file);
    }
  });
});

// URL Adder Toggle
btnAddMediaUrl.addEventListener('click', () => {
  mediaUrlWrap.style.display = mediaUrlWrap.style.display === 'none' ? 'block' : 'none';
  if (mediaUrlWrap.style.display === 'block') spMediaUrlInput.focus();
});

btnConfirmMediaUrl.addEventListener('click', () => {
  const url = spMediaUrlInput.value.trim();
  if (url) {
    editorImages.push(url);
    spMediaUrlInput.value = '';
    mediaUrlWrap.style.display = 'none';
    renderMediaGrid();
    showToast('🖼️ Image added to gallery');
  }
});

// ── 5. TAGS BUILDER ───────────────────────────────────────────────────────────
function renderTags() {
  spTagsPills.innerHTML = editorTags.map((tag, idx) => `
    <span class="tag-pill">
      ${tag}
      <button type="button" class="tag-pill-remove" data-index="${idx}">✕</button>
    </span>
  `).join('');

  spTagsPills.querySelectorAll('.tag-pill-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      editorTags.splice(idx, 1);
      renderTags();
    });
  });
}

spTagInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = spTagInput.value.trim().replace(/,/g, '');
    if (val && !editorTags.includes(val)) {
      editorTags.push(val);
      renderTags();
    }
    spTagInput.value = '';
  }
});

// ── 6. SHOPIFY VARIANTS & OPTIONS ─────────────────────────────────────────────
spHasVariants.addEventListener('change', () => {
  if (spHasVariants.checked && editorOptions.length === 0) {
    editorOptions.push({ name: 'Size', values: ['Small', 'Medium', 'Large'] });
  }
  renderVariantsUI();
});

function renderVariantsUI() {
  const hasVariants = spHasVariants.checked;
  spVariantsBuilder.style.display = hasVariants ? 'block' : 'none';
  spQtyGroup.style.display = hasVariants ? 'none' : 'block';

  if (!hasVariants) return;

  // Render Option Rows
  spOptionsList.innerHTML = editorOptions.map((opt, optIdx) => `
    <div class="variant-option-row">
      <button type="button" class="btn-remove-option" data-opt="${optIdx}">✕ Remove</button>
      <div class="grid-2-col" style="margin-bottom: 0.5rem;">
        <div class="form-group" style="margin-bottom:0;">
          <label>Option Name</label>
          <input type="text" class="opt-name-input" data-opt="${optIdx}" value="${opt.name}" placeholder="e.g. Size, Color">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Option Values (comma separated)</label>
          <input type="text" class="opt-vals-input" data-opt="${optIdx}" value="${(opt.values || []).join(', ')}" placeholder="e.g. Small, Medium, Large">
        </div>
      </div>
    </div>
  `).join('');

  // Option row listeners
  spOptionsList.querySelectorAll('.btn-remove-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.opt);
      editorOptions.splice(idx, 1);
      if (editorOptions.length === 0) spHasVariants.checked = false;
      renderVariantsUI();
    });
  });

  spOptionsList.querySelectorAll('.opt-name-input').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = parseInt(inp.dataset.opt);
      editorOptions[idx].name = inp.value;
      generateVariantMatrix();
    });
  });

  spOptionsList.querySelectorAll('.opt-vals-input').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = parseInt(inp.dataset.opt);
      const vals = inp.value.split(',').map(s => s.trim()).filter(Boolean);
      editorOptions[idx].values = vals;
      generateVariantMatrix();
    });
  });

  generateVariantMatrix();
}

btnAddOption.addEventListener('click', () => {
  const defaultNames = ['Color', 'Material', 'Style'];
  const nextName = defaultNames.find(n => !editorOptions.some(o => o.name.toLowerCase() === n.toLowerCase())) || 'Option';
  editorOptions.push({ name: nextName, values: [] });
  renderVariantsUI();
});

function generateVariantMatrix() {
  if (editorOptions.length === 0) {
    spVariantsTbody.innerHTML = '';
    return;
  }

  // Compute Cartesian product
  const validOptions = editorOptions.filter(o => o.name && o.values && o.values.length > 0);
  if (validOptions.length === 0) {
    spVariantsTbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted);padding:1rem;">Add option values above to generate variants.</td></tr>`;
    return;
  }

  const combinations = validOptions.reduce((acc, curr) => {
    const res = [];
    acc.forEach(a => {
      curr.values.forEach(v => {
        res.push([...a, v]);
      });
    });
    return res;
  }, [[]]);

  const defaultPrice = parseFloat(spPrice.value) || 0;

  // Build variants array preserving existing entered data
  editorVariants = combinations.map(combo => {
    const title = combo.join(' / ');
    const existing = editorVariants.find(v => v.title === title);
    return {
      title,
      price: existing && existing.price !== undefined ? existing.price : defaultPrice,
      stock: existing && existing.stock !== undefined ? existing.stock : 10,
      sku: existing && existing.sku ? existing.sku : `${(spSku.value || 'SOLO')}-${combo.join('-').toUpperCase().replace(/\s+/g, '')}`
    };
  });

  // Render Table Rows
  spVariantsTbody.innerHTML = editorVariants.map((v, i) => `
    <tr>
      <td><strong>${v.title}</strong></td>
      <td>
        <input type="number" step="0.01" min="0" class="var-price" data-idx="${i}" value="${v.price}">
      </td>
      <td>
        <input type="number" min="0" step="1" class="var-stock" data-idx="${i}" value="${v.stock}">
      </td>
      <td>
        <input type="text" class="var-sku" data-idx="${i}" value="${v.sku}">
      </td>
    </tr>
  `).join('');

  spVariantsTbody.querySelectorAll('.var-price').forEach(inp => {
    inp.addEventListener('input', () => { editorVariants[inp.dataset.idx].price = parseFloat(inp.value) || 0; });
  });
  spVariantsTbody.querySelectorAll('.var-stock').forEach(inp => {
    inp.addEventListener('input', () => { editorVariants[inp.dataset.idx].stock = parseInt(inp.value) || 0; });
  });
  spVariantsTbody.querySelectorAll('.var-sku').forEach(inp => {
    inp.addEventListener('input', () => { editorVariants[inp.dataset.idx].sku = inp.value; });
  });
}

function updateVariantsPrice() {
  const p = parseFloat(spPrice.value) || 0;
  if (!spHasVariants.checked || editorVariants.length === 0) return;
  // If user changes primary price, update variants that still had 0
  editorVariants.forEach(v => {
    if (!v.price || v.price === 0) v.price = p;
  });
}

// ── 7. SEO PREVIEW & DESCRIPTION TOOLBAR ──────────────────────────────────────
function updateSeoPreview() {
  const title = (spTitle.value || '').trim() || 'Solo Product Title';
  const desc = (spDesc.value || '').trim() || 'Describe your product to improve your rankings and attract buyers...';
  const id = editingId || (products.length + 1);

  seoPreviewTitle.textContent = `${title} | Solo`;
  seoPreviewUrl.textContent = `https://adounas.com/product.html?id=${id}`;
  seoPreviewDesc.textContent = desc.length > 150 ? `${desc.substring(0, 150)}...` : desc;
}

spTitle.addEventListener('input', updateSeoPreview);
spDesc.addEventListener('input', updateSeoPreview);

// Description Quick Toolbar
document.querySelectorAll('.toolbar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tag = btn.dataset.tag;
    const start = spDesc.selectionStart;
    const end = spDesc.selectionEnd;
    const text = spDesc.value;
    const selected = text.substring(start, end);

    if (tag === 'bold') {
      spDesc.value = text.substring(0, start) + `**${selected || 'bold text'}**` + text.substring(end);
    } else if (tag === 'italic') {
      spDesc.value = text.substring(0, start) + `*${selected || 'italic text'}*` + text.substring(end);
    } else if (tag === 'list') {
      spDesc.value = text.substring(0, start) + `\n• ${selected || 'Feature item 1'}\n• Feature item 2` + text.substring(end);
    } else if (tag === 'clean') {
      spDesc.value = spDesc.value.replace(/[*_#•]/g, '').trim();
    }
    updateSeoPreview();
  });
});

// Quantity Tracking toggle
spTrackQty.addEventListener('change', toggleQtyGroup);
function toggleQtyGroup() {
  if (spHasVariants.checked) {
    spQtyGroup.style.display = 'none';
  } else {
    spQtyGroup.style.display = spTrackQty.checked ? 'block' : 'none';
  }
}

// ── 8. 1-CLICK PRODUCT IMPORTER (Shopify Integrated) ──────────────────────────
async function handleProductImport(url, statusEl, btnEl) {
  if (!url) {
    setImporterStatus(statusEl, 'Please enter a product URL first.', 'error');
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    setImporterStatus(statusEl, 'Please enter a valid link starting with https://', 'error');
    return;
  }

  setImporterStatus(statusEl, '⏳ Extracting Shopify product details from supplier...', 'loading');
  btnEl.disabled = true;

  try {
    const res = await adminFetch('/api/admin/import-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Failed to extract product data.');
    }

    const p = data.product;

    // If on list view, open editor
    if (productsListView.style.display !== 'none') {
      openProductEditor(null);
    }

    // Auto-fill Shopify form
    if (p.name) spTitle.value = p.name;
    if (p.price) {
      const rawPrice = Number(p.price);
      // If scraped from US site (< 1000), convert to FCFA (approx 1 USD = 600 FCFA)
      const fcfaPrice = rawPrice < 1000 ? Math.round(rawPrice * 600) : Math.round(rawPrice);
      spPrice.value = fcfaPrice;
      // Set reasonable compare-at price for promo display (e.g. +25%)
      spComparePrice.value = Math.round(fcfaPrice * 1.25);
    }
    if (p.desc) spDesc.value = p.desc;
    if (p.category) spCategory.value = p.category;

    // Detect vendor from URL
    if (/alibaba/i.test(url)) spVendor.value = 'Alibaba';
    else if (/aliexpress/i.test(url)) spVendor.value = 'AliExpress';
    else if (/amazon/i.test(url)) spVendor.value = 'Amazon';
    else if (/shein/i.test(url)) spVendor.value = 'Shein';
    else spVendor.value = 'Supplier Import';

    // Populate Media Images
    const imgs = p.images && p.images.length > 0 ? p.images : (p.image ? [p.image] : []);
    editorImages = imgs;
    renderMediaGrid();

    // Auto-tags
    if (p.category && !editorTags.includes(p.category.toLowerCase())) {
      editorTags.push(p.category.toLowerCase());
    }
    editorTags.push(spVendor.value.toLowerCase());
    renderTags();

    calculatePricingMetrics();
    updateSeoPreview();

    setImporterStatus(statusEl, `✅ Imported! Found "${(p.name || 'Product').substring(0, 45)}..." — review and save.`, 'success');
    showToast('🎉 Shopify product details imported!');

  } catch (err) {
    console.error('Import error:', err);
    setImporterStatus(statusEl, `❌ Import error: ${err.message}. Check link or fill details manually.`, 'error');
  } finally {
    btnEl.disabled = false;
  }
}

function setImporterStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = `importer-status ${type}`;
  el.style.display = 'block';
}

// Quick Drawer Importer
btnImportQuick.addEventListener('click', () => {
  handleProductImport(importUrlInputQuick.value.trim(), importerStatusQuick, btnImportQuick);
});
importUrlInputQuick.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnImportQuick.click();
  }
});

// Sidebar Importer
btnImportSide.addEventListener('click', () => {
  handleProductImport(importUrlInputSide.value.trim(), importerStatusSide, btnImportSide);
});
importUrlInputSide.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnImportSide.click();
  }
});

// ── 9. SAVE / DUPLICATE / DELETE PRODUCT ──────────────────────────────────────
btnSaveProduct.addEventListener('click', () => {
  const name = spTitle.value.trim();
  const price = parseFloat(spPrice.value);

  if (!name) {
    showToast('Product title is required.', 'error');
    spTitle.focus();
    return;
  }

  if (isNaN(price) || price < 0) {
    showToast('Please enter a valid selling price.', 'error');
    spPrice.focus();
    return;
  }

  const comparePrice = parseFloat(spComparePrice.value) || null;
  const cost = parseFloat(spCost.value) || null;
  const desc = spDesc.value.trim();
  const sku = spSku.value.trim();
  const barcode = spBarcode.value.trim();
  const trackQuantity = spTrackQty.checked;
  const continueSelling = spContinueSelling.checked;
  const status = spStatus.value || 'active';
  const category = spCategory.value.trim();
  const productType = spProductType.value.trim();
  const vendor = spVendor.value.trim();

  // Stock calculation
  let stock = null;
  if (spHasVariants.checked && editorVariants.length > 0) {
    stock = editorVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
  } else if (trackQuantity) {
    const rawStock = spStock.value.trim();
    stock = rawStock === '' ? null : parseInt(rawStock);
  }

  const image = editorImages[0] || '';
  const images = editorImages;

  const productData = {
    name,
    price,
    comparePrice,
    cost,
    desc,
    sku,
    barcode,
    trackQuantity,
    continueSelling,
    stock,
    status,
    category,
    productType,
    vendor,
    tags: editorTags,
    image,
    images,
    hasVariants: spHasVariants.checked,
    options: spHasVariants.checked ? editorOptions : [],
    variants: spHasVariants.checked ? editorVariants : []
  };

  if (editingId !== null) {
    products = products.map(p => p.id === editingId ? { ...p, ...productData, id: editingId } : p);
    saveProducts(products);
    showToast('✅ Product saved successfully!');
  } else {
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ id: newId, ...productData });
    saveProducts(products);
    showToast('🎉 Product created successfully!');
  }

  closeProductEditor();
});

function duplicateProduct(id) {
  const p = products.find(prod => prod.id === id);
  if (!p) return;
  const newId = products.length > 0 ? Math.max(...products.map(pr => pr.id)) + 1 : 1;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = newId;
  copy.name = `${copy.name} (Copy)`;
  copy.status = 'draft';
  if (copy.sku) copy.sku = `${copy.sku}-COPY`;
  products.push(copy);
  saveProducts(products);
  renderProductsTable();
  showToast('📋 Product duplicated as Draft!');
}

function deleteProduct(id) {
  const p = products.find(prod => prod.id === id);
  if (!confirm(`Are you sure you want to delete "${p ? p.name : 'this product'}"? This cannot be undone.`)) return;
  products = products.filter(prod => prod.id !== id);
  saveProducts(products);
  renderProductsTable();
  showToast('🗑️ Product deleted.');
}

// ── 10. TAB NAVIGATION ────────────────────────────────────────────────────────
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
  panelProducts.style.display = 'block';
  renderProductsTable();
});

tabMessages.addEventListener('click', () => {
  setTab(tabMessages);
  panelMessages.style.display = 'grid';
  loadChatList();
  startChatPolling();
});

tabOrders.addEventListener('click', () => {
  setTab(tabOrders);
  panelOrders.style.display = 'block';
  loadOrders();
});

// ── 11. ADMIN ORDERS ──────────────────────────────────────────────────────────
const ordersListEl     = document.getElementById('orders-list');
const ordersFilterEl   = document.getElementById('orders-filter');
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
    const waMsg = encodeURIComponent(`Bonjour ${o.customer.name}! Ici la boutique Adounas concernant votre commande #${o.orderId} (${formatFCFA(o.total)}). Votre livraison à ${o.customer.location} est en cours de préparation!`);
    const waUrl = cleanDigits ? `https://wa.me/${cleanDigits}?text=${waMsg}` : '#';
    const telUrl = rawPhone ? `tel:${rawPhone}` : '#';

    return `
    <div class="shopify-card" style="margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Commande #${escO(o.orderId)} · ${fmtDate(o.createdAt)}</div>
          <div style="font-size:1.05rem; font-weight:700; margin:0.35rem 0;">
            ${escO(o.customer.name)} <span style="font-weight:400; font-size:0.88rem; color:var(--text-muted);">(${escO(o.customer.phone)})</span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">
            📍 ${escO(o.customer.location)} ${o.customer.email ? ` · ✉️ ${escO(o.customer.email)}` : ''}
          </div>
          <div style="background:#F9FAFB; padding:0.6rem 0.85rem; border-radius:var(--radius-xs); border:1px solid var(--border-subtle); font-size:0.85rem;">
            ${o.items.map(i => `<strong>${escO(i.name)}</strong> × ${i.qty}`).join(' &nbsp;|&nbsp; ')}
          </div>
          <div style="margin-top:0.75rem; font-size:1.1rem; font-weight:800; color:var(--text);">
            ${formatFCFA(o.total)} <span style="font-size:0.75rem; color:#108043; background:#E3F1DF; padding:0.15rem 0.4rem; border-radius:4px;">💵 Paiement à la livraison</span>
          </div>
          <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
            ${cleanDigits ? `<a href="${waUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-secondary" style="color:#25D366; font-weight:700;">💬 WhatsApp</a>` : ''}
            ${rawPhone ? `<a href="${telUrl}" class="btn btn-sm btn-secondary">📞 Call</a>` : ''}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
          <span class="badge-status-pill badge-${o.status === 'confirmed' ? 'active' : (o.status === 'pending' ? 'draft' : 'sale')}">${STATUS_LABELS[o.status] || o.status}</span>
          <select class="sp-select" style="width:auto; padding:0.35rem 0.6rem; font-size:0.82rem;" onchange="updateOrderStatus('${escO(o.orderId)}', this.value)">
            <option value="pending"   ${o.status==='pending'   ? 'selected':''}>⏳ Pending</option>
            <option value="confirmed" ${o.status==='confirmed' ? 'selected':''}>✅ Confirmed</option>
            <option value="delivered" ${o.status==='delivered' ? 'selected':''}>📦 Delivered</option>
            <option value="cancelled" ${o.status==='cancelled' ? 'selected':''}>❌ Cancelled</option>
          </select>
        </div>
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

setInterval(async () => {
  if (tabOrders.classList.contains('active') && getAdminToken()) {
    await loadOrders();
  }
}, 10000);

// ── 12. ADMIN CHAT ────────────────────────────────────────────────────────────
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

async function loadChatList() {
  try {
    const res   = await adminFetch('/api/chat/all');
    const chats = await res.json();

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

// ── Initial Render ────────────────────────────────────────────────────────────
renderProductsTable();
