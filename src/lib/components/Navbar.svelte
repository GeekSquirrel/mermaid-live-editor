<script lang="ts" module>
  import { logEvent } from '$lib/util/stats';
  import { version } from 'mermaid/package.json';

  void logEvent('version', {
    mermaidVersion: version
  });
</script>

<script lang="ts">
  import { resolve } from '$app/paths';
  import MainMenu from '$/components/MainMenu.svelte';
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import type { Snippet } from 'svelte';
  import MermaidIcon from '~icons/custom/mermaid';
  import GithubIcon from '~icons/mdi/github';

  interface Props {
    mobileToggle?: Snippet;
    children: Snippet;
    hidePromotion?: boolean;
  }

  let { children, mobileToggle }: Props = $props();
</script>

<nav class="z-50 flex p-4 sm:p-6">
  <div class="flex flex-1 items-center gap-2">
    <MainMenu />
    <MermaidIcon class="size-6" />
    <a href={resolve('/', {})} class="whitespace-nowrap text-accent">
      {#if !mobileToggle}
        Mermaid
      {/if}
      Live Editor
    </a>
  </div>
  <div
    id="menu"
    class="hidden flex-nowrap items-center justify-between gap-3 overflow-hidden md:flex">
    <a
      href={resolve('/projects', {})}
      class="flex items-center gap-1 text-sm font-medium transition-colors hover:text-accent">
      Projects
    </a>
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
    <Separator orientation="vertical" />
    {@render children()}
  </div>
  {@render mobileToggle?.()}
</nav>
