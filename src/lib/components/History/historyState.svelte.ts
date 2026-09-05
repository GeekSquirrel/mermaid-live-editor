import { api } from '$lib/services/api';
import type { HistoryEntry, HistoryType, Optional, State } from '$lib/types';
import { persisted, readJSON, writeJSON } from '$lib/util/persist.svelte';
import { inputState } from '$lib/util/state.svelte';
import { logEvent } from '$lib/util/stats';
import { generateSlug } from 'random-word-slugs';
import { v4 as uuidV4 } from 'uuid';

import { diagramState } from '$lib/util/diagramState.svelte';

const MAX_AUTO_HISTORY_LENGTH = 30;
const AUTO_SAVE_INTERVAL = 60_000;

let currentDiagramId = $state<string | null>(null);

const getAutoKey = (diagramId: string | null): string =>
  diagramId ? `autoHistoryStore:${diagramId}` : 'autoHistoryStore';

const getManualKey = (diagramId: string | null): string =>
  diagramId ? `manualHistoryStore:${diagramId}` : 'manualHistoryStore';

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
  get diagramId(): string | null {
    return currentDiagramId;
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
  }
};

export const setMode = (next: HistoryType): void => {
  mode.value = next;
};

export const setCurrentDiagramId = (id: string | null): void => {
  if (currentDiagramId === id) {
    return;
  }
  currentDiagramId = id;
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
  diagramId: string | null = currentDiagramId
): HistoryEntry => ({
  diagram_id: diagramId,
  id: uuidV4(),
  name: (customName && customName.trim()) || generateSlug(2),
  state,
  time: Date.now(),
  type
});
export const loadSavedEntries = async (
  diagramId: string | null = currentDiagramId
): Promise<HistoryEntry[]> => {
  try {
    const entries = await api.getHistoryEntries('manual', diagramId);
    if (Array.isArray(entries)) {
      if (currentDiagramId === diagramId) {
        manual = entries;
      }
      writeJSON(getManualKey(diagramId), entries);
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
  diagramId: string | null = currentDiagramId
): boolean => {
  if (manual.length > 0 && stateKey(manual[0].state) === stateKey(state)) {
    diagramState.showBookmarkDuplicate();
    return false;
  }
  const entry = createEntry(state, 'manual', customName, diagramId);
  if (currentDiagramId === diagramId) {
    manual = [entry, ...manual];
  }
  writeJSON(getManualKey(diagramId), manual);
  logEvent('history', { action: 'save', type: 'manual' });

  void api
    .createHistoryEntry({
      diagramId,
      id: entry.id,
      name: entry.name || 'Untitled',
      state: entry.state,
      time: entry.time,
      type: 'manual'
    })
    .then(() => {
      diagramState.showBookmarked();
    })
    .catch((err) => {
      console.error('Failed to sync history entry to backend:', err);
      diagramState.showBookmarkError();
    });

  return true;
};

export const addAutoEntry = (
  state: State,
  diagramId: string | null = currentDiagramId
): boolean => {
  const currentEntries =
    diagramId === currentDiagramId
      ? autoEntries
      : readJSON<HistoryEntry[]>(getAutoKey(diagramId), []);

  if (currentEntries.length > 0 && stateKey(currentEntries[0].state) === stateKey(state)) {
    return false;
  }
  const trimmed =
    currentEntries.length >= MAX_AUTO_HISTORY_LENGTH
      ? currentEntries.slice(0, MAX_AUTO_HISTORY_LENGTH - 1)
      : currentEntries;
  const updated = [createEntry(state, 'auto', undefined, diagramId), ...trimmed];
  if (diagramId === currentDiagramId) {
    autoEntries = updated;
  }
  writeJSON(getAutoKey(diagramId), updated);
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
    writeJSON(getManualKey(currentDiagramId), manual);
    logEvent('history', { action: 'clear', type: 'single' });
    void api.deleteHistoryEntry(id).catch((err) => {
      console.error('Failed to delete history entry from backend:', err);
    });
    return;
  }
  if (mode.value === 'auto') {
    autoEntries = autoEntries.filter((entry) => entry.id !== id);
    writeJSON(getAutoKey(currentDiagramId), autoEntries);
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
    writeJSON(getManualKey(currentDiagramId), manual);
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
    writeJSON(getAutoKey(currentDiagramId), autoEntries);
    logEvent('history', { action: 'rename' });
  }
};

export const clearActive = (): void => {
  if (mode.value === 'manual') {
    manual = [];
    writeJSON(getManualKey(currentDiagramId), []);
    logEvent('history', { action: 'clear', type: 'all' });
    void api.clearHistoryEntries('manual', currentDiagramId).catch((err) => {
      console.error('Failed to clear history in backend:', err);
    });
    return;
  }
  if (mode.value === 'auto') {
    autoEntries = [];
    writeJSON(getAutoKey(currentDiagramId), []);
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

  // 1. Auto entries (localStorage for current diagram)
  const incomingAuto = valid.filter((entry) => entry.type === 'auto');
  if (incomingAuto.length > 0) {
    const existingAutoIDs = autoEntries.map(({ id }) => id);
    const freshAuto = incomingAuto.filter(({ id }) => !existingAutoIDs.includes(id));
    restored += freshAuto.length;
    autoEntries = [...autoEntries, ...freshAuto].sort((a, b) => b.time - a.time);
    writeJSON(getAutoKey(currentDiagramId), autoEntries);
  }

  // 2. Manual entries (SQLite sync for current diagram)
  const incomingManual = valid.filter((entry) => entry.type === 'manual');
  if (incomingManual.length > 0) {
    const existingManualIDs = manual.map(({ id }) => id);
    const freshManual = incomingManual.filter(({ id }) => !existingManualIDs.includes(id));
    restored += freshManual.length;
    manual = [...manual, ...freshManual].sort((a, b) => b.time - a.time);
    writeJSON(getManualKey(currentDiagramId), manual);
    for (const entry of freshManual) {
      void api
        .createHistoryEntry({
          diagramId: currentDiagramId,
          id: entry.id,
          name: entry.name || 'Untitled',
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
  autoEntries = setIDs(readJSON<HistoryEntry[]>(getAutoKey(currentDiagramId), []));
  writeJSON(getAutoKey(currentDiagramId), autoEntries);
  manual = setIDs(readJSON<HistoryEntry[]>(getManualKey(currentDiagramId), []));
  writeJSON(getManualKey(currentDiagramId), manual);
};

let autoSaveTimer: ReturnType<typeof setInterval> | undefined;

// Idempotent; returns the stop function for use as a lifecycle cleanup.
export const startAutoSave = (): (() => void) => {
  if (autoSaveTimer === undefined) {
    autoSaveTimer = setInterval(() => {
      const added = addAutoEntry($state.snapshot(inputState));
      if (added || diagramState.hasChanges) {
        void diagramState.save();
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
