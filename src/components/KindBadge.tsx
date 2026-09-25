import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Product } from '@/payload-types'

export function KindBadge({ kind, className }: { kind: Product['kind']; className?: string }) {
  return kind === 'ai-art' ? (
    <Badge variant="secondary" className={cn('badge-kind bg-[image:var(--gradient)] text-[var(--bg)]', className)}>
      AI art
    </Badge>
  ) : (
    <Badge variant="secondary" className={cn('badge-kind bg-[var(--surface-2)] text-[var(--text)]', className)}>
      Photo
    </Badge>
  )
}
