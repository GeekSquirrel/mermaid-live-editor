import type { HistoryEntry, HistoryType, Optional, State } from '$lib/types';
import { api } from '$lib/services/api';
import { persisted, readJSON, writeJSON } from '$lib/util/persist.svelte';
import { inputState } from '$lib/util/state.svelte';
import { logEvent } from '$lib/util/stats';
import { generateSlug } from 'random-word-slugs';
import { v4 as uuidV4 } from 'uuid';

import { projectState } from '$lib/util/projectState.svelte';

const MAX_AUTO_HISTORY_LENGTH = 30;
const AUTO_SAVE_INTERVAL = 60_000;

let currentProjectId = $state<string | null>(null);

const getAutoKey = (projectId: string | null): string =>
  projectId ? `autoHistoryStore:${projectId}` : 'autoHistoryStore';

const getManualKey = (projectId: string | null): string =>
  projectId ? `manualHistoryStore:${projectId}` : 'manualHistoryStore';

let autoEntries = $state<HistoryEntry[]>(readJSON<HistoryEntry[]>(getAutoKey(null), []));
let manual = $state<HistoryEntry[]>(readJSON<HistoryEntry[]>(getManualKey(null), []));
const mode = persisted<HistoryType>('autoHistoryMode', 'manual');
let loader = $state<HistoryEntry[]>([]);

// Loader entries are in-memory, so a persisted 'loader' mode is empty after reload.
if (mode.value === 'loader') {
  mode.value = 'manual';
}

export const historyState = {
  get bookmarkCount(): number {
    return manual.length;
  },
  get entries(): HistoryEntry[] {
    switch (mode.value) {
      case 'auto':
        return autoEntries;
      case 'manual':
        return manual;
      default:
        return loader;
    }
  },
  get loaderEntries(): HistoryEntry[] {
    return loader;
  },
  get mode(): HistoryType {
    return mode.value;
  },
  get projectId(): string | null {
    return currentProjectId;
  }
};

export const setMode = (next: HistoryType): void => {
  mode.value = next;
};

export const setCurrentProjectId = (id: string | null): void => {
  if (currentProjectId === id) {
    return;
  }
  currentProjectId = id;
  autoEntries = readJSON<HistoryEntry[]>(getAutoKey(id), []);
  manual = readJSON<HistoryEntry[]>(getManualKey(id), []);
  void loadSavedEntries(id);
};

// Dedup key: only the fields that define the diagram, so volatile/view-only
// fields (renderCount, pan/zoom, …) don't count as a change.
export const stateKey = (state: State): string =>
  JSON.stringify({ code: state.code, mermaid: state.mermaid });

const createEntry = (
  state: State,
  type: 'auto' | 'manual',
  customName?: string,
  projectId: string | null = currentProjectId
): HistoryEntry => ({
  id: uuidV4(),
  name: (customName && customName.trim()) || generateSlug(2),
  project_id: projectId,
  state,
  time: Date.now(),
  type
});

export const loadSavedEntries = async (
  projectId: string | null = currentProjectId
): Promise<HistoryEntry[]> => {
  try {
    const entries = await api.getHistoryEntries('manual', projectId);
    if (Array.isArray(entries)) {
      if (currentProjectId === projectId) {
        manual = entries;
      }
      writeJSON(getManualKey(projectId), entries);
      return entries;
    }
  } catch (err) {
    console.error('Failed to load saved history entries from backend:', err);
  }
  return manual;
};

// Returns true if added, false if it duplicated the most recent entry.
export const addManualEntry = (
  state: State,
  customName?: string,
  projectId: string | null = currentProjectId
): boolean => {
  if (manual.length > 0 && stateKey(manual[0].state) === stateKey(state)) {
    return false;
  }
  const entry = createEntry(state, 'manual', customName, projectId);
  if (currentProjectId === projectId) {
    manual = [entry, ...manual];
  }
  writeJSON(getManualKey(projectId), manual);
  logEvent('history', { action: 'save', type: 'manual' });

  void api
    .createHistoryEntry({
      id: entry.id,
      name: entry.name || 'Untitled',
      projectId,
      state: entry.state,
      time: entry.time,
      type: 'manual'
    })
    .then(() => {
      projectState.showBookmarked();
    })
    .catch((err) => {
      console.error('Failed to sync history entry to backend:', err);
      projectState.showBookmarkError();
    });

  return true;
};

export const addAutoEntry = (
  state: State,
  projectId: string | null = currentProjectId
): boolean => {
  const currentEntries =
    projectId === currentProjectId
      ? autoEntries
      : readJSON<HistoryEntry[]>(getAutoKey(projectId), []);

  if (currentEntries.length > 0 && stateKey(currentEntries[0].state) === stateKey(state)) {
    return false;
  }
  const trimmed =
    currentEntries.length >= MAX_AUTO_HISTORY_LENGTH
      ? currentEntries.slice(0, MAX_AUTO_HISTORY_LENGTH - 1)
      : currentEntries;
  const updated = [createEntry(state, 'auto', undefined, projectId), ...trimmed];
  if (projectId === currentProjectId) {
    autoEntries = updated;
  }
  writeJSON(getAutoKey(projectId), updated);
  logEvent('history', { action: 'save', type: 'auto' });
  return true;
};

// Replaces the in-memory revisions (e.g. when a gist is loaded), assigning ids.
export const setLoaderEntries = (entries: Optional<HistoryEntry, 'id'>[]): void => {
  loader = entries.map((entry) =>
    entry.id ? (entry as HistoryEntry) : { ...entry, id: uuidV4() }
  );
};

export const removeEntry = (id: string): void => {
  if (mode.value === 'manual') {
    manual = manual.filter((entry) => entry.id !== id);
    writeJSON(getManualKey(currentProjectId), manual);
    logEvent('history', { action: 'clear', type: 'single' });
    void api.deleteHistoryEntry(id).catch((err) => {
      console.error('Failed to delete history entry from backend:', err);
    });
    return;
  }
  if (mode.value === 'auto') {
    autoEntries = autoEntries.filter((entry) => entry.id !== id);
    writeJSON(getAutoKey(currentProjectId), autoEntries);
    logEvent('history', { action: 'clear', type: 'single' });
  }
};

export const renameEntry = (id: string, name: string): void => {
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }
  if (mode.value === 'manual') {
    manual = manual.map((entry) => (entry.id === id ? { ...entry, name: trimmed } : entry));
    writeJSON(getManualKey(currentProjectId), manual);
    logEvent('history', { action: 'rename' });
    void api.updateHistoryEntry(id, { name: trimmed }).catch((err) => {
      console.error('Failed to update history entry in backend:', err);
    });
    return;
  }
  if (mode.value === 'auto') {
    autoEntries = autoEntries.map((entry) =>
      entry.id === id ? { ...entry, name: trimmed } : entry
    );
    writeJSON(getAutoKey(currentProjectId), autoEntries);
    logEvent('history', { action: 'rename' });
  }
};

export const clearActive = (): void => {
  if (mode.value === 'manual') {
    manual = [];
    writeJSON(getManualKey(currentProjectId), []);
    logEvent('history', { action: 'clear', type: 'all' });
    void api.clearHistoryEntries('manual', currentProjectId).catch((err) => {
      console.error('Failed to clear history in backend:', err);
    });
    return;
  }
  if (mode.value === 'auto') {
    autoEntries = [];
    writeJSON(getAutoKey(currentProjectId), []);
    logEvent('history', { action: 'clear', type: 'all' });
  }
};

const validateEntry = (entry: HistoryEntry): boolean =>
  Boolean(entry && entry.type && entry.state) && typeof entry.time === 'number';

export interface RestoreResult {
  restored: number;
  invalid: number;
  duplicates: number;
}

// Routes each uploaded entry to the store matching its own type, skipping ids
// that already exist.
export const restoreEntries = (data: HistoryEntry[]): RestoreResult => {
  const valid = data.filter((entry) => validateEntry(entry));
  const invalid = data.length - valid.length;
  let restored = 0;

  // 1. Auto entries (localStorage for current project)
  const incomingAuto = valid.filter((entry) => entry.type === 'auto');
  if (incomingAuto.length > 0) {
    const existingAutoIDs = autoEntries.map(({ id }) => id);
    const freshAuto = incomingAuto.filter(({ id }) => !existingAutoIDs.includes(id));
    restored += freshAuto.length;
    autoEntries = [...autoEntries, ...freshAuto].sort((a, b) => b.time - a.time);
    writeJSON(getAutoKey(currentProjectId), autoEntries);
  }

  // 2. Manual entries (SQLite sync for current project)
  const incomingManual = valid.filter((entry) => entry.type === 'manual');
  if (incomingManual.length > 0) {
    const existingManualIDs = manual.map(({ id }) => id);
    const freshManual = incomingManual.filter(({ id }) => !existingManualIDs.includes(id));
    restored += freshManual.length;
    manual = [...manual, ...freshManual].sort((a, b) => b.time - a.time);
    writeJSON(getManualKey(currentProjectId), manual);
    for (const entry of freshManual) {
      void api
        .createHistoryEntry({
          id: entry.id,
          name: entry.name || 'Untitled',
          projectId: currentProjectId,
          state: entry.state,
          time: entry.time,
          type: 'manual'
        })
        .catch(console.error);
    }
  }

  const duplicates = valid.length - restored;
  logEvent('history', { action: 'restore', duplicates, invalid, success: restored });
  return { restored, invalid, duplicates };
};

const setIDs = (entries: HistoryEntry[]): HistoryEntry[] =>
  entries.map((entry) => (entry.id ? entry : { ...entry, id: uuidV4() }));

// One-time migration: re-reads localStorage so entries written by an older
// version get ids, then persists and updates the reactive state.
export const injectHistoryIDs = (): void => {
  autoEntries = setIDs(readJSON<HistoryEntry[]>(getAutoKey(currentProjectId), []));
  writeJSON(getAutoKey(currentProjectId), autoEntries);
  manual = setIDs(readJSON<HistoryEntry[]>(getManualKey(currentProjectId), []));
  writeJSON(getManualKey(currentProjectId), manual);
};

let autoSaveTimer: ReturnType<typeof setInterval> | undefined;

// Idempotent; returns the stop function for use as a lifecycle cleanup.
export const startAutoSave = (): (() => void) => {
  if (autoSaveTimer === undefined) {
    autoSaveTimer = setInterval(() => {
      const added = addAutoEntry($state.snapshot(inputState));
      if (added || projectState.hasChanges) {
        void projectState.save();
      }
    }, AUTO_SAVE_INTERVAL);
  }
  return stopAutoSave;
};

export const stopAutoSave = (): void => {
  if (autoSaveTimer !== undefined) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = undefined;
  }
};
