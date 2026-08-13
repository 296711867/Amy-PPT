import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@renderer/lib/utils'

export const ToggleGroup = ToggleGroupPrimitive.Root

export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors',
      'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-45',
      'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-[0_5px_12px_rgb(var(--ui-shadow-color)/0.18)]',
      'data-[state=off]:hover:bg-accent',
      className
    )}
    {...props}
  />
))
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName
