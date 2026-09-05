<script lang="ts" module>
  import { logEvent } from '$lib/util/stats';
  import { version } from 'mermaid/package.json';

  void logEvent('version', {
    mermaidVersion: version
  });
</script>

<script lang="ts">
  import MainMenu from '$/components/MainMenu.svelte';
  import DiagramBreadcrumb from '$/components/DiagramBreadcrumb.svelte';
  import { Button } from '$/components/ui/button';
  import type { Snippet } from 'svelte';
  import GithubIcon from '~icons/mdi/github';

  interface Props {
    mobileToggle?: Snippet;
    children?: Snippet;
    /** Rendered between the leading button and the breadcrumb; defaults to the main menu popover. */
    leading?: Snippet;
    /** Rendered in the center of the navbar (e.g. the diagrams search input). */
    center?: Snippet;
  }

  let { children, mobileToggle, leading, center }: Props = $props();
</script>

<nav class="z-50 flex items-center justify-between gap-2 p-4 sm:p-6">
  <div class={['flex min-w-0 items-center gap-2 overflow-hidden', !center && 'flex-1']}>
    {#if leading}
      {@render leading()}
    {:else}
      <MainMenu />
    {/if}
    <DiagramBreadcrumb />
  </div>
  {#if center}
    <div class="flex min-w-0 flex-1 justify-center">
      {@render center()}
    </div>
  {/if}
  <div
    id="menu"
    class="hidden flex-nowrap items-center justify-between gap-3 overflow-visible md:flex">
    {@render children?.()}
    <Button
      variant="ghost"
      size="sm"
      href="https://github.com/GeekSquirrel/mermaid-vault"
      target="_blank"
      rel="noopener noreferrer"
      title="GitHub Repository"
      aria-label="GitHub Repository">
      <GithubIcon class="size-4" />
    </Button>
  </div>
  <div class="flex items-center gap-2 md:hidden">
    {@render mobileToggle?.()}
    {#if !mobileToggle}
      <Button
        variant="ghost"
        size="sm"
        href="https://github.com/GeekSquirrel/mermaid-vault"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub Repository"
        aria-label="GitHub Repository">
        <GithubIcon class="size-4" />
      </Button>
    {/if}
  </div>
</nav>
