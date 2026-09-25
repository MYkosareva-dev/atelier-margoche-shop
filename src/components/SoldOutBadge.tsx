import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function SoldOutBadge({ className, id }: { className?: string; id?: string }) {
  return (
    <Badge
      id={id}
      variant="destructive"
      className={cn('badge-soldout bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]', className)}
    >
      Sold out
    </Badge>
  )
}
