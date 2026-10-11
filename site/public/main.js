// IQRA 1447 landing page: the app switch, workbook sizes from the build, and the contact form.

// Whether the page shows the app (header link, hero button, app section) is the
// author's switch at /admin, kept in Firestore at config/site. Hidden unless the
// document says appVisible: true — so an error, or no document yet, keeps it hidden.
// Hiding the links does not make the app private: its own address still works.
fetch('https://firestore.googleapis.com/v1/projects/iqra---learn-quranic-arabic/databases/(default)/documents/config/site',
  { cache: 'no-store' })
  .then(r => (r.ok ? r.json() : null))
  .then(doc => {
    if (doc?.fields?.appVisible?.booleanValue === true) document.documentElement.classList.add('app-on');
  })
  .catch(() => {});

// Page counts and sizes are written by site/build.mjs at deploy time, so they
// follow the PDFs without anyone editing this page.
fetch('/workbooks/meta.json', { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : null))
  .then(meta => {
    if (!meta) return;
    for (const el of document.querySelectorAll('.book')) {
      const m = meta[`level${el.dataset.level}`];
      if (!m) continue;
      const mb = (m.bytes / 1048576).toFixed(1);
      el.querySelector('[data-meta]').textContent = `PDF · ${m.pages} pages · ${mb} MB · ${m.edition}`;
    }
  })
  .catch(() => {});

const form = document.getElementById('contact-form');
const status = form.querySelector('.form-status');
const button = form.querySelector('button[type=submit]');
const opened = Date.now();

function say(text, kind) {
  status.textContent = text;
  status.className = 'form-status' + (kind ? ' ' + kind : '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const name = (data.name || '').trim(), email = (data.email || '').trim(), message = (data.message || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Please check your email address.', 'err');
  if (message.length < 10) return say('Please write a little more in your message.', 'err');

  button.disabled = true;
  say('Sending…');
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, name, email, message, elapsed: Date.now() - opened }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || 'send failed');
    form.reset();
    say('Thank you — your message has been sent. We will reply, in shaa Allah.', 'ok');
  } catch {
    say('Sorry, the message could not be sent. Please try again in a few minutes.', 'err');
  } finally {
    button.disabled = false;
  }
});

// The workbook ↔ app crosswalk (/workbooks/crosswalk.json, generated from the
// masters' own Tables of Contents): under each workbook, which app lessons
// match its sections — "for listening practice, see the app". It is app-only,
// so it stays hidden until config/site says the app is visible.
fetch('/workbooks/crosswalk.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null))
  .then((cw) => {
    if (!cw) return;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    for (const [level, lv] of Object.entries(cw.levels)) {
      const el = document.querySelector(`[data-app-lessons="${level}"]`);
      if (!el) continue;
      const rows = lv.sections
        .filter((s) => s.lessons.length)
        .map((s) => `<li><span class="app-lessons-section">Section ${s.section} · ${esc(s.title)}</span> — for listening practice, see the app: ${s.lessons.map((l) => `<a href="${esc(l.url)}" rel="noopener">${esc(l.title)}</a>`).join(', ')}</li>`);
      if (rows.length) el.innerHTML = `<ul>${rows.join('')}</ul>`;
    }
  })
  .catch(() => {});
