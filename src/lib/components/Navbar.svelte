<script lang="ts" module>
  import { logEvent } from '$lib/util/stats';
  import { version } from 'mermaid/package.json';

  void logEvent('version', {
    mermaidVersion: version
  });
</script>

<script lang="ts">
  import MainMenu from '$/components/MainMenu.svelte';
  import ProjectBreadcrumb from '$/components/ProjectBreadcrumb.svelte';
  import { Button } from '$/components/ui/button';
  import type { Snippet } from 'svelte';
  import GithubIcon from '~icons/mdi/github';

  interface Props {
    mobileToggle?: Snippet;
    children?: Snippet;
  }

  let { children, mobileToggle }: Props = $props();
</script>

<nav class="z-50 flex items-center justify-between p-4 sm:p-6">
  <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
    <MainMenu />
    <ProjectBreadcrumb />
  </div>
  <div
    id="menu"
    class="hidden flex-nowrap items-center justify-between gap-3 overflow-visible md:flex">
    {@render children?.()}
    <Button
      variant="ghost"
      size="sm"
      href="https://github.com/GeekSquirrel/mermaid-editor"
      target="_blank"
      rel="noopener noreferrer"
      title="GitHub Repository"
      aria-label="GitHub Repository">
      <GithubIcon class="size-4" />
    </Button>
  </div>
  <div class="flex items-center gap-2 md:hidden">
    {@render mobileToggle?.()}
    <Button
      variant="ghost"
      size="sm"
      href="https://github.com/GeekSquirrel/mermaid-editor"
      target="_blank"
      rel="noopener noreferrer"
      title="GitHub Repository"
      aria-label="GitHub Repository">
      <GithubIcon class="size-4" />
    </Button>
  </div>
</nav>
