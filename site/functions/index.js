/**
 * The contact form of iqra.muslimbynature.org.
 *
 * Hosting rewrites POST /api/contact to this function (firebase.json, target
 * "home"), so the page and the form share one origin and no CORS is needed.
 * A message becomes:
 *   1. a row in the author's Notion database — columns Name (title), Email
 *      (email), Topic (select), Message (text); the full message also goes in
 *      the page body, since a Notion text property holds 2,000 characters;
 *   2. an email to the IQRA mailbox, with Reply-To set to the sender, so a
 *      reply is one click.
 * Either one is enough for the sender to be told "sent"; a failure of the
 * other is logged and, for Notion, reported in the email so it gets fixed.
 *
 * The three secrets live in Secret Manager, set by the author with
 * `firebase functions:secrets:set NAME` — never in this repository:
 *   NOTION_TOKEN        the Notion integration's internal secret
 *   NOTION_DATABASE_ID  the database's 32-character id (a pasted link works too)
 *   GMAIL_APP_PASSWORD  an app password of the mailbox below
 *
 * Spam: a hidden field people never fill in, and a minimum time on the page.
 * A bot that trips either is told "sent" and nothing is stored. If spam gets
 * through anyway, add Cloudflare Turnstile.
 */
import { onRequest } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import nodemailer from 'nodemailer';

const NOTION_TOKEN = defineSecret('NOTION_TOKEN');
const NOTION_DATABASE_ID = defineSecret('NOTION_DATABASE_ID');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

const MAILBOX = 'kintegracion@gmail.com';            // the app's admin account (app/src/lib/auth.ts)
const TOPICS = ['Question', 'Feedback', 'Something else'];
const MIN_MS_ON_PAGE = 2500;

const oneLine = s => String(s ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
const multiLine = s => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The id is the last 32 hex characters of the link's last path segment — a bare id,
 *  a dashed UUID or a whole "Copy link" URL all work. Searching the whole URL for the
 *  first 32 hex characters would not: a title slug ending in a-f letters runs into the id. */
function databaseId(raw) {
  const last = String(raw).trim().split(/[?#]/)[0].split('/').pop().replace(/-/g, '');
  const hex = last.match(/[0-9a-f]{32}$/i);
  if (!hex) throw new Error('NOTION_DATABASE_ID does not end in a 32-character database id');
  return hex[0];
}

const chunks = (s, n) => { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out; };

async function saveToNotion({ name, email, topic, message }) {
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN.value().trim()}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: databaseId(NOTION_DATABASE_ID.value()) },
      properties: {
        Name: { title: [{ text: { content: name || email } }] },     // the name is optional
        Email: { email },
        Topic: { select: { name: topic } },
        Message: { rich_text: [{ text: { content: message.slice(0, 2000) } }] },
      },
      children: message.split(/\n{2,}/).flatMap(p => chunks(p, 2000)).slice(0, 90).map(p => ({
        object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: p } }] },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 400)}`);
}

async function sendMail({ name, email, topic, message }, notionError) {
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: MAILBOX, pass: GMAIL_APP_PASSWORD.value().replace(/\s+/g, '') },
  });
  await transport.sendMail({
    from: `"IQRA 1447 website" <${MAILBOX}>`,
    to: MAILBOX,
    replyTo: name ? `"${name.replace(/"/g, "'")}" <${email}>` : email,
    subject: `[IQRA 1447] ${topic} — ${name || email}`.slice(0, 180),
    text: `From: ${name ? `${name} <${email}>` : email}\nAbout: ${topic}\n\n${message}\n\n— Sent from the contact form at iqra.muslimbynature.org` +
      (notionError ? `\n\nNOTE: this message was NOT saved to Notion: ${notionError}` : ''),
  });
}

export const contact = onRequest(
  { region: 'us-central1', secrets: [NOTION_TOKEN, NOTION_DATABASE_ID, GMAIL_APP_PASSWORD],
    maxInstances: 2, memory: '256MiB', timeoutSeconds: 30, invoker: 'public' },
  async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    const b = typeof req.body === 'object' && req.body ? req.body : {};

    // bots: answer as if sent, keep nothing
    if (oneLine(b.website) || !(Number(b.elapsed) >= MIN_MS_ON_PAGE)) {
      logger.info('contact: dropped as automated', { trap: !!oneLine(b.website), elapsed: Number(b.elapsed) || 0 });
      return res.json({ ok: true });
    }

    const msg = {
      name: oneLine(b.name).slice(0, 100),
      email: oneLine(b.email).slice(0, 200),
      topic: TOPICS.includes(oneLine(b.topic)) ? oneLine(b.topic) : 'Something else',
      message: multiLine(b.message).slice(0, 5000),
    };
    if (!EMAIL_RE.test(msg.email) || msg.message.length < 10) {
      return res.status(400).json({ ok: false, error: 'Please give a valid email and a message.' });
    }

    let notionError = '';
    try { await saveToNotion(msg); } catch (e) { notionError = e.message; logger.error('contact: Notion failed', { error: e.message }); }
    let mailError = '';
    try { await sendMail(msg, notionError); } catch (e) { mailError = e.message; logger.error('contact: email failed', { error: e.message }); }

    if (notionError && mailError) return res.status(502).json({ ok: false, error: 'Could not deliver the message.' });
    logger.info('contact: delivered', { notion: !notionError, email: !mailError, topic: msg.topic });
    return res.json({ ok: true });
  },
);
