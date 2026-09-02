<script lang="ts">
  import { projectState } from '$lib/util/projectState.svelte';
  import CheckIcon from '~icons/material-symbols/check-circle-outline-rounded';
  import LoadingIcon from '~icons/material-symbols/sync-rounded';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import EditIcon from '~icons/material-symbols/edit-outline-rounded';

  const handleTitleChange = () => {
    projectState.notifyChange();
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
      oninput={handleTitleChange}
      placeholder="未命名项目"
      class="h-8 w-36 sm:w-48 rounded-md border border-input bg-background/50 px-2.5 py-1 text-xs sm:text-sm font-medium transition-colors placeholder:text-muted-foreground focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-background/80" />
    <EditIcon class="pointer-events-none absolute right-2 size-3.5 text-muted-foreground/60" />
  </div>

  <div class="flex items-center gap-1.5 text-xs">
    {#if projectState.saveStatus === 'saving'}
      <span class="inline-flex items-center gap-1 text-amber-500 font-medium bg-amber-500/10 px-2 py-0.5 rounded">
        <LoadingIcon class="size-3.5 animate-spin" />
        保存中...
      </span>
    {:else if projectState.saveStatus === 'saved'}
      <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded">
        <CheckIcon class="size-3.5" />
        已保存
      </span>
    {:else if projectState.saveStatus === 'error'}
      <span
        class="inline-flex items-center gap-1 text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded cursor-pointer"
        title={projectState.errorMessage || '保存失败，点击重试'}
        onclick={handleRetry}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && handleRetry()}>
        <ErrorIcon class="size-3.5" />
        保存失败 (点击重试)
      </span>
    {/if}
  </div>
</div>
