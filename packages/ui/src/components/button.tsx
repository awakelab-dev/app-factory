import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Botón base de la plataforma (patrón shadcn/ui: el componente vive en el repo).
 * Variantes según marca AWK-2026: cian vivo como CTA sobre fondos oscuros.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-awk-cyan-400 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-awk-cyan-500 text-awk-navy-900 hover:bg-awk-cyan-400',
        secondary: 'bg-awk-blue-600 text-awk-blue-50 hover:bg-awk-blue-500',
        outline:
          'border border-awk-cyan-500 text-awk-cyan-500 hover:bg-awk-cyan-500 hover:text-awk-navy-900',
        ghost: 'text-awk-blue-100 hover:bg-awk-blue-800'
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
