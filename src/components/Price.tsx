import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/utils'

export function Price({ cents, className, suffixClassName }: { cents: number; className?: string; suffixClassName?: string }) {
  return (
    <p className={cn('tabular-nums', className)}>
      {formatEUR(cents)} <span className={cn('text-sm text-[var(--text-muted)]', suffixClassName)}>incl. VAT</span>
    </p>
  )
}
