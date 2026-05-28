// VERCEL BUILD FIX 2 - Menu buttons text color: WHITE INTENSE (Force rebuild: 2026-05-24)
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCurrentUserStore } from '@/features/usuarios/store/current-user-store'
import { ServerSyncProvider } from '@/shared/components/server-sync-provider'
import { useModulosSistemaStore } from '@/features/modulos-sistema/store/modulos-sistema-store'
import { MODULOS } from '@/features/usuarios-gestion/types'
import { LanguageSwitcher } from '@/shared/components/language-switcher'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { TipoInventarioBadge } from '@/features/contexto-sesion/components/tipo-inventario-badge'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { EcosystemSidebar } from '@/shared/components/ecosystem-sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useCurrentUserStore((s) => s.user)
  const tCommon = useTranslations('common')
  const tApp = useTranslations('app')
  const [returnUrl, setReturnUrl] = useState<string | null>(null)
  const [fromContable, setFromContable] = useState(false)
  const initModulos = useModulosSistemaStore((s) => s.initModulos)
  const empresaActiva = useEmpresaStore((s) => s.empresas[0])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const from = params.get('from')
    const ret = params.get('returnUrl')
    if (from === 'contable' && ret) {
      localStorage.setItem('gi-return-url', ret)
      localStorage.setItem('gi-from-contable', '1')
      setReturnUrl(ret)
      setFromContable(true)
    } else {
      const savedRet = localStorage.getItem('gi-return-url')
      const savedFrom = localStorage.getItem('gi-from-contable')
      if (savedRet && savedFrom === '1') {
        setReturnUrl(savedRet)
        setFromContable(true)
      }
    }
  }, [])

  const volverAContable = () => {
    if (returnUrl) {
      localStorage.removeItem('gi-return-url')
      localStorage.removeItem('gi-from-contable')
      window.location.href = returnUrl
    }
  }

  useEffect(() => {
    // Skip localStorage cleanup to preserve user data
    if (typeof window !== 'undefined' && !localStorage.getItem('data-initialized')) {
      localStorage.setItem('data-initialized', '1')
    }
  }, [])

  useEffect(() => {
    initModulos(MODULOS.map((m) => m.id as string))
  }, [initModulos])

  return (
    <ServerSyncProvider>
      <div className="flex min-h-screen" style={{ background: '#000' }}>
        <EcosystemSidebar />

        <main className="flex-1 flex flex-col min-h-screen transition-all duration-300" style={{ background: '#000' }}>
          <header className="px-8 py-3 shrink-0 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-4">
              {empresaActiva?.nombre && (
                <div className="text-white font-semibold text-sm tracking-wide max-w-xs truncate" title={empresaActiva.nombre}>
                  {empresaActiva.nombre}
                </div>
              )}
              {fromContable && returnUrl && (
                <button
                  onClick={volverAContable}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 flex items-center gap-2"
                  style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.5)' }}
                  title={tCommon('backToAccounting')}
                >
                  <span>←</span> {tCommon('backToAccounting')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <TipoInventarioBadge />
              <LanguageSwitcher />
              <div className="text-right">
                <p className="text-sm font-medium text-white">
                  {user.nombre} {user.apellido}
                </p>
                <p className="text-xs text-white font-bold">{user.rol}</p>
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}
              >
                {user.nombre.charAt(0)}
                {user.apellido.charAt(0)}
              </div>
            </div>
          </header>
          <div className="flex-1 px-4 py-6 md:px-6 overflow-x-hidden min-w-0">
            {children}
          </div>
        </main>
      </div>
    </ServerSyncProvider>
  )
}
