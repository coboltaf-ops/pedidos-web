'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/comidas/landing')
  }, [router])
  
  return <div>Redirigiendo...</div>
}
