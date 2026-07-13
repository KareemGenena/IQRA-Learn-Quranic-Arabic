/**
 * Admin gate for the calibrate page. The PIN itself is not stored in the
 * code — only its SHA-256 hash — so casual users can't read it out of the
 * bundle. (A determined developer could still bypass this client-side check;
 * calibration only writes to their own browser, so nothing shared is at risk.)
 *
 * To change the PIN, run:
 *   node -e "const c=require('crypto');console.log(c.createHash('sha256').update('YOUR-NEW-PIN').digest('hex'))"
 * and paste the output below.
 */

const ADMIN_PIN_HASH = '118b139b6c1709ade9f8327baa6376e1bdbe89ba37c26512a0b67e84dc116961';

const STORAGE_KEY = 'iqra-admin';

export function isAdmin(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export async function tryUnlock(pin: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin.trim()));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== ADMIN_PIN_HASH) return false;
  localStorage.setItem(STORAGE_KEY, '1');
  return true;
}
