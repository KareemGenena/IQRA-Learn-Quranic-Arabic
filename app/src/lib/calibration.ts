/**
 * Tap-to-calibrate storage. Calibrated boundaries live in localStorage,
 * keyed per lesson, and take priority over words.json timings and the
 * automatic estimate. The calibrate page can export the whole lesson as a
 * words.json with the calibrated timings baked in.
 */

export type CalibrationMap = Record<number, number[]>;

const key = (lessonId: number) => `iqra-calibration-lesson${lessonId}`;

export function loadCalibration(lessonId: number): CalibrationMap {
  try {
    const raw = localStorage.getItem(key(lessonId));
    return raw ? (JSON.parse(raw) as CalibrationMap) : {};
  } catch {
    return {};
  }
}

export function saveCalibration(lessonId: number, wordId: number, boundaries: number[]): void {
  const map = loadCalibration(lessonId);
  map[wordId] = boundaries.map((b) => Math.round(b * 1000) / 1000);
  localStorage.setItem(key(lessonId), JSON.stringify(map));
}

export function clearCalibration(lessonId: number, wordId: number): void {
  const map = loadCalibration(lessonId);
  delete map[wordId];
  localStorage.setItem(key(lessonId), JSON.stringify(map));
}

/**
 * Local snapshot of the cloud calibrations (see cloudCalibration.ts),
 * refreshed on every app start that has a connection, so the installed
 * PWA keeps the latest-known timings when offline.
 */
const cloudKey = (lessonId: number) => `iqra-cloud-cal-lesson${lessonId}`;

export function loadCloudSnapshot(lessonId: number): CalibrationMap {
  try {
    const raw = localStorage.getItem(cloudKey(lessonId));
    return raw ? (JSON.parse(raw) as CalibrationMap) : {};
  } catch {
    return {};
  }
}

export function storeCloudSnapshot(lessonId: number, map: CalibrationMap): void {
  localStorage.setItem(cloudKey(lessonId), JSON.stringify(map));
}
