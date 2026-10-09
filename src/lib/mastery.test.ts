import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultMastery,
  dueGameReviews,
  exportMastery,
  getIndependenceSummary,
  importMastery,
  loadMastery,
  MASTERY_STORAGE_KEY,
  recordGameReview,
  recordGuided,
  recordIndependent,
  saveMastery,
  saveProject,
} from './mastery';

afterEach(() => vi.unstubAllGlobals());

describe('game learning evidence', () => {
  it('keeps assisted lesson completions separate from independently passed challenges', () => {
    const initial = defaultMastery();
    const guided = recordGuided(initial, 'clicker-1', true, '2026-10-09');
    expect(initial.guided).toEqual({});
    expect(guided.independent).toEqual({});
    expect(getIndependenceSummary(guided, ['clicker-1', 'clicker-2'])).toEqual({
      guided: 1,
      independent: 0,
      assisted: 1,
      pending: 1,
      percent: 0,
    });
    const independent = recordIndependent(guided, 'clicker-1', 3, '2026-10-10');
    expect(independent.independent['clicker-1']).toEqual({
      completedAt: '2026-10-10',
      attempts: 3,
    });
    expect(independent.review['clicker-1']).toEqual({ due: '2026-10-11', interval: 1 });
    expect(getIndependenceSummary(independent, ['clicker-1', 'clicker-2']).percent).toBe(50);
    expect(recordIndependent(independent, 'clicker-1', 1, '2026-10-12')).toBe(independent);
  });

  it('retains a record of assistance while permitting later independent evidence', () => {
    const first = recordGuided(defaultMastery(), 'pong', false, '2026-10-09');
    const assisted = recordGuided(first, 'pong', true, '2026-10-10');
    expect(assisted.guided.pong).toEqual({ assisted: true, completedAt: '2026-10-09' });
    expect(recordGuided(assisted, 'pong', false)).toBe(assisted);
  });

  it('advances spaced reviews only after a due, passing, unassisted challenge', () => {
    const mastered = recordIndependent(defaultMastery(), 'pong', 2, '2026-12-31');
    const passed = { passed: true, assisted: false, solutionViewed: false };
    expect(dueGameReviews(mastered, '2026-12-31')).toEqual([]);
    expect(dueGameReviews(mastered, '2027-01-01')).toEqual(['pong']);
    expect(recordGameReview(mastered, 'pong', passed, '2026-12-31')).toBe(mastered);
    expect(recordGameReview(mastered, 'pong', { ...passed, passed: false }, '2027-01-01')).toBe(
      mastered
    );
    expect(recordGameReview(mastered, 'pong', { ...passed, assisted: true }, '2027-01-01')).toBe(
      mastered
    );
    expect(
      recordGameReview(mastered, 'pong', { ...passed, solutionViewed: true }, '2027-01-01')
    ).toBe(mastered);
    const reviewed = recordGameReview(mastered, 'pong', passed, '2027-01-01');
    expect(reviewed.review.pong).toEqual({ due: '2027-01-04', interval: 3 });
    expect(recordGameReview(reviewed, 'pong', passed, '2027-01-01')).toBe(reviewed);
    expect(dueGameReviews(reviewed, '2027-01-01')).toEqual([]);
  });

  it('does not accidentally grant completions for unsafe IDs or invalid attempt counts', () => {
    const state = defaultMastery();
    expect(recordGuided(state, '__proto__')).toBe(state);
    expect(recordIndependent(state, 'constructor')).toBe(state);
    expect(recordIndependent(state, 'pong', 0)).toBe(state);
    expect(recordIndependent(state, 'pong', Number.NaN)).toBe(state);
  });
});

describe('game portfolio and backups', () => {
  it('round-trips code without running it and filters only removed curriculum entries', () => {
    const first = recordIndependent(
      recordGuided(defaultMastery(), 'pong', true, '2026-10-09'),
      'pong',
      2,
      '2026-10-09'
    );
    const state = saveProject(
      first,
      'my-pong',
      'My Pong',
      'throw new Error("never execute backup code"); // 🌱',
      '2026-10-09'
    );
    const withOld = saveProject(
      recordGuided(state, 'old-lesson', false, '2026-10-09'),
      'old-game',
      'Old game',
      'old source',
      '2026-10-09'
    );
    const restored = importMastery(exportMastery(withOld), ['pong'], ['my-pong']);
    expect(restored).toEqual(state);
    expect(first.projects).toEqual({});
  });

  it('rejects malformed JSON, hostile keys, invalid dates, and unsupported versions', () => {
    expect(() => importMastery('{broken')).toThrow('valid JSON');
    expect(() => importMastery(JSON.stringify({ ...defaultMastery(), version: 2 }))).toThrow(
      'supported'
    );
    expect(() =>
      importMastery(
        '{"version":1,"guided":{"__proto__":{"assisted":false,"completedAt":"2026-10-09"}},"independent":{},"projects":{},"review":{}}'
      )
    ).toThrow('guided');
    expect(() =>
      importMastery(
        JSON.stringify({
          ...defaultMastery(),
          independent: { pong: { completedAt: '2026-02-30', attempts: 1 } },
        })
      )
    ).toThrow('independent');
    expect(() =>
      importMastery(
        JSON.stringify({
          ...defaultMastery(),
          review: { pong: { due: '2026-10-10', interval: 0 } },
        })
      )
    ).toThrow('review');
    expect({}.hasOwnProperty('assisted')).toBe(false);
  });

  it('bounds individual projects, total code, and backup size', () => {
    const state = defaultMastery();
    expect(saveProject(state, 'pong', 'Pong', 'x'.repeat(50_001))).toBe(state);
    expect(saveProject(state, 'pong', '', 'source')).toBe(state);
    expect(saveProject(state, 'constructor', 'Pong', 'source')).toBe(state);
    const oversized = {
      ...state,
      projects: { pong: { title: 'Pong', code: 'x'.repeat(50_001), updatedAt: '2026-10-09' } },
    };
    expect(() => importMastery(JSON.stringify(oversized))).toThrow('oversized');
    let full = state;
    for (let i = 0; i < 10; i += 1)
      full = saveProject(full, `game-${i}`, 'Game', 'x'.repeat(50_000), '2026-10-09');
    expect(saveProject(full, 'overflow', 'Extra game', 'x')).toBe(full);
    expect(saveProject(full, 'game-0', 'Updated game', 'short')).not.toBe(full);
    expect(() => importMastery('x'.repeat(1_000_001))).toThrow('too large');
  });

  it('stores under a separate key and survives corrupt, blocked, or full storage', () => {
    const state = saveProject(defaultMastery(), 'pong', 'Pong', 'const score = 0;', '2026-10-09');
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => exportMastery(state), setItem });
    expect(loadMastery()).toEqual(state);
    expect(saveMastery(state)).toBe(true);
    expect(setItem).toHaveBeenCalledWith(MASTERY_STORAGE_KEY, JSON.stringify(state));
    vi.stubGlobal('localStorage', {
      getItem: () => '{bad',
      setItem: () => {
        throw new Error('Full');
      },
    });
    expect(loadMastery()).toEqual(defaultMastery());
    expect(saveMastery(state)).toBe(false);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Blocked');
      },
    });
    expect(loadMastery()).toEqual(defaultMastery());
  });
});
