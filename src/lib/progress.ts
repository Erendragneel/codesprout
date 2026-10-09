export type Progress = {
  version: 1;
  completed: string[];
  xp: number;
  activity: Record<string, number>;
  drafts: Record<string, string>;
  lastLesson: string | null;
  settings: { sound: boolean; readAloud: boolean; reducedMotion: boolean };
  review: Record<string, { due: string; interval: number }>;
};

export const PROGRESS_STORAGE_KEY = 'codesprout.progress.v1';
const MAX_JSON_LENGTH = 1_000_000;
const MAX_DRAFT_LENGTH = 50_000;
const MAX_ITEMS = 2_000;
const DAY = 86_400_000;

export function defaultProgress(): Progress {
  return {
    version: 1,
    completed: [],
    xp: 0,
    activity: {},
    drafts: {},
    lastLesson: null,
    settings: { sound: true, readAloud: false, reducedMotion: false },
    review: {},
  };
}

/** A calendar date in the learner's local time zone. */
export function localDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function dayOrToday(day?: string): string {
  return isDate(day) ? day : localDate();
}

function safeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 120 &&
    value !== '__proto__' &&
    value !== 'constructor' &&
    value !== 'prototype'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function integer(value: unknown, max = 100_000_000): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

function decodeProgress(json: string, validIds?: readonly string[]): Progress {
  if (json.length > MAX_JSON_LENGTH)
    throw new Error('This backup is too large. Choose a CodeSprout progress backup.');
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    throw new Error('This file is not valid JSON. Choose a CodeSprout progress backup.');
  }
  if (
    !isRecord(input) ||
    input.version !== 1 ||
    !Array.isArray(input.completed) ||
    !integer(input.xp) ||
    !isRecord(input.activity) ||
    !isRecord(input.drafts) ||
    !isRecord(input.settings) ||
    !isRecord(input.review)
  ) {
    throw new Error('This file is not a supported CodeSprout progress backup.');
  }
  if (
    input.completed.length > MAX_ITEMS ||
    Object.keys(input.drafts).length > MAX_ITEMS ||
    Object.keys(input.activity).length > MAX_ITEMS ||
    Object.keys(input.review).length > MAX_ITEMS
  ) {
    throw new Error('This backup contains too many entries.');
  }
  if (!input.completed.every(safeId)) throw new Error('This backup has an invalid lesson list.');
  const allowed = validIds ? new Set(validIds) : null;
  const accepts = (id: string) => safeId(id) && (!allowed || allowed.has(id));
  const result = defaultProgress();
  result.completed = [...new Set(input.completed as string[])].filter(accepts);
  result.xp = input.xp;
  for (const [date, value] of Object.entries(input.activity)) {
    if (!isDate(date) || !integer(value, 10_000))
      throw new Error('This backup has invalid activity dates or counts.');
    result.activity[date] = value;
  }
  let totalDraftLength = 0;
  for (const [id, value] of Object.entries(input.drafts)) {
    if (!safeId(id) || typeof value !== 'string' || value.length > MAX_DRAFT_LENGTH) {
      throw new Error('This backup has an invalid or oversized code draft.');
    }
    totalDraftLength += value.length;
    if (totalDraftLength > 500_000) throw new Error('This backup contains too much draft code.');
    if (accepts(id)) result.drafts[id] = value;
  }
  for (const key of ['sound', 'readAloud', 'reducedMotion'] as const) {
    if (typeof input.settings[key] !== 'boolean')
      throw new Error('This backup has invalid settings.');
    result.settings[key] = input.settings[key];
  }
  if (input.lastLesson !== null && !safeId(input.lastLesson))
    throw new Error('This backup has an invalid last lesson.');
  result.lastLesson =
    typeof input.lastLesson === 'string' && accepts(input.lastLesson) ? input.lastLesson : null;
  for (const [id, value] of Object.entries(input.review)) {
    if (
      !safeId(id) ||
      !isRecord(value) ||
      !isDate(value.due) ||
      !integer(value.interval, 365) ||
      value.interval < 1
    ) {
      throw new Error('This backup has an invalid review schedule.');
    }
    if (accepts(id) && result.completed.includes(id))
      result.review[id] = { due: value.due, interval: value.interval };
  }
  return result;
}

export function loadProgress(): Progress {
  try {
    const json = globalThis.localStorage?.getItem(PROGRESS_STORAGE_KEY);
    return json ? decodeProgress(json) : defaultProgress();
  } catch {
    return defaultProgress();
  }
}

/** Returns false when storage is unavailable or full; learning can still continue. */
export function saveProgress(progress: Progress): boolean {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function completeLesson(progress: Progress, id: string, today?: string): Progress {
  if (!safeId(id) || progress.completed.includes(id)) return progress;
  const date = dayOrToday(today);
  return {
    ...progress,
    completed: [...progress.completed, id],
    xp: progress.xp + 30,
    activity: { ...progress.activity, [date]: (progress.activity[date] ?? 0) + 1 },
    lastLesson: id,
    review: { ...progress.review, [id]: { due: shiftDate(date, 1), interval: 1 } },
  };
}

/** Due reviews earn 10 XP once, then move further into the future. */
export function recordReview(progress: Progress, id: string, today?: string): Progress {
  const date = dayOrToday(today);
  const previous = progress.review[id];
  if (!safeId(id) || !progress.completed.includes(id) || !previous || previous.due > date)
    return progress;
  const interval =
    previous.interval < 3
      ? 3
      : previous.interval < 7
        ? 7
        : previous.interval < 14
          ? 14
          : previous.interval < 30
            ? 30
            : 60;
  return {
    ...progress,
    xp: progress.xp + 10,
    activity: { ...progress.activity, [date]: (progress.activity[date] ?? 0) + 1 },
    review: { ...progress.review, [id]: { due: shiftDate(date, interval), interval } },
  };
}

export function exportProgress(progress: Progress): string {
  return JSON.stringify(progress, null, 2);
}

/** Unknown lesson IDs are discarded so backups survive curriculum changes. */
export function importProgress(json: string, validIds: string[]): Progress {
  return decodeProgress(json, validIds);
}

/** An active streak survives until the end of today when yesterday was active. */
export function getStreak(progress: Progress, today?: string): number {
  let date = dayOrToday(today);
  if (!(progress.activity[date] > 0)) date = shiftDate(date, -1);
  let count = 0;
  while (progress.activity[date] > 0 && count < MAX_ITEMS) {
    count += 1;
    date = shiftDate(date, -1);
  }
  return count;
}

export function getLevel(xp: number): { level: number; current: number; needed: number } {
  const total = Number.isFinite(xp) ? Math.min(100_000_000, Math.max(0, Math.floor(xp))) : 0;
  const level = Math.floor((1 + Math.sqrt(1 + (8 * total) / 100)) / 2);
  const current = total - (100 * (level - 1) * level) / 2;
  return { level, current, needed: level * 100 };
}
