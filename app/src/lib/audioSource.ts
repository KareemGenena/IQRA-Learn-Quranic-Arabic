/**
 * Shared audio fetching. Each recording is downloaded ONCE as a Blob and
 * playback uses a local blob: URL instead of streaming the file URL.
 *
 * Why: audio elements request media with HTTP Range requests, which the
 * service worker's precache doesn't support — on some browsers the first
 * (uncached) playback starts and then dies. A blob URL is served entirely
 * by the browser, no service worker involved, so playback is bulletproof —
 * and analysis + playback share one download.
 */

const blobs = new Map<string, Promise<Blob>>();
const objectUrls = new Map<string, Promise<string>>();

export function getAudioBlob(url: string): Promise<Blob> {
  let p = blobs.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`audio fetch failed: ${r.status} ${url}`);
      return r.blob();
    });
    p.catch(() => blobs.delete(url)); // transient failures must not stick
    blobs.set(url, p);
  }
  return p;
}

export function getAudioSrc(url: string): Promise<string> {
  let p = objectUrls.get(url);
  if (!p) {
    p = getAudioBlob(url).then((blob) => URL.createObjectURL(blob));
    p.catch(() => objectUrls.delete(url));
    objectUrls.set(url, p);
  }
  return p;
}
