<script lang="ts">
  import { projectState } from '$lib/util/projectState.svelte';
  import CheckIcon from '~icons/material-symbols/check-circle-outline-rounded';
  import LoadingIcon from '~icons/material-symbols/sync-rounded';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import EditIcon from '~icons/material-symbols/edit-outline-rounded';

  const handleTitleInput = () => {
    if (projectState.title !== projectState.lastSavedTitle) {
      projectState.saveStatus = 'idle';
      projectState.debouncedSave();
    }
  };

  const handleTitleCommit = () => {
    void projectState.rename(projectState.title);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement)?.blur();
    }
  };

  const handleRetry = () => {
    void projectState.save();
  };
</script>

<div class="flex items-center gap-3">
  <div class="relative flex items-center">
    <input
      type="text"
      bind:value={projectState.title}
      oninput={handleTitleInput}
      onchange={handleTitleCommit}
      onblur={handleTitleCommit}
      onkeydown={handleKeyDown}
      placeholder="Untitled Project"
      class="h-8 w-36 rounded-md border border-input bg-background/50 px-2.5 py-1 text-xs font-medium transition-colors placeholder:text-muted-foreground hover:bg-background/80 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none sm:w-48 sm:text-sm" />
    <EditIcon class="pointer-events-none absolute right-2 size-3.5 text-muted-foreground/60" />
  </div>

  <div class="flex items-center gap-1.5 text-xs">
    {#if projectState.saveStatus === 'saving'}
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
        title={projectState.errorMessage || 'Save failed, click to retry'}
        onclick={handleRetry}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && handleRetry()}>
        <ErrorIcon class="size-3.5" />
        Save failed (Click to retry)
      </span>
    {/if}
  </div>
</div>
