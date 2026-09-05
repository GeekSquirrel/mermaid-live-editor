<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

  let {
    ref = $bindable(null),
    class: className,
    inset = false,
    destructive = false,
    ...restProps
  }: DropdownMenuPrimitive.ItemProps & {
    inset?: boolean;
    destructive?: boolean;
  } = $props();
</script>

<DropdownMenuPrimitive.Item
  bind:ref
  class={cn(
    'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-current',
    inset && 'pl-8',
    destructive &&
      'text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive',
    className
  )}
  {...restProps} />
