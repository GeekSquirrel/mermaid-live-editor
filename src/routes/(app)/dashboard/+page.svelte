<script lang="ts">
  import Navbar from '$/components/Navbar.svelte';
  import ProjectCardPreview from '$/components/ProjectCardPreview.svelte';
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { Switch } from '$/components/ui/switch';
  import { api, type Project, type Workspace } from '$lib/services/api';
  import { mode, setMode } from 'mode-watcher';
  import { toast } from 'svelte-sonner';
  import { fade, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { SvelteMap } from 'svelte/reactivity';
  import { onMount, tick } from 'svelte';
  import AddIcon from '~icons/material-symbols/add-2-rounded';
  import CheckBoxBlankIcon from '~icons/material-symbols/check-box-outline-blank-rounded';
  import CheckBoxIcon from '~icons/material-symbols/check-box-outline-rounded';
  import CheckIcon from '~icons/material-symbols/check-rounded';
  import CloseIcon from '~icons/material-symbols/close-rounded';
  import ChecklistIcon from '~icons/material-symbols/checklist-rounded';
  import ContrastIcon from '~icons/material-symbols/contrast';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';
  import OpenIcon from '~icons/material-symbols/open-in-new-rounded';
  import PencilIcon from '~icons/material-symbols/edit-outline-rounded';
  import PanelCloseIcon from '~icons/material-symbols/left-panel-close-outline-rounded';
  import PanelOpenIcon from '~icons/material-symbols/left-panel-open-outline-rounded';
  import RefreshIcon from '~icons/material-symbols/refresh-rounded';
  import SearchIcon from '~icons/material-symbols/search-rounded';

  const SIDEBAR_KEY = 'projects.sidebarOpen';
  const WORKSPACE_KEY = 'projects.currentWorkspaceId';

  let projects = $state<Project[]>([]);
  let workspaces = $state<Workspace[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let currentWorkspaceId = $state('');
  let sidebarOpen = $state(true);
  let selectMode = $state(false);
  let selectedIds = $state<string[]>([]);
  let searchInputEl = $state<HTMLInputElement | null>(null);

  // Inline workspace creation: the long plus button swaps places with an input
  let creatingWorkspace = $state(false);
  let newWorkspaceName = $state('');
  let createInputEl = $state<HTMLInputElement | null>(null);

  // Inline workspace rename: the list item swaps its name for an input
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let renameInputEl = $state<HTMLInputElement | null>(null);

  // Inline delete confirmation: the row / card itself shows the overlay
  let pendingDeleteWorkspaceId = $state<string | null>(null);
  let pendingDeleteProjectId = $state<string | null>(null);

  // Styled confirmation dialog (multi-select batch delete)
  let confirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmDescription = $state('');
  let confirmAction: (() => Promise<void>) | null = null;

  const requestConfirm = (title: string, description: string, action: () => Promise<void>) => {
    confirmTitle = title;
    confirmDescription = description;
    confirmAction = action;
    confirmOpen = true;
  };

  const runConfirmedAction = async () => {
    confirmOpen = false;
    const action = confirmAction;
    confirmAction = null;
    if (action) {
      await action();
    }
  };

  const loadProjects = async () => {
    loading = true;
    error = null;
    try {
      projects = await api.getProjects();
      selectedIds = [];
      selectMode = false;
    } catch (err) {
      console.error('Failed to load projects:', err);
      error = err instanceof Error ? err.message : 'Unable to connect to backend server';
    } finally {
      loading = false;
    }
  };

  const loadWorkspaces = async () => {
    try {
      // Newest first; the built-in Default workspace (oldest) sinks to the bottom
      const list = (await api.getWorkspaces()).sort((a, b) => b.created_at - a.created_at);
      workspaces = list;
      if (!list.some((w) => w.id === currentWorkspaceId)) {
        currentWorkspaceId = list[0]?.id ?? '';
      }
      return list;
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      return [];
    }
  };

  onMount(() => {
    const storedSidebar = localStorage.getItem(SIDEBAR_KEY);
    if (storedSidebar !== null) {
      sidebarOpen = storedSidebar === 'true';
    }
    const storedWorkspace = localStorage.getItem(WORKSPACE_KEY);
    if (storedWorkspace) {
      currentWorkspaceId = storedWorkspace;
    }
    void loadProjects();
    void loadWorkspaces().then((list) => {
      // Deep link from the editor breadcrumb: /dashboard?workspace=<id>
      const wsParam = new URLSearchParams(window.location.search).get('workspace');
      if (wsParam && list.some((w) => w.id === wsParam)) {
        switchWorkspace(wsParam);
      }
    });
  });

  const toggleSidebar = () => {
    sidebarOpen = !sidebarOpen;
    localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
  };

  const switchWorkspace = (id: string) => {
    currentWorkspaceId = id;
    localStorage.setItem(WORKSPACE_KEY, id);
    selectMode = false;
    selectedIds = [];
  };

  const startCreateWorkspace = () => {
    creatingWorkspace = true;
    newWorkspaceName = '';
    void tick().then(() => {
      createInputEl?.focus();
    });
  };

  const confirmCreateWorkspace = async () => {
    if (!creatingWorkspace) {
      return;
    }
    const name = newWorkspaceName.trim();
    creatingWorkspace = false;
    newWorkspaceName = '';
    if (!name) {
      return;
    }
    try {
      const workspace = await api.createWorkspace({ name });
      // The new workspace takes the first slot; existing entries shift down
      workspaces = [workspace, ...workspaces];
      switchWorkspace(workspace.id);
    } catch (err) {
      toast.error(
        `Failed to create workspace: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  const cancelCreateWorkspace = () => {
    creatingWorkspace = false;
    newWorkspaceName = '';
  };

  const handleCreateKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void confirmCreateWorkspace();
    } else if (e.key === 'Escape') {
      cancelCreateWorkspace();
    }
  };

  const startRenameWorkspace = (workspace: Workspace) => {
    renamingId = workspace.id;
    renameValue = workspace.name;
    void tick().then(() => {
      renameInputEl?.focus();
      renameInputEl?.select();
    });
  };

  const commitRenameWorkspace = async () => {
    const id = renamingId;
    if (!id) {
      return;
    }
    renamingId = null;
    const workspace = workspaces.find((w) => w.id === id);
    const name = renameValue.trim();
    renameValue = '';
    if (!workspace || !name || name === workspace.name) {
      return;
    }
    try {
      const updated = await api.updateWorkspace(id, { name });
      workspaces = workspaces.map((w) => (w.id === id ? updated : w));
    } catch (err) {
      toast.error(
        `Failed to rename workspace: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  const cancelRenameWorkspace = () => {
    renamingId = null;
    renameValue = '';
  };

  const handleRenameKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitRenameWorkspace();
    } else if (e.key === 'Escape') {
      cancelRenameWorkspace();
    }
  };

  const requestDeleteWorkspace = (workspace: Workspace) => {
    pendingDeleteWorkspaceId = workspace.id;
  };

  const cancelDeleteWorkspace = () => {
    pendingDeleteWorkspaceId = null;
  };

  const confirmDeleteWorkspace = async () => {
    const id = pendingDeleteWorkspaceId;
    if (!id) {
      return;
    }
    pendingDeleteWorkspaceId = null;
    try {
      await api.deleteWorkspace(id);
      const list = await loadWorkspaces();
      if (currentWorkspaceId === id) {
        switchWorkspace(list[0]?.id ?? '');
      }
    } catch (err) {
      toast.error(
        `Failed to delete workspace: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  const requestDeleteProject = (project: Project) => {
    pendingDeleteProjectId = project.id;
  };

  const cancelDeleteProject = () => {
    pendingDeleteProjectId = null;
  };

  const confirmDeleteProject = async () => {
    const id = pendingDeleteProjectId;
    if (!id) {
      return;
    }
    pendingDeleteProjectId = null;
    try {
      await api.deleteProject(id);
      projects = projects.filter((p) => p.id !== id);
      selectedIds = selectedIds.filter((selected) => selected !== id);
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const toggleSelectMode = () => {
    selectMode = !selectMode;
    selectedIds = [];
  };

  const toggleProjectSelection = (id: string) => {
    selectedIds = selectedIds.includes(id)
      ? selectedIds.filter((selected) => selected !== id)
      : [...selectedIds, id];
  };

  const handleBatchDelete = () => {
    const idsToDelete = [...selectedIds];
    if (idsToDelete.length === 0) {
      return;
    }
    requestConfirm(
      'Delete projects',
      `Are you sure you want to delete ${idsToDelete.length} selected project(s)? This action cannot be undone.`,
      async () => {
        const deletedIds: string[] = [];
        let failed = 0;
        for (const id of idsToDelete) {
          try {
            await api.deleteProject(id);
            deletedIds.push(id);
          } catch {
            failed++;
          }
        }
        projects = projects.filter((p) => !deletedIds.includes(p.id));
        selectedIds = selectedIds.filter((id) => !deletedIds.includes(id));
        if (failed > 0) {
          toast.error(
            `Failed to delete ${failed} of ${idsToDelete.length} project(s). Please try again.`
          );
        } else {
          toast.success(`Deleted ${deletedIds.length} project(s)`);
        }
      }
    );
  };

  const handleKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isTyping =
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (e.key === 'Escape' && selectMode) {
      selectMode = false;
      selectedIds = [];
    } else if (e.key === '/' && !isTyping) {
      e.preventDefault();
      searchInputEl?.focus();
    }
  };

  // The backend guarantees every project belongs to an existing workspace
  const workspaceProjects = $derived(projects.filter((p) => p.workspace_id === currentWorkspaceId));

  const filteredProjects = $derived(
    workspaceProjects.filter(
      (p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const projectCounts = $derived.by(() => {
    const counts = new SvelteMap<string, number>();
    for (const p of projects) {
      const id = p.workspace_id || '';
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  });

  const currentWorkspaceName = $derived(
    workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? ''
  );

  const allSelected = $derived(
    filteredProjects.length > 0 && filteredProjects.every((p) => selectedIds.includes(p.id))
  );

  const toggleSelectAll = () => {
    selectedIds = allSelected ? [] : filteredProjects.map((p) => p.id);
  };

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
</script>

{#snippet sidebarToggle()}
  <Button
    variant="ghost"
    size="sm"
    class="h-9 w-9 shrink-0 p-0"
    onclick={toggleSidebar}
    title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
    aria-label="Toggle sidebar">
    {#if sidebarOpen}
      <PanelCloseIcon class="size-5" />
    {:else}
      <PanelOpenIcon class="size-5" />
    {/if}
  </Button>
{/snippet}

{#snippet searchBox()}
  <div class="relative w-full max-w-lg">
    <SearchIcon
      class="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
    <input
      type="text"
      placeholder="Search projects..."
      bind:this={searchInputEl}
      bind:value={searchQuery}
      class="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm text-foreground shadow-xs transition-all placeholder:text-muted-foreground hover:border-primary/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none" />
  </div>
{/snippet}

{#snippet cardBody(project: Project, selected: boolean, isSelectMode: boolean)}
  {#if isSelectMode}
    <div
      class={[
        'absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded-md border transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background/80'
      ]}>
      {#if selected}
        <CheckBoxIcon class="size-4" />
      {/if}
    </div>
  {/if}

  <div class="flex shrink-0 items-start justify-between gap-2">
    <div class="min-w-0 flex-1">
      <h2
        class="truncate font-semibold text-card-foreground group-hover:text-primary"
        title={project.title || 'Untitled Project'}>
        {project.title || 'Untitled Project'}
      </h2>
      <p class="mt-0.5 text-xs text-muted-foreground">
        Updated {formatDate(project.updated_at)}
      </p>
    </div>
  </div>

  <div class="my-2 min-h-0 flex-1 sm:my-3">
    <ProjectCardPreview code={project.code} id={project.id} previewKind="project" />
  </div>

  {#if !isSelectMode}
    <div
      class="flex shrink-0 items-center justify-end gap-2 border-t border-border/50 pt-2.5 sm:pt-3">
      <Button
        variant="destructive"
        size="sm"
        class="h-7 px-2 text-xs sm:h-8"
        onclick={() => requestDeleteProject(project)}>
        <DeleteIcon class="mr-1 size-3.5" />
        Delete
      </Button>
      <Button
        variant="default"
        size="sm"
        class="h-7 gap-1 px-2.5 text-xs sm:h-8 sm:px-3"
        href={`/edit?projectId=${project.id}`}>
        <OpenIcon class="size-3.5" />
        Open Editor
      </Button>
    </div>
  {/if}
{/snippet}

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col overflow-hidden bg-background text-foreground">
  <Navbar leading={sidebarToggle} center={searchBox} />

  <div class="relative flex min-h-0 flex-1 overflow-hidden">
    {#if sidebarOpen}
      <!-- Mobile backdrop -->
      <button
        type="button"
        class="absolute inset-0 z-30 bg-black/40 md:hidden"
        aria-label="Close sidebar"
        onclick={toggleSidebar}></button>

      <aside
        transition:fade={{ duration: 120 }}
        class="absolute inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-border bg-card shadow-lg md:relative md:z-auto md:shadow-none">
        <div class="px-3 pt-3 pb-1">
          <h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Workspaces
          </h2>
        </div>

        <div class="relative h-9 px-2 pb-2">
          {#if creatingWorkspace}
            <input
              bind:this={createInputEl}
              bind:value={newWorkspaceName}
              type="text"
              placeholder="Workspace name"
              aria-label="New workspace name"
              class="absolute inset-0 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              transition:fade={{ duration: 130 }}
              onkeydown={handleCreateKeydown}
              onblur={() => void confirmCreateWorkspace()} />
          {:else}
            <button
              type="button"
              class="absolute inset-0 flex w-full items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              transition:fade={{ duration: 130 }}
              onclick={startCreateWorkspace}
              title="New workspace"
              aria-label="New workspace">
              <AddIcon class="size-4" />
            </button>
          {/if}
        </div>

        <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {#if workspaces.length === 0}
            <button
              type="button"
              transition:fade={{ duration: 150 }}
              class="flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-border px-3 py-4 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              onclick={startCreateWorkspace}>
              <span class="text-sm font-medium">No workspaces yet</span>
              <span class="text-xs">Click here to create one</span>
            </button>
          {/if}
          {#each workspaces as workspace (workspace.id)}
            <div
              animate:flip={{ duration: 200 }}
              in:slide={{ duration: 150 }}
              out:fade={{ duration: 120 }}
              class={[
                'group relative flex w-full items-center rounded-md transition-colors',
                workspace.id === currentWorkspaceId ? 'bg-accent/15' : 'hover:bg-muted'
              ]}>
              {#if renamingId === workspace.id}
                <input
                  bind:this={renameInputEl}
                  bind:value={renameValue}
                  type="text"
                  aria-label="Workspace name"
                  class="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  onkeydown={handleRenameKeydown}
                  onblur={() => void commitRenameWorkspace()} />
              {:else}
                <button
                  type="button"
                  class={[
                    'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    workspace.id === currentWorkspaceId
                      ? 'font-semibold text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  ]}
                  onclick={() => switchWorkspace(workspace.id)}>
                  <span class="truncate" title={workspace.name}>{workspace.name}</span>
                  <span
                    class="shrink-0 rounded-full bg-muted px-1.5 text-xs text-muted-foreground group-hover:invisible">
                    {projectCounts.get(workspace.id) || 0}
                  </span>
                </button>
                <div class="hidden shrink-0 items-center gap-0.5 pr-1.5 group-hover:flex">
                  <button
                    type="button"
                    class="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                    onclick={() => startRenameWorkspace(workspace)}
                    title="Rename workspace"
                    aria-label="Rename workspace">
                    <PencilIcon class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background/60 hover:text-destructive"
                    onclick={() => requestDeleteWorkspace(workspace)}
                    title="Delete workspace"
                    aria-label="Delete workspace">
                    <DeleteIcon class="size-3.5" />
                  </button>
                </div>
              {/if}

              {#if pendingDeleteWorkspaceId === workspace.id}
                <div
                  transition:fade={{ duration: 120 }}
                  class="absolute inset-0 z-10 flex items-center justify-between gap-1 rounded-md bg-background/95 pr-1 pl-2 shadow-sm">
                  <span class="truncate text-xs font-medium text-destructive">
                    Delete "{workspace.name}"?
                  </span>
                  <span class="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      class="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      onclick={() => void confirmDeleteWorkspace()}
                      title="Confirm delete"
                      aria-label="Confirm delete">
                      <CheckIcon class="size-4" />
                    </button>
                    <button
                      type="button"
                      class="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onclick={cancelDeleteWorkspace}
                      title="Cancel"
                      aria-label="Cancel delete">
                      <CloseIcon class="size-4" />
                    </button>
                  </span>
                </div>
              {/if}
            </div>
          {/each}
        </nav>

        <div class="flex items-center justify-between border-t border-border px-3 py-3">
          <span class="flex items-center gap-2 text-sm">
            <ContrastIcon class="size-5" />
            Dark Mode
          </span>
          <Switch
            checked={mode.current === 'dark'}
            onCheckedChange={(dark) => setMode(dark ? 'dark' : 'light')} />
        </div>
      </aside>
    {/if}

    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div class="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div class="flex min-w-0 items-center gap-2 sm:gap-3">
          <h1 class="truncate text-lg font-semibold">{currentWorkspaceName}</h1>
          <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              class="h-9 w-9 p-0"
              onclick={() => {
                void loadProjects();
                void loadWorkspaces();
              }}
              title="Refresh list">
              <RefreshIcon class="size-4" />
            </Button>

            <Button
              variant={selectMode ? 'secondary' : 'outline'}
              size="sm"
              class="h-9 w-9 p-0 {selectMode ? 'ring-1 ring-ring' : ''}"
              onclick={toggleSelectMode}
              title={selectMode ? 'Exit multi-select' : 'Multi-select'}>
              <ChecklistIcon class="size-4" />
            </Button>

            {#if selectMode}
              <Button
                variant={allSelected ? 'secondary' : 'outline'}
                size="sm"
                class="h-9 w-9 p-0"
                onclick={toggleSelectAll}
                disabled={filteredProjects.length === 0}
                title={allSelected ? 'Deselect all' : 'Select all'}>
                {#if allSelected}
                  <CheckBoxIcon class="size-4" />
                {:else}
                  <CheckBoxBlankIcon class="size-4" />
                {/if}
              </Button>
              {#if selectedIds.length > 0}
                <Button
                  variant="destructive"
                  size="sm"
                  class="h-9 gap-1 px-3"
                  onclick={handleBatchDelete}>
                  <DeleteIcon class="size-4" />
                  Delete ({selectedIds.length})
                </Button>
              {/if}
            {/if}
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          {#if !selectMode && workspaces.length > 0}
            <Button
              variant="accent"
              size="sm"
              class="h-9 gap-1 whitespace-nowrap"
              href={`/edit?workspaceId=${currentWorkspaceId}`}>
              <AddIcon class="size-4" />
              New Project
            </Button>
          {/if}
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
        {#if loading}
          <div class="flex h-64 items-center justify-center">
            <div class="flex flex-col items-center gap-2 text-muted-foreground">
              <div
                class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent">
              </div>
              <span class="text-sm">Loading projects...</span>
            </div>
          </div>
        {:else if error}
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p class="text-sm font-medium text-destructive">{error}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              Please make sure the backend server (http://localhost:8080) is running
            </p>
            <Button variant="outline" size="sm" class="mt-4" onclick={() => void loadProjects()}>
              Retry
            </Button>
          </div>
        {:else if workspaces.length === 0}
          <div
            class="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
            <p class="text-base font-medium">No workspaces yet.</p>
            <p class="mt-1 text-sm text-muted-foreground">
              Create a workspace to start organizing your projects.
            </p>
            <Button variant="accent" size="sm" class="mt-4 gap-1" onclick={startCreateWorkspace}>
              <AddIcon class="size-4" />
              New Workspace
            </Button>
          </div>
        {:else if filteredProjects.length === 0}
          <div
            class="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
            {#if searchQuery}
              <p class="text-muted-foreground">No projects found matching "{searchQuery}"</p>
              <Button variant="ghost" size="sm" class="mt-2" onclick={() => (searchQuery = '')}>
                Clear search
              </Button>
            {:else}
              <p class="text-base font-medium">No projects in this workspace yet.</p>
              <p class="mt-1 text-sm text-muted-foreground">
                Created projects will be automatically synchronized to SQLite database
              </p>
              <Button
                variant="accent"
                size="sm"
                href={`/edit?workspaceId=${currentWorkspaceId}`}
                class="mt-4 gap-1">
                <AddIcon class="size-4" />
                Create First Project
              </Button>
            {/if}
          </div>
        {:else}
          <div class="projects-grid">
            {#each filteredProjects as project (project.id)}
              {@const selected = selectedIds.includes(project.id)}
              {#if selectMode}
                <div
                  role="checkbox"
                  aria-checked={selected}
                  tabindex="0"
                  aria-label={project.title || 'Untitled Project'}
                  class={[
                    'group relative flex aspect-square w-full cursor-pointer flex-col justify-between rounded-lg border p-3.5 transition-all sm:p-4',
                    selected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary'
                      : 'border-border bg-card hover:border-primary/50'
                  ]}
                  onclick={() => toggleProjectSelection(project.id)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleProjectSelection(project.id);
                    }
                  }}>
                  {@render cardBody(project, selected, true)}
                </div>
              {:else}
                <div
                  class="group relative flex aspect-square w-full flex-col justify-between rounded-lg border border-border bg-card p-3.5 transition-all hover:border-primary/50 hover:shadow-md sm:p-4">
                  {@render cardBody(project, selected, false)}

                  {#if pendingDeleteProjectId === project.id}
                    <div
                      transition:fade={{ duration: 120 }}
                      class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-background/92 p-4 text-center backdrop-blur-[2px]">
                      <DeleteIcon class="size-6 text-destructive" />
                      <p class="text-sm font-semibold text-foreground">Delete this project?</p>
                      <p class="text-xs text-muted-foreground">
                        "{project.title || 'Untitled Project'}" will be permanently removed. This
                        action cannot be undone.
                      </p>
                      <div class="mt-2 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          class="h-7 text-xs"
                          onclick={cancelDeleteProject}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          class="h-7 gap-1 text-xs"
                          onclick={() => void confirmDeleteProject()}>
                          <DeleteIcon class="size-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </main>
  </div>
</div>

<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{confirmTitle}</Dialog.Title>
      <Dialog.Description>{confirmDescription}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (confirmOpen = false)}>Cancel</Button>
      <Button variant="destructive" onclick={() => void runConfirmedAction()}>Delete</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .projects-grid {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .projects-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5rem;
    }
  }

  @media (min-width: 1024px) {
    .projects-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 1280px) and (orientation: landscape) {
    .projects-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (min-width: 1536px) and (orientation: landscape) {
    .projects-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  @media (min-width: 900px) and (orientation: portrait) {
    .projects-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
