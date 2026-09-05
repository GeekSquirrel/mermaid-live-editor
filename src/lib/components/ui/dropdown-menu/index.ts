import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
import Content from './dropdown-menu-content.svelte';
import Item from './dropdown-menu-item.svelte';
import Separator from './dropdown-menu-separator.svelte';
import SubContent from './dropdown-menu-sub-content.svelte';
import SubTrigger from './dropdown-menu-sub-trigger.svelte';

const Root = DropdownMenuPrimitive.Root;
const Trigger = DropdownMenuPrimitive.Trigger;
const Sub = DropdownMenuPrimitive.Sub;
const Group = DropdownMenuPrimitive.Group;

export {
  Root,
  Trigger,
  Content,
  Item,
  Separator,
  Sub,
  SubContent,
  SubTrigger,
  Group,
  //
  Root as DropdownMenu,
  Trigger as DropdownMenuTrigger,
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Separator as DropdownMenuSeparator,
  Sub as DropdownMenuSub,
  SubContent as DropdownMenuSubContent,
  SubTrigger as DropdownMenuSubTrigger,
  Group as DropdownMenuGroup
};
