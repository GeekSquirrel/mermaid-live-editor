<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type PreviewTheme } from '$lib/services/api';
  import { sha256Hex } from '$lib/util/hash';
  import { render } from '$lib/util/mermaid';
  import type { MermaidConfig } from 'mermaid';
  import { mode } from 'mode-watcher';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import LoadingIcon from '~icons/material-symbols/sync-rounded';

  let {
    code,
    id,
    previewKind
  }: { code: string; id: string; previewKind?: 'diagram' | 'bookmark' } = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let svgContent = $state<string | null>(null);

  let visible = false;
  let generation = 0;

  const themeOf = (): PreviewTheme => (mode.current === 'dark' ? 'dark' : 'light');

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

  /**
   * Load the preview for the current theme: stored server-side SVG first,
   * then fall back to live client rendering and backfill the server preview.
   * A generation counter discards results from superseded runs (theme flips,
   * re-entries) so stale async results never overwrite newer ones.
   */
  const loadFlow = async () => {
    const gen = ++generation;
    if (!code?.trim()) {
      error = null;
      loading = false;
      svgContent = null;
      return;
    }
    loading = true;
    error = null;

    const theme = themeOf();

    if (previewKind) {
      try {
        const stored =
          previewKind === 'diagram'
            ? await api.getDiagramPreview(id, theme)
            : await api.getBookmarkPreview(id, theme);
        if (gen !== generation) return;
        if (stored) {
          svgContent = stored;
          loading = false;
          return;
        }
      } catch {
        // Server preview unavailable — fall through to live rendering
      }
    }

    try {
      const renderId =
        'preview-' +
        id.replace(/[^a-zA-Z0-9_-]/g, '') +
        '-' +
        Math.random().toString(36).substring(2, 7);
      const config: MermaidConfig = {
        securityLevel: 'loose',
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default'
      };
      const res = await render(config, code, renderId);
      if (gen !== generation) return;
      svgContent = res.svg;
      loading = false;

      // Backfill the server preview for this theme so future visits skip
      // live rendering. Fire-and-forget; failures are silently ignored.
      if (previewKind) {
        const codeHash = await sha256Hex(code);
        if (gen === generation && codeHash) {
          const dto = { theme, codeHash, svg: res.svg };
          void (previewKind === 'diagram'
            ? api.uploadDiagramPreview(id, dto)
            : api.uploadBookmarkPreview(id, dto));
        }
      }
    } catch (err) {
      if (gen !== generation) return;
      error = err instanceof Error ? err.message : 'Syntax error';
      svgContent = null;
      loading = false;
    }
  };

  onMount(() => {
    if (!containerEl) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      visible = true;
      void loadFlow();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          visible = true;
          void loadFlow();
        }
      },
      { rootMargin: '150px' }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  });

  // Re-load when the color mode flips so previews match the active theme.
  $effect(() => {
    void mode.current;
    if (visible) {
      void loadFlow();
    }
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
