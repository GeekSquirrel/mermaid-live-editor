<script lang="ts">
  import FloatingToolbar from '$/components/FloatingToolbar.svelte';
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import type { PanZoomState } from '$/util/panZoom';
  import ExpandIcon from '~icons/material-symbols/open-in-full-rounded';
  import ArrowsToCircleIcon from '~icons/material-symbols/screenshot-frame-2';
  import MagnifyingGlassPlusIcon from '~icons/material-symbols/zoom-in';
  import MagnifyingGlassMinusIcon from '~icons/material-symbols/zoom-out';
  import SaveIcon from '~icons/material-symbols/save-outline-rounded';
  import BookmarkAddIcon from '~icons/material-symbols/bookmark-add-outline-rounded';

  let {
    /** Embed/narrow frames: keep zoom buttons visible below the `sm` breakpoint. */
    compact = false,
    fullScreenHref,
    panZoomState,
    onSave,
    onBookmark
  }: {
    compact?: boolean;
    /** When set, shows a "Full Screen" button linking here. Omit for store-free embeds. */
    fullScreenHref?: string;
    panZoomState: PanZoomState;
    onSave?: () => void;
    onBookmark?: () => void;
  } = $props();

  const zoomClass = $derived(compact ? undefined : 'hidden sm:block');
</script>

<FloatingToolbar>
  <Button variant="ghost" size="icon" title="Reset view" onclick={() => panZoomState.reset()}>
    <ArrowsToCircleIcon />
  </Button>
  <Separator orientation="vertical" />
  <Button
    variant="ghost"
    size="icon"
    class={zoomClass}
    title="Zoom out"
    onclick={() => panZoomState.zoomOut()}>
    <MagnifyingGlassMinusIcon />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    class={zoomClass}
    title="Zoom in"
    onclick={() => panZoomState.zoomIn()}>
    <MagnifyingGlassPlusIcon />
  </Button>
  {#if fullScreenHref}
    <Separator orientation="vertical" class={zoomClass} />
    <Button variant="ghost" size="icon" title="Full Screen" href={fullScreenHref} target="_blank">
      <ExpandIcon />
    </Button>
  {/if}
  {#if onSave || onBookmark}
    <Separator orientation="vertical" />
    {#if onSave}
      <Button variant="ghost" size="icon" title="Save diagram" onclick={onSave}>
        <SaveIcon class="size-4" />
      </Button>
    {/if}
    {#if onBookmark}
      <Button variant="ghost" size="icon" title="Bookmark diagram state" onclick={onBookmark}>
        <BookmarkAddIcon class="size-4" />
      </Button>
    {/if}
  {/if}
</FloatingToolbar>
