import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import { createHash, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const app    = express();
const PORT   = process.env.PORT || 3001;
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';

// ── Security Headers & Baseline Hardening ─────────────────────────────────────
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '500kb' }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const rateLimits = new Map(); // key -> { count, resetTime }

function rateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.' }) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    let record = rateLimits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimits.set(key, record);
    } else {
      record.count++;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Cleanup stale rate limit records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimits.entries()) {
    if (now > v.resetTime) rateLimits.delete(k);
  }
}, 10 * 60 * 1000);

const adminLoginLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many admin login attempts. Please wait 15 minutes.' });
const authLimiter       = rateLimiter({ windowMs: 15 * 60 * 1000, max: 15, message: 'Too many authentication attempts. Please try again later.' });
const orderLimiter      = rateLimiter({ windowMs: 10 * 60 * 1000, max: 6, message: 'Order limit reached. Please wait a few moments.' });
const chatLimiter       = rateLimiter({ windowMs: 60 * 1000, max: 25, message: 'Message rate limit exceeded. Please slow down.' });

// ── Sanitization Helper ───────────────────────────────────────────────────────
function sanitizeText(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLength);
}
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── POST /api/create-checkout-session ─────────────────────────────────────────
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const line_items = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.desc || undefined,
          // Images must be public absolute URLs — skip local paths
          images: item.image && item.image.startsWith('http') ? [item.image] : [],
        },
        unit_amount: Math.round(Number(item.price) * 100), // cents
      },
      quantity: item.qty,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      allow_promotion_codes: true,
      success_url: `${CLIENT}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${CLIENT}/cancel.html`,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'FR', 'DE', 'AU'] },
      billing_address_collection: 'auto',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/verify-session ────────────────────────────────────────────────────
app.get('/api/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'No session_id' });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items'],
    });

    res.json({
      status:          session.payment_status,
      customer_email:  session.customer_details?.email || null,
      customer_name:   session.customer_details?.name  || null,
      amount_total:    session.amount_total,
      currency:        session.currency,
      items:           session.line_items?.data || [],
    });
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Auth Endpoints ────────────────────────────────────────────────────────────

// Generic JSON file helpers
function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Auth Store (users.json + sessions in memory) ────────────────────────────────
const USERS_FILE = path.join(__dirname, 'users.json');
const sessions   = {};  // token -> { userId, email, name }

function hashPw(pw) {
  return createHash('sha256').update(pw + 'solo_salt_2026').digest('hex');
}
function genToken() {
  return randomBytes(32).toString('hex');
}
function loadUsers() { return loadJson(USERS_FILE, []); }
function saveUsers(u) { saveJson(USERS_FILE, u); }

// POST /api/auth/register
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, email, password } = req.body;
  const cleanName = sanitizeText(name, 80);
  const cleanEmail = sanitizeText(email, 120).toLowerCase();

  if (!cleanName || !cleanEmail || !password)
    return res.status(400).json({ error: 'Name, email and password are required.' });
  if (!isValidEmail(cleanEmail))
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  if (password.length < 6 || password.length > 128)
    return res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });

  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === cleanEmail))
    return res.status(409).json({ error: 'An account with this email already exists.' });

  const user = { id: Date.now().toString(), name: cleanName, email: cleanEmail, passwordHash: hashPw(password), createdAt: Date.now() };
  users.push(user);
  saveUsers(users);

  const token = genToken();
  sessions[token] = { userId: user.id, email: user.email, name: user.name, createdAt: Date.now() };
  res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = sanitizeText(email, 120).toLowerCase();
  if (!cleanEmail || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  const users = loadUsers();
  const user  = users.find(u => u.email === cleanEmail);
  if (!user || user.passwordHash !== hashPw(password))
    return res.status(401).json({ error: 'Incorrect email or password.' });

  const token = genToken();
  sessions[token] = { userId: user.id, email: user.email, name: user.name, createdAt: Date.now() };
  res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const session = sessions[token];
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ user: session });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  delete sessions[token];
  res.json({ ok: true });
});

// ── Admin Authentication (with 24h expiration) ──────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'solo2026';
const adminSessions  = new Map(); // token -> expiresAt (timestamp)
const ADMIN_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const expiresAt = adminSessions.get(token);
  if (!token || !expiresAt || Date.now() > expiresAt) {
    if (token) adminSessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized: Admin session expired or invalid.' });
  }
  next();
}

// POST /api/admin/login (with strict rate limit)
app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  const token = 'adm_' + genToken();
  adminSessions.set(token, Date.now() + ADMIN_SESSION_DURATION);
  res.json({ ok: true, token });
});

// GET /api/admin/verify
app.get('/api/admin/verify', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const expiresAt = adminSessions.get(token);
  if (token && expiresAt && Date.now() < expiresAt) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid or expired admin session.' });
});

// POST /api/admin/logout
app.post('/api/admin/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  adminSessions.delete(token);
  res.json({ ok: true });
});

// ── GET /api/geocode (GPS address lookup) ──────────────────────────────────────
app.get('/api/geocode', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat or lon' });
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
      headers: { 'User-Agent': 'Adounas-Ecommerce/1.0 (contact@adounas.com)' }
    });
    const data = await r.json();
    const a = data.address || {};
    const parts = [
      a.road || a.neighbourhood || a.suburb,
      a.city || a.town || a.village || a.state,
      a.country
    ].filter(Boolean);
    const address = parts.length > 0 ? parts.join(', ') : (data.display_name || `GPS (${lat}, ${lon})`);
    res.json({ ok: true, address, lat, lon });
  } catch (err) {
    res.json({ ok: true, address: `GPS (${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)})`, lat, lon });
  }
});

// ── Chat Store ─────────────────────────────────────────────────────────────────
const CHATS_FILE = path.join(__dirname, 'chats.json');
function loadChats() { return loadJson(CHATS_FILE, {}); }
function saveChats(d) { saveJson(CHATS_FILE, d); }

// ── POST /api/chat/send ────────────────────────────────────────────────────────
app.post('/api/chat/send', chatLimiter, (req, res) => {
  const { chatId, sender, text, name } = req.body;
  const cleanChatId = sanitizeText(chatId, 100);
  const cleanSender = sender === 'admin' ? 'admin' : 'customer';
  const cleanText   = sanitizeText(text, 1000);
  const cleanName   = sanitizeText(name, 80) || 'Customer';

  if (!cleanChatId || !cleanText) return res.status(400).json({ error: 'Missing fields' });

  const chats = loadChats();
  if (!chats[cleanChatId]) {
    chats[cleanChatId] = { chatId: cleanChatId, name: cleanName, messages: [], createdAt: Date.now(), unread: 0 };
  }

  const msg = { id: Date.now(), sender: cleanSender, text: cleanText, ts: Date.now() };
  chats[cleanChatId].messages.push(msg);
  if (cleanSender === 'customer') chats[cleanChatId].unread = (chats[cleanChatId].unread || 0) + 1;
  else chats[cleanChatId].unread = 0;

  saveChats(chats);
  res.json({ ok: true, msg });
});

// ── GET /api/chat/sync ─────────────────────────────────────────────────────────
app.get('/api/chat/sync', (req, res) => {
  const cleanChatId = sanitizeText(req.query.chatId, 100);
  if (!cleanChatId) return res.status(400).json({ error: 'Missing chatId' });
  const chats = loadChats();
  const chat = chats[cleanChatId] || { messages: [] };
  res.json({ messages: chat.messages });
});

// ── GET /api/chat/all  (admin only) ───────────────────────────────────────────
app.get('/api/chat/all', adminAuth, (_, res) => {
  const chats = loadChats();
  const list = Object.values(chats).map(c => ({
    chatId:    c.chatId,
    name:      c.name,
    unread:    c.unread || 0,
    lastMsg:   c.messages.length ? c.messages[c.messages.length - 1].text : '',
    createdAt: c.createdAt,
  })).sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
});

// ── GET /api/chat/thread  (admin only) ────────────────────────────────────────
app.get('/api/chat/thread', adminAuth, (req, res) => {
  const cleanChatId = sanitizeText(req.query.chatId, 100);
  if (!cleanChatId) return res.status(400).json({ error: 'Missing chatId' });
  const chats = loadChats();
  const chat = chats[cleanChatId];
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  chat.unread = 0;
  saveChats(chats);
  res.json(chat);
});

// ── Orders Store (persisted to orders.json) ───────────────────────────────────
const ORDERS_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  if (!existsSync(ORDERS_FILE)) return [];
  try { return JSON.parse(readFileSync(ORDERS_FILE, 'utf8')); } catch { return []; }
}
function saveOrders(orders) {
  writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// ── Telegram Order Alert Dispatcher ──────────────────────────────────────────
async function sendTelegramAlert(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const itemsList = order.items.map(i => `  • ${sanitizeText(i.name, 60)} × ${i.qty} ($${(Number(i.price) * i.qty).toFixed(2)})`).join('\n');
  const cleanPhone = (order.customer.phone || '').replace(/[^0-9+]/g, '');

  const text = `🛍️ *NEW ORDER RECEIVED!*
━━━━━━━━━━━━━━━━━━
🆔 *Order:* \`${order.orderId}\`
👤 *Customer:* ${order.customer.name || 'Anonymous'}
📞 *Phone:* ${order.customer.phone || 'N/A'}
📍 *Address:* ${order.customer.location || 'N/A'}
✉️ *Email:* ${order.customer.email || 'N/A'}
💵 *Total:* $${Number(order.total).toFixed(2)} (Cash on Delivery)

📦 *Items Ordered:*
${itemsList}

━━━━━━━━━━━━━━━━━━
💬 [WhatsApp Customer](https://wa.me/${cleanPhone.replace('+', '')})
⚙️ [Open Admin Dashboard](${process.env.CLIENT_URL || 'https://adounas.com'}/admin.html)`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
  } catch (err) {
    console.error('Telegram notification error:', err.message);
  }
}

// ── POST /api/orders (with rate limiter and input validation) ──────────────────
app.post('/api/orders', orderLimiter, async (req, res) => {
  const { customer, items, total } = req.body;
  if (!customer || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order data.' });
  }

  const cleanCustomer = {
    name: sanitizeText(customer.name, 80),
    phone: sanitizeText(customer.phone, 30),
    location: sanitizeText(customer.location, 160),
    email: sanitizeText(customer.email, 120),
    userId: sanitizeText(customer.userId, 60),
  };

  if (!cleanCustomer.name || !cleanCustomer.phone || !cleanCustomer.location) {
    return res.status(400).json({ error: 'Customer name, phone and delivery address are required.' });
  }

  const cleanItems = items.map(i => ({
    id: i.id,
    name: sanitizeText(i.name, 100),
    price: Math.max(0, Number(i.price) || 0),
    qty: Math.max(1, Math.min(99, parseInt(i.qty) || 1)),
    image: sanitizeText(i.image, 300)
  }));

  const calcTotal = cleanItems.reduce((s, i) => s + i.price * i.qty, 0);

  const orders = loadOrders();
  const orderId = 'ORD-' + Date.now();
  const order = {
    orderId,
    customer: cleanCustomer,
    items: cleanItems,
    total: calcTotal || Math.max(0, Number(total) || 0),
    status: 'pending',
    createdAt: Date.now(),
  };
  orders.unshift(order);
  saveOrders(orders);

  // Send instant Telegram alert asynchronously
  sendTelegramAlert(order).catch(() => {});


  res.json({ ok: true, orderId });
});

// ── POST /api/admin/test-telegram (admin only) ────────────────────────────────
app.post('/api/admin/test-telegram', adminAuth, async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in Railway variables or .env.' });
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ *Adounas Instant Alerts Connected!*\nYou will receive real-time push alerts whenever a customer places an order.',
        parse_mode: 'Markdown'
      })
    });
    const data = await r.json();
    if (data.ok) res.json({ ok: true });
    else res.status(400).json({ error: data.description || 'Failed to send message to Telegram.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── GET /api/orders  (admin only - all orders) ───────────────────────────────
app.get('/api/orders', adminAuth, (_, res) => {
  res.json(loadOrders());
});

// ── GET /api/orders/:id  (receipt view by specific ID) ────────────────────────
app.get('/api/orders/:id', (req, res) => {
  const order = loadOrders().find(o => o.orderId === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});


// ── PATCH /api/orders/:id  (admin only) ───────────────────────────────────────
app.patch('/api/orders/:id', adminAuth, (req, res) => {
  const { status } = req.body;
  const orders = loadOrders();
  const order = orders.find(o => o.orderId === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = status;
  saveOrders(orders);
  res.json({ ok: true, order });
});


// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ ok: true, status: 'healthy', time: new Date().toISOString() });
});

// ── Serve Static Assets in Production ─────────────────────────────────────────
const distPath = path.join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // Fallback for client-side routing in Express 5
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
} else {
  app.get('/', (_, res) => {
    res.send('<h1>Adounas Server is Running</h1><p>Building frontend...</p>');
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`\n✅  Adounas Server running  →  http://${HOST}:${PORT}`);
  console.log(`   Dist static files: ${existsSync(distPath) ? '✅ Loaded' : '⚠️ Not found'}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}\n`);
});


