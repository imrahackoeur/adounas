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

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ error: 'An account with this email already exists.' });

  const user = { id: Date.now().toString(), name: name.trim(), email: email.toLowerCase().trim(), passwordHash: hashPw(password), createdAt: Date.now() };
  users.push(user);
  saveUsers(users);

  const token = genToken();
  sessions[token] = { userId: user.id, email: user.email, name: user.name };
  res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  const users = loadUsers();
  const user  = users.find(u => u.email === email.toLowerCase().trim());
  if (!user || user.passwordHash !== hashPw(password))
    return res.status(401).json({ error: 'Incorrect email or password.' });

  const token = genToken();
  sessions[token] = { userId: user.id, email: user.email, name: user.name };
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

// ── Chat Store ─────────────────────────────────────────────────────────────────
const CHATS_FILE = path.join(__dirname, 'chats.json');
function loadChats() { return loadJson(CHATS_FILE, {}); }
function saveChats(d) { saveJson(CHATS_FILE, d); }

// ── POST /api/chat/send ────────────────────────────────────────────────────────
app.post('/api/chat/send', (req, res) => {
  const { chatId, sender, text, name } = req.body;
  if (!chatId || !sender || !text) return res.status(400).json({ error: 'Missing fields' });

  const chats = loadChats();
  if (!chats[chatId]) {
    chats[chatId] = { chatId, name: name || 'Customer', messages: [], createdAt: Date.now(), unread: 0 };
  }

  const msg = { id: Date.now(), sender, text, ts: Date.now() };
  chats[chatId].messages.push(msg);
  if (sender === 'customer') chats[chatId].unread = (chats[chatId].unread || 0) + 1;
  else chats[chatId].unread = 0;

  saveChats(chats);
  res.json({ ok: true, msg });
});

// ── GET /api/chat/sync ─────────────────────────────────────────────────────────
app.get('/api/chat/sync', (req, res) => {
  const { chatId } = req.query;
  if (!chatId) return res.status(400).json({ error: 'Missing chatId' });
  const chats = loadChats();
  const chat = chats[chatId] || { messages: [] };
  res.json({ messages: chat.messages });
});

// ── GET /api/chat/all  (admin) ────────────────────────────────────────────────
app.get('/api/chat/all', (_, res) => {
  const chats = loadChats();
  // Return summaries for the list (no messages body)
  const list = Object.values(chats).map(c => ({
    chatId:    c.chatId,
    name:      c.name,
    unread:    c.unread || 0,
    lastMsg:   c.messages.length ? c.messages[c.messages.length - 1].text : '',
    createdAt: c.createdAt,
  })).sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
});

// ── GET /api/chat/thread  (admin) ─────────────────────────────────────────────
app.get('/api/chat/thread', (req, res) => {
  const { chatId } = req.query;
  if (!chatId) return res.status(400).json({ error: 'Missing chatId' });
  const chats = loadChats();
  const chat = chats[chatId];
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  // Mark as read
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

// ── POST /api/orders ───────────────────────────────────────────────────────────
app.post('/api/orders', (req, res) => {
  const { customer, items, total } = req.body;
  if (!customer || !items || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order data.' });
  }
  const orders = loadOrders();
  const orderId = 'ORD-' + Date.now();
  const order = {
    orderId,
    customer,   // { name, phone, location }
    items,
    total,
    status: 'pending',
    createdAt: Date.now(),
  };
  orders.unshift(order);
  saveOrders(orders);
  res.json({ ok: true, orderId });
});

// ── GET /api/orders  (admin) ───────────────────────────────────────────────────
app.get('/api/orders', (_, res) => {
  res.json(loadOrders());
});

// ── GET /api/orders/:id ────────────────────────────────────────────────────────
app.get('/api/orders/:id', (req, res) => {
  const order = loadOrders().find(o => o.orderId === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// ── PATCH /api/orders/:id  (admin update status) ──────────────────────────────
app.patch('/api/orders/:id', (req, res) => {
  const { status } = req.body;
  const orders = loadOrders();
  const order = orders.find(o => o.orderId === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = status;
  saveOrders(orders);
  res.json({ ok: true, order });
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
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Adounas Server running  →  http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}\n`);
});

