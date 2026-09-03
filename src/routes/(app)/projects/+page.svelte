<script lang="ts">
  import { resolve } from '$app/paths';
  import Navbar from '$/components/Navbar.svelte';
  import { Button } from '$/components/ui/button';
  import { api, type Project } from '$lib/services/api';
  import { onMount } from 'svelte';
  import AddIcon from '~icons/material-symbols/add-2-rounded';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';
  import OpenIcon from '~icons/material-symbols/open-in-new-rounded';
  import SearchIcon from '~icons/material-symbols/search-rounded';
  import RefreshIcon from '~icons/material-symbols/refresh-rounded';

  let projects = $state<Project[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');

  const loadProjects = async () => {
    loading = true;
    error = null;
    try {
      projects = await api.getProjects();
    } catch (err) {
      console.error('Failed to load projects:', err);
      error = err instanceof Error ? err.message : 'Unable to connect to backend server';
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    void loadProjects();
  });

  const handleDelete = async (project: Project) => {
    if (
      !confirm(
        `Are you sure you want to delete "${project.title || 'Untitled Project'}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await api.deleteProject(project.id);
      projects = projects.filter((p) => p.id !== project.id);
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const filteredProjects = $derived(
    projects.filter(
      (p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

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

<div class="flex h-full flex-col overflow-hidden bg-background text-foreground">
  <Navbar>
    <a
      href={resolve('/edit', {})}
      class="inline-flex items-center gap-1 text-sm font-medium hover:text-accent">
      <AddIcon class="size-4" />
      New Project
    </a>
  </Navbar>

  <main class="mx-auto w-full max-w-7xl flex-1 overflow-y-auto p-4 sm:p-8">
    <div class="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">My Projects</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Manage your Mermaid diagrams and chart projects saved in cloud storage
        </p>
      </div>

      <div class="flex w-full items-center gap-3 sm:w-auto">
        <div class="relative flex-1 sm:w-64">
          <SearchIcon
            class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            bind:value={searchQuery}
            class="w-full rounded-md border border-input bg-background py-1.5 pr-3 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" />
        </div>

        <Button variant="outline" size="sm" onclick={loadProjects} title="Refresh list">
          <RefreshIcon class="size-4" />
        </Button>

        <Button variant="accent" size="sm" href="/edit" class="gap-1 whitespace-nowrap">
          <AddIcon class="size-4" />
          New Project
        </Button>
      </div>
    </div>

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
        <Button variant="outline" size="sm" class="mt-4" onclick={loadProjects}>Retry</Button>
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
          <p class="text-base font-medium">No projects yet. Click New Project to get started.</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Created projects will be automatically synchronized to SQLite database
          </p>
          <Button variant="accent" size="sm" href="/edit" class="mt-4 gap-1">
            <AddIcon class="size-4" />
            Create First Project
          </Button>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each filteredProjects as project (project.id)}
          <div
            class="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md">
            <div>
              <div class="flex items-start justify-between gap-2">
                <h2
                  class="line-clamp-1 font-semibold text-card-foreground group-hover:text-primary">
                  {project.title || 'Untitled Project'}
                </h2>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                Updated {formatDate(project.updated_at)}
              </p>

              <div
                class="mt-3 line-clamp-3 h-16 overflow-hidden rounded bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
                {project.code || '(Empty diagram)'}
              </div>
            </div>

            <div class="mt-4 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
              <Button
                variant="destructive"
                size="sm"
                class="h-8 px-2 text-xs"
                onclick={() => handleDelete(project)}>
                <DeleteIcon class="mr-1 size-3.5" />
                Delete
              </Button>
              <Button
                variant="default"
                size="sm"
                class="h-8 gap-1 px-3 text-xs"
                href={`/edit?projectId=${project.id}`}>
                <OpenIcon class="size-3.5" />
                Open Editor
              </Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>
