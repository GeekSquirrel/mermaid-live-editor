<script lang="ts">
  import Card from '$lib/components/Card/Card.svelte';
  import type { State } from '$lib/types';
  import { prompt } from '$lib/util/notify';
  import { serializeState } from '$lib/util/serde';
  import { replaceInputState } from '$lib/util/state.svelte';
  import { logEvent } from '$lib/util/stats';
  import dayjs from 'dayjs';
  import dayjsRelativeTime from 'dayjs/plugin/relativeTime';
  import TrashAltIcon from '~icons/material-symbols/delete-outline-rounded';
  import DownloadIcon from '~icons/material-symbols/download-rounded';
  import EditIcon from '~icons/material-symbols/edit-outline-rounded';
  import OpenInNewIcon from '~icons/material-symbols/open-in-new-rounded';
  import UndoIcon from '~icons/material-symbols/settings-backup-restore-rounded';
  import HistoryIcon from '~icons/mdi/clock-outline';
  import { onMount } from 'svelte';
  import { Button } from '../ui/button';
  import { Separator } from '../ui/separator';
  import {
    clearActive,
    historyState,
    removeEntry,
    renameEntry,
    setMode
  } from './historyState.svelte';

  dayjs.extend(dayjsRelativeTime);

  let editingId: string | null = $state(null);
  let editValue = $state('');

  const commitRename = () => {
    if (editingId !== null && editValue.trim()) {
      renameEntry(editingId, editValue);
    }
    editingId = null;
  };

  onMount(() => {
    setMode('auto');
  });

  const downloadTimeline = () => {
    const data = historyState.entries;
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mermaid-timeline-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logEvent('history', { action: 'download', type: 'auto' });
  };

  const clearAll = async () => {
    if (await prompt('Are you sure you want to delete all timeline entries?')) {
      clearActive();
    }
  };

  const restoreHistoryItem = (state: State) => {
    replaceInputState(state);
    logEvent('history', { action: 'restore', type: 'auto' });
  };

  const entryUrl = (state: State): string =>
    `${window.location.origin}${window.location.pathname}#${serializeState(state)}`;

  const entriesWithUrl = $derived(
    historyState.entries.map((entry) => ({ ...entry, openUrl: entryUrl(entry.state) }))
  );
</script>

<Card isOpen isClosable={false} title="Timeline" icon={{ component: HistoryIcon, class: 'size-4' }}>
  {#snippet actions()}
    <div class="flex items-center gap-2">
      {#if historyState.entries.length > 0}
        <Button
          id="downloadHistory"
          size="icon"
          variant="ghost"
          onclick={downloadTimeline}
          title="Download timeline">
          <DownloadIcon />
        </Button>
      {/if}
      <Button
        id="clearHistory"
        size="icon"
        variant="ghost"
        class="hover:text-destructive"
        onclick={clearAll}
        title="Delete all timeline entries">
        <TrashAltIcon />
      </Button>
    </div>
  {/snippet}

  <ul class="flex h-full flex-col gap-2 overflow-auto p-2" id="historyList">
    {#if entriesWithUrl.length > 0}
      {#each entriesWithUrl as { id, state, time, name, url, openUrl } (id)}
        <li class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex min-w-0 flex-1 flex-col">
              <div class="flex min-w-0 items-center gap-1 overflow-hidden">
                {#if url}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener"
                    title="Open revision in new tab"
                    class="min-w-0 truncate text-blue-500 hover:underline">{name}</a>
                {:else if editingId === id}
                  <input
                    class="min-w-0 flex-1 rounded border px-1 text-sm"
                    bind:value={editValue}
                    aria-label="Rename entry"
                    onkeydown={(event) => {
                      if (event.key === 'Enter') {
                        commitRename();
                      } else if (event.key === 'Escape') {
                        editingId = null;
                      }
                    }}
                    onblur={commitRename} />
                {:else}
                  <span class="min-w-0 truncate" title={name}>{name}</span>
                  <button
                    type="button"
                    class="shrink-0 opacity-50 hover:opacity-100"
                    title="Rename"
                    onclick={() => {
                      editingId = id;
                      editValue = name ?? '';
                    }}>
                    <EditIcon class="size-3.5" />
                  </button>
                {/if}
              </div>
              <span class="text-xs whitespace-nowrap text-primary-foreground/30">
                {new Date(time).toLocaleString()}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-sm whitespace-nowrap text-primary-foreground/50">
                {dayjs(time).fromNow()}
              </span>
              <Button
                href={openUrl}
                target="_blank"
                rel="noopener"
                size="icon"
                variant="ghost"
                title="Open in new tab">
                <OpenInNewIcon />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Restore this version"
                onclick={() => restoreHistoryItem(state)}>
                <UndoIcon />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="hover:text-destructive"
                title="Delete this version"
                onclick={() => removeEntry(id)}>
                <TrashAltIcon />
              </Button>
            </div>
          </div>
          <Separator />
        </li>
      {/each}
    {:else}
      <div class="m-2 text-center whitespace-pre-line">
        No timeline snapshots yet. The Timeline is saved automatically every minute.
      </div>
    {/if}
  </ul>
</Card>
