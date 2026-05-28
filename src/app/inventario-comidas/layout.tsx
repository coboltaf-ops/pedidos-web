'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { InventarioSidebar } from '@/shared/components/inventario-sidebar'
import { SidebarProvider } from '@/shared/context/sidebar-context'
import { usePollingProductosComidas } from '@/features/inventario-comidas/hooks/use-polling-productos-comidas'
import { usePollingFormulasComidas } from '@/features/inventario-comidas/hooks/use-polling-formulas-comidas'
import { usePollingProveedoresComidas } from '@/features/inventario-comidas/hooks/use-polling-proveedores-comidas'
import { usePollingOrdenesComidas } from '@/features/inventario-comidas/hooks/use-polling-ordenes-comidas'
import { usePollingRecepcionComidas } from '@/features/inventario-comidas/hooks/use-polling-recepcion-comidas'
import { usePollingBodegasComidas } from '@/features/inventario-comidas/hooks/use-polling-bodegas-comidas'
import { usePollingAjustesComidas } from '@/features/inventario-comidas/hooks/use-polling-ajustes-comidas'
import { usePollingInventarioFisicoComidas } from '@/features/inventario-comidas/hooks/use-polling-inventario-fisico-comidas'
import { usePollingsSalidasComidas } from '@/features/inventario-comidas/hooks/use-polling-salidas-comidas'
import { usePollingUsuariosComidas } from '@/features/inventario-comidas/hooks/use-polling-usuarios-comidas'
import { usePollingDatosEmpresaComidas } from '@/features/inventario-comidas/hooks/use-polling-datos-empresa-comidas'
import { usePollingClientesComidas } from '@/features/inventario-comidas/hooks/use-polling-clientes-comidas'

function InventarioComidasDataLoader() {
  usePollingProductosComidas(5000)
  usePollingFormulasComidas(5000)
  usePollingProveedoresComidas(5000)
  usePollingOrdenesComidas(5000)
  usePollingRecepcionComidas(5000)
  usePollingBodegasComidas(5000)
  usePollingAjustesComidas(5000)
  usePollingInventarioFisicoComidas(5000)
  usePollingsSalidasComidas(5000)
  usePollingUsuariosComidas(5000)
  usePollingDatosEmpresaComidas(5000)
  usePollingClientesComidas(5000)
  return null
}

function InventarioComidasLayoutContent({ children }: { children: React.ReactNode }) {
  const empresaActiva = useEmpresaStore(s => s.empresas[0])
  const logoEmpresa = empresaActiva?.logo
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const pathname = usePathname()

  // Ocultar sidebar automáticamente cuando navegas a un módulo específico
  useEffect(() => {
    console.log('Pathname:', pathname)
    const modulosRutas = ['clientes', 'proveedores', 'productos', 'formulas', 'ordenes-compra', 'recepcion', 'bodegas', 'salidas', 'ajustes', 'inventario-fisico', 'datos-empresa', 'usuarios']
    const isModulePage = modulosRutas.some(modulo => pathname.includes(`/inventario-comidas/${modulo}`))
    console.log('Es módulo:', isModulePage)
    if (isModulePage) {
      setSidebarVisible(false)
      console.log('Ocultando sidebar')
    }
  }, [pathname])

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex' }}>
      <InventarioComidasDataLoader />
      {sidebarVisible && <InventarioSidebar onClose={() => setSidebarVisible(false)} />}
      <main style={{ flex: 1, marginLeft: sidebarVisible ? '256px' : '0', overflowY: 'auto', transition: 'margin-left 0.3s' }}>
        {!sidebarVisible && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'fixed', top: '20px', left: '20px', zIndex: 50 }}>
            <img src={logoEmpresa || ''} alt="SPIN" style={{ width: '48px', height: '48px' }} />
            <button
              onClick={() => setSidebarVisible(true)}
              style={{
                padding: '10px 16px',
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
              }}
            >
              ☰ Menú
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

export default function InventarioComidasLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <InventarioComidasLayoutContent>{children}</InventarioComidasLayoutContent>
    </SidebarProvider>
  )
}
