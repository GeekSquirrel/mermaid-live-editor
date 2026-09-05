<script lang="ts">
  import { buttonVariants } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { Separator } from '$/components/ui/separator';
  import { Switch } from '$/components/ui/switch';
  import * as ToggleGroup from '$/components/ui/toggle-group';
  import Card from '$/components/Card/Card.svelte';
  import CopyButton from '$/components/CopyButton.svelte';
  import CopyInput from '$/components/CopyInput.svelte';
  import { MERMAID_LOOKS, MERMAID_THEMES, TID } from '$/constants';
  import { isDarkTheme, type EmbedMode } from '$/util/embed';
  import { EMBED_IFRAME_SANDBOX, buildEmbedSnippets, buildEmbedUrls } from '$/util/embedCode';
  import {
    imageSize,
    isClipboardAvailable,
    onCopyClipboard,
    onDownloadPNG,
    onDownloadSVG
  } from '$/util/exportImage.svelte';
  import { silentlySanitizeConfig } from '$/util/sanitize';
  import { urls, validatedState } from '$/util/state.svelte';
  import { copyToClipboard } from '$/util/util';
  import { asset, base } from '$app/paths';
  import { logEvent } from '$lib/util/stats';
  import CodeIcon from '~icons/material-symbols/code';
  import CloseIcon from '~icons/material-symbols/close';
  import DownloadIcon from '~icons/material-symbols/download';
  import ExternalLinkIcon from '~icons/material-symbols/open-in-new-rounded';
  import ShareIcon from '~icons/material-symbols/share';
  import WidthIcon from '~icons/material-symbols/width-rounded';
  import { Button } from './ui/button';

  interface Props {
    /** Provided on mobile, where the panel needs an explicit close affordance. */
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  // ---------------------------------------------------------------------------
  // Export (previously the Actions card)
  // ---------------------------------------------------------------------------

  let gistURL = $state('');
  $effect(() => {
    const { loader } = validatedState.current;
    if (loader?.type === 'gist') {
      gistURL = loader.config.url;
    }
  });

  const loadGist = () => {
    if (!gistURL) {
      return alert('Please enter a Gist URL first');
    }
    window.location.href = `${window.location.pathname}?gist=${gistURL}`;
    logEvent('loadGist');
  };

  const isNetlify = window.location.host.includes('netlify');

  // ---------------------------------------------------------------------------
  // Embed (previously the Share dialog)
  // ---------------------------------------------------------------------------

  const sanitizedConfig = $derived(silentlySanitizeConfig(validatedState.current.mermaid));
  // Deliberate initial-value capture: the embed form seeds from the config at
  // mount time and then owns its values.
  // svelte-ignore state_referenced_locally
  const initialConfig = sanitizedConfig;
  const initialTheme = (initialConfig.theme as string | undefined) ?? 'default';
  let theme = $state(initialTheme);
  let look = $state((initialConfig.look as string | undefined) ?? 'classic');
  let mode = $state<EmbedMode>(isDarkTheme(initialTheme) ? 'dark' : 'light');
  let controls = $state(true);
  let grid = $state(true);
  let width = $state('100%');
  let height = $state('480');
  let format = $state<'iframe' | 'webComponent'>('iframe');
  let showPreview = $state(false);

  // The expensive half (config sanitize + pako serialize) is independent of
  // width/height, so typing in the size inputs only re-runs the snippet strings.
  const embedUrls = $derived(
    buildEmbedUrls({
      code: validatedState.current.code,
      config: sanitizedConfig,
      controls,
      grid,
      host: window.location.origin + base,
      look,
      mode,
      theme
    })
  );
  const snippets = $derived(buildEmbedSnippets(embedUrls, { height, width }));
  const snippet = $derived(format === 'webComponent' ? snippets.webComponent : snippets.iframe);
</script>

<Card isOpen isClosable={false} title="Share" icon={{ component: ShareIcon, class: 'size-4' }}>
  {#snippet actions()}
    {#if onClose}
      <Button size="icon" variant="ghost" onclick={onClose} title="Close share panel">
        <CloseIcon />
      </Button>
    {/if}
  {/snippet}
  <div class="h-full overflow-y-auto p-2">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <h2 class="flex items-center gap-2">
          <img class="size-5" src={asset('/favicon.svg')} alt="Mermaid Live Editor" />
          Mermaid Live Editor
        </h2>
        <CopyInput value={window.location.href} />
        <p class="text-sm text-muted-foreground">
          The content of the diagrams you create never leaves your browser.
        </p>
      </div>

      <Separator />

      <div class="flex flex-col gap-2">
        <h2 class="flex items-center gap-2">
          <ExternalLinkIcon class="size-5" />
          View-only link
        </h2>
        <CopyInput value={urls.current.view} />
        <p class="text-sm text-muted-foreground">
          Opens the current diagram on this server without editing controls.
        </p>
      </div>

      <Separator />

      <div class="flex flex-col gap-2">
        <h2>Export</h2>
        <div class="flex w-full flex-wrap items-center gap-2 whitespace-nowrap">
          PNG size
          <ToggleGroup.Root type="single" variant="outline" bind:value={imageSize.mode}>
            <ToggleGroup.Item value="auto">Auto</ToggleGroup.Item>
            <ToggleGroup.Item value="width">Width</ToggleGroup.Item>
            <ToggleGroup.Item value="height">Height</ToggleGroup.Item>
          </ToggleGroup.Root>
          {#if imageSize.mode !== 'auto'}
            <WidthIcon
              class={[
                'size-6 shrink-0 transition-all',
                imageSize.mode === 'width' && 'rotate-90'
              ]} />
          {/if}
          <Input
            type="number"
            min="3"
            max="10000"
            disabled={imageSize.mode === 'auto'}
            bind:value={imageSize.size} />
        </div>
        <div class="flex flex-wrap gap-2">
          <div class="flex min-w-40 flex-grow gap-0.5">
            <Button class="flex-grow" onclick={onDownloadPNG} data-testid="download-PNG">
              <DownloadIcon />
              PNG
            </Button>
          </div>
          <div class="flex min-w-40 flex-grow gap-0.5">
            <Button class="flex-grow" onclick={() => onDownloadSVG()} data-testid="download-SVG">
              <DownloadIcon />
              SVG
            </Button>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <a
            class={buttonVariants({ variant: 'outline', class: 'flex-grow gap-2' })}
            target="_blank"
            rel="noreferrer"
            href={urls.current.png}>
            <ExternalLinkIcon /> Open PNG
          </a>
          <a
            class={buttonVariants({ variant: 'outline', class: 'flex-grow gap-2' })}
            target="_blank"
            rel="noreferrer"
            href={urls.current.svg}>
            <ExternalLinkIcon /> Open SVG
          </a>
        </div>
        <Separator />
        {#if isClipboardAvailable()}
          <CopyButton onclick={onCopyClipboard} label="Copy Image" />
        {/if}
        <CopyInput value={urls.current.mdCode} label="Copy Markdown" testID={TID.copyMarkdown} />
        <p class="text-xs text-muted-foreground">Markdown thumbnail generated by this server.</p>
        <div class="flex w-full items-center gap-2">
          <Input type="url" bind:value={gistURL} placeholder="Enter Gist URL" />
          <Button onclick={loadGist}>Load Gist</Button>
        </div>
        {#if isNetlify}
          <div class="flex w-full items-center justify-center">
            <a class="link text-sm text-gray-500 underline" href="https://netlify.com">
              This site is powered by Netlify
            </a>
          </div>
        {/if}
      </div>

      <Separator />

      <div class="flex flex-col gap-3">
        <h2 class="flex items-center gap-2">
          <CodeIcon class="size-5" />
          Embed
        </h2>
        <p class="text-sm text-muted-foreground">
          Embed a live, interactive diagram in your own website or blog.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-sm">
            Theme
            <select
              bind:value={theme}
              class="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
              {#each MERMAID_THEMES as themeName (themeName)}
                <option value={themeName}>{themeName}</option>
              {/each}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Look
            <select
              bind:value={look}
              class="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
              {#each MERMAID_LOOKS as lookName (lookName)}
                <option value={lookName}>{lookName}</option>
              {/each}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Width
            <Input bind:value={width} />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Height
            <Input bind:value={height} />
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <ToggleGroup.Root
            type="single"
            variant="outline"
            value={mode}
            onValueChange={(value) => {
              if (value === 'light' || value === 'dark') {
                mode = value;
              }
            }}>
            <ToggleGroup.Item value="light">Light</ToggleGroup.Item>
            <ToggleGroup.Item value="dark">Dark</ToggleGroup.Item>
          </ToggleGroup.Root>
          <label class="flex items-center gap-2 text-sm">
            <Switch bind:checked={controls} />
            Controls
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Switch bind:checked={grid} />
            Grid
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Switch bind:checked={showPreview} />
            Preview
          </label>
        </div>
        {#if showPreview}
          <iframe
            data-testid={TID.embedPreview}
            src={embedUrls.url}
            title="Embed preview"
            class="h-52 w-full rounded-lg border"
            sandbox={EMBED_IFRAME_SANDBOX}></iframe>
        {/if}
        <div class="flex items-start gap-2">
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <ToggleGroup.Root
              type="single"
              variant="outline"
              value={format}
              onValueChange={(value) => {
                if (value === 'iframe' || value === 'webComponent') {
                  format = value;
                }
              }}>
              <ToggleGroup.Item value="iframe">iframe</ToggleGroup.Item>
              <ToggleGroup.Item value="webComponent">Web component</ToggleGroup.Item>
            </ToggleGroup.Root>
            <textarea
              data-testid={TID.embedSnippet}
              readonly
              rows="4"
              class="w-full rounded-md border border-input bg-background p-2 font-mono text-xs text-foreground"
              value={snippet}></textarea>
          </div>
          <CopyButton onclick={() => copyToClipboard(snippet)} />
        </div>
      </div>
    </div>
  </div>
</Card>
