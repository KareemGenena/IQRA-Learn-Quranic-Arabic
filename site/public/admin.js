// /admin — the author's switches for the landing page. Today: whether it shows the app.
//
// Same approach as the app (app/src/lib/auth.ts, appConfig.ts): Firebase Auth and
// Firestore over their REST APIs, no SDK. The switch is the document config/site,
// { appVisible: bool, updatedAt }, which anyone may read and only the admin email may
// write (firestore.rules) — so this page's own email check is only for a clear
// message; the rules are what enforce it. The token lives in memory: a reload signs out.

const API_KEY = 'AIzaSyCxCjuSvjxYza2FZUnNMCXCumECto0Eyig';      // the app's public web key
const PROJECT = 'iqra---learn-quranic-arabic';
const ADMIN = 'kintegracion@gmail.com';
const DOC = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/config/site`;

const $ = id => document.getElementById(id);
const signin = $('signin'), panel = $('panel'), toggle = $('app-visible');
const signinStatus = signin.querySelector('.form-status'), saveStatus = $('save-status');
let token = null;

const say = (el, text, kind) => { el.textContent = text; el.className = 'form-status' + (kind ? ' ' + kind : ''); };

const AUTH_ERRORS = {
  INVALID_LOGIN_CREDENTIALS: 'That email and password do not match.',
  INVALID_PASSWORD: 'That email and password do not match.',
  EMAIL_NOT_FOUND: 'That email and password do not match.',
  INVALID_EMAIL: 'Please check the email address.',
  USER_DISABLED: 'This account is disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts — please wait a few minutes and try again.',
};

signin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('a-email').value.trim(), password = $('a-password').value;
  if (!email || !password) return say(signinStatus, 'Please enter the email and password.', 'err');
  say(signinStatus, 'Signing in…');
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const out = await res.json();
    $('a-password').value = '';
    if (!res.ok) {
      const code = String(out?.error?.message || '').split(' ')[0];
      return say(signinStatus, AUTH_ERRORS[code] || `Sign-in failed (${code || res.status}).`, 'err');
    }
    if (String(out.email).toLowerCase() !== ADMIN) {
      return say(signinStatus, 'This account is not the IQRA 1447 admin, so it cannot change these settings.', 'err');
    }
    token = out.idToken;
    say(signinStatus, '');
    signin.hidden = true;
    panel.hidden = false;
    await load();
  } catch {
    say(signinStatus, 'Could not reach the sign-in service. Check the connection and try again.', 'err');
  }
});

async function load() {
  toggle.disabled = true;
  say(saveStatus, 'Reading the current setting…');
  try {
    const res = await fetch(`${DOC}?key=${API_KEY}`, { cache: 'no-store' });
    const doc = res.status === 404 ? null : await res.json();
    if (res.status !== 404 && !res.ok) throw new Error(String(res.status));
    toggle.checked = doc?.fields?.appVisible?.booleanValue === true;
    say(saveStatus, toggle.checked ? 'The website shows the app.' : 'The website hides the app.');
  } catch {
    say(saveStatus, 'Could not read the current setting. Reload the page to try again.', 'err');
    return;
  }
  toggle.disabled = false;
}

toggle.addEventListener('change', async () => {
  const want = toggle.checked;
  toggle.disabled = true;
  say(saveStatus, 'Saving…');
  try {
    const res = await fetch(`${DOC}?key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: {
        appVisible: { booleanValue: want },
        updatedAt: { timestampValue: new Date().toISOString() },
      } }),
    });
    if (res.status === 401 || res.status === 403) throw new Error('auth');
    if (!res.ok) throw new Error(String(res.status));
    say(saveStatus, want ? 'Saved — the website now shows the app.' : 'Saved — the website now hides the app.', 'ok');
  } catch (err) {
    toggle.checked = !want;
    say(saveStatus, err.message === 'auth'
      ? 'Your sign-in has expired or is not allowed. Sign out and sign in again.'
      : 'Could not save. Please try again.', 'err');
  }
  toggle.disabled = false;
});

$('signout').addEventListener('click', () => {
  token = null;
  panel.hidden = true;
  signin.hidden = false;
  say(saveStatus, '');
  say(signinStatus, 'Signed out.');
});
