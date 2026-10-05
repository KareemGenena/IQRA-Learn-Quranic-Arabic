// IQRA 1447 landing page: workbook sizes from the build, and the contact form.

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
  if (!name) return say('Please tell us your name.', 'err');
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
