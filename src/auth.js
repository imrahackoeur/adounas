// ── Customer Auth Management ──────────────────────────────────────────────────
const TOKEN_KEY = 'solo_auth_token';
const USER_KEY  = 'solo_auth_user';

let onAuthSuccessCallback = null;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  const u = localStorage.getItem(USER_KEY);
  try { return u ? JSON.parse(u) : null; } catch { return null; }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  updateAuthUI();
}

export function clearSession() {
  const token = getToken();
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => {});
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  updateAuthUI();
}

export async function loginUser(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed.');
  setSession(data.token, data.user);
  return data.user;
}

export async function registerUser(name, email, password) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed.');
  setSession(data.token, data.user);
  return data.user;
}

export function openAuthModal(callback, defaultTab = 'login') {
  onAuthSuccessCallback = callback || null;
  const overlay = document.getElementById('auth-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  switchAuthTab(defaultTab);
  clearAuthErrors();
}

export function closeAuthModal() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  clearAuthErrors();
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('auth-form-login');
  const regForm   = document.getElementById('auth-form-register');
  const tabLogin  = document.getElementById('auth-tab-login');
  const tabReg    = document.getElementById('auth-tab-register');
  const modalSub  = document.getElementById('auth-modal-sub');

  if (tab === 'register') {
    loginForm.style.display = 'none';
    regForm.style.display = 'flex';
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
    if (modalSub) modalSub.textContent = 'Create an account to complete your order';
    const nameInp = document.getElementById('auth-reg-name');
    if (nameInp) nameInp.focus();
  } else {
    loginForm.style.display = 'flex';
    regForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    if (modalSub) modalSub.textContent = 'Sign in to complete your order';
    const emailInp = document.getElementById('auth-login-email');
    if (emailInp) emailInp.focus();
  }
}

function clearAuthErrors() {
  const errLogin = document.getElementById('auth-login-error');
  const errReg   = document.getElementById('auth-reg-error');
  if (errLogin) { errLogin.textContent = ''; errLogin.style.display = 'none'; }
  if (errReg)   { errReg.textContent = ''; errReg.style.display = 'none'; }
}

function showAuthError(formType, msg) {
  const errEl = document.getElementById(formType === 'login' ? 'auth-login-error' : 'auth-reg-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

export function updateAuthUI() {
  const user = getCurrentUser();
  const navUserBtn = document.getElementById('nav-user-btn');
  const userLabel  = document.getElementById('nav-user-label');
  const userDropdown = document.getElementById('nav-user-dropdown');
  const dropdownName = document.getElementById('user-dropdown-name');
  const dropdownEmail= document.getElementById('user-dropdown-email');

  // Pre-fill delivery name in cart if present
  const delivName = document.getElementById('delivery-name');
  if (delivName && user && !delivName.value) {
    delivName.value = user.name;
  }

  if (navUserBtn) {
    if (user) {
      if (userLabel) userLabel.textContent = user.name.split(' ')[0];
      navUserBtn.classList.add('logged-in');
      if (dropdownName) dropdownName.textContent = user.name;
      if (dropdownEmail) dropdownEmail.textContent = user.email;
    } else {
      if (userLabel) userLabel.textContent = 'Sign In';
      navUserBtn.classList.remove('logged-in');
    }
  }
}

// ── Initialize event listeners ────────────────────────────────────────────────
export function initAuth() {
  const overlay   = document.getElementById('auth-overlay');
  const closeBtn  = document.getElementById('auth-close');
  const tabLogin  = document.getElementById('auth-tab-login');
  const tabReg    = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('auth-form-login');
  const formReg   = document.getElementById('auth-form-register');
  const navUserBtn= document.getElementById('nav-user-btn');
  const userDropdown = document.getElementById('nav-user-dropdown');
  const logoutBtn = document.getElementById('user-logout-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeAuthModal(); });

  if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab('login'));
  if (tabReg) tabReg.addEventListener('click', () => switchAuthTab('register'));

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthErrors();
      const email = document.getElementById('auth-login-email').value.trim();
      const pass  = document.getElementById('auth-login-password').value;
      const submitBtn = formLogin.querySelector('button[type="submit"]');
      const origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';

      try {
        await loginUser(email, pass);
        closeAuthModal();
        if (onAuthSuccessCallback) {
          const cb = onAuthSuccessCallback;
          onAuthSuccessCallback = null;
          cb();
        }
      } catch (err) {
        showAuthError('login', err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    });
  }

  if (formReg) {
    formReg.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthErrors();
      const name  = document.getElementById('auth-reg-name').value.trim();
      const email = document.getElementById('auth-reg-email').value.trim();
      const pass  = document.getElementById('auth-reg-password').value;
      const submitBtn = formReg.querySelector('button[type="submit"]');
      const origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account…';

      try {
        await registerUser(name, email, pass);
        closeAuthModal();
        if (onAuthSuccessCallback) {
          const cb = onAuthSuccessCallback;
          onAuthSuccessCallback = null;
          cb();
        }
      } catch (err) {
        showAuthError('register', err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    });
  }

  if (navUserBtn) {
    navUserBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = getCurrentUser();
      if (!user) {
        openAuthModal(null, 'login');
      } else {
        if (userDropdown) {
          userDropdown.classList.toggle('open');
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      if (userDropdown) userDropdown.classList.remove('open');
    });
  }

  document.addEventListener('click', (e) => {
    if (userDropdown && userDropdown.classList.contains('open')) {
      if (!userDropdown.contains(e.target) && e.target !== navUserBtn) {
        userDropdown.classList.remove('open');
      }
    }
  });

  // Check current session from server
  const token = getToken();
  if (token) {
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (!res.ok) throw new Error();
      return res.json();
    }).then(data => {
      setSession(token, data.user);
    }).catch(() => {
      clearSession();
    });
  } else {
    updateAuthUI();
  }
}
