import { api } from '$lib/services/api';
import { inputState, updateCode } from '$lib/util/state.svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SAVE_DEBOUNCE_MS, DiagramState } from './diagramState.svelte';

vi.mock('$lib/services/api', () => ({
  api: {
    clearHistoryEntries: vi.fn().mockResolvedValue({ cleared: true }),
    createDiagram: vi
      .fn()
      .mockImplementation((data) => Promise.resolve({ id: 'created-id-123', ...data })),
    createHistoryEntry: vi.fn().mockResolvedValue({}),
    deleteDiagram: vi.fn().mockResolvedValue({ deleted: true }),
    deleteHistoryEntry: vi.fn().mockResolvedValue({ deleted: true }),
    getDiagram: vi
      .fn()
      .mockImplementation((id) =>
        Promise.resolve({ id, title: 'Server Diagram', code: 'graph TD\n ServerCode' })
      ),
    getDiagrams: vi.fn().mockResolvedValue([]),
    getHistoryEntries: vi.fn().mockResolvedValue([]),
    updateDiagram: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    updateHistoryEntry: vi.fn().mockResolvedValue({})
  }
}));

describe('DiagramState auto-save & lifecycle', () => {
  let diagram: DiagramState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    diagram = new DiagramState();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('has debounce duration set to 10 seconds', () => {
    expect(AUTO_SAVE_DEBOUNCE_MS).toBe(10_000);
  });

  it('remains in idle status on initial load of an existing diagram', async () => {
    window.history.replaceState(null, '', '/diagram?id=existing-proj-id');

    await diagram.loadFromUrl();

    expect(diagram.id).toBe('existing-proj-id');
    expect(diagram.title).toBe('Server Diagram');
    expect(inputState.code).toBe('graph TD\n ServerCode');
    expect(diagram.saveStatus).toBe('idle');

    // Calling notifyChange with untouched code should not trigger save
    diagram.notifyChange();
    expect(diagram.saveStatus).toBe('idle');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.updateDiagram).not.toHaveBeenCalled();
  });

  it('clears prompt to idle on edit, and saves after 10 seconds of inactivity', async () => {
    window.history.replaceState(null, '', '/diagram?id=test-id');
    await diagram.loadFromUrl();

    // 1. User edits code
    updateCode('graph TD\n UserEditedCode');
    diagram.notifyChange();

    // While editing before 10s, saveStatus must be idle (prompt disappears)
    expect(diagram.saveStatus).toBe('idle');

    // 2. 9 seconds pass with user typing again
    await vi.advanceTimersByTimeAsync(9_000);
    expect(api.updateDiagram).not.toHaveBeenCalled();

    // Typing again resets the 10s timer
    updateCode('graph TD\n UserEditedCodeAgain');
    diagram.notifyChange();
    expect(diagram.saveStatus).toBe('idle');

    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.updateDiagram).not.toHaveBeenCalled();

    // 3. Full 10s elapses after last operation -> saves
    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.updateDiagram).toHaveBeenCalledWith('test-id', {
      title: 'Server Diagram',
      code: 'graph TD\n UserEditedCodeAgain'
    });
    // Save completed in < 3s, directly shows saved
    expect(diagram.saveStatus).toBe('saved');

    // 4. When user edits again, prompt disappears (saveStatus becomes idle)
    updateCode('graph TD\n EvenNewerCode');
    diagram.notifyChange();
    expect(diagram.saveStatus).toBe('idle');
  });

  it('shows saving status only if save takes longer than 3 seconds', async () => {
    window.history.replaceState(null, '', '/diagram?id=manual-id');
    await diagram.loadFromUrl();

    // Simulate slow network update (takes 4s)
    let resolveSlowUpdate: (() => void) | undefined;
    vi.mocked(api.updateDiagram).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSlowUpdate = () =>
            resolve({
              code: 'slow',
              created_at: 0,
              id: 'manual-id',
              title: 'Server Diagram',
              updated_at: 0
            });
        })
    );

    updateCode('graph TD\n SlowCode');
    const savePromise = diagram.save();

    // Initially < 3s, does not show saving
    expect(diagram.saveStatus).toBe('idle');

    // Advance 2s (still < 3s)
    await vi.advanceTimersByTimeAsync(2_000);
    expect(diagram.saveStatus).toBe('idle');

    // Advance 1s more (reaches 3s threshold) -> shows saving
    await vi.advanceTimersByTimeAsync(1_000);
    expect(diagram.saveStatus).toBe('saving');

    // Complete the save
    resolveSlowUpdate?.();
    await savePromise;

    expect(diagram.saveStatus).toBe('saved');
  });

  it('silently saves when creating a new diagram (no diagramId in URL, saveStatus remains idle)', async () => {
    window.history.replaceState(null, '', '/diagram');
    updateCode('graph TD\n NewDiagramCode');

    await diagram.loadFromUrl();

    expect(api.createDiagram).toHaveBeenCalledWith({
      title: 'Untitled Diagram',
      code: 'graph TD\n NewDiagramCode',
      workspace_id: null
    });
    expect(diagram.id).toBe('created-id-123');
    // Silent save: saveStatus is NOT set to saving or saved
    expect(diagram.saveStatus).toBe('idle');
    expect(window.location.search).toContain('id=created-id-123');
  });

  it('creates only one diagram when loadFromUrl is invoked concurrently', async () => {
    window.history.replaceState(null, '', '/diagram');
    updateCode('graph TD\n ConcurrentCode');

    await Promise.all([diagram.loadFromUrl(), diagram.loadFromUrl()]);

    expect(api.createDiagram).toHaveBeenCalledTimes(1);
  });

  it('assigns a new diagram to the workspace from the workspaceId query param', async () => {
    window.history.replaceState(null, '', '/diagram?workspaceId=ws-abc');
    updateCode('graph TD\n WorkspaceDiagram');

    await diagram.loadFromUrl();

    expect(api.createDiagram).toHaveBeenCalledWith({
      title: 'Untitled Diagram',
      code: 'graph TD\n WorkspaceDiagram',
      workspace_id: 'ws-abc'
    });
    expect(diagram.workspaceId).toBe('ws-abc');
  });

  it('stores the workspace of an existing diagram on load', async () => {
    window.history.replaceState(null, '', '/diagram?id=existing-proj-id');
    vi.mocked(api.getDiagram).mockResolvedValueOnce({
      id: 'existing-proj-id',
      title: 'Server Diagram',
      code: 'graph TD\n ServerCode',
      workspace_id: 'ws-xyz'
    } as never);

    await diagram.loadFromUrl();

    expect(diagram.workspaceId).toBe('ws-xyz');
  });

  it('silently saves when renaming a diagram (saveStatus remains idle)', async () => {
    window.history.replaceState(null, '', '/diagram?id=existing-proj-id');
    await diagram.loadFromUrl();

    await diagram.rename('My Renamed Architecture');

    expect(diagram.title).toBe('My Renamed Architecture');
    expect(api.updateDiagram).toHaveBeenCalledWith('existing-proj-id', {
      title: 'My Renamed Architecture',
      code: 'graph TD\n ServerCode'
    });
    // Silent save: saveStatus is NOT set to saving or saved
    expect(diagram.saveStatus).toBe('idle');
  });

  it('handles bookmark status lifecycle and 3s fadeout', async () => {
    expect(diagram.bookmarkStatus).toBe('idle');

    diagram.showBookmarked();
    expect(diagram.bookmarkStatus).toBe('bookmarked');

    await vi.advanceTimersByTimeAsync(3_000);
    expect(diagram.bookmarkStatus).toBe('idle');

    diagram.showBookmarkDuplicate();
    expect(diagram.bookmarkStatus).toBe('duplicate');

    await vi.advanceTimersByTimeAsync(3_000);
    expect(diagram.bookmarkStatus).toBe('idle');

    diagram.showBookmarkError('Failed to save');
    expect(diagram.bookmarkStatus).toBe('error');
    expect(diagram.bookmarkErrorMessage).toBe('Failed to save');

    await vi.advanceTimersByTimeAsync(3_000);
    expect(diagram.bookmarkStatus).toBe('idle');
    expect(diagram.bookmarkErrorMessage).toBeNull();
  });

  it('triggers immediate save and updates saveStatus to saved when saving unsaved changes, fading out after 3s', async () => {
    window.history.replaceState(null, '', '/diagram?id=existing-proj-id');
    await diagram.loadFromUrl();

    expect(diagram.hasChanges).toBe(false);

    // User types new code in editor
    updateCode('graph TD\n ModifiedCode');
    expect(diagram.hasChanges).toBe(true);

    // Outside click / blur triggers save()
    await diagram.save();

    expect(api.updateDiagram).toHaveBeenCalledWith('existing-proj-id', {
      title: 'Server Diagram',
      code: 'graph TD\n ModifiedCode'
    });
    expect(diagram.saveStatus).toBe('saved');
    expect(diagram.hasChanges).toBe(false);

    // After 3s, saved status fades out to idle
    await vi.advanceTimersByTimeAsync(3_000);
    expect(diagram.saveStatus).toBe('idle');
  });

  it('handles save error status and 3s fadeout', async () => {
    window.history.replaceState(null, '', '/diagram?id=error-proj-id');
    await diagram.loadFromUrl();

    vi.mocked(api.updateDiagram).mockRejectedValueOnce(new Error('Network failure'));
    updateCode('graph TD\n ErrorCode');

    await diagram.save();
    expect(diagram.saveStatus).toBe('error');
    expect(diagram.errorMessage).toBe('Network failure');

    await vi.advanceTimersByTimeAsync(3_000);
    expect(diagram.saveStatus).toBe('idle');
    expect(diagram.errorMessage).toBeNull();
  });

  it('silently saves when switching sample diagram, without showing saving or saved', async () => {
    window.history.replaceState(null, '', '/diagram?id=sample-proj-id');
    await diagram.loadFromUrl();

    // User switches to a sample diagram
    const sampleCode = 'architecture-beta\n  service db(database)[Database]';
    updateCode(sampleCode);
    // Silent save triggered
    await diagram.save({ silent: true });

    expect(api.updateDiagram).toHaveBeenCalledWith('sample-proj-id', {
      title: 'Server Diagram',
      code: sampleCode
    });
    // Remains idle throughout
    expect(diagram.saveStatus).toBe('idle');
    expect(diagram.lastSavedCode).toBe(sampleCode);

    // Even if notifyChange is triggered, no debounced save should be scheduled
    diagram.notifyChange();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(diagram.saveStatus).toBe('idle');
  });

  it('saves empty code when editor code is cleared and save is triggered', async () => {
    window.history.replaceState(null, '', '/diagram?id=existing-proj-id');
    await diagram.loadFromUrl();

    expect(diagram.hasChanges).toBe(false);

    // User clears code in editor
    updateCode('');
    expect(diagram.hasChanges).toBe(true);

    await diagram.save();

    expect(api.updateDiagram).toHaveBeenCalledWith('existing-proj-id', {
      title: 'Server Diagram',
      code: ''
    });
    expect(diagram.saveStatus).toBe('saved');
    expect(diagram.lastSavedCode).toBe('');
    expect(diagram.hasChanges).toBe(false);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(diagram.saveStatus).toBe('idle');
  });
});
