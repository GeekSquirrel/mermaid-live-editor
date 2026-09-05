<script lang="ts">
  import { Button } from '$/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
  } from '$/components/ui/dropdown-menu';
  import { api, type Diagram, type Workspace } from '$lib/services/api';
  import { sha256Hex } from '$lib/util/hash';
  import { tick } from 'svelte';
  import { fade } from 'svelte/transition';
  import CopyIcon from '~icons/material-symbols/content-copy-outline-rounded';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';
  import DownloadIcon from '~icons/material-symbols/download-rounded';
  import MoveIcon from '~icons/material-symbols/drive-file-move-outline-rounded';
  import MoreIcon from '~icons/material-symbols/more-vert-rounded';
  import OpenIcon from '~icons/material-symbols/open-in-new-rounded';
  import CheckIcon from '~icons/material-symbols/check-rounded';
  import DiagramCardPreview from '$/components/DiagramCardPreview.svelte';

  interface Props {
    diagram: Diagram;
    workspaces: Workspace[];
    selectMode?: boolean;
    selected?: boolean;
    /** Persists the new title; parent updates its list with the result */
    onrename?: (diagram: Diagram, title: string) => Promise<void>;
    /** Creates the copy; parent inserts it into its list and returns it */
    onduplicate?: (diagram: Diagram) => Promise<Diagram | undefined>;
    /** Persists the workspace change; parent updates its list */
    onmove?: (diagram: Diagram, workspaceId: string) => Promise<void>;
    /** Deletes after the in-card confirmation overlay; parent updates its list */
    ondelete?: (diagram: Diagram) => Promise<void>;
    ontoggleselect?: (id: string) => void;
  }

  let {
    diagram,
    workspaces,
    selectMode = false,
    selected = false,
    onrename,
    onduplicate,
    onmove,
    ondelete,
    ontoggleselect
  }: Props = $props();

  let isEditing = $state(false);
  let editTitle = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);
  let confirmingDelete = $state(false);

  const otherWorkspaces = $derived(workspaces.filter((w) => w.id !== diagram.workspace_id));

  const formatDate = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString(undefined, {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Title click-to-rename, mirroring the editor breadcrumb's diagram name
  // (DiagramBreadcrumb.svelte): select-all on entry, Enter/blur commits,
  // Escape reverts.
  const startEditing = () => {
    editTitle = diagram.title;
    isEditing = true;
    void tick().then(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  };

  const commitTitle = () => {
    if (!isEditing) return;
    isEditing = false;
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== diagram.title) {
      void onrename?.(diagram, trimmed);
    }
  };

  const handleEditKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      isEditing = false;
    }
  };

  // Copy the stored server-side previews (both themes) to the new diagram so
  // the duplicate renders instantly. The code is identical, so the original
  // hash stays valid. Fire-and-forget: when anything fails (no stored preview,
  // offline), DiagramCardPreview falls back to live rendering and backfills.
  const copyPreviews = async (copy: Diagram) => {
    const codeHash = await sha256Hex(diagram.code);
    if (!codeHash) return;
    for (const theme of ['light', 'dark'] as const) {
      try {
        const svg = await api.getDiagramPreview(diagram.id, theme);
        if (!svg) continue;
        await api.uploadDiagramPreview(copy.id, { theme, codeHash, svg });
      } catch {
        // Live rendering in the preview component covers this copy
      }
    }
  };

  const duplicate = async () => {
    const copy = await onduplicate?.(diagram);
    if (copy) {
      void copyPreviews(copy);
    }
  };

  const sanitizeFilename = (name: string) =>
    name
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim()
      .slice(0, 100) || 'Untitled Diagram';

  const downloadSource = () => {
    const blob = new Blob([diagram.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(diagram.title || 'Untitled Diagram')}.mmd`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    confirmingDelete = false;
    await ondelete?.(diagram);
  };

  const handleSelectKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ontoggleselect?.(diagram.id);
    }
  };
</script>

{#snippet cardInner()}
  <div class="flex shrink-0 items-start justify-between gap-2">
    <div class="min-w-0 flex-1">
      {#if isEditing}
        <input
          bind:this={inputEl}
          bind:value={editTitle}
          type="text"
          aria-label="Diagram name"
          placeholder="Untitled Diagram"
          class="h-7 w-full rounded-md border border-border bg-background px-2 py-0.5 font-semibold text-foreground shadow-xs transition-colors outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          onclick={(e) => e.stopPropagation()}
          onblur={commitTitle}
          onkeydown={handleEditKeydown} />
      {:else if selectMode}
        <h2
          class="truncate font-semibold text-card-foreground"
          title={diagram.title || 'Untitled Diagram'}>
          {diagram.title || 'Untitled Diagram'}
        </h2>
      {:else}
        <h2
          class="truncate font-semibold text-card-foreground group-hover:text-primary"
          title={diagram.title || 'Untitled Diagram'}>
          <button
            type="button"
            class="max-w-full cursor-text truncate rounded px-0.5 py-0.5 text-left transition-colors hover:text-accent"
            title="Click to rename diagram"
            onclick={startEditing}>
            {diagram.title || 'Untitled Diagram'}
          </button>
        </h2>
      {/if}
      <p class="mt-0.5 text-xs text-muted-foreground">
        Updated {formatDate(diagram.updated_at)}
      </p>
    </div>

    {#if !selectMode}
      <DropdownMenu>
        <DropdownMenuTrigger
          class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
          title="More actions"
          aria-label="More actions">
          <MoreIcon class="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <MoveIcon />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="max-h-64 overflow-y-auto">
              {#if otherWorkspaces.length === 0}
                <DropdownMenuItem disabled>No other workspaces</DropdownMenuItem>
              {:else}
                {#each otherWorkspaces as workspace (workspace.id)}
                  <DropdownMenuItem onSelect={() => void onmove?.(diagram, workspace.id)}>
                    <span class="truncate">{workspace.name}</span>
                    {#if workspace.id === diagram.workspace_id}
                      <CheckIcon class="ml-auto" />
                    {/if}
                  </DropdownMenuItem>
                {/each}
              {/if}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={downloadSource}>
            <DownloadIcon />
            Download .mmd
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => (confirmingDelete = true)}>
            <DeleteIcon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    {/if}
  </div>

  <div class="my-2 min-h-0 flex-1 sm:my-3">
    <DiagramCardPreview code={diagram.code} id={diagram.id} previewKind="diagram" />
  </div>

  {#if !selectMode}
    <div
      class="flex shrink-0 items-center justify-end gap-2 border-t border-border/50 pt-2.5 sm:pt-3">
      <Button
        variant="outline"
        size="sm"
        class="h-7 gap-1 px-2.5 text-xs sm:h-8 sm:px-3"
        onclick={() => void duplicate()}>
        <CopyIcon class="size-3.5" />
        Duplicate
      </Button>
      <Button
        variant="default"
        size="sm"
        class="h-7 gap-1 px-2.5 text-xs sm:h-8 sm:px-3"
        href={`/diagram?id=${diagram.id}`}>
        <OpenIcon class="size-3.5" />
        Open
      </Button>
    </div>
  {/if}
{/snippet}

{#if selectMode}
  <!-- Select mode: the whole card acts as a checkbox -->
  <div
    role="checkbox"
    aria-checked={selected}
    tabindex="0"
    aria-label={diagram.title || 'Untitled Diagram'}
    onclick={() => ontoggleselect?.(diagram.id)}
    onkeydown={handleSelectKeydown}
    class={[
      'relative flex aspect-square w-full cursor-pointer flex-col justify-between rounded-lg border p-3.5 transition-all sm:p-4',
      selected
        ? 'border-primary bg-primary/5 ring-2 ring-primary'
        : 'border-border bg-card hover:border-primary/50'
    ]}>
    <div
      class={[
        'absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded-md border transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background/80'
      ]}>
      {#if selected}
        <CheckIcon class="size-4" />
      {/if}
    </div>
    {@render cardInner()}
  </div>
{:else}
  <div
    class="group relative flex aspect-square w-full flex-col justify-between rounded-lg border border-border bg-card p-3.5 transition-all hover:border-primary/50 hover:shadow-md sm:p-4">
    {@render cardInner()}

    {#if confirmingDelete}
      <div
        transition:fade={{ duration: 120 }}
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-background/92 p-4 text-center backdrop-blur-[2px]">
        <DeleteIcon class="size-6 text-destructive" />
        <p class="text-sm font-semibold text-foreground">Delete this diagram?</p>
        <p class="text-xs text-muted-foreground">
          "{diagram.title || 'Untitled Diagram'}" will be permanently removed. This action cannot be
          undone.
        </p>
        <div class="mt-2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-7 text-xs"
            onclick={() => (confirmingDelete = false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="h-7 gap-1 text-xs"
            onclick={() => void confirmDelete()}>
            <DeleteIcon class="size-3.5" />
            Delete
          </Button>
        </div>
      </div>
    {/if}
  </div>
{/if}
