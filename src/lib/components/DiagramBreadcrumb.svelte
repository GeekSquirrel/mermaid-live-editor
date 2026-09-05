<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { api } from '$lib/services/api';
  import { diagramState } from '$lib/util/diagramState.svelte';
  import BookmarkIcon from '~icons/material-symbols/bookmark-outline-rounded';
  import CheckIcon from '~icons/material-symbols/check-circle-outline-rounded';
  import LoadingIcon from '~icons/material-symbols/sync-rounded';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import { tick } from 'svelte';
  import { fade } from 'svelte/transition';

  const isDashboardPage = $derived(page.url.pathname.startsWith('/dashboard'));

  // Workspace segment of the editor breadcrumb; re-resolved whenever the
  // diagram's workspace changes (load, or first save of a new diagram).
  let workspaceName = $state('Default');
  $effect(() => {
    const wsId = diagramState.workspaceId || '';
    api
      .getWorkspaces()
      .then((list) => {
        workspaceName = list.find((w) => w.id === wsId)?.name ?? 'Default';
      })
      .catch(() => {
        workspaceName = 'Default';
      });
  });

  let isEditing = $state(false);
  let editTitle = $state(diagramState.title);
  let inputEl = $state<HTMLInputElement | null>(null);

  const startEditing = () => {
    editTitle = diagramState.title;
    isEditing = true;
    void tick().then(() => {
      inputEl?.select();
    });
  };

  const commitTitle = () => {
    isEditing = false;
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== diagramState.title) {
      void diagramState.rename(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      isEditing = false;
      editTitle = diagramState.title;
    }
  };
</script>

{#if isDashboardPage}
  <span class="text-sm font-semibold text-foreground sm:text-base">Dashboard</span>
{:else}
  <div class="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs sm:gap-2 sm:text-base">
    <!-- Desktop: Dashboard / Workspace / Diagram; mobile: Workspace / Diagram -->
    <a
      href={resolve('/dashboard', {})}
      class="hidden shrink-0 truncate rounded px-1 py-0.5 font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-accent md:inline">
      Dashboard
    </a>
    <span class="hidden text-muted-foreground/40 md:inline">/</span>
    <a
      href={diagramState.workspaceId
        ? `${resolve('/dashboard', {})}?workspace=${diagramState.workspaceId}`
        : resolve('/dashboard', {})}
      class="max-w-[100px] shrink-0 truncate rounded px-1 py-0.5 font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-accent sm:max-w-[160px]"
      title={`Open workspace "${workspaceName}" in dashboard`}>
      {workspaceName}
    </a>
    <span class="text-muted-foreground/40">/</span>

    {#if isEditing}
      <input
        bind:this={inputEl}
        type="text"
        bind:value={editTitle}
        onblur={commitTitle}
        onkeydown={handleKeyDown}
        placeholder="Untitled Diagram"
        class="xs:w-32 h-7 w-24 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium shadow-xs transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none sm:w-48 sm:text-sm" />
    {:else}
      <button
        type="button"
        onclick={startEditing}
        title="Click to rename diagram"
        class="xs:max-w-[120px] max-w-[80px] truncate rounded px-1 py-0.5 text-left font-medium text-foreground transition-colors hover:bg-muted/60 hover:text-accent sm:max-w-[200px]">
        {diagramState.title || 'Untitled Diagram'}
      </button>
    {/if}

    <!-- Desktop Status indicators immediately to the right of Diagrams/${Diagram Name} -->
    <div class="hidden shrink-0 items-center gap-1.5 text-xs md:flex">
      {#if diagramState.bookmarkStatus === 'bookmarked'}
        <span
          transition:fade={{ duration: 300 }}
          class="inline-flex items-center gap-1 rounded bg-pink-500/10 px-2 py-0.5 font-medium text-pink-600 dark:text-pink-400">
          <BookmarkIcon class="size-3.5" />
          Bookmarked
        </span>
      {:else if diagramState.bookmarkStatus === 'duplicate'}
        <span
          transition:fade={{ duration: 300 }}
          class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
          <BookmarkIcon class="size-3.5" />
          State already bookmarked
        </span>
      {:else if diagramState.bookmarkStatus === 'error'}
        <span
          transition:fade={{ duration: 300 }}
          class="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive"
          title={diagramState.bookmarkErrorMessage || 'Failed to save bookmark'}>
          <ErrorIcon class="size-3.5" />
          Failed to save bookmark
        </span>
      {:else if diagramState.saveStatus === 'saving'}
        <span
          class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-500">
          <LoadingIcon class="size-3.5 animate-spin" />
          Saving...
        </span>
      {:else if diagramState.saveStatus === 'saved'}
        <span
          transition:fade={{ duration: 300 }}
          class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckIcon class="size-3.5" />
          Saved
        </span>
      {:else if diagramState.saveStatus === 'error'}
        <span
          transition:fade={{ duration: 300 }}
          class="inline-flex cursor-pointer items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive"
          title={diagramState.errorMessage || 'Failed to save diagram, click to retry'}
          onclick={() => void diagramState.save()}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && void diagramState.save()}>
          <ErrorIcon class="size-3.5" />
          Failed to save diagram
        </span>
      {/if}
    </div>

    <!-- Mobile floating bar notification at bottom-right -->
    <div
      class="pointer-events-none fixed right-4 bottom-12 z-50 flex flex-col items-end gap-2 md:hidden">
      {#if diagramState.bookmarkStatus === 'bookmarked'}
        <div
          transition:fade={{ duration: 300 }}
          class="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-pink-500/30 bg-background/95 px-3 py-1.5 text-xs font-medium text-pink-600 shadow-lg backdrop-blur-md dark:text-pink-400">
          <BookmarkIcon class="size-4 text-pink-600 dark:text-pink-400" />
          <span>Bookmarked</span>
        </div>
      {:else if diagramState.bookmarkStatus === 'duplicate'}
        <div
          transition:fade={{ duration: 300 }}
          class="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-background/95 px-3 py-1.5 text-xs font-medium text-amber-600 shadow-lg backdrop-blur-md dark:text-amber-400">
          <BookmarkIcon class="size-4 text-amber-600 dark:text-amber-400" />
          <span>State already bookmarked</span>
        </div>
      {:else if diagramState.bookmarkStatus === 'error'}
        <div
          transition:fade={{ duration: 300 }}
          class="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-background/95 px-3 py-1.5 text-xs font-medium text-destructive shadow-lg backdrop-blur-md">
          <ErrorIcon class="size-4 text-destructive" />
          <span>{diagramState.bookmarkErrorMessage || 'Failed to save bookmark'}</span>
        </div>
      {:else if diagramState.saveStatus === 'saving'}
        <div
          class="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-background/95 px-3 py-1.5 text-xs font-medium text-amber-500 shadow-lg backdrop-blur-md">
          <LoadingIcon class="size-4 animate-spin text-amber-500" />
          <span>Saving...</span>
        </div>
      {:else if diagramState.saveStatus === 'saved'}
        <div
          transition:fade={{ duration: 300 }}
          class="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-background/95 px-3 py-1.5 text-xs font-medium text-emerald-600 shadow-lg backdrop-blur-md dark:text-emerald-400">
          <CheckIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>Saved</span>
        </div>
      {:else if diagramState.saveStatus === 'error'}
        <div
          transition:fade={{ duration: 300 }}
          class="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-destructive/30 bg-background/95 px-3 py-1.5 text-xs font-medium text-destructive shadow-lg backdrop-blur-md"
          title={diagramState.errorMessage || 'Failed to save diagram, click to retry'}
          onclick={() => void diagramState.save()}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && void diagramState.save()}>
          <ErrorIcon class="size-4 text-destructive" />
          <span>Failed to save diagram</span>
        </div>
      {/if}
    </div>
  </div>
{/if}
