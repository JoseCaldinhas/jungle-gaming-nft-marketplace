// Componente Button no padrão de componentes locais shadcn/ui, estilizado com Tailwind.
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' }
export const Button = forwardRef<HTMLButtonElement, Props>(({ className, variant = 'default', type = 'button', ...props }, ref) =>
  <button ref={ref} type={type} className={cn('inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:pointer-events-none disabled:opacity-50', variant === 'default' ? 'bg-orange-500 text-white hover:bg-orange-600' : variant === 'outline' ? 'border border-orange-500 text-orange-100 hover:bg-orange-500/20' : 'hover:bg-white/10', className)} {...props} />)
Button.displayName = 'Button'
