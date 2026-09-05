// ── Customer In-App Chat ──────────────────────────────────────────────────────
// Works on both index.html and product.html

const CHAT_ID_KEY  = 'solo_chat_id';
const CHAT_NM_KEY  = 'solo_chat_name';
const POLL_INTERVAL = 4000; // ms

function getChatId() {
  let id = localStorage.getItem(CHAT_ID_KEY);
  if (!id) {
    id = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(CHAT_ID_KEY, id);
  }
  return id;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(container, msg) {
  const div = document.createElement('div');
  div.className = `chat-msg ${msg.sender}`;
  div.innerHTML = `${escapeHtml(msg.text)}<span class="chat-msg-time">${formatTime(msg.ts)}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function initChat() {
  const triggerBtn   = document.getElementById('chat-trigger-btn');
  const chatWindow   = document.getElementById('chat-window');
  const chatIconOpen = document.getElementById('chat-icon-open');
  const chatIconClose= document.getElementById('chat-icon-close');
  const unreadBadge  = document.getElementById('chat-unread-badge');
  const namePrompt   = document.getElementById('chat-name-prompt');
  const nameInput    = document.getElementById('chat-name-input');
  const nameSubmit   = document.getElementById('chat-name-submit');
  const messagesEl   = document.getElementById('chat-messages');
  const inputRow     = document.getElementById('chat-input-row');
  const chatInput    = document.getElementById('chat-input');
  const sendBtn      = document.getElementById('chat-send-btn');

  if (!triggerBtn) return; // Not on a page with the chat widget

  const chatId = getChatId();
  let chatName = localStorage.getItem(CHAT_NM_KEY);
  let isOpen   = false;
  let pollTimer = null;
  let lastMsgCount = 0;

  // Restore state: if name exists, skip name prompt
  if (chatName) {
    namePrompt.style.display = 'none';
    messagesEl.style.display = 'flex';
    inputRow.style.display   = 'flex';
  }

  // ── Toggle ────────────────────────────────────────────────
  triggerBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? 'flex' : 'none';
    chatIconOpen.style.display  = isOpen ? 'none' : '';
    chatIconClose.style.display = isOpen ? '' : 'none';
    unreadBadge.style.display   = 'none';

    if (isOpen && chatName) {
      loadMessages();
      startPolling();
    }
    if (!isOpen) stopPolling();
  });

  // ── Name submission ───────────────────────────────────────
  nameSubmit.addEventListener('click', submitName);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });

  function submitName() {
    const val = nameInput.value.trim();
    if (!val) return;
    chatName = val;
    localStorage.setItem(CHAT_NM_KEY, val);
    namePrompt.style.display = 'none';
    messagesEl.style.display = 'flex';
    inputRow.style.display   = 'flex';
    sendMessage(`Hi, I'm ${chatName}! 👋`);
    startPolling();
  }

  // ── Send message ──────────────────────────────────────────
  sendBtn.addEventListener('click', () => sendFromInput());
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendFromInput(); });

  function sendFromInput() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    sendMessage(text);
  }

  async function sendMessage(text) {
    const msg = { id: Date.now(), sender: 'customer', text, ts: Date.now() };
    appendMessage(messagesEl, msg);
    lastMsgCount++;
    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, sender: 'customer', text, name: chatName }),
      });
    } catch (e) { console.warn('Chat send error:', e); }
  }

  // ── Polling ───────────────────────────────────────────────
  async function loadMessages() {
    try {
      const res  = await fetch(`/api/chat/sync?chatId=${chatId}`);
      const data = await res.json();
      const msgs = data.messages || [];
      if (msgs.length !== lastMsgCount) {
        lastMsgCount = msgs.length;
        messagesEl.innerHTML = '';
        msgs.forEach(m => appendMessage(messagesEl, m));
        // Unread badge if window is closed
        if (!isOpen) {
          const adminMsgs = msgs.filter(m => m.sender === 'admin');
          if (adminMsgs.length > 0) {
            unreadBadge.style.display = 'flex';
            unreadBadge.textContent   = adminMsgs.length;
          }
        }
      }
    } catch(e) { /* Server may not be available */ }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(loadMessages, POLL_INTERVAL);
  }
  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // Start polling silently in background to detect admin replies
  if (chatName) {
    startPolling();
  }
}

initChat();
