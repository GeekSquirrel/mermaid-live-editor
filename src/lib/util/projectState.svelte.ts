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
  workspaceId = $state<string | null>(null);
  title = $state<string>('Untitled Project');
  saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  errorMessage = $state<string | null>(null);
  bookmarkStatus = $state<'idle' | 'bookmarked' | 'duplicate' | 'error'>('idle');
  bookmarkErrorMessage = $state<string | null>(null);

  private initialized = false;
  /** In-flight loadFromUrl promise; concurrent calls (onMount + afterNavigate) share it
   *  so a fresh /edit visit never creates two projects. */
  private loadPromise: Promise<void> | null = null;
  lastSavedCode = '';
  lastSavedTitle = '';
  debouncedSave: ReturnType<typeof debounce>;
  private savingTimer?: ReturnType<typeof setTimeout>;
  private bookmarkTimer?: ReturnType<typeof setTimeout>;
  private savedTimer?: ReturnType<typeof setTimeout>;
  private errorTimer?: ReturnType<typeof setTimeout>;

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
    }
    this.bookmarkStatus = 'error';
    this.bookmarkErrorMessage = message;
    this.bookmarkTimer = setTimeout(() => {
      if (this.bookmarkStatus === 'error') {
        this.bookmarkStatus = 'idle';
        this.bookmarkErrorMessage = null;
      }
      this.bookmarkTimer = undefined;
    }, 3_000);
  }

  async loadFromUrl() {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadPromise = this.doLoadFromUrl().finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  private async doLoadFromUrl() {
    if (typeof window === 'undefined') return;

    const searchParams = new SvelteURLSearchParams(window.location.search);
    const idParam = searchParams.get('projectId');

    if (!idParam) {
      this.id = null;
      this.title = 'Untitled Project';
      this.saveStatus = 'idle';
      this.initialized = true;

      // Resolve the workspace the new project belongs to: explicit query param,
      // otherwise the workspace currently selected on the dashboard.
      const workspaceParam = searchParams.get('workspaceId');
      this.workspaceId =
        workspaceParam || localStorage.getItem('projects.currentWorkspaceId') || '';

      // 新建项目时静默保存
      await this.save({ silent: true });
      return;
    }

    this.id = idParam;
    this.saveStatus = 'idle';

    try {
      const project = await api.getProject(idParam);
      this.title = project.title || 'Untitled Project';
      this.workspaceId = project.workspace_id || '';
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
    if (currentCode === undefined || currentCode === null) return;

    if (this.savingTimer) {
      clearTimeout(this.savingTimer);
      this.savingTimer = undefined;
    }
    if (this.savedTimer) {
      clearTimeout(this.savedTimer);
      this.savedTimer = undefined;
    }
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = undefined;
    }

    const isSilent = Boolean(options.silent);

    if (isSilent) {
      // 静默保存立即同步已保存标记，避免响应式触发 notifyChange 再次调度非静默自动保存
      this.lastSavedCode = currentCode;
      this.lastSavedTitle = this.title;
    } else {
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
          code: currentCode,
          workspace_id: this.workspaceId || null
        });
        this.workspaceId = created.workspace_id || this.workspaceId || '';
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
        this.savedTimer = setTimeout(() => {
          if (this.saveStatus === 'saved') {
            this.saveStatus = 'idle';
          }
          this.savedTimer = undefined;
        }, 3_000);
      }
    } catch (err) {
      console.error('Failed to save project:', err);
      if (this.savingTimer) {
        clearTimeout(this.savingTimer);
        this.savingTimer = undefined;
      }
      if (this.savedTimer) {
        clearTimeout(this.savedTimer);
        this.savedTimer = undefined;
      }
      if (isSilent) {
        this.lastSavedCode = '';
      }
      this.saveStatus = 'error';
      this.errorMessage = err instanceof Error ? err.message : 'Failed to save diagram';
      this.errorTimer = setTimeout(() => {
        if (this.saveStatus === 'error') {
          this.saveStatus = 'idle';
          this.errorMessage = null;
        }
        this.errorTimer = undefined;
      }, 3_000);
    } finally {
      this.debouncedSave.cancel();
    }
  }

  notifyChange() {
    if (!this.initialized) return;

    const currentCode = inputState.code;
    if (currentCode === this.lastSavedCode && this.title === this.lastSavedTitle) {
      return;
    }

    if (this.savedTimer) {
      clearTimeout(this.savedTimer);
      this.savedTimer = undefined;
    }
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = undefined;
    }

    // When user edits (new unsaved changes), the prompt disappears
    this.saveStatus = 'idle';
    this.debouncedSave();
  }
}

export const projectState = new ProjectState();
