<script lang="ts">
  import Actions from '$/components/Actions.svelte';
  import Card from '$/components/Card/Card.svelte';
  import DiagramDocButton from '$/components/DiagramDocumentationButton.svelte';
  import Editor from '$/components/Editor.svelte';
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
  import Preset from '$/components/Preset.svelte';
  import Share from '$/components/Share.svelte';
  import SyncRoughToolbar from '$/components/SyncRoughToolbar.svelte';
  import { Button } from '$/components/ui/button';
  import * as Resizable from '$/components/ui/resizable';
  import { Switch } from '$/components/ui/switch';
  import VersionSecurityToolbar from '$/components/VersionSecurityToolbar.svelte';
  import View from '$/components/View.svelte';
  import type { EditorMode, Tab } from '$/types';
  import { shouldShowEditorChooser } from '$/util/migration/domainMigration';
  import { PanZoomState } from '$/util/panZoom';
  import { projectState } from '$/util/projectState.svelte';
  import { validatedState, updateCodeStore, urls, inputState } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import { initHandler } from '$/util/util';
  import { onMount } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import BookmarkIcon from '~icons/material-symbols/bookmark-outline-rounded';
  import HistoryIcon from '~icons/material-symbols/history';
  import GearIcon from '~icons/material-symbols/settings-outline-rounded';
  import { historyState, setMode } from '$/components/History/historyState.svelte';

  const panZoomState = new PanZoomState();

  const tabSelectHandler = (tab: Tab) => {
    const editorMode: EditorMode = tab.id === 'code' ? 'code' : 'config';
    updateCodeStore({ editorMode });
  };

  const editorTabs: Tab[] = [
    {
      icon: CodeIcon,
      id: 'code',
      title: 'Code'
    },
    {
      icon: GearIcon,
      id: 'config',
      title: 'Config'
    }
  ];

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
  $effect(() => {
    if (isMobile) {
      editorPane?.resize(50);
    }
  });
</script>

<div class="flex h-full flex-col overflow-hidden">
  {#snippet mobileToggle()}
    <div class="flex items-center gap-2">
      Edit <Switch
        id="editorMode"
        class="data-[state=checked]:bg-accent"
        bind:checked={isViewMode}
        onclick={() => {
          logEvent('mobileViewToggle');
        }} /> View
    </div>
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
    <div
      class={[
        'size-full',
        isMobile && ['w-[200%] duration-300', isViewMode && '-translate-x-1/2']
      ]}>
      <Resizable.PaneGroup
        direction="horizontal"
        autoSaveId="liveEditor"
        class="gap-4 p-2 pt-0 sm:gap-0 sm:p-6 sm:pt-0">
        <Resizable.Pane bind:this={editorPane} defaultSize={30} minSize={15}>
          <div class="flex h-full flex-col gap-4 sm:gap-6">
            <Card
              onselect={tabSelectHandler}
              isOpen
              tabs={editorTabs}
              activeTabID={validatedState.current.editorMode}
              isClosable={false}>
              {#snippet actions()}
                <DiagramDocButton />
              {/snippet}
              <Editor {isMobile} />
            </Card>

            <div class="group flex flex-wrap justify-between gap-4 sm:gap-6">
              <Preset />
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
    </div>
  </div>
</div>

<EditorChooserModal bind:open={showEditorChooser} />
