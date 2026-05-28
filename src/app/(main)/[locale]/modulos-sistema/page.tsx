'use client'

import { useTranslations } from 'next-intl'

import { useEffect } from 'react'
import { useModulosSistemaStore } from '@/features/modulos-sistema/store/modulos-sistema-store'
import { MODULOS } from '@/features/usuarios-gestion/types'
import { usePermisos } from '@/shared/hooks/use-permisos'

const MODULOS_NO_DESACTIVABLES = ['dashboard', 'modulos-sistema']

const MODULO_ICONS: Record<string, string> = {
  dashboard: '📊',
  productos: '📦',
  proveedores: '🏢',
  'ordenes-compra': '🛒',
  'recepcion-facturas': '📋',
  bodegas: '🏭',
  transferencias: '🔄',
  'salidas-almacen': '📤',
  'ajustes-inventario': '⚖️',
  'centros-costo': '💰',
  'correos-enviados': '📧',
  referencias: '⚙️',
  'datos-empresa': '🏛️',
  'carga-inicial-inventario': '📥',
  'modulos-sistema': '🗂️',
  'pedidos': '📄',
}

export default function ModulosSistemaPage() {
  const t = useTranslations('pages')
  const tF = useTranslations('fields')
  const tH = useTranslations('headers')
  const tSub = useTranslations('subtitles')
  const tTip = useTranslations('tooltips')
  const permisos = usePermisos('modulos-sistema')
  const { modulos, toggleModulo, initModulos } = useModulosSistemaStore()

  // Sincronizar: agregar módulos nuevos que no existan en el store
  useEffect(() => {
    initModulos(MODULOS.map(m => m.id as string))
  }, [initModulos])

  if (!permisos.leer) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/60 text-lg">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  const allModulos = [...MODULOS]

  const activosCount = modulos.filter(m => m.activo).length
  const totalCount = allModulos.length

  const getEstado = (id: string) => {
    const found = modulos.find(m => m.id === id)
    return found ? found.activo : true
  }

  const esNoDesactivable = (id: string) => MODULOS_NO_DESACTIVABLES.includes(id)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('modulosSistema')}</h1>
          <p className="text-white/50 mt-1">{tSub('modulosSistema')}</p>
        </div>
        <div
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff' }}
        >
          {activosCount} módulos activos de {totalCount} total
        </div>
      </div>

      {/* Module list */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(96,165,250,0.15)' }}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">Módulo</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Identificador</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {allModulos.map((modulo) => {
                const activo = getEstado(modulo.id)
                const noDesactivable = esNoDesactivable(modulo.id)
                const icon = MODULO_ICONS[modulo.id] ?? '🔧'

                return (
                  <tr key={modulo.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          {icon}
                        </div>
                        <span className="text-sm font-medium text-white">{modulo.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-xs text-white font-mono font-bold">{modulo.id}</code>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {noDesactivable ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium cursor-not-allowed opacity-60"
                          style={{
                            background: 'rgba(22,163,74,0.5)',
                            border: '1px solid rgba(22,163,74,0.8)',
                            color: '#ffffff',
                          }}
                          title={tTip('moduloNoDesactivar')}
                        >
                          ● Activo
                        </span>
                      ) : permisos.editar ? (
                        <button
                          onClick={() => toggleModulo(modulo.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                          style={activo ? {
                            background: 'rgba(22,163,74,0.5)',
                            border: '1px solid rgba(22,163,74,0.8)',
                            color: '#ffffff',
                          } : {
                            background: 'rgba(220,38,38,0.8)',
                            border: '1px solid rgba(239,68,68,1)',
                            color: '#ffffff',
                          }}
                        >
                          {activo ? '● Activo' : '● Inactivo'}
                        </button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium"
                          style={activo ? {
                            background: 'rgba(22,163,74,0.5)',
                            border: '1px solid rgba(22,163,74,0.8)',
                            color: '#ffffff',
                          } : {
                            background: 'rgba(220,38,38,0.8)',
                            border: '1px solid rgba(239,68,68,1)',
                            color: '#ffffff',
                          }}
                        >
                          {activo ? '● Activo' : '● Inactivo'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!permisos.editar && (
        <p className="mt-4 text-xs text-white/30 text-center">Solo los administradores pueden activar o desactivar módulos.</p>
      )}
    </div>
  )
}
