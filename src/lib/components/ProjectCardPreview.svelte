<script lang="ts">
  import { onMount } from 'svelte';
  import { render } from '$lib/util/mermaid';
  import type { MermaidConfig } from 'mermaid';
  import { mode } from 'mode-watcher';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import LoadingIcon from '~icons/material-symbols/sync-rounded';

  let { code, id }: { code: string; id: string } = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let svgContent = $state<string | null>(null);

  const injectSvg = (node: HTMLDivElement, content: string | null) => {
    if (content) {
      node.innerHTML = content;
    }
    return {
      update(nextContent: string | null) {
        if (nextContent) {
          node.innerHTML = nextContent;
        } else {
          node.innerHTML = '';
        }
      }
    };
  };

  const renderPreview = async () => {
    if (!code?.trim()) return;
    loading = true;
    error = null;
    try {
      const renderId =
        'preview-' +
        id.replace(/[^a-zA-Z0-9_-]/g, '') +
        '-' +
        Math.random().toString(36).substring(2, 7);
      const config: MermaidConfig = {
        securityLevel: 'loose',
        startOnLoad: false,
        theme: mode.current === 'dark' ? 'dark' : 'default'
      };
      const res = await render(config, code, renderId);
      svgContent = res.svg;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Syntax error';
      svgContent = null;
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    if (!containerEl) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      void renderPreview();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          void renderPreview();
        }
      },
      { rootMargin: '150px' }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  });
</script>

<div
  bind:this={containerEl}
  class="relative flex size-full items-center justify-center overflow-hidden rounded-md border border-border/40 bg-muted/20 p-2">
  {#if !code?.trim()}
    <span class="text-xs text-muted-foreground italic">(Empty diagram)</span>
  {:else if error}
    <div
      class="flex size-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded bg-destructive/10 p-3 text-center text-xs text-destructive">
      <ErrorIcon class="size-5 shrink-0" />
      <span class="font-semibold">Syntax error</span>
      <span class="line-clamp-3 font-mono text-[11px] text-destructive/80">
        {error}
      </span>
    </div>
  {:else if loading}
    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <LoadingIcon class="size-4 animate-spin" />
      <span>Rendering preview...</span>
    </div>
  {/if}

  <div
    use:injectSvg={svgContent}
    class={[
      'pointer-events-none flex size-full items-center justify-center overflow-hidden [&>svg]:h-auto [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:max-w-full [&>svg]:object-contain',
      !svgContent && 'hidden'
    ]}>
  </div>

  {#if !svgContent && !error && !loading && code?.trim()}
    <div class="size-full animate-pulse bg-muted/10"></div>
  {/if}
</div>
