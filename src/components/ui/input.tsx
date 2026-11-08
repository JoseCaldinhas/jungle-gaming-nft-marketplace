import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) =>
  <input ref={ref} type={type} className={cn('flex h-10 w-full rounded-md border border-orange-900/50 bg-transparent px-3 py-2 text-sm text-inherit placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-50', className)} {...props} />)
Input.displayName = 'Input'
