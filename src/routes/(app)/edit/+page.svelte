<script lang="ts">
  import Actions from '$/components/Actions.svelte';
  import Card from '$/components/Card/Card.svelte';
  import Editor from '$/components/Editor.svelte';
  import SamplesPanel from '$/components/SamplesPanel.svelte';
  import Bookmarks from '$/components/History/Bookmarks.svelte';
  import Timeline from '$/components/History/Timeline.svelte';
  import {
    addManualEntry,
    loadSavedEntries,
    setCurrentProjectId,
    startAutoSave
  } from '$/components/History/historyState.svelte';
  import { afterNavigate } from '$app/navigation';
  import EditorChooserModal from '$/components/migration/EditorChooserModal.svelte';
  import Navbar from '$/components/Navbar.svelte';
  import CanvasToolbar from '$/components/CanvasToolbar.svelte';
  import Share from '$/components/Share.svelte';
  import SyncRoughToolbar from '$/components/SyncRoughToolbar.svelte';
  import { Button } from '$/components/ui/button';
  import * as Resizable from '$/components/ui/resizable';
  import { Switch } from '$/components/ui/switch';
  import VersionSecurityToolbar from '$/components/VersionSecurityToolbar.svelte';
  import View from '$/components/View.svelte';
  import { shouldShowEditorChooser } from '$/util/migration/domainMigration';
  import { PanZoomState } from '$/util/panZoom';
  import { projectState } from '$/util/projectState.svelte';
  import { validatedState, urls, inputState } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import { initHandler } from '$/util/util';
  import { onMount } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import BookmarkIcon from '~icons/material-symbols/bookmark-outline-rounded';
  import HistoryIcon from '~icons/material-symbols/history';
  import ShapesIcon from '~icons/material-symbols/account-tree-outline-rounded';
  import { historyState, setMode } from '$/components/History/historyState.svelte';

  const panZoomState = new PanZoomState();

  let activeEditorTab = $state<'code' | 'samples'>('code');
  let editorContainerRef = $state<HTMLDivElement>();

  const handleWindowPointerDown = (event: PointerEvent) => {
    if (!editorContainerRef) return;
    const target = event.target as Node | null;
    const isInsideEditor =
      target &&
      (editorContainerRef.contains(target) ||
        (target instanceof Element &&
          Boolean(target.closest('.monaco-editor') || target.closest('.monaco-menu-container'))));

    if (isInsideEditor) {
      return;
    }

    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && (editorContainerRef.contains(activeEl) || activeEl.closest('.monaco-editor'))) {
      activeEl.blur();
    }

    if (projectState.hasChanges) {
      void projectState.save();
    }
  };

  let width = $state(0);
  let isMobile = $derived(width < 640);
  let isViewMode = $state(true);
  let showEditorChooser = $state(false);

  onMount(async () => {
    await initHandler();
    await projectState.loadFromUrl();
    setCurrentProjectId(projectState.id);
    showEditorChooser = shouldShowEditorChooser();
    window.addEventListener('appinstalled', () => {
      logEvent('pwaInstalled', { isMobile });
    });
  });

  afterNavigate(async () => {
    await projectState.loadFromUrl();
    setCurrentProjectId(projectState.id);
  });

  $effect(() => {
    void inputState.code;
    projectState.notifyChange();
  });

  $effect(() => {
    setCurrentProjectId(projectState.id);
  });

  // Record the Timeline for the whole session and load saved history from backend
  onMount(() => {
    void loadSavedEntries();
    return startAutoSave();
  });

  const handleSaveDiagram = async () => {
    await projectState.save();
  };

  const handleBookmarkDiagram = () => {
    const currentId = projectState.id;
    setCurrentProjectId(currentId);
    const currentState = $state.snapshot(inputState);
    const title = projectState.title?.trim();
    addManualEntry(currentState, title || undefined, currentId);
  };

  let activePanel = $state<'bookmarks' | 'timeline' | null>(null);

  const toggleBookmarks = () => {
    activePanel = activePanel === 'bookmarks' ? null : 'bookmarks';
    if (activePanel === 'bookmarks') {
      setMode('manual');
    }
  };

  const toggleTimeline = () => {
    activePanel = activePanel === 'timeline' ? null : 'timeline';
    if (activePanel === 'timeline') {
      setMode('auto');
    }
  };

  let editorPane: Resizable.Pane | undefined;
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="flex h-full flex-col overflow-hidden">
  {#snippet mobileToggle()}
    <div class="flex shrink-0 items-center gap-1.5 text-xs font-medium">
      <button
        type="button"
        class={!isViewMode ? 'font-semibold text-foreground' : 'text-muted-foreground'}
        onclick={() => (isViewMode = false)}>
        Edit
      </button>
      <Switch
        id="editorMode"
        class="data-[state=checked]:bg-accent"
        checked={isViewMode}
        onCheckedChange={(checked) => {
          isViewMode = checked;
          logEvent('mobileViewToggle');
        }} />
      <button
        type="button"
        class={isViewMode ? 'font-semibold text-foreground' : 'text-muted-foreground'}
        onclick={() => (isViewMode = true)}>
        View
      </button>
    </div>
  {/snippet}

  {#snippet editorTitle()}
    <Button
      variant={activeEditorTab === 'code' ? 'secondary' : 'ghost'}
      size="sm"
      class={[
        'h-8 gap-1.5 px-2.5 text-xs font-medium',
        activeEditorTab === 'code' && 'bg-accent/15 font-semibold text-accent hover:bg-accent/20'
      ]}
      onclick={(e) => {
        e.stopPropagation();
        activeEditorTab = 'code';
      }}>
      <CodeIcon class="size-4" />
      Code
    </Button>
  {/snippet}

  {#snippet editorActions()}
    <Button
      variant={activeEditorTab === 'samples' ? 'secondary' : 'ghost'}
      size="sm"
      class={[
        'h-8 gap-1.5 px-2.5 text-xs font-medium',
        activeEditorTab === 'samples' && 'bg-accent/15 font-semibold text-accent hover:bg-accent/20'
      ]}
      onclick={() => {
        activeEditorTab = activeEditorTab === 'samples' ? 'code' : 'samples';
      }}>
      <ShapesIcon class="size-4" />
      Samples
    </Button>
  {/snippet}

  <Navbar mobileToggle={isMobile ? mobileToggle : undefined}>
    <div class="relative inline-flex">
      <Button
        variant={activePanel === 'bookmarks' ? 'secondary' : 'default'}
        size="sm"
        class="gap-1.5"
        onclick={toggleBookmarks}
        title="Bookmarks">
        <BookmarkIcon class="size-4" />
        Bookmarks
      </Button>
      {#if historyState.bookmarkCount > 0}
        <span
          class="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground shadow-sm">
          {historyState.bookmarkCount}
        </span>
      {/if}
    </div>
    <Button
      variant={activePanel === 'timeline' ? 'secondary' : 'default'}
      size="sm"
      class="gap-1.5"
      onclick={toggleTimeline}
      title="Timeline">
      <HistoryIcon class="size-4" />
      Timeline
    </Button>
    <Share />
  </Navbar>

  <div class="flex flex-1 flex-col overflow-hidden" bind:clientWidth={width}>
    {#if isMobile}
      <div
        class={[
          'flex h-full w-[200%] transition-transform duration-300',
          isViewMode ? '-translate-x-1/2' : 'translate-x-0'
        ]}>
        <div class="flex h-full w-1/2 flex-col gap-4 overflow-y-auto p-2">
          <Card isOpen titleSnippet={editorTitle} actions={editorActions} isClosable={false}>
            {#if activeEditorTab === 'code'}
              <div bind:this={editorContainerRef} class="h-full">
                <Editor {isMobile} />
              </div>
            {:else}
              <div class="h-full">
                <SamplesPanel />
              </div>
            {/if}
          </Card>
          <Actions />
        </div>
        <div class="relative flex h-full w-1/2 flex-col overflow-hidden">
          <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
          <div class="absolute top-0 right-0">
            <CanvasToolbar
              {panZoomState}
              fullScreenHref={urls.current.view}
              onSave={() => void handleSaveDiagram()}
              onBookmark={handleBookmarkDiagram} />
          </div>
          <div class="absolute right-0 bottom-0"><VersionSecurityToolbar /></div>
          <div class="absolute bottom-0 left-0"><SyncRoughToolbar /></div>
        </div>
      </div>
    {:else}
      <Resizable.PaneGroup
        direction="horizontal"
        autoSaveId="liveEditor"
        class="gap-4 p-2 pt-0 sm:gap-0 sm:p-6 sm:pt-0">
        <Resizable.Pane bind:this={editorPane} defaultSize={30} minSize={15}>
          <div class="flex h-full flex-col gap-4 sm:gap-6">
            <Card isOpen titleSnippet={editorTitle} actions={editorActions} isClosable={false}>
              {#if activeEditorTab === 'code'}
                <div bind:this={editorContainerRef} class="h-full">
                  <Editor {isMobile} />
                </div>
              {:else}
                <div class="h-full">
                  <SamplesPanel />
                </div>
              {/if}
            </Card>

            <div class="flex flex-col gap-4 sm:gap-6">
              <Actions />
            </div>
          </div>
        </Resizable.Pane>
        <Resizable.Handle class="mr-1 hidden opacity-0 sm:block" />
        <Resizable.Pane minSize={15} class="relative flex h-full flex-1 flex-col overflow-hidden">
          <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
          <div class="absolute top-0 right-0">
            <CanvasToolbar
              {panZoomState}
              fullScreenHref={urls.current.view}
              onSave={() => void handleSaveDiagram()}
              onBookmark={handleBookmarkDiagram} />
          </div>
          <div class="absolute right-0 bottom-0"><VersionSecurityToolbar /></div>
          <div class="absolute bottom-0 left-0 sm:left-5"><SyncRoughToolbar /></div>
        </Resizable.Pane>
        {#if activePanel === 'bookmarks'}
          <Resizable.Handle class="ml-1 hidden opacity-0 sm:block" />
          <Resizable.Pane minSize={15} defaultSize={30} class="hidden h-full grow flex-col sm:flex">
            <Bookmarks />
          </Resizable.Pane>
        {:else if activePanel === 'timeline'}
          <Resizable.Handle class="ml-1 hidden opacity-0 sm:block" />
          <Resizable.Pane minSize={15} defaultSize={30} class="hidden h-full grow flex-col sm:flex">
            <Timeline />
          </Resizable.Pane>
        {/if}
      </Resizable.PaneGroup>
    {/if}
  </div>
</div>

<EditorChooserModal bind:open={showEditorChooser} />
