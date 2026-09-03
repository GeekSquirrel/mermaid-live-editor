import { api } from '$lib/services/api';
import { inputState, updateCode } from '$lib/util/state.svelte';
import { debounce } from 'lodash-es';
import { SvelteURL, SvelteURLSearchParams } from 'svelte/reactivity';

export const AUTO_SAVE_DEBOUNCE_MS = 10_000;
export const SAVING_DISPLAY_DELAY_MS = 3_000;

export interface SaveOptions {
  silent?: boolean;
}

export class ProjectState {
  id = $state<string | null>(null);
  title = $state<string>('Untitled Project');
  saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  errorMessage = $state<string | null>(null);
  bookmarkStatus = $state<'idle' | 'bookmarked' | 'duplicate' | 'error'>('idle');
  bookmarkErrorMessage = $state<string | null>(null);

  private initialized = false;
  lastSavedCode = '';
  lastSavedTitle = '';
  debouncedSave: ReturnType<typeof debounce>;
  private savingTimer?: ReturnType<typeof setTimeout>;
  private bookmarkTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.debouncedSave = debounce(() => void this.save(), AUTO_SAVE_DEBOUNCE_MS);
  }

  get hasChanges(): boolean {
    return inputState.code !== this.lastSavedCode || this.title !== this.lastSavedTitle;
  }

  showBookmarked() {
    if (this.bookmarkTimer) {
      clearTimeout(this.bookmarkTimer);
    }
    this.bookmarkStatus = 'bookmarked';
    this.bookmarkErrorMessage = null;
    this.bookmarkTimer = setTimeout(() => {
      this.bookmarkStatus = 'idle';
      this.bookmarkTimer = undefined;
    }, 3_000);
  }

  showBookmarkDuplicate() {
    if (this.bookmarkTimer) {
      clearTimeout(this.bookmarkTimer);
    }
    this.bookmarkStatus = 'duplicate';
    this.bookmarkErrorMessage = null;
    this.bookmarkTimer = setTimeout(() => {
      this.bookmarkStatus = 'idle';
      this.bookmarkTimer = undefined;
    }, 3_000);
  }

  showBookmarkError(message = 'Failed to save bookmark') {
    if (this.bookmarkTimer) {
      clearTimeout(this.bookmarkTimer);
      this.bookmarkTimer = undefined;
    }
    this.bookmarkStatus = 'error';
    this.bookmarkErrorMessage = message;
  }

  async loadFromUrl() {
    if (typeof window === 'undefined') return;

    const searchParams = new SvelteURLSearchParams(window.location.search);
    const idParam = searchParams.get('projectId');

    if (!idParam) {
      this.id = null;
      this.title = 'Untitled Project';
      this.saveStatus = 'idle';
      this.initialized = true;

      // 新建项目时静默保存
      await this.save({ silent: true });
      return;
    }

    this.id = idParam;
    this.saveStatus = 'idle';

    try {
      const project = await api.getProject(idParam);
      this.title = project.title || 'Untitled Project';
      this.lastSavedTitle = this.title;
      this.lastSavedCode = project.code;
      updateCode(project.code, { updateDiagram: true });
      this.saveStatus = 'idle';
    } catch (err) {
      console.error('Failed to load project:', err);
      this.errorMessage = err instanceof Error ? err.message : 'Failed to load project';
      this.saveStatus = 'error';
    } finally {
      this.initialized = true;
    }
  }

  async rename(newTitle: string) {
    if (!this.initialized) return;
    const trimmed = newTitle.trim() || 'Untitled Project';
    this.title = trimmed;
    if (trimmed !== this.lastSavedTitle) {
      // 重命名时静默保存，不显示 saving/saved 标识
      await this.save({ silent: true });
    }
  }

  async save(options: SaveOptions = {}) {
    if (!this.initialized) return;

    this.debouncedSave.cancel();

    const currentCode = inputState.code;
    if (!currentCode) return;

    if (this.savingTimer) {
      clearTimeout(this.savingTimer);
      this.savingTimer = undefined;
    }

    const isSilent = Boolean(options.silent);

    if (!isSilent) {
      this.errorMessage = null;
      // 当保存过程小于3秒时，不显示 saving，直接在成功后显示 saved；超过3秒才显示 saving
      this.savingTimer = setTimeout(() => {
        this.saveStatus = 'saving';
      }, SAVING_DISPLAY_DELAY_MS);
    }

    try {
      const currentTitle = this.title.trim() || 'Untitled Project';
      if (this.id) {
        await api.updateProject(this.id, {
          title: currentTitle,
          code: currentCode
        });
        this.lastSavedCode = currentCode;
        this.lastSavedTitle = this.title;
      } else {
        const created = await api.createProject({
          title: currentTitle,
          code: currentCode
        });
        this.id = created.id;
        this.lastSavedCode = currentCode;
        this.lastSavedTitle = this.title;

        const newUrl = new SvelteURL(window.location.href);
        newUrl.searchParams.set('projectId', created.id);
        const currentState = typeof window !== 'undefined' ? (window.history.state ?? {}) : {};
        window.history.replaceState(currentState, '', newUrl.toString());
      }

      if (this.savingTimer) {
        clearTimeout(this.savingTimer);
        this.savingTimer = undefined;
      }

      if (!isSilent) {
        this.saveStatus = 'saved';
      }
    } catch (err) {
      console.error('Failed to save project:', err);
      if (this.savingTimer) {
        clearTimeout(this.savingTimer);
        this.savingTimer = undefined;
      }
      this.saveStatus = 'error';
      this.errorMessage = err instanceof Error ? err.message : 'Failed to save diagram';
    }
  }

  notifyChange() {
    if (!this.initialized) return;

    const currentCode = inputState.code;
    if (currentCode === this.lastSavedCode && this.title === this.lastSavedTitle) {
      return;
    }

    // When user edits (new unsaved changes), the prompt disappears
    this.saveStatus = 'idle';
    this.debouncedSave();
  }
}

export const projectState = new ProjectState();
