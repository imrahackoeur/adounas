import './style.css';
import './suivi.css';
import './adaptive.js';

function formatFCFA(amount) {
  const num = Math.round(Number(amount) || 0);
  return `${num.toLocaleString('fr-FR')} FCFA`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const trackForm         = document.getElementById('track-form');
const trackInput        = document.getElementById('track-input');
const trackSubmitBtn    = document.getElementById('track-submit-btn');
const trackLoading      = document.getElementById('track-loading');
const trackError        = document.getElementById('track-error');
const trackErrorMsg     = document.getElementById('track-error-msg');
const trackContainer    = document.getElementById('track-orders-container');

// Map statuses to timeline steps (0: Received, 1: Prep, 2: Out for delivery, 3: Delivered)
const STATUS_STEP_MAP = {
  pending:   1, // Commande Reçue & Validée
  confirmed: 2, // En Préparation par l'équipe
  delivering:3, // En cours de livraison (Livreur en route)
  delivered: 4, // Livrée
  cancelled: -1 // Annulée
};

async function performTrack(query) {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return;

  trackInput.value = cleanQ;
  trackLoading.style.display = 'block';
  trackError.style.display = 'none';
  trackContainer.innerHTML = '';
  trackSubmitBtn.disabled = true;

  try {
    const res = await fetch(`/api/orders/track?query=${encodeURIComponent(cleanQ)}`);
    const data = await res.json();

    trackLoading.style.display = 'none';

    if (res.ok && data.ok && data.orders && data.orders.length > 0) {
      renderTrackedOrders(data.orders);
    } else {
      trackError.style.display = 'block';
      trackErrorMsg.textContent = data.error || 'Aucune commande trouvée. Vérifiez les informations saisies.';
    }
  } catch (err) {
    trackLoading.style.display = 'none';
    trackError.style.display = 'block';
    trackErrorMsg.textContent = 'Impossible de contacter le serveur. Veuillez réessayer.';
  } finally {
    trackSubmitBtn.disabled = false;
  }
}

function renderTrackedOrders(orders) {
  trackContainer.innerHTML = orders.map(order => {
    const currentStep = STATUS_STEP_MAP[order.status] || 1;
    const isCancelled = order.status === 'cancelled';
    const isDelivered = order.status === 'delivered';

    // Calculate progress fill percentage
    let fillPct = '0%';
    if (currentStep === 1) fillPct = '15%';
    else if (currentStep === 2) fillPct = '50%';
    else if (currentStep === 3) fillPct = '80%';
    else if (currentStep === 4) fillPct = '100%';

    const statusBadgeClass = `status-pill-${order.status || 'pending'}`;
    const statusLabel = {
      pending:   '⏳ Commande Enregistrée',
      confirmed: '🔍 En Préparation',
      delivered: '📦 Livrée avec Succès',
      cancelled: '❌ Annulée'
    }[order.status] || order.status;

    // WhatsApp Support link
    const waMsg = encodeURIComponent(`Bonjour Adounas! Je souhaite avoir des informations sur ma commande #${order.orderId} (${formatFCFA(order.total)}).`);
    const waLink = `https://wa.me/221770000000?text=${waMsg}`;

    return `
      <div class="order-tracking-card">
        
        <!-- Header -->
        <div class="order-card-header">
          <div>
            <span class="order-id-label">Commande #${esc(order.orderId)}</span>
            <h2 class="order-card-title">${esc(order.customer.name)}</h2>
            <span class="order-date-label">Passée le ${fmtDate(order.createdAt)}</span>
          </div>
          <div>
            <span class="status-pill-lg ${statusBadgeClass}">${statusLabel}</span>
          </div>
        </div>

        <!-- Visual Timeline Stepper -->
        ${isCancelled ? `
          <div style="background:#FEE2E2; border:1px solid #FECACA; padding:1rem; border-radius:12px; color:#991B1B; font-weight:600; margin:1.5rem 0;">
            ⚠️ Cette commande a été annulée. Veuillez contacter notre service client sur WhatsApp pour plus de détails.
          </div>
        ` : `
          <div class="delivery-timeline">
            <div class="timeline-track-bg">
              <div class="timeline-track-fill" style="width: ${fillPct};"></div>
            </div>

            <!-- Step 1: Reçue -->
            <div class="timeline-step ${currentStep >= 1 ? 'completed' : ''} ${currentStep === 1 ? 'active' : ''}">
              <div class="step-circle">📝</div>
              <div class="step-label">Reçue</div>
              <div class="step-desc">Commande validée</div>
            </div>

            <!-- Step 2: En Préparation -->
            <div class="timeline-step ${currentStep >= 2 ? 'completed' : ''} ${currentStep === 2 ? 'active' : ''}">
              <div class="step-circle">📦</div>
              <div class="step-label">Préparation</div>
              <div class="step-desc">Colis emballé</div>
            </div>

            <!-- Step 3: En Livraison -->
            <div class="timeline-step ${currentStep >= 3 ? 'completed' : ''} ${currentStep === 3 ? 'active' : ''}">
              <div class="step-circle">🛵</div>
              <div class="step-label">En Livraison</div>
              <div class="step-desc">Livreur en route</div>
            </div>

            <!-- Step 4: Livré -->
            <div class="timeline-step ${currentStep >= 4 ? 'completed' : ''}">
              <div class="step-circle">✅</div>
              <div class="step-label">Livrée</div>
              <div class="step-desc">Remis au client</div>
            </div>
          </div>
        `}

        <!-- Details Grid -->
        <div class="order-details-grid">
          
          <!-- Items list -->
          <div class="order-items-box">
            <h4>Articles commandés (${order.items.length})</h4>
            <div class="order-items-list">
              ${order.items.map(item => `
                <div class="order-track-item">
                  <img src="${item.image || 'https://placehold.co/100x100'}" alt="${esc(item.name)}" class="order-track-thumb" onerror="this.src='https://placehold.co/100x100'">
                  <div class="order-track-item-info">
                    <div class="order-track-item-name">${esc(item.name)}</div>
                    <div class="order-track-item-sub">Quantité: ${item.qty} × ${formatFCFA(item.price)}</div>
                  </div>
                  <div class="order-track-item-price">${formatFCFA(item.price * item.qty)}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Shipping & Payment -->
          <div class="order-shipping-box">
            <div>
              <h4>Détails de Livraison</h4>
              <div class="shipping-info-row">
                <div class="shipping-label">Destination</div>
                <div class="shipping-val">📍 ${esc(order.customer.location)}</div>
              </div>
              <div class="shipping-info-row">
                <div class="shipping-label">Téléphone de contact</div>
                <div class="shipping-val">📞 ${esc(order.customer.phone)}</div>
              </div>
              <div class="shipping-info-row">
                <div class="shipping-label">Mode de règlement</div>
                <div class="shipping-val">💵 Paiement à la réception (Cash / Wave)</div>
              </div>
            </div>

            <div>
              <div class="order-total-summary">
                <span class="total-sum-label">Montant Total</span>
                <span class="total-sum-amount">${formatFCFA(order.total)}</span>
              </div>
              <div class="order-support-actions">
                <a href="${waLink}" target="_blank" rel="noopener" class="btn-support-wa">
                  <span>💬 Contacter sur WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;
  }).join('');

  // Scroll to results smoothly
  trackContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Search Form Listener ──────────────────────────────────────────────────────
if (trackForm) {
  trackForm.addEventListener('submit', e => {
    e.preventDefault();
    const query = trackInput.value.trim();
    if (query) {
      // Update browser URL without reloading
      const url = new URL(window.location);
      url.searchParams.set('query', query);
      window.history.pushState({}, '', url);
      performTrack(query);
    }
  });
}

// ── Check URL query on page load (e.g. /suivi.html?id=ORD-... or ?phone=77...) ──
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('query') || params.get('id') || params.get('phone');
  if (q) {
    performTrack(q);
  }

  // Update Cart Badge on header
  try {
    const cart = JSON.parse(localStorage.getItem('solo_cart') || '[]');
    const totalCount = cart.reduce((s, i) => s + (i.qty || 1), 0);
    const badge = document.getElementById('cart-count');
    if (badge) {
      badge.textContent = totalCount;
      badge.classList.toggle('visible', totalCount > 0);
    }
  } catch {}
});
