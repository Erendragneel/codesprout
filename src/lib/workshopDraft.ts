export type WorkshopDraft = {
  version: 1;
  title: string;
  code: string;
  projectId: string | null;
  controls?: 'pointer' | 'arrows' | 'platformer';
};
export const WORKSHOP_KEY = 'codesprout.workshop.v1';
export function importWorkshopDraft(json: string): WorkshopDraft {
  if (json.length > 200_000) throw new Error('This workshop draft is too large.');
  const value = JSON.parse(json);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.version !== 1 ||
    typeof value.code !== 'string' ||
    value.code.length > 50_000 ||
    typeof value.title !== 'string' ||
    value.title.length > 120 ||
    !(
      value.projectId === null ||
      (typeof value.projectId === 'string' && /^project-[a-z0-9-]{1,100}$/i.test(value.projectId))
    ) ||
    (value.controls !== undefined && !['pointer', 'arrows', 'platformer'].includes(value.controls))
  )
    throw new Error('This backup contains an invalid workshop draft.');
  return {
    version: 1,
    title: value.title,
    code: value.code,
    projectId: value.projectId,
    ...(value.controls ? { controls: value.controls } : {}),
  };
}
export function loadWorkshopDraft(fallbackCode = ''): WorkshopDraft {
  const fallback: WorkshopDraft = {
    version: 1,
    title: 'My little game',
    code: fallbackCode,
    projectId: null,
  };
  try {
    const saved = localStorage.getItem(WORKSHOP_KEY);
    if (saved) return importWorkshopDraft(saved);
    const legacy = localStorage.getItem('codesprout-game-lab');
    if (legacy !== null && legacy.length <= 50_000) return { ...fallback, code: legacy };
  } catch {
    /* A blocked or corrupt store must not prevent learning. */
  }
  return fallback;
}
export function saveWorkshopDraft(draft: WorkshopDraft): boolean {
  try {
    const json = JSON.stringify(draft);
    importWorkshopDraft(json);
    localStorage.setItem(WORKSHOP_KEY, json);
    return true;
  } catch {
    return false;
  }
}
