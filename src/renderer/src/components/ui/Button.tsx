import { cn } from '@renderer/lib/utils'
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium leading-none transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50 disabled:grayscale',
        '[&_svg]:shrink-0',
        'cursor-pointer',
        {
          'bg-[linear-gradient(135deg,var(--ui-action),var(--ui-action-hover))] text-primary-foreground shadow-[0_8px_20px_rgb(var(--ui-shadow-color)/0.18)] hover:brightness-105':
            variant === 'default',
          'bg-[linear-gradient(135deg,var(--ui-action-soft),var(--ui-selected))] text-foreground shadow-[0_8px_20px_rgb(var(--ui-shadow-color)/0.14)] hover:brightness-105':
            variant === 'secondary',
          'bg-[linear-gradient(135deg,var(--ui-danger),var(--ui-danger-hover))] text-destructive-foreground shadow-[0_8px_20px_rgb(var(--ui-shadow-color)/0.16)] hover:brightness-105':
            variant === 'destructive',
          'soft-btn text-foreground': variant === 'outline',
          'bg-transparent text-muted-foreground hover:bg-[var(--ui-hover)] hover:text-accent-foreground shadow-none':
            variant === 'ghost'
        },
        {
          'h-9 px-4 text-sm': size === 'sm',
          'h-11 px-5 text-sm': size === 'md',
          'h-12 px-7 text-base': size === 'lg'
        },
        className
      )}
      {...props}
    />
  )
}
