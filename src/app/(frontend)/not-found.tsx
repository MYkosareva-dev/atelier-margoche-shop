import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">This page does not exist.</h1>
      <Button asChild variant="outline" className="h-10 border-[var(--border)] text-[var(--text)]">
        <Link href="/">
          <ArrowLeft aria-hidden /> Back to prints
        </Link>
      </Button>
    </div>
  )
}
