import type { HistoryEntry, HistoryType, Optional, State } from '$lib/types';
import { api } from '$lib/services/api';
import { persisted, readJSON, writeJSON } from '$lib/util/persist.svelte';
import { inputState } from '$lib/util/state.svelte';
import { logEvent } from '$lib/util/stats';
import { generateSlug } from 'random-word-slugs';
import { v4 as uuidV4 } from 'uuid';

const MAX_AUTO_HISTORY_LENGTH = 30;
const AUTO_SAVE_INTERVAL = 60_000;

const auto = persisted<HistoryEntry[]>('autoHistoryStore', []);
let manual = $state<HistoryEntry[]>(readJSON<HistoryEntry[]>('manualHistoryStore', []));
const mode = persisted<HistoryType>('autoHistoryMode', 'manual');
let loader = $state<HistoryEntry[]>([]);

// Loader entries are in-memory, so a persisted 'loader' mode is empty after reload.
if (mode.value === 'loader') {
  mode.value = 'manual';
}

export const historyState = {
  get entries(): HistoryEntry[] {
    switch (mode.value) {
      case 'auto':
        return auto.value;
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

// Dedup key: only the fields that define the diagram, so volatile/view-only
// fields (renderCount, pan/zoom, …) don't count as a change.
export const stateKey = (state: State): string =>
  JSON.stringify({ code: state.code, mermaid: state.mermaid });

const createEntry = (state: State, type: 'auto' | 'manual', customName?: string): HistoryEntry => ({
  id: uuidV4(),
  name: (customName && customName.trim()) || generateSlug(2),
  state,
  time: Date.now(),
  type
});

export const loadSavedEntries = async (): Promise<HistoryEntry[]> => {
  try {
    const entries = await api.getHistoryEntries('manual');
    if (Array.isArray(entries)) {
      manual = entries;
      writeJSON('manualHistoryStore', entries);
      return entries;
    }
  } catch (err) {
    console.error('Failed to load saved history entries from backend:', err);
  }
  return manual;
};

// Returns true if added, false if it duplicated the most recent entry.
export const addManualEntry = (state: State, customName?: string): boolean => {
  if (manual.length > 0 && stateKey(manual[0].state) === stateKey(state)) {
    return false;
  }
  const entry = createEntry(state, 'manual', customName);
  manual = [entry, ...manual];
  writeJSON('manualHistoryStore', manual);
  logEvent('history', { action: 'save', type: 'manual' });

  void api
    .createHistoryEntry({
      id: entry.id,
      name: entry.name || 'Untitled',
      state: entry.state,
      time: entry.time,
      type: 'manual'
    })
    .catch((err) => {
      console.error('Failed to sync history entry to backend:', err);
    });

  return true;
};

export const addAutoEntry = (state: State): boolean => {
  const entries = auto.value;
  if (entries.length > 0 && stateKey(entries[0].state) === stateKey(state)) {
    return false;
  }
  const trimmed =
    entries.length >= MAX_AUTO_HISTORY_LENGTH
      ? entries.slice(0, MAX_AUTO_HISTORY_LENGTH - 1)
      : entries;
  auto.value = [createEntry(state, 'auto'), ...trimmed];
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
    writeJSON('manualHistoryStore', manual);
    logEvent('history', { action: 'clear', type: 'single' });
    void api.deleteHistoryEntry(id).catch((err) => {
      console.error('Failed to delete history entry from backend:', err);
    });
    return;
  }
  if (mode.value === 'auto') {
    auto.value = auto.value.filter((entry) => entry.id !== id);
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
    writeJSON('manualHistoryStore', manual);
    logEvent('history', { action: 'rename' });
    void api.updateHistoryEntry(id, { name: trimmed }).catch((err) => {
      console.error('Failed to update history entry in backend:', err);
    });
    return;
  }
  if (mode.value === 'auto') {
    auto.value = auto.value.map((entry) => (entry.id === id ? { ...entry, name: trimmed } : entry));
    logEvent('history', { action: 'rename' });
  }
};

export const clearActive = (): void => {
  if (mode.value === 'manual') {
    manual = [];
    writeJSON('manualHistoryStore', []);
    logEvent('history', { action: 'clear', type: 'all' });
    void api.clearHistoryEntries('manual').catch((err) => {
      console.error('Failed to clear history in backend:', err);
    });
    return;
  }
  if (mode.value === 'auto') {
    auto.value = [];
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

  // 1. Auto entries (localStorage)
  const incomingAuto = valid.filter((entry) => entry.type === 'auto');
  if (incomingAuto.length > 0) {
    const existingAutoIDs = auto.value.map(({ id }) => id);
    const freshAuto = incomingAuto.filter(({ id }) => !existingAutoIDs.includes(id));
    restored += freshAuto.length;
    auto.value = [...auto.value, ...freshAuto].sort((a, b) => b.time - a.time);
  }

  // 2. Manual entries (SQLite sync)
  const incomingManual = valid.filter((entry) => entry.type === 'manual');
  if (incomingManual.length > 0) {
    const existingManualIDs = manual.map(({ id }) => id);
    const freshManual = incomingManual.filter(({ id }) => !existingManualIDs.includes(id));
    restored += freshManual.length;
    manual = [...manual, ...freshManual].sort((a, b) => b.time - a.time);
    writeJSON('manualHistoryStore', manual);
    for (const entry of freshManual) {
      void api
        .createHistoryEntry({
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
  auto.value = setIDs(readJSON<HistoryEntry[]>('autoHistoryStore', []));
  manual = setIDs(readJSON<HistoryEntry[]>('manualHistoryStore', []));
  writeJSON('manualHistoryStore', manual);
};

let autoSaveTimer: ReturnType<typeof setInterval> | undefined;

// Idempotent; returns the stop function for use as a lifecycle cleanup.
export const startAutoSave = (): (() => void) => {
  if (autoSaveTimer === undefined) {
    autoSaveTimer = setInterval(
      () => addAutoEntry($state.snapshot(inputState)),
      AUTO_SAVE_INTERVAL
    );
  }
  return stopAutoSave;
};

export const stopAutoSave = (): void => {
  if (autoSaveTimer !== undefined) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = undefined;
  }
};
