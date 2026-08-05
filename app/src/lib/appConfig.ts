/**
 * What the public sees, controlled at runtime rather than by a redeploy.
 *
 * A lesson is draft (admin only), published (public), or archived (pulled
 * back to admin only). Features under construction are likewise admin-only
 * until they're switched on for everyone.
 *
 * The config lives in one small Firestore document so the admin can publish
 * from the app itself. Everything is cached locally and falls back to the
 * defaults below, so a learner with no network still sees the right thing.
 */

import { getIdToken } from './adminAuth';
import { API_KEY, PROJECT_ID } from './firebaseConfig';

/**
 * draft     — built but never published; only the admin sees it
 * published — live for learners
 * archived  — was live, pulled back; behaves exactly like draft, and the
 *             separate word only records that it had been out before
 * deleted   — gone from every list, admin included
 */
export type LessonStatus = 'draft' | 'published' | 'archived' | 'deleted';
/** 'everyone' = live for learners, 'admin' = still being built. */
export type FeatureAudience = 'everyone' | 'admin';

export interface AppConfig {
  lessons: Record<string, LessonStatus>;
  features: Record<string, FeatureAudience>;
}

export const DEFAULT_CONFIG: AppConfig = {
  lessons: { 1: 'published', 2: 'published', 3: 'archived' },
  features: { laser: 'admin', notes: 'admin' },
};

const CACHE_KEY = 'iqra-app-config';
const DOC = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/config/app`;

export function cachedConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      lessons: { ...DEFAULT_CONFIG.lessons, ...parsed.lessons },
      features: { ...DEFAULT_CONFIG.features, ...parsed.features },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Firestore's REST shape is verbose; flatten it back to plain maps. */
function decode(fields: Record<string, any> | undefined): AppConfig {
  const readMap = (key: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const props = fields?.[key]?.mapValue?.fields ?? {};
    for (const [k, v] of Object.entries(props)) {
      const s = (v as { stringValue?: string }).stringValue;
      if (s) out[k] = s;
    }
    return out;
  };
  return {
    lessons: { ...DEFAULT_CONFIG.lessons, ...(readMap('lessons') as Record<string, LessonStatus>) },
    features: {
      ...DEFAULT_CONFIG.features,
      ...(readMap('features') as Record<string, FeatureAudience>),
    },
  };
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${DOC}?key=${API_KEY}`);
  if (res.status === 404) return DEFAULT_CONFIG; // nothing published yet
  if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
  const json = (await res.json()) as { fields?: Record<string, unknown> };
  const config = decode(json.fields as Record<string, any>);
  localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  return config;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new Error('not signed in');
  const mapOf = (obj: Record<string, string>) => ({
    mapValue: { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { stringValue: v }])) },
  });
  const res = await fetch(`${DOC}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: { lessons: mapOf(config.lessons), features: mapOf(config.features) } }),
  });
  if (!res.ok) throw new Error(`config save failed: ${res.status}`);
  localStorage.setItem(CACHE_KEY, JSON.stringify(config));
}

export const lessonStatus = (config: AppConfig, id: number): LessonStatus =>
  config.lessons[String(id)] ?? 'draft';

/** Can this visitor open this lesson at all? */
export const canSeeLesson = (config: AppConfig, id: number, admin: boolean): boolean => {
  const status = lessonStatus(config, id);
  if (status === 'deleted') return false; // gone for everyone, admin included
  return admin || status === 'published';
};

/** Is this feature switched on for this visitor? */
export const canUseFeature = (config: AppConfig, name: string, admin: boolean): boolean =>
  admin || (config.features[name] ?? 'admin') === 'everyone';
