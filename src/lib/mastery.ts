import { localDate } from './progress';

export type MasteryState = {
  version: 1;
  guided: Record<string, { assisted: boolean; completedAt: string }>;
  independent: Record<string, { completedAt: string; attempts: number }>;
  projects: Record<string, { title: string; code: string; updatedAt: string }>;
  review: Record<string, { due: string; interval: number }>;
};

export type ReviewEvidence = { passed: boolean; assisted: boolean; solutionViewed: boolean };
export const MASTERY_STORAGE_KEY = 'codesprout.game-mastery.v1';
const MAX_JSON_LENGTH = 1_000_000;
const MAX_CODE_LENGTH = 50_000;
const MAX_TOTAL_CODE_LENGTH = 500_000;
const MAX_ITEMS = 2_000;
const DAY = 86_400_000;

export function defaultMastery(): MasteryState {
  return { version: 1, guided: {}, independent: {}, projects: {}, review: {} };
}

function safeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value) &&
    value !== '__proto__' &&
    value !== 'constructor' &&
    value !== 'prototype'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dayOrToday(today?: string): string {
  return isDate(today) ? today : localDate();
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function integer(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= max;
}

function decodeMastery(
  json: string,
  validLessonIds?: readonly string[],
  validProjectIds?: readonly string[]
): MasteryState {
  if (json.length > MAX_JSON_LENGTH) throw new Error('This game backup is too large.');
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    throw new Error('This file is not valid JSON. Choose a CodeSprout game backup.');
  }
  if (
    !isRecord(input) ||
    input.version !== 1 ||
    !isRecord(input.guided) ||
    !isRecord(input.independent) ||
    !isRecord(input.projects) ||
    !isRecord(input.review)
  ) {
    throw new Error('This file is not a supported CodeSprout game backup.');
  }
  if (
    [input.guided, input.independent, input.projects, input.review].some(
      (map) => Object.keys(map).length > MAX_ITEMS
    )
  ) {
    throw new Error('This game backup contains too many entries.');
  }
  const lessons = validLessonIds ? new Set(validLessonIds) : null;
  const projects = validProjectIds ? new Set(validProjectIds) : null;
  const result = defaultMastery();
  for (const [id, value] of Object.entries(input.guided)) {
    if (
      !safeId(id) ||
      !isRecord(value) ||
      typeof value.assisted !== 'boolean' ||
      !isDate(value.completedAt)
    ) {
      throw new Error('This game backup has an invalid guided completion.');
    }
    if (!lessons || lessons.has(id))
      result.guided[id] = { assisted: value.assisted, completedAt: value.completedAt };
  }
  for (const [id, value] of Object.entries(input.independent)) {
    if (
      !safeId(id) ||
      !isRecord(value) ||
      !isDate(value.completedAt) ||
      !integer(value.attempts, 100_000)
    ) {
      throw new Error('This game backup has an invalid independent completion.');
    }
    if (!lessons || lessons.has(id))
      result.independent[id] = { completedAt: value.completedAt, attempts: value.attempts };
  }
  let totalCodeLength = 0;
  for (const [id, value] of Object.entries(input.projects)) {
    if (
      !safeId(id) ||
      !isRecord(value) ||
      typeof value.title !== 'string' ||
      value.title.trim().length === 0 ||
      value.title.length > 120 ||
      typeof value.code !== 'string' ||
      value.code.length > MAX_CODE_LENGTH ||
      !isDate(value.updatedAt)
    ) {
      throw new Error('This game backup has an invalid or oversized project.');
    }
    totalCodeLength += value.code.length;
    if (totalCodeLength > MAX_TOTAL_CODE_LENGTH)
      throw new Error('This game backup contains too much project code.');
    if (!projects || projects.has(id))
      result.projects[id] = { title: value.title, code: value.code, updatedAt: value.updatedAt };
  }
  for (const [id, value] of Object.entries(input.review)) {
    if (!safeId(id) || !isRecord(value) || !isDate(value.due) || !integer(value.interval, 365)) {
      throw new Error('This game backup has an invalid review schedule.');
    }
    if (result.independent[id]) result.review[id] = { due: value.due, interval: value.interval };
  }
  return result;
}

export function loadMastery(): MasteryState {
  try {
    const json = globalThis.localStorage?.getItem(MASTERY_STORAGE_KEY);
    return json ? decodeMastery(json) : defaultMastery();
  } catch {
    return defaultMastery();
  }
}

/** A blocked or full store does not stop the current learning session. */
export function saveMastery(state: MasteryState): boolean {
  try {
    if (!globalThis.localStorage) return false;
    const json = JSON.stringify(state);
    decodeMastery(json);
    globalThis.localStorage.setItem(MASTERY_STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

/** Guided completion records help separately from independent challenge results. */
export function recordGuided(
  state: MasteryState,
  id: string,
  assisted = false,
  today?: string
): MasteryState {
  if (!safeId(id) || typeof assisted !== 'boolean') return state;
  const previous = state.guided[id];
  if (previous && (previous.assisted || !assisted)) return state;
  return {
    ...state,
    guided: {
      ...state.guided,
      [id]: {
        assisted: assisted || !!previous?.assisted,
        completedAt: previous?.completedAt ?? dayOrToday(today),
      },
    },
  };
}

/** Call only after the learner passes a fresh challenge without a hint or worked solution. */
export function recordIndependent(
  state: MasteryState,
  id: string,
  attempts = 1,
  today?: string
): MasteryState {
  if (!safeId(id) || !integer(attempts, 100_000) || state.independent[id]) return state;
  const date = dayOrToday(today);
  return {
    ...state,
    independent: { ...state.independent, [id]: { completedAt: date, attempts } },
    review: { ...state.review, [id]: { due: shiftDate(date, 1), interval: 1 } },
  };
}

/** Saving a draft preserves source only; importing or saving code never runs it. */
export function saveProject(
  state: MasteryState,
  id: string,
  title: string,
  code: string,
  today?: string
): MasteryState {
  if (
    !safeId(id) ||
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 120 ||
    typeof code !== 'string' ||
    code.length > MAX_CODE_LENGTH
  )
    return state;
  if (!state.projects[id] && Object.keys(state.projects).length >= MAX_ITEMS) return state;
  const totalLength = Object.entries(state.projects).reduce(
    (total, [projectId, project]) => total + (projectId === id ? 0 : project.code.length),
    code.length
  );
  if (totalLength > MAX_TOTAL_CODE_LENGTH) return state;
  return {
    ...state,
    projects: {
      ...state.projects,
      [id]: { title: title.trim(), code, updatedAt: dayOrToday(today) },
    },
  };
}

export function dueGameReviews(state: MasteryState, today?: string): string[] {
  const date = dayOrToday(today);
  return Object.entries(state.review)
    .filter(([id, review]) => !!state.independent[id] && review.due <= date)
    .sort(
      ([idA, reviewA], [idB, reviewB]) =>
        reviewA.due.localeCompare(reviewB.due) || idA.localeCompare(idB)
    )
    .map(([id]) => id);
}

/** Opening an exercise, reading an answer, or a failed run cannot count as independent review. */
export function recordGameReview(
  state: MasteryState,
  id: string,
  evidence: ReviewEvidence,
  today?: string
): MasteryState {
  const date = dayOrToday(today);
  const previous = state.review[id];
  if (
    !safeId(id) ||
    !state.independent[id] ||
    !previous ||
    previous.due > date ||
    evidence?.passed !== true ||
    evidence.assisted !== false ||
    evidence.solutionViewed !== false
  )
    return state;
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
    ...state,
    review: { ...state.review, [id]: { due: shiftDate(date, interval), interval } },
  };
}

export function getIndependenceSummary(
  state: MasteryState,
  lessonIds?: readonly string[]
): { guided: number; independent: number; assisted: number; pending: number; percent: number } {
  const ids = new Set(
    lessonIds ?? [...Object.keys(state.guided), ...Object.keys(state.independent)]
  );
  let guided = 0;
  let independent = 0;
  let assisted = 0;
  let pending = 0;
  for (const id of ids) {
    if (state.guided[id]) {
      guided += 1;
      if (state.guided[id].assisted) assisted += 1;
      if (!state.independent[id]) pending += 1;
    }
    if (state.independent[id]) independent += 1;
  }
  return {
    guided,
    independent,
    assisted,
    pending,
    percent: ids.size ? Math.round((independent / ids.size) * 100) : 0,
  };
}

export function exportMastery(state: MasteryState): string {
  const json = JSON.stringify(state, null, 2);
  decodeMastery(json);
  return json;
}

/** Removed lesson and project IDs may be filtered without discarding the rest of a backup. */
export function importMastery(
  json: string,
  validLessonIds?: readonly string[],
  validProjectIds?: readonly string[]
): MasteryState {
  return decodeMastery(json, validLessonIds, validProjectIds);
}
