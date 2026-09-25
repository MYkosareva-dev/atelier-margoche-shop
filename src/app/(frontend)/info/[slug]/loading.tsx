import { Skeleton } from '@/components/ui/skeleton'

const LINE_WIDTHS = ['100%', '95%', '90%', '100%', '85%', '60%']

export default function InfoLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-3" aria-busy="true">
      <Skeleton className="mb-8 h-10 w-2/3 bg-[var(--surface-2)]" />
      {LINE_WIDTHS.map((width, i) => (
        <Skeleton key={i} className="h-4 bg-[var(--surface-2)]" style={{ width }} />
      ))}
    </div>
  )
}
