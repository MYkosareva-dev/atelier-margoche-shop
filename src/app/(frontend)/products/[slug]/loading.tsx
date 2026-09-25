import { Skeleton } from '@/components/ui/skeleton'

export default function ProductLoading() {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr] md:gap-12" aria-busy="true">
      <Skeleton className="aspect-[4/5] w-full rounded-[var(--radius)] bg-[var(--surface-2)]" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-20 bg-[var(--surface-2)]" />
        <Skeleton className="h-10 w-3/4 bg-[var(--surface-2)]" />
        <Skeleton className="h-16 w-full bg-[var(--surface-2)]" />
        <Skeleton className="h-8 w-1/3 bg-[var(--surface-2)]" />
      </div>
    </div>
  )
}
