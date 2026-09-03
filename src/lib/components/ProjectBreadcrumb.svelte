<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { projectState } from '$lib/util/projectState.svelte';
  import BookmarkIcon from '~icons/material-symbols/bookmark-outline-rounded';
  import CheckIcon from '~icons/material-symbols/check-circle-outline-rounded';
  import LoadingIcon from '~icons/material-symbols/sync-rounded';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import { tick } from 'svelte';

  const isProjectsPage = $derived(page.url.pathname.startsWith('/projects'));

  let isEditing = $state(false);
  let editTitle = $state(projectState.title);
  let inputEl = $state<HTMLInputElement | null>(null);

  const startEditing = () => {
    editTitle = projectState.title;
    isEditing = true;
    void tick().then(() => {
      inputEl?.select();
    });
  };

  const commitTitle = () => {
    isEditing = false;
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== projectState.title) {
      void projectState.rename(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      isEditing = false;
      editTitle = projectState.title;
    }
  };
</script>

{#if isProjectsPage}
  <span class="text-sm font-semibold text-foreground sm:text-base">Projects</span>
{:else}
  <div class="flex items-center gap-2 overflow-hidden text-sm sm:text-base">
    <a
      href={resolve('/projects', {})}
      class="font-medium text-muted-foreground transition-colors hover:text-foreground">
      Projects
    </a>
    <span class="text-muted-foreground/40">/</span>

    {#if isEditing}
      <input
        bind:this={inputEl}
        type="text"
        bind:value={editTitle}
        onblur={commitTitle}
        onkeydown={handleKeyDown}
        placeholder="Untitled Project"
        class="h-7 w-32 rounded border border-input bg-background px-2 py-0.5 text-xs font-medium focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none sm:w-48 sm:text-sm" />
    {:else}
      <button
        type="button"
        onclick={startEditing}
        title="Click to rename project"
        class="max-w-[120px] truncate rounded px-1 py-0.5 text-left font-medium transition-colors hover:bg-muted/60 hover:text-accent sm:max-w-[200px]">
        {projectState.title || 'Untitled Project'}
      </button>
    {/if}

    <!-- Status indicators immediately to the right of Projects/${Project Name} -->
    <div class="flex shrink-0 items-center gap-1.5 text-xs">
      {#if projectState.bookmarkStatus === 'bookmarked'}
        <span
          class="inline-flex animate-in items-center gap-1 rounded bg-pink-500/10 px-2 py-0.5 font-medium text-pink-600 transition-opacity duration-500 fade-in dark:text-pink-400">
          <BookmarkIcon class="size-3.5" />
          Bookmarked
        </span>
      {:else if projectState.bookmarkStatus === 'duplicate'}
        <span
          class="inline-flex animate-in items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 transition-opacity duration-500 fade-in dark:text-amber-400">
          <BookmarkIcon class="size-3.5" />
          State already bookmarked
        </span>
      {:else if projectState.bookmarkStatus === 'error'}
        <span
          class="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive transition-opacity duration-500"
          title={projectState.bookmarkErrorMessage || 'Failed to save bookmark'}>
          <ErrorIcon class="size-3.5" />
          Failed to save bookmark
        </span>
      {:else if projectState.saveStatus === 'saving'}
        <span
          class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-500">
          <LoadingIcon class="size-3.5 animate-spin" />
          Saving...
        </span>
      {:else if projectState.saveStatus === 'saved'}
        <span
          class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckIcon class="size-3.5" />
          Saved
        </span>
      {:else if projectState.saveStatus === 'error'}
        <span
          class="inline-flex cursor-pointer items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 font-medium text-destructive"
          title={projectState.errorMessage || 'Failed to save diagram, click to retry'}
          onclick={() => void projectState.save()}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && void projectState.save()}>
          <ErrorIcon class="size-3.5" />
          Failed to save diagram
        </span>
      {/if}
    </div>
  </div>
{/if}
