import { afterEach, describe, expect, it } from 'vitest';
import {
  importWorkshopDraft,
  loadWorkshopDraft,
  saveWorkshopDraft,
  WORKSHOP_KEY,
} from './workshopDraft';
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
function store(entries: Record<string, string> = {}) {
  const data = new Map(Object.entries(entries));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  });
  return data;
}
describe('workshop draft durability', () => {
  it('keeps a renamed platformer with its controls and source across reload and backup', () => {
    store();
    const draft = {
      version: 1 as const,
      title: '私のゲーム 🌱',
      code: 'const message = "hello";\nfunction draw() {}',
      projectId: 'project-abc-123',
      controls: 'platformer' as const,
    };
    expect(saveWorkshopDraft(draft)).toBe(true);
    expect(loadWorkshopDraft()).toEqual(draft);
    expect(importWorkshopDraft(JSON.stringify(draft))).toEqual(draft);
  });
  it('migrates a legacy code-only draft without discarding it', () => {
    store({ 'codesprout-game-lab': 'let score = 42;' });
    expect(loadWorkshopDraft('fallback')).toMatchObject({
      code: 'let score = 42;',
      title: 'My little game',
      projectId: null,
    });
  });
  it('rejects invalid imports but recovers from corrupt or blocked local storage', () => {
    store({ [WORKSHOP_KEY]: 'invalid' });
    expect(loadWorkshopDraft('safe').code).toBe('safe');
    expect(() =>
      importWorkshopDraft(
        JSON.stringify({
          version: 1,
          title: 'bad',
          code: 'x',
          projectId: '../../escape',
          controls: 'network',
        })
      )
    ).toThrow();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    expect(loadWorkshopDraft('safe').code).toBe('safe');
    expect(saveWorkshopDraft({ version: 1, title: 'a', code: 'b', projectId: null })).toBe(false);
  });
});
