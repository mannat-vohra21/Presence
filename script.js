/* ============================================================
   ATTENDANCE MANAGER — SCRIPT.JS
   Strictly limited to: logout confirmation, captcha check,
   mobile nav toggle. No other business logic lives here.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------------------------------------------------------
     1. MOBILE NAV TOGGLE
  --------------------------------------------------------- */
  var navToggle = document.querySelector('.nav-toggle');
  var siteNav = document.querySelector('.site-nav');

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      siteNav.classList.toggle('nav-open');
      var expanded = siteNav.classList.contains('nav-open');
      navToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  /* ---------------------------------------------------------
     1b. THEME TOGGLE (dark / light)
  --------------------------------------------------------- */
  var themeToggle = document.getElementById('themeToggle');
  var htmlEl = document.documentElement;

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = htmlEl.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      htmlEl.setAttribute('data-theme', next);
      try { localStorage.setItem('presence-theme', next); } catch (e) {}

      themeToggle.classList.remove('pulsing');
      void themeToggle.offsetWidth; // restart animation
      themeToggle.classList.add('pulsing');
    });
  }

  /* ---------------------------------------------------------
     2. LOGOUT — handled by the delegated click listener in the
     SPA router script (keeps a single source of truth and lets
     it also clear the simulated auth session; see AuthSim below).
  --------------------------------------------------------- */

  /* ---------------------------------------------------------
     3. CAPTCHA — simple generated code + validation
  --------------------------------------------------------- */
  var captchaDisplays = document.querySelectorAll('.js-captcha-code');

  function randomCaptcha() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 5; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  captchaDisplays.forEach(function (display) {
    var value = randomCaptcha();
    display.textContent = value;
    display.setAttribute('data-value', value);
  });

  var refreshButtons = document.querySelectorAll('.js-captcha-refresh');
  refreshButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-target'));
      if (!target) return;
      btn.classList.add('spinning');
      var value = randomCaptcha();
      target.textContent = value;
      target.setAttribute('data-value', value);
      var input = document.getElementById(target.getAttribute('data-input'));
      if (input) input.value = '';
      var feedback = document.getElementById(target.getAttribute('data-feedback'));
      if (feedback) { feedback.textContent = ''; feedback.className = 'captcha-feedback'; }
      setTimeout(function () { btn.classList.remove('spinning'); }, 400);
    });
  });

  var authForms = document.querySelectorAll('.js-captcha-form');
  authForms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var display = form.querySelector('.js-captcha-code');
      var input = form.querySelector('.js-captcha-input');
      if (!display || !input) return;
      var feedback = document.getElementById(display.getAttribute('data-feedback'));

      var expected = display.getAttribute('data-value');
      var entered = input.value.trim().toUpperCase();

      if (entered !== expected) {
        if (feedback) {
          feedback.textContent = 'Captcha does not match. Please try again.';
          feedback.className = 'captcha-feedback err';
        }
        var refresh = form.querySelector('.js-captcha-refresh');
        if (refresh) refresh.click();
        return;
      }

      if (feedback) {
        feedback.textContent = 'Captcha verified.';
        feedback.className = 'captcha-feedback ok';
      }

      if (form.id === 'login-form' && window.AuthSim) {
        window.AuthSim.handleLogin(form);
      } else if (form.id === 'signup-form' && window.AuthSim) {
        window.AuthSim.handleSignup(form);
      } else {
        alert('Form validated successfully. (UI demo — no backend connected.)');
      }
    });
  });

});

/* ============================================================
   SPA ROUTER — merged single-file navigation
   Every page from the original multi-file site now lives in
   this one document as a <section class="page" id="page-KEY">.
   Instead of rewriting every href by hand, a single delegated
   click handler resolves any internal-looking link (index.html,
   pages/xxx.html, xxx.html, optionally with a #anchor) to its
   matching section and swaps visibility — no page reload.
   ============================================================ */
(function () {
  var pages = document.querySelectorAll('.page');
  var navLinksAll = document.querySelectorAll('.nav-links a');

  function resolvePageKey(href) {
    if (!href) return null;
    var clean = href.split('#')[0];
    clean = clean.replace(/^(\.\.\/)+/, '').replace(/^pages\//, '');
    clean = clean.replace(/\.html$/, '');
    if (clean === '' || clean === 'index') clean = 'home';
    return clean;
  }

  window.showPage = function (name, anchor) {
    var target = document.getElementById('page-' + name);
    if (!target) return;
    pages.forEach(function (p) { p.style.display = 'none'; });
    target.style.display = 'block';

    navLinksAll.forEach(function (a) {
      var key = resolvePageKey(a.getAttribute('href'));
      var isActive = key === name && !a.classList.contains('js-logout');
      a.classList.toggle('active', isActive);
    });

    var siteNav = document.querySelector('.site-nav');
    if (siteNav) siteNav.classList.remove('nav-open');

    if (anchor) {
      setTimeout(function () {
        var el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 30);
    } else {
      window.scrollTo(0, 0);
    }
  };

  document.addEventListener('click', function (e) {
    var logoutEl = e.target.closest('.js-logout');
    if (logoutEl) {
      e.preventDefault();
      if (window.AuthSim) { window.AuthSim.clearSession(); window.AuthSim.updateNavForRole(null); }
      alert('Successfully logged out.');
      showPage('home');
      return;
    }

    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || /^(https?:)?\/\//.test(href) || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;

    var key = resolvePageKey(href);
    if (!key) return;
    var target = document.getElementById('page-' + key);
    if (!target) return; // not an internal page link (e.g. plain "#")

    e.preventDefault();
    var anchor = href.indexOf('#') !== -1 ? href.split('#')[1] : null;
    showPage(key, anchor);
  });

  // Initial route
  showPage('home');
})();

/* ============================================================
   AUTH SIMULATION — localStorage only, no backend.
   This is a frontend prototype: "accounts" are plain JSON
   objects saved to localStorage to simulate registration and
   login. Swap the four storage functions below for real API
   calls once a backend exists — nothing else needs to change.
   ============================================================ */
(function () {
  var USERS_KEY = 'am_users';
  var SESSION_KEY = 'am_session';

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveUsers(users) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
  }
  function findUser(email) {
    email = (email || '').trim().toLowerCase();
    var match = getUsers().filter(function (u) { return u.email.toLowerCase() === email; });
    return match.length ? match[0] : null;
  }
  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setSession(user, remember) {
    var data = JSON.stringify({ name: user.name, email: user.email, role: user.role, id: user.id });
    try {
      if (remember) {
        localStorage.setItem(SESSION_KEY, data);
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY, data);
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {}
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // Seed two demo accounts (one per role) so sign-in can be tried immediately.
  if (getUsers().length === 0) {
    saveUsers([
      { name: 'John', id: 'EMP1001', email: 'john@gmail.com', password: '123456', role: 'teacher' },
      { name: 'Riya', id: '21CS114', email: 'riya@gmail.com', password: '123456', role: 'student' }
    ]);
  }

  /* Show/hide top-nav links AND in-page content based on the signed-in
     role. null = signed out, shows the public (marketing) links and
     hides all role-gated page content. Any element tagged
     data-view-role="teacher"/"student" (in the nav, or inside the
     attendance/medical/reports pages) is gated by this one function so
     a student can never see the teacher's full class register, the
     leave-approval queue, or the institute-wide report — only their
     own data — and vice versa. */
  function updateNavForRole(role) {
    document.querySelectorAll('.nav-links [data-nav-role]').forEach(function (a) {
      var roles = (a.getAttribute('data-nav-role') || '').split(' ');
      var show = role ? roles.indexOf(role) !== -1 : roles.indexOf('public') !== -1;
      a.style.display = show ? '' : 'none';
    });
    var authGroup = document.querySelector('.nav-auth');
    var divider = document.querySelector('.nav-divider');
    if (authGroup) authGroup.style.display = role ? 'none' : '';
    if (divider) divider.style.display = role ? 'none' : '';

    document.querySelectorAll('[data-view-role]').forEach(function (el) {
      var roles = (el.getAttribute('data-view-role') || '').split(' ');
      el.style.display = (role && roles.indexOf(role) !== -1) ? '' : 'none';
    });
  }

  /* Reflect the signed-in user's name/role everywhere it's shown —
     every profile-chip in the document (topbar of every shared page),
     the student identity card, and the dashboard welcome heading.
     Previously this only touched the topbar chip on one page, which
     is why a freshly signed-up name could still show a leftover demo
     name elsewhere. */
  function applySessionToDashboard(session) {
    if (!session) return;
    var initials = session.name.trim().split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var roleLabel = session.role === 'teacher' ? 'Teacher' : 'Student';

    document.querySelectorAll('.profile-chip').forEach(function (chip) {
      var nameEl = chip.querySelector('.name');
      var roleEl = chip.querySelector('.role');
      var avatarEl = chip.querySelector('.avatar');
      if (nameEl) nameEl.textContent = session.name;
      if (roleEl) roleEl.textContent = roleLabel;
      if (avatarEl) avatarEl.textContent = initials || avatarEl.textContent;
    });

    var idNameEl = document.getElementById('student-identity-name');
    var idMetaEl = document.getElementById('student-identity-meta');
    var idAvatarEl = document.getElementById('student-identity-avatar');
    if (idNameEl) idNameEl.textContent = session.name;
    if (idMetaEl) idMetaEl.textContent = (session.id ? session.id : 'ID not set');
    if (idAvatarEl) idAvatarEl.textContent = initials || idAvatarEl.textContent;

    var page = document.getElementById(session.role === 'teacher' ? 'page-teacher' : 'page-student');
    var heading = page ? page.querySelector('.page-head h1') : null;
    if (heading) heading.textContent = 'Welcome back, ' + session.name.split(' ')[0] + ' 👋';
  }

  function handleSignup(form) {
    var feedback = document.getElementById('signup-auth-feedback');
    var name = document.getElementById('signup-name').value.trim();
    var idNumber = document.getElementById('signup-id').value.trim();
    var email = document.getElementById('signup-email').value.trim();
    var role = document.getElementById('signup-role').value;
    var pass = document.getElementById('signup-password').value;
    var confirm = document.getElementById('signup-confirm').value;

    if (!idNumber) { setFeedback(feedback, 'Please enter your Roll No. / Employee ID.', false); return; }
    if (!role) { setFeedback(feedback, 'Please select whether you are registering as a Student or Teacher.', false); return; }
    if (pass !== confirm) { setFeedback(feedback, 'Passwords do not match.', false); return; }
    if (findUser(email)) { setFeedback(feedback, 'An account with this email already exists.', false); return; }
    var idTaken = getUsers().some(function (u) { return (u.id || '').toLowerCase() === idNumber.toLowerCase(); });
    if (idTaken) { setFeedback(feedback, 'That Roll No. / Employee ID is already registered.', false); return; }

    var users = getUsers();
    var newUser = { name: name, id: idNumber, email: email, password: pass, role: role };
    users.push(newUser);
    saveUsers(users);

    setSession(newUser, false);
    updateNavForRole(newUser.role);
    applySessionToDashboard(getSession());
    setFeedback(feedback, 'Account created! Taking you to your dashboard…', true);
    setTimeout(function () { showPage(role === 'teacher' ? 'teacher' : 'student'); }, 700);
  }

  function handleLogin(form) {
    var feedback = document.getElementById('login-auth-feedback');
    var email = document.getElementById('login-email').value.trim();
    var pass = document.getElementById('login-password').value;
    var rememberBox = document.getElementById('remember');
    var remember = rememberBox ? rememberBox.checked : false;

    var user = findUser(email);
    if (!user || user.password !== pass) {
      setFeedback(feedback, 'Incorrect email or password.', false);
      return;
    }

    setSession(user, remember);
    updateNavForRole(user.role);
    applySessionToDashboard(getSession());
    setFeedback(feedback, 'Signed in! Redirecting…', true);
    setTimeout(function () { showPage(user.role === 'teacher' ? 'teacher' : 'student'); }, 500);
  }

  function setFeedback(el, message, ok) {
    if (!el) return;
    el.textContent = message;
    el.className = 'captcha-feedback ' + (ok ? 'ok' : 'err');
  }

  window.AuthSim = {
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    updateNavForRole: updateNavForRole,
    applySessionToDashboard: applySessionToDashboard,
    handleSignup: handleSignup,
    handleLogin: handleLogin
  };

  // Reflect any existing (persisted) session as soon as the nav exists.
  var existing = getSession();
  updateNavForRole(existing ? existing.role : null);
  if (existing) applySessionToDashboard(existing);
})();
