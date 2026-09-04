<script lang="ts">
  import * as Dialog from '$/components/ui/dialog';
  import { env } from '$/util/env';
  import ShieldIcon from '~icons/material-symbols/shield-lock-outline-rounded';
</script>

{#if env.privacyPolicyUrl}
  <a href={env.privacyPolicyUrl} target="_blank">
    <ShieldIcon />
  </a>
{:else}
  <Dialog.Root>
    <Dialog.Trigger>
      <ShieldIcon />
    </Dialog.Trigger>
    <Dialog.Content class="max-h-full overflow-hidden overflow-y-auto p-12">
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-2 text-xl">
          <ShieldIcon class="size-8 text-green-700" />
          Data security
        </Dialog.Title>
      </Dialog.Header>

      <div class="space-y-4 text-sm text-foreground/90">
        <p class="text-base font-semibold text-foreground">
          Self-Hosted Mermaid Live Editor with Persistent Storage
        </p>
        <p>
          Your diagram data is saved locally to your self-hosted instance and stored in your SQLite
          database. Unlike public cloud services, your diagrams and private data never leave your
          infrastructure.
        </p>
        <p>
          All editing, rendering, and persistence operations are performed entirely within your
          self-hosted deployment. No third-party trackers or external cloud services are enabled.
        </p>
        <p>
          This is an open source project based on Mermaid Live Editor with full-stack persistent
          storage capabilities. Source code and updates are available on
          <a
            href="https://github.com/GeekSquirrel/mermaid-vault"
            class="text-accent underline"
            target="_blank"
            rel="noopener noreferrer">GitHub</a
          >.
        </p>
      </div>
    </Dialog.Content>
  </Dialog.Root>
{/if}
