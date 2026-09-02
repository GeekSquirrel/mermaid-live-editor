import { api } from '$lib/services/api';
import { inputState, updateCode } from '$lib/util/state.svelte';
import { debounce } from 'lodash-es';

export class ProjectState {
  id = $state<string | null>(null);
  title = $state<string>('Untitled Project');
  saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  errorMessage = $state<string | null>(null);

  private initialized = false;
  debouncedSave: () => void;

  constructor() {
    this.debouncedSave = debounce(() => void this.save(), 1500);
  }

  async loadFromUrl() {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const idParam = searchParams.get('projectId');

    if (!idParam) {
      this.id = null;
      this.title = 'Untitled Project';
      this.saveStatus = 'idle';
      this.initialized = true;
      return;
    }

    this.id = idParam;
    this.saveStatus = 'saving';

    try {
      const project = await api.getProject(idParam);
      this.title = project.title || 'Untitled Project';
      updateCode(project.code, { updateDiagram: true });
      this.saveStatus = 'saved';
    } catch (err) {
      console.error('Failed to load project:', err);
      this.errorMessage = err instanceof Error ? err.message : 'Failed to load project';
      this.saveStatus = 'error';
    } finally {
      this.initialized = true;
    }
  }

  async save() {
    if (!this.initialized) return;

    const currentCode = inputState.code;
    if (!currentCode) return;

    this.saveStatus = 'saving';
    this.errorMessage = null;

    try {
      if (this.id) {
        await api.updateProject(this.id, {
          title: this.title.trim() || 'Untitled Project',
          code: currentCode
        });
        this.saveStatus = 'saved';
      } else {
        const created = await api.createProject({
          title: this.title.trim() || 'Untitled Project',
          code: currentCode
        });
        this.id = created.id;
        this.saveStatus = 'saved';

        const newUrl = new URL(window.location.href);
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
    this.saveStatus = 'saving';
    this.debouncedSave();
  }
}

export const projectState = new ProjectState();

