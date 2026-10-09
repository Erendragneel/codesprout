import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completeLesson,
  defaultProgress,
  exportProgress,
  getLevel,
  getStreak,
  importProgress,
  loadProgress,
  localDate,
  recordReview,
  saveProgress,
} from './progress';

afterEach(() => vi.unstubAllGlobals());

describe('lesson progress', () => {
  it('awards completion once without mutating the previous progress', () => {
    const initial = defaultProgress();
    const completed = completeLesson(initial, 'hello', '2026-12-31');
    expect(initial.completed).toEqual([]);
    expect(completed.xp).toBe(30);
    expect(completed.activity).toEqual({ '2026-12-31': 1 });
    expect(completed.review.hello).toEqual({ due: '2027-01-01', interval: 1 });
    expect(completeLesson(completed, 'hello', '2027-01-01')).toBe(completed);
  });

  it('spaces reviews out and cannot award the same due review twice', () => {
    const completed = completeLesson(defaultProgress(), 'hello', '2026-10-01');
    expect(recordReview(completed, 'hello', '2026-10-01')).toBe(completed);
    const reviewed = recordReview(completed, 'hello', '2026-10-02');
    expect(reviewed.review.hello).toEqual({ due: '2026-10-05', interval: 3 });
    expect(reviewed.xp).toBe(40);
    expect(recordReview(reviewed, 'hello', '2026-10-02')).toBe(reviewed);
    expect(recordReview(reviewed, 'missing', '2026-10-02')).toBe(reviewed);
  });

  it('counts consecutive calendar days across month and leap-year boundaries', () => {
    const progress = defaultProgress();
    progress.activity = { '2024-02-28': 1, '2024-02-29': 1, '2024-03-01': 2 };
    expect(getStreak(progress, '2024-03-01')).toBe(3);
    expect(getStreak(progress, '2024-03-02')).toBe(3);
    expect(getStreak(progress, '2024-03-03')).toBe(0);
  });

  it('computes level boundaries accurately', () => {
    expect(getLevel(99)).toEqual({ level: 1, current: 99, needed: 100 });
    expect(getLevel(100)).toEqual({ level: 2, current: 0, needed: 200 });
    expect(getLevel(330)).toEqual({ level: 3, current: 30, needed: 300 });
    expect(getLevel(-1)).toEqual({ level: 1, current: 0, needed: 100 });
    expect(getLevel(Number.NaN)).toEqual({ level: 1, current: 0, needed: 100 });
  });

  it('uses local calendar fields instead of converting to UTC', () => {
    const date = new Date(2026, 9, 9, 0, 15);
    expect(localDate(date)).toBe('2026-10-09');
  });
});

describe('backups and storage', () => {
  it('round-trips all useful progress while filtering removed lessons', () => {
    const progress = completeLesson(defaultProgress(), 'hello', '2026-10-09');
    progress.drafts = { hello: 'console.log("🌱");', removed: 'old code' };
    progress.completed.push('removed');
    progress.settings.sound = false;
    const restored = importProgress(exportProgress(progress), ['hello']);
    expect(restored.completed).toEqual(['hello']);
    expect(restored.drafts).toEqual({ hello: 'console.log("🌱");' });
    expect(restored.settings.sound).toBe(false);
    expect(restored.review.hello.due).toBe('2026-10-10');
  });

  it('rejects corrupted JSON, dangerous keys, invalid dates, and oversized code', () => {
    expect(() => importProgress('{bad', ['hello'])).toThrow('valid JSON');
    expect(() => importProgress(JSON.stringify({ ...defaultProgress(), version: 2 }), [])).toThrow(
      'supported'
    );
    expect(() =>
      importProgress(JSON.stringify({ ...defaultProgress(), completed: ['__proto__'] }), [])
    ).toThrow('lesson list');
    expect(() =>
      importProgress(JSON.stringify({ ...defaultProgress(), activity: { '2026-02-30': 1 } }), [])
    ).toThrow('activity');
    expect(() =>
      importProgress(
        JSON.stringify({ ...defaultProgress(), drafts: { hello: 'a'.repeat(50_001) } }),
        ['hello']
      )
    ).toThrow('oversized');
    expect(() => importProgress(JSON.stringify({ ...defaultProgress(), xp: -10 }), [])).toThrow(
      'supported'
    );
  });

  it('does not lose the session when local storage is blocked or full', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Blocked');
      },
      setItem: () => {
        throw new Error('Full');
      },
    });
    expect(loadProgress()).toEqual(defaultProgress());
    expect(saveProgress(defaultProgress())).toBe(false);
  });

  it('starts safely when a saved value is corrupted', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken', setItem: vi.fn() });
    expect(loadProgress()).toEqual(defaultProgress());
  });
});
