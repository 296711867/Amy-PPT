import { cn } from '@renderer/lib/utils'
import React from 'react'

type ButtonGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical'
}

export function ButtonGroup({
  className,
  orientation = 'horizontal',
  ...props
}: ButtonGroupProps): React.JSX.Element {
  return (
    <div
      role="group"
      data-orientation={orientation}
      className={cn(
        'inline-flex w-fit items-stretch overflow-hidden rounded-lg border bg-background',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        className
      )}
      {...props}
    />
  )
}

type ButtonGroupSeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical'
}

export function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: ButtonGroupSeparatorProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      data-orientation={orientation}
      className={cn(
        orientation === 'vertical' ? 'my-1 w-px self-stretch' : 'mx-1 h-px self-stretch',
        'bg-border',
        className
      )}
      {...props}
    />
  )
}
