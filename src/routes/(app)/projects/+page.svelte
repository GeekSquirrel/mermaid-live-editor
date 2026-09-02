<script lang="ts">
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
      error = err instanceof Error ? err.message : '无法连接到后端服务器';
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    void loadProjects();
  });

  const handleDelete = async (project: Project) => {
    if (!confirm(`确定要删除项目 "${project.title}" 吗？此操作无法撤销。`)) {
      return;
    }
    try {
      await api.deleteProject(project.id);
      projects = projects.filter((p) => p.id !== project.id);
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const filteredProjects = $derived(
    projects.filter((p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const formatDate = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
</script>

<div class="flex h-full flex-col overflow-hidden bg-background text-foreground">
  <Navbar>
    <a
      href="/edit"
      class="inline-flex items-center gap-1 text-sm font-medium hover:text-accent">
      <AddIcon class="size-4" />
      新建项目
    </a>
  </Navbar>

  <main class="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl w-full mx-auto">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">我的项目</h1>
        <p class="text-sm text-muted-foreground mt-1">
          管理您保存在云端的 Mermaid 流程图与图表项目
        </p>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <div class="relative flex-1 sm:w-64">
          <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索项目标题..."
            bind:value={searchQuery}
            class="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>

        <Button variant="outline" size="sm" onclick={loadProjects} title="刷新列表">
          <RefreshIcon class="size-4" />
        </Button>

        <Button variant="accent" size="sm" href="/edit" class="gap-1 whitespace-nowrap">
          <AddIcon class="size-4" />
          新建项目
        </Button>
      </div>
    </div>

    {#if loading}
      <div class="flex h-64 items-center justify-center">
        <div class="flex flex-col items-center gap-2 text-muted-foreground">
          <div class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <span class="text-sm">加载项目列表中...</span>
        </div>
      </div>
    {:else if error}
      <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p class="text-sm font-medium text-destructive">{error}</p>
        <p class="text-xs text-muted-foreground mt-1">请确认后端服务 (http://localhost:8080) 已正常启动</p>
        <Button variant="outline" size="sm" class="mt-4" onclick={loadProjects}>
          重试
        </Button>
      </div>
    {:else if filteredProjects.length === 0}
      <div class="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
        {#if searchQuery}
          <p class="text-muted-foreground">没有找到匹配 "{searchQuery}" 的项目</p>
          <Button variant="ghost" size="sm" class="mt-2" onclick={() => (searchQuery = '')}>
            清除搜索
          </Button>
        {:else}
          <p class="text-base font-medium">暂无项目，点击新建项目开始创作</p>
          <p class="text-sm text-muted-foreground mt-1">创建的项目将自动同步并保存至云端 SQLite 数据库</p>
          <Button variant="accent" size="sm" href="/edit" class="mt-4 gap-1">
            <AddIcon class="size-4" />
            新建第一个项目
          </Button>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each filteredProjects as project (project.id)}
          <div class="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/50">
            <div>
              <div class="flex items-start justify-between gap-2">
                <h2 class="font-semibold text-card-foreground line-clamp-1 group-hover:text-primary">
                  {project.title || '未命名项目'}
                </h2>
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                更新于 {formatDate(project.updated_at)}
              </p>

              <div class="mt-3 rounded bg-muted/50 p-2 font-mono text-xs text-muted-foreground line-clamp-3 overflow-hidden h-16">
                {project.code || '（空代码）'}
              </div>
            </div>

            <div class="mt-4 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
              <Button
                variant="destructive"
                size="sm"
                class="h-8 px-2 text-xs"
                onclick={() => handleDelete(project)}>
                <DeleteIcon class="size-3.5 mr-1" />
                删除
              </Button>
              <Button
                variant="default"
                size="sm"
                class="h-8 px-3 text-xs gap-1"
                href={`/edit?projectId=${project.id}`}>
                <OpenIcon class="size-3.5" />
                打开编辑
              </Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>
