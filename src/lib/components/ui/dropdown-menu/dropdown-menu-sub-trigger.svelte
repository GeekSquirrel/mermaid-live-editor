<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import ChevronRightIcon from '~icons/material-symbols/chevron-right-rounded';

  let {
    ref = $bindable(null),
    class: className,
    inset = false,
    children,
    ...restProps
  }: DropdownMenuPrimitive.SubTriggerProps & {
    inset?: boolean;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<DropdownMenuPrimitive.SubTrigger
  bind:ref
  class={cn(
    'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-current',
    inset && 'pl-8',
    className
  )}
  {...restProps}>
  {@render children?.()}
  <ChevronRightIcon class="ml-auto" />
</DropdownMenuPrimitive.SubTrigger>
