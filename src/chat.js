// ── Customer In-App Chat (Persistent & Account-Linked) ──────────────────────
// Works on index.html, product.html, and all pages

const CHAT_ID_KEY  = 'solo_chat_id';
const CHAT_NM_KEY  = 'solo_chat_name';
const POLL_INTERVAL = 3500; // ms

function getLoggedInUser() {
  try {
    const raw = localStorage.getItem('solo_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getChatId() {
  const user = getLoggedInUser();
  if (user && user.id) {
    const userChatId = 'user_chat_' + user.id;
    localStorage.setItem(CHAT_ID_KEY, userChatId);
    return userChatId;
  }
  let id = localStorage.getItem(CHAT_ID_KEY);
  if (!id) {
    id = 'guest_chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(CHAT_ID_KEY, id);
  }
  return id;
}

function getLocalHistory(chatId) {
  try {
    const raw = localStorage.getItem('solo_chat_history_' + chatId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(chatId, msgs) {
  try {
    localStorage.setItem('solo_chat_history_' + chatId, JSON.stringify(msgs));
  } catch {}
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function appendMessage(container, msg) {
  const div = document.createElement('div');
  div.className = `chat-msg ${msg.sender}`;
  div.innerHTML = `${escapeHtml(msg.text)}<span class="chat-msg-time">${formatTime(msg.ts)}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
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

  if (!triggerBtn || !messagesEl) return;

  const user = getLoggedInUser();
  const chatId = getChatId();
  let chatName = (user && user.name) ? user.name : localStorage.getItem(CHAT_NM_KEY);
  let isOpen   = false;
  let pollTimer = null;
  let currentMessages = getLocalHistory(chatId);

  // Render locally cached messages immediately so they never disappear
  if (currentMessages.length > 0) {
    messagesEl.innerHTML = '';
    currentMessages.forEach(m => appendMessage(messagesEl, m));
  }

  // Restore UI state if name or user exists
  if (chatName || (user && user.name)) {
    if (namePrompt) namePrompt.style.display = 'none';
    messagesEl.style.display = 'flex';
    if (inputRow) inputRow.style.display = 'flex';
  }

  // ── Toggle Chat Window ──────────────────────────────────
  triggerBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? 'flex' : 'none';
    if (chatIconOpen) chatIconOpen.style.display  = isOpen ? 'none' : '';
    if (chatIconClose) chatIconClose.style.display = isOpen ? '' : 'none';
    if (unreadBadge) unreadBadge.style.display   = 'none';

    if (isOpen) {
      loadMessages();
      startPolling();
      if (chatInput) chatInput.focus();
    } else {
      stopPolling();
    }
  });

  // ── Name Submission for Guests ──────────────────────────
  if (nameSubmit && nameInput) {
    nameSubmit.addEventListener('click', submitName);
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });
  }

  function submitName() {
    const val = nameInput ? nameInput.value.trim() : '';
    if (!val) return;
    chatName = val;
    localStorage.setItem(CHAT_NM_KEY, val);
    if (namePrompt) namePrompt.style.display = 'none';
    messagesEl.style.display = 'flex';
    if (inputRow) inputRow.style.display = 'flex';
    sendMessage(`Hi, I'm ${chatName}! 👋`);
    startPolling();
  }

  // ── Send Message ─────────────────────────────────────────
  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => sendFromInput());
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendFromInput(); });
  }

  function sendFromInput() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    sendMessage(text);
  }

  async function sendMessage(text) {
    const activeUser = getLoggedInUser();
    const senderName = (activeUser && activeUser.name) ? activeUser.name : (chatName || 'Customer');
    const msg = { id: Date.now(), sender: 'customer', text, ts: Date.now() };

    // Append to UI & local storage immediately
    appendMessage(messagesEl, msg);
    currentMessages.push(msg);
    saveLocalHistory(chatId, currentMessages);

    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          sender: 'customer',
          text,
          name: senderName
        }),
      });
    } catch (e) {
      console.warn('Chat send error:', e);
    }
  }

  // ── Load & Sync Messages ─────────────────────────────────
  async function loadMessages() {
    try {
      const res  = await fetch(`/api/chat/sync?chatId=${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      const serverMsgs = data.messages || [];

      if (JSON.stringify(serverMsgs) !== JSON.stringify(currentMessages)) {
        currentMessages = serverMsgs;
        saveLocalHistory(chatId, serverMsgs);
        messagesEl.innerHTML = '';
        currentMessages.forEach(m => appendMessage(messagesEl, m));

        // Update unread badge when closed
        if (!isOpen && unreadBadge) {
          const adminMsgs = serverMsgs.filter(m => m.sender === 'admin');
          if (adminMsgs.length > 0) {
            unreadBadge.style.display = 'flex';
            unreadBadge.textContent   = adminMsgs.length;
          }
        }
      }
    } catch (e) {
      // Offline fallback: currentMessages remains loaded from local storage
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(loadMessages, POLL_INTERVAL);
  }
  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // Always sync messages on initial load & start silent background polling
  loadMessages();
  startPolling();
}

// Initialize chat when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}

