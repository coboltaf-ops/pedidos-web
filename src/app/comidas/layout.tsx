'use client'

import { usePathname } from 'next/navigation'
import { usePollingPedidos } from '@/features/comidas/hooks/use-polling-pedidos'
import { usePollingCaja } from '@/features/comidas/hooks/use-polling-caja'
import { usePollingProductosComidas } from '@/features/inventario-comidas/hooks/use-polling-productos-comidas'
import { usePollingFormulasComidas } from '@/features/inventario-comidas/hooks/use-polling-formulas-comidas'
import { InventarioSidebar } from '@/shared/components/inventario-sidebar'

function ComidasDataLoader() {
  usePollingPedidos(5000)
  usePollingCaja(5000)
  usePollingProductosComidas(5000)
  usePollingFormulasComidas(5000)
  return null
}

export default function ComidasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isStandalone = pathname === '/comidas/landing' || pathname === '/comidas/qr'

  if (isStandalone) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <ComidasDataLoader />
        {children}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex' }}>
      <ComidasDataLoader />
      <InventarioSidebar />
      <main style={{ flex: 1, marginLeft: '256px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
