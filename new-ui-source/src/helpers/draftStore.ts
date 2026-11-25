// Tiny registry so unsaved drafts survive a forced re-login (BUG-27). Pages register a getter for their
// dirty draft; api/client.ts calls saveDraftsToSession() on a 401 right before redirecting to login, and the
// page restores the draft when it loads again. Storage calls are wrapped: a blocked/full store never throws.

export interface DraftSnapshot {
  courseId: string;
  key: string;
  value: string;
}

type DraftGetter = () => DraftSnapshot | null;

const getters = new Set<DraftGetter>();
const PREFIX = "studio-draft:";

const storageKey = (courseId: string, key: string) => `${PREFIX}${courseId}:${key}`;

/** Registers a getter returning the current dirty draft (or null when clean). Returns an unregister function. */
export function registerDraft(getter: DraftGetter): () => void {
  getters.add(getter);
  return () => {
    getters.delete(getter);
  };
}

/** Persists every dirty registered draft to sessionStorage, keyed by course id. */
export function saveDraftsToSession(): void {
  for (const getter of Array.from(getters)) {
    try {
      const draft = getter();
      if (draft && draft.courseId && draft.value) sessionStorage.setItem(storageKey(draft.courseId, draft.key), draft.value);
    } catch {
      // storage unavailable - nothing more we can do
    }
  }
}

export function loadDraft(courseId: string, key: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(courseId, key));
  } catch {
    return null;
  }
}

export function clearDraft(courseId: string, key: string): void {
  try {
    sessionStorage.removeItem(storageKey(courseId, key));
  } catch {
    // ignore
  }
}
