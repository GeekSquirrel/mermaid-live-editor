import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '$lib/services/api';
import { inputState, updateCode } from '$lib/util/state.svelte';
import { AUTO_SAVE_DEBOUNCE_MS, ProjectState } from './projectState.svelte';

vi.mock('$lib/services/api', () => ({
  api: {
    clearHistoryEntries: vi.fn().mockResolvedValue({ cleared: true }),
    createHistoryEntry: vi.fn().mockResolvedValue({}),
    createProject: vi
      .fn()
      .mockImplementation((data) => Promise.resolve({ id: 'created-id-123', ...data })),
    deleteHistoryEntry: vi.fn().mockResolvedValue({ deleted: true }),
    deleteProject: vi.fn().mockResolvedValue({ deleted: true }),
    getHistoryEntries: vi.fn().mockResolvedValue([]),
    getProject: vi
      .fn()
      .mockImplementation((id) =>
        Promise.resolve({ id, title: 'Server Project', code: 'graph TD\n ServerCode' })
      ),
    getProjects: vi.fn().mockResolvedValue([]),
    updateHistoryEntry: vi.fn().mockResolvedValue({}),
    updateProject: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data }))
  }
}));

describe('ProjectState auto-save & lifecycle', () => {
  let project: ProjectState;

  beforeEach(() => {
    vi.useFakeTimers();
    project = new ProjectState();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('has debounce duration set to 10 seconds', () => {
    expect(AUTO_SAVE_DEBOUNCE_MS).toBe(10_000);
  });

  it('remains in idle status on initial load of an existing project', async () => {
    window.history.replaceState(null, '', '/edit?projectId=existing-proj-id');

    await project.loadFromUrl();

    expect(project.id).toBe('existing-proj-id');
    expect(project.title).toBe('Server Project');
    expect(inputState.code).toBe('graph TD\n ServerCode');
    expect(project.saveStatus).toBe('idle');

    // Calling notifyChange with untouched code should not trigger save
    project.notifyChange();
    expect(project.saveStatus).toBe('idle');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.updateProject).not.toHaveBeenCalled();
  });

  it('clears prompt to idle on edit, and saves after 10 seconds of inactivity', async () => {
    window.history.replaceState(null, '', '/edit?projectId=test-id');
    await project.loadFromUrl();

    // 1. User edits code
    updateCode('graph TD\n UserEditedCode');
    project.notifyChange();

    // While editing before 10s, saveStatus must be idle (prompt disappears)
    expect(project.saveStatus).toBe('idle');

    // 2. 9 seconds pass with user typing again
    await vi.advanceTimersByTimeAsync(9_000);
    expect(api.updateProject).not.toHaveBeenCalled();

    // Typing again resets the 10s timer
    updateCode('graph TD\n UserEditedCodeAgain');
    project.notifyChange();
    expect(project.saveStatus).toBe('idle');

    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.updateProject).not.toHaveBeenCalled();

    // 3. Full 10s elapses after last operation -> saves
    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.updateProject).toHaveBeenCalledWith('test-id', {
      title: 'Server Project',
      code: 'graph TD\n UserEditedCodeAgain'
    });
    // Save completed in < 3s, directly shows saved
    expect(project.saveStatus).toBe('saved');

    // 4. When user edits again, prompt disappears (saveStatus becomes idle)
    updateCode('graph TD\n EvenNewerCode');
    project.notifyChange();
    expect(project.saveStatus).toBe('idle');
  });

  it('shows saving status only if save takes longer than 3 seconds', async () => {
    window.history.replaceState(null, '', '/edit?projectId=manual-id');
    await project.loadFromUrl();

    // Simulate slow network update (takes 4s)
    let resolveSlowUpdate: (() => void) | undefined;
    vi.mocked(api.updateProject).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSlowUpdate = () =>
            resolve({
              code: 'slow',
              created_at: 0,
              id: 'manual-id',
              title: 'Server Project',
              updated_at: 0
            });
        })
    );

    updateCode('graph TD\n SlowCode');
    const savePromise = project.save();

    // Initially < 3s, does not show saving
    expect(project.saveStatus).toBe('idle');

    // Advance 2s (still < 3s)
    await vi.advanceTimersByTimeAsync(2_000);
    expect(project.saveStatus).toBe('idle');

    // Advance 1s more (reaches 3s threshold) -> shows saving
    await vi.advanceTimersByTimeAsync(1_000);
    expect(project.saveStatus).toBe('saving');

    // Complete the save
    resolveSlowUpdate?.();
    await savePromise;

    expect(project.saveStatus).toBe('saved');
  });

  it('silently saves when creating a new project (no projectId in URL, saveStatus remains idle)', async () => {
    window.history.replaceState(null, '', '/edit');
    updateCode('graph TD\n NewProjectCode');

    await project.loadFromUrl();

    expect(api.createProject).toHaveBeenCalledWith({
      title: 'Untitled Project',
      code: 'graph TD\n NewProjectCode'
    });
    expect(project.id).toBe('created-id-123');
    // Silent save: saveStatus is NOT set to saving or saved
    expect(project.saveStatus).toBe('idle');
    expect(window.location.search).toContain('projectId=created-id-123');
  });

  it('silently saves when renaming a project (saveStatus remains idle)', async () => {
    window.history.replaceState(null, '', '/edit?projectId=existing-proj-id');
    await project.loadFromUrl();

    await project.rename('My Renamed Architecture');

    expect(project.title).toBe('My Renamed Architecture');
    expect(api.updateProject).toHaveBeenCalledWith('existing-proj-id', {
      title: 'My Renamed Architecture',
      code: 'graph TD\n ServerCode'
    });
    // Silent save: saveStatus is NOT set to saving or saved
    expect(project.saveStatus).toBe('idle');
  });

  it('handles bookmark status lifecycle and 3s fadeout', async () => {
    expect(project.bookmarkStatus).toBe('idle');

    project.showBookmarked();
    expect(project.bookmarkStatus).toBe('bookmarked');

    await vi.advanceTimersByTimeAsync(3_000);
    expect(project.bookmarkStatus).toBe('idle');

    project.showBookmarkDuplicate();
    expect(project.bookmarkStatus).toBe('duplicate');

    await vi.advanceTimersByTimeAsync(3_000);
    expect(project.bookmarkStatus).toBe('idle');

    project.showBookmarkError('Failed to save');
    expect(project.bookmarkStatus).toBe('error');
    expect(project.bookmarkErrorMessage).toBe('Failed to save');
  });
});
