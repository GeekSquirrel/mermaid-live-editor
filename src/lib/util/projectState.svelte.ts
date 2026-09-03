import { api } from '$lib/services/api';
import { inputState, updateCode } from '$lib/util/state.svelte';
import { debounce } from 'lodash-es';
import { SvelteURL, SvelteURLSearchParams } from 'svelte/reactivity';

export const AUTO_SAVE_DEBOUNCE_MS = 30_000;

export class ProjectState {
  id = $state<string | null>(null);
  title = $state<string>('Untitled Project');
  saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  errorMessage = $state<string | null>(null);

  private initialized = false;
  lastSavedCode = '';
  lastSavedTitle = '';
  debouncedSave: ReturnType<typeof debounce>;

  constructor() {
    this.debouncedSave = debounce(() => void this.save(), AUTO_SAVE_DEBOUNCE_MS);
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

      // 新建项目时应当立刻触发一次保存
      await this.save();
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
      await this.save();
    }
  }

  async save() {
    if (!this.initialized) return;

    this.debouncedSave.cancel();

    const currentCode = inputState.code;
    if (!currentCode) return;

    this.saveStatus = 'saving';
    this.errorMessage = null;

    try {
      const currentTitle = this.title.trim() || 'Untitled Project';
      if (this.id) {
        await api.updateProject(this.id, {
          title: currentTitle,
          code: currentCode
        });
        this.lastSavedCode = currentCode;
        this.lastSavedTitle = this.title;
        this.saveStatus = 'saved';
      } else {
        const created = await api.createProject({
          title: currentTitle,
          code: currentCode
        });
        this.id = created.id;
        this.lastSavedCode = currentCode;
        this.lastSavedTitle = this.title;
        this.saveStatus = 'saved';

        const newUrl = new SvelteURL(window.location.href);
        newUrl.searchParams.set('projectId', created.id);
        window.history.replaceState({}, '', newUrl.toString());
      }
    } catch (err) {
      console.error('Failed to save project:', err);
      this.saveStatus = 'error';
      this.errorMessage = err instanceof Error ? err.message : 'Failed to save project to backend';
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
