'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { useOrdenesProduccionStore } from '@/features/produccion/store/ordenes-produccion-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { type OrdenProduccion } from '@/features/produccion/types'
import { fDate } from '@/shared/lib/format-date'

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const sitStyle = (s: string): React.CSSProperties => {
  if (s === 'Completada') return { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' }
  if (s === 'En Proceso') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Pendiente') return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
  return { background: 'rgba(107,114,128,0.2)', color: '#d1d5db', border: '1px solid rgba(107,114,128,0.3)' }
}

export default function EjecucionProduccionPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tH = useTranslations('headers')
  const tSec = useTranslations('sections')
  const tHelp = useTranslations('help')
  const { ordenes, updateOrden } = useOrdenesProduccionStore()
  const { productos, updateProducto } = useProductosStore()

  const ejecutables = ordenes.filter(o => o.situacion === 'Pendiente' || o.situacion === 'En Proceso')
  const completadas = ordenes.filter(o => o.situacion === 'Completada')

  const [selectedOrden, setSelectedOrden] = useState<OrdenProduccion | null>(null)
  const [lineasAjustadas, setLineasAjustadas] = useState<{ id: string; cantidad_usada: number }[]>([])
  const [cantidadProducida, setCantidadProducida] = useState(0)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const seleccionarOrden = (o: OrdenProduccion) => {
    setSelectedOrden(o)
    setLineasAjustadas(o.lineas.map(l => ({ id: l.id, cantidad_usada: l.cantidad_usada || l.cantidad_requerida })))
    setCantidadProducida(o.cantidad_producida || o.cantidad_a_producir)
    setMensaje('')
    setError('')
  }

  const updateLineaCantidad = (id: string, cantidad: number) => {
    setLineasAjustadas(prev => prev.map(l => l.id === id ? { ...l, cantidad_usada: cantidad } : l))
  }

  const ejecutar = () => {
    if (!selectedOrden) return
    setError('')
    setMensaje('')

    // Verificar stock suficiente
    const faltantes: string[] = []
    selectedOrden.lineas.forEach(l => {
      const ajuste = lineasAjustadas.find(a => a.id === l.id)
      const cantidadUsar = ajuste?.cantidad_usada || l.cantidad_requerida
      const prod = productos.find(p => p.id === l.producto_id)
      if (prod && prod.existencia < cantidadUsar) {
        faltantes.push(`${l.descripcion}: necesita ${cantidadUsar}, tiene ${prod.existencia}`)
      }
    })

    if (faltantes.length > 0) {
      setError(`Stock insuficiente:\n${faltantes.join('\n')}`)
      return
    }

    // 1. Restar materia prima del inventario
    selectedOrden.lineas.forEach(l => {
      const ajuste = lineasAjustadas.find(a => a.id === l.id)
      const cantidadUsar = ajuste?.cantidad_usada || l.cantidad_requerida
      const prod = productos.find(p => p.id === l.producto_id)
      if (prod) {
        updateProducto(prod.id, { existencia: Math.max(0, prod.existencia - cantidadUsar) })
      }
    })

    // 2. Sumar producto terminado al inventario
    const pt = productos.find(p => p.id === selectedOrden.producto_terminado_id)
    if (pt) {
      updateProducto(pt.id, { existencia: (pt.existencia || 0) + cantidadProducida })
    }

    // 3. Actualizar la orden
    const lineasActualizadas = selectedOrden.lineas.map(l => {
      const ajuste = lineasAjustadas.find(a => a.id === l.id)
      return { ...l, cantidad_usada: ajuste?.cantidad_usada || l.cantidad_requerida, ajustado: (ajuste?.cantidad_usada || l.cantidad_requerida) !== l.cantidad_requerida }
    })

    updateOrden(selectedOrden.id, {
      lineas: lineasActualizadas,
      cantidad_producida: cantidadProducida,
      fecha_ejecucion: new Date().toISOString().split('T')[0],
      situacion: 'Completada',
    })

    setMensaje(`Producción completada: ${cantidadProducida} unidades de ${selectedOrden.producto_terminado_nombre}. Materia prima descontada del inventario.`)
    setSelectedOrden(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('ejecucionProduccion')}</h1>
        <p className="text-white/50 text-sm mt-1">{tHelp('ejecutarSubtitle')}</p>
      </div>

      {mensaje && <div className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: 'rgba(34,197,94,0.15)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' }}>{mensaje}</div>}
      {error && <div className="px-4 py-3 rounded-xl text-sm font-semibold whitespace-pre-line" style={{ background: 'rgba(239,68,68,0.15)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>}

      {!selectedOrden ? (
        <>
          {/* Lista de órdenes ejecutables */}
          <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="px-4 py-3 bg-white/5 border-b border-white/10">
              <h2 className="text-sm font-bold text-white uppercase">Órdenes Pendientes de Ejecución</h2>
            </div>
            {ejecutables.length === 0 ? (
              <div className="px-6 py-12 text-center text-white/30">{tE('noOrdenesPendientes')}</div>
            ) : (
              <div className="divide-y divide-white/5">
                {ejecutables.map(o => (
                  <div key={o.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-white">{o.consecutivo}</span>
                      <span className="text-white/60">{o.producto_terminado_nombre}</span>
                      <span className="text-white/40 text-sm">×{o.cantidad_a_producir}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={sitStyle(o.situacion)}>{o.situacion}</span>
                    </div>
                    <button onClick={() => seleccionarOrden(o)} className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                      Ejecutar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historial */}
          {completadas.length > 0 && (
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                <h2 className="text-sm font-bold text-white uppercase">{tSec('historialEjecuciones')}</h2>
              </div>
              <div className="divide-y divide-white/5">
                {completadas.slice(0, 10).map(o => (
                  <div key={o.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-white/60">{o.consecutivo}</span>
                      <span className="text-white/50">{o.producto_terminado_nombre}</span>
                      <span className="text-green-400 font-bold text-sm">+{o.cantidad_producida}</span>
                    </div>
                    <span className="text-white/30 text-sm">{fDate(o.fecha_ejecucion)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Panel de ejecución */
        <div className="bg-black/20 p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Ejecutar: {selectedOrden.consecutivo}</h2>
              <p className="text-white/50 text-sm">{selectedOrden.formula_nombre} → {selectedOrden.producto_terminado_nombre}</p>
            </div>
            <button onClick={() => setSelectedOrden(null)} className="text-white/40 hover:text-white text-xl">✕</button>
          </div>

          {/* Cantidad a producir (ajustable) */}
          <div className="max-w-xs">
            <label className="block text-xl font-extrabold text-white mb-1">Cantidad Producida (real)</label>
            <input type="number" min={0} value={cantidadProducida} onChange={e => setCantidadProducida(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
          </div>

          {/* Materia prima con ajuste */}
          <div>
            <label className="block text-xl font-extrabold text-white mb-2 uppercase">Materia Prima — Ajustar Cantidades Reales</label>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-base text-white">
                <thead className="bg-white/5 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Código</th>
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right">Requerida</th>
                    <th className="px-4 py-2 text-right">Cantidad Real Usada</th>
                    <th className="px-4 py-2 text-left">Unidad</th>
                    <th className="px-4 py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrden.lineas.map(l => {
                    const ajuste = lineasAjustadas.find(a => a.id === l.id)
                    const prod = productos.find(p => p.id === l.producto_id)
                    const stock = prod?.existencia || 0
                    const cantUsar = ajuste?.cantidad_usada || 0
                    return (
                      <tr key={l.id} className="border-t border-white/5">
                        <td className="px-4 py-2 font-mono text-xs">{l.codigo}</td>
                        <td className="px-4 py-2">{l.descripcion}</td>
                        <td className="px-4 py-2 text-right text-white/50">{l.cantidad_requerida}</td>
                        <td className="px-4 py-2 text-right">
                          <input type="number" min={0} step="0.01" value={cantUsar}
                            onChange={e => updateLineaCantidad(l.id, Number(e.target.value))}
                            className="w-24 px-2 py-1 rounded-lg text-sm text-white text-right outline-none"
                            style={{ background: cantUsar !== l.cantidad_requerida ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
                        </td>
                        <td className="px-4 py-2">{l.unidad_medida}</td>
                        <td className="px-4 py-2 text-right" style={{ color: stock >= cantUsar ? '#86efac' : '#fca5a5' }}>{stock}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={ejecutar} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              {tBtn('confirmExecution')}
            </button>
            <button onClick={() => setSelectedOrden(null)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
              {tBtn('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
