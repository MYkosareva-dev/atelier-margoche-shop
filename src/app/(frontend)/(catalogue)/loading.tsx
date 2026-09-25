import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function CatalogueLoading() {
  return (
    <>
      <Skeleton className="h-10 w-3/4 max-w-md bg-[var(--surface-2)]" />
      <Skeleton className="mt-4 mb-10 h-5 w-full max-w-xl bg-[var(--surface-2)]" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8" aria-busy="true">
        {[0, 1, 2].map((i) => (
          // 3 cards on desktop, 1 on mobile (SPEC Screen 1).
          <div key={i} className={cn(i > 0 && 'hidden md:block')}>
            <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius)] bg-[var(--surface-2)]" />
            <Skeleton className="mt-4 h-5 w-2/3 bg-[var(--surface-2)]" />
            <Skeleton className="mt-2 h-4 w-1/3 bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
    </>
  )
}
