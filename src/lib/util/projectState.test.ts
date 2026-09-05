import { api } from '$lib/services/api';
import { inputState, updateCode } from '$lib/util/state.svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.clearAllMocks();
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
      code: 'graph TD\n NewProjectCode',
      workspace_id: null
    });
    expect(project.id).toBe('created-id-123');
    // Silent save: saveStatus is NOT set to saving or saved
    expect(project.saveStatus).toBe('idle');
    expect(window.location.search).toContain('projectId=created-id-123');
  });

  it('creates only one project when loadFromUrl is invoked concurrently', async () => {
    window.history.replaceState(null, '', '/edit');
    updateCode('graph TD\n ConcurrentCode');

    await Promise.all([project.loadFromUrl(), project.loadFromUrl()]);

    expect(api.createProject).toHaveBeenCalledTimes(1);
  });

  it('assigns a new project to the workspace from the workspaceId query param', async () => {
    window.history.replaceState(null, '', '/edit?workspaceId=ws-abc');
    updateCode('graph TD\n WorkspaceProject');

    await project.loadFromUrl();

    expect(api.createProject).toHaveBeenCalledWith({
      title: 'Untitled Project',
      code: 'graph TD\n WorkspaceProject',
      workspace_id: 'ws-abc'
    });
    expect(project.workspaceId).toBe('ws-abc');
  });

  it('stores the workspace of an existing project on load', async () => {
    window.history.replaceState(null, '', '/edit?projectId=existing-proj-id');
    vi.mocked(api.getProject).mockResolvedValueOnce({
      id: 'existing-proj-id',
      title: 'Server Project',
      code: 'graph TD\n ServerCode',
      workspace_id: 'ws-xyz'
    } as never);

    await project.loadFromUrl();

    expect(project.workspaceId).toBe('ws-xyz');
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

    await vi.advanceTimersByTimeAsync(3_000);
    expect(project.bookmarkStatus).toBe('idle');
    expect(project.bookmarkErrorMessage).toBeNull();
  });

  it('triggers immediate save and updates saveStatus to saved when saving unsaved changes, fading out after 3s', async () => {
    window.history.replaceState(null, '', '/edit?projectId=existing-proj-id');
    await project.loadFromUrl();

    expect(project.hasChanges).toBe(false);

    // User types new code in editor
    updateCode('graph TD\n ModifiedCode');
    expect(project.hasChanges).toBe(true);

    // Outside click / blur triggers save()
    await project.save();

    expect(api.updateProject).toHaveBeenCalledWith('existing-proj-id', {
      title: 'Server Project',
      code: 'graph TD\n ModifiedCode'
    });
    expect(project.saveStatus).toBe('saved');
    expect(project.hasChanges).toBe(false);

    // After 3s, saved status fades out to idle
    await vi.advanceTimersByTimeAsync(3_000);
    expect(project.saveStatus).toBe('idle');
  });

  it('handles save error status and 3s fadeout', async () => {
    window.history.replaceState(null, '', '/edit?projectId=error-proj-id');
    await project.loadFromUrl();

    vi.mocked(api.updateProject).mockRejectedValueOnce(new Error('Network failure'));
    updateCode('graph TD\n ErrorCode');

    await project.save();
    expect(project.saveStatus).toBe('error');
    expect(project.errorMessage).toBe('Network failure');

    await vi.advanceTimersByTimeAsync(3_000);
    expect(project.saveStatus).toBe('idle');
    expect(project.errorMessage).toBeNull();
  });

  it('silently saves when switching sample diagram, without showing saving or saved', async () => {
    window.history.replaceState(null, '', '/edit?projectId=sample-proj-id');
    await project.loadFromUrl();

    // User switches to a sample diagram
    const sampleCode = 'architecture-beta\n  service db(database)[Database]';
    updateCode(sampleCode);
    // Silent save triggered
    await project.save({ silent: true });

    expect(api.updateProject).toHaveBeenCalledWith('sample-proj-id', {
      title: 'Server Project',
      code: sampleCode
    });
    // Remains idle throughout
    expect(project.saveStatus).toBe('idle');
    expect(project.lastSavedCode).toBe(sampleCode);

    // Even if notifyChange is triggered, no debounced save should be scheduled
    project.notifyChange();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(project.saveStatus).toBe('idle');
  });

  it('saves empty code when editor code is cleared and save is triggered', async () => {
    window.history.replaceState(null, '', '/edit?projectId=existing-proj-id');
    await project.loadFromUrl();

    expect(project.hasChanges).toBe(false);

    // User clears code in editor
    updateCode('');
    expect(project.hasChanges).toBe(true);

    await project.save();

    expect(api.updateProject).toHaveBeenCalledWith('existing-proj-id', {
      title: 'Server Project',
      code: ''
    });
    expect(project.saveStatus).toBe('saved');
    expect(project.lastSavedCode).toBe('');
    expect(project.hasChanges).toBe(false);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(project.saveStatus).toBe('idle');
  });
});
