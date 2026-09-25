import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'

import { getPageBySlug } from '@/lib/queries'

// Safety net; the Pages afterChange hook revalidates immediately (SPEC Rule B10).
export const revalidate = 60

// No paths at build time: each page renders on first request, then is cached and revalidated.
export function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPageBySlug((await params).slug)
  return page ? { title: page.title } : {}
}

export default async function InfoPage({ params }: Props) {
  const page = await getPageBySlug((await params).slug)
  if (!page) notFound()

  return (
    <article className="prose prose-invert mx-auto max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)]">{page.title}</h1>
      <RichText data={page.content} />
    </article>
  )
}
