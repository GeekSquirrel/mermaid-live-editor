<script lang="ts">
  import Card from '$lib/components/Card/Card.svelte';
  import type { HistoryEntry, State } from '$lib/types';
  import { notify, prompt } from '$lib/util/notify';
  import { serializeState } from '$lib/util/serde';
  import { inputState, replaceInputState } from '$lib/util/state.svelte';
  import { logEvent } from '$lib/util/stats';
  import dayjs from 'dayjs';
  import dayjsRelativeTime from 'dayjs/plugin/relativeTime';
  import BookmarkAddIcon from '~icons/material-symbols/bookmark-add-outline-rounded';
  import BookmarkIcon from '~icons/material-symbols/bookmark-outline-rounded';
  import TrashAltIcon from '~icons/material-symbols/delete-outline-rounded';
  import DownloadIcon from '~icons/material-symbols/download-rounded';
  import EditIcon from '~icons/material-symbols/edit-outline-rounded';
  import OpenInNewIcon from '~icons/material-symbols/open-in-new-rounded';
  import UndoIcon from '~icons/material-symbols/settings-backup-restore-rounded';
  import UploadIcon from '~icons/material-symbols/upload-rounded';
  import { onMount } from 'svelte';
  import { Button } from '../ui/button';
  import { Separator } from '../ui/separator';
  import {
    addManualEntry,
    clearActive,
    historyState,
    loadSavedEntries,
    removeEntry,
    renameEntry,
    restoreEntries,
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
    setMode('manual');
    void loadSavedEntries();
  });

  const downloadBookmarks = () => {
    const data = historyState.entries;
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mermaid-bookmarks-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logEvent('history', { action: 'download', type: 'manual' });
  };

  const uploadBookmarks = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async ({ target }: Event) => {
      const file = (target as HTMLInputElement)?.files?.[0];
      if (!file) {
        return;
      }
      const data: HistoryEntry[] = JSON.parse(await file.text());
      const { restored, invalid, duplicates } = restoreEntries(data);
      notify(`${restored} restored, ${duplicates} duplicate, ${invalid} invalid.`);
    });
    input.click();
  };

  const saveBookmark = () => {
    addManualEntry($state.snapshot(inputState));
  };

  const clearAll = async () => {
    if (await prompt('Are you sure you want to delete all bookmarks?')) {
      clearActive();
    }
  };

  const restoreHistoryItem = (state: State) => {
    replaceInputState(state);
    logEvent('history', { action: 'restore', type: 'manual' });
  };

  const entryUrl = (state: State): string =>
    `${window.location.origin}${window.location.pathname}#${serializeState(state)}`;

  const entriesWithUrl = $derived(
    historyState.entries.map((entry) => ({ ...entry, openUrl: entryUrl(entry.state) }))
  );
</script>

<Card
  isOpen
  isClosable={false}
  title="Bookmarks"
  icon={{ component: BookmarkIcon, class: 'size-4' }}>
  {#snippet actions()}
    <div class="flex items-center gap-2">
      <Button
        size="icon"
        variant="ghost"
        id="uploadHistory"
        onclick={uploadBookmarks}
        title="Upload bookmarks">
        <UploadIcon />
      </Button>
      {#if historyState.entries.length > 0}
        <Button
          id="downloadHistory"
          size="icon"
          variant="ghost"
          onclick={downloadBookmarks}
          title="Download bookmarks">
          <DownloadIcon />
        </Button>
      {/if}
      <Separator orientation="vertical" />
      <Button
        id="saveHistory"
        size="icon"
        variant="ghost"
        onclick={saveBookmark}
        title="Bookmark current state">
        <BookmarkAddIcon />
      </Button>
      <Button
        id="clearHistory"
        size="icon"
        variant="ghost"
        class="hover:text-destructive"
        onclick={clearAll}
        title="Delete all bookmarks">
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
        No bookmarks yet. Click the bookmark button to bookmark the current diagram and restore it
        later.
      </div>
    {/if}
  </ul>
</Card>
