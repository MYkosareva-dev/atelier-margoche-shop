'use client'

import { useEffect, useState } from 'react'
import { Toaster as Sonner } from 'sonner'

// Block E: bottom-right on desktop, bottom-center on phones, auto-dismiss after 6 s.
export function Toaster() {
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return <Sonner theme="dark" position={mobile ? 'bottom-center' : 'bottom-right'} duration={6000} richColors />
}
