'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useOrdenesStore } from '@/features/ordenes-compra/store/ordenes-store'
import { useRecepcionesStore } from '@/features/recepcion-facturas/store/recepciones-store'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import { useTransferenciasStore } from '@/features/transferencias/store/transferencias-store'
import { useAjustesStore } from '@/features/ajustes-inventario/store/ajustes-store'
import { useSalidasStore } from '@/features/salidas-almacen/store/salidas-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { fmtMoney } from '@/shared/lib/format-number'

const TIPO = 'Materiales y Suministros'
const COLOR = '#2563eb'
const COLOR_BORDER = 'rgba(59,130,246,0.4)'
const COLOR_BG = 'rgba(59,130,246,0.15)'

export default function DashboardMaterialesSuministrosPage() {
  const setTipoActivo = useTipoInventarioSesion(s => s.setTipoActivo)
  useEffect(() => { setTipoActivo(TIPO) }, [setTipoActivo])

  const todosProductos = useProductosStore(s => s.productos)
  const todasOrdenes = useOrdenesStore(s => s.ordenes)
  const todasRecepciones = useRecepcionesStore(s => s.recepciones)
  const todasBodegas = useBodegasStore(s => s.bodegas)
  const todasTransferencias = useTransferenciasStore(s => s.transferencias)
  const todosAjustes = useAjustesStore(s => s.ajustes)
  const todasSalidas = useSalidasStore(s => s.salidas)

  const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim()
  const matchTipo = (v: unknown) => norm(String(v || '')) === TIPO

  const productos = todosProductos.filter(p => matchTipo(p.tipo_inventario))
  const ordenes = todasOrdenes.filter(o => matchTipo(o.tipo_inventario))
  const recepciones = todasRecepciones.filter(r => matchTipo(r.tipo_inventario))
  const bodegas = todasBodegas.filter(b => matchTipo(b.tipo_inventario))
  const transferencias = todasTransferencias.filter(t => matchTipo((t as unknown as { tipo_inventario?: string }).tipo_inventario))
  const ajustes = todosAjustes.filter(a => matchTipo((a as unknown as { tipo_inventario?: string }).tipo_inventario))
  const salidas = todasSalidas.filter(s => matchTipo(s.tipo_inventario))

  // KPIs
  const productosActivos = productos.filter(p => p.situacion === 'Activo')
  const valorInventario = productosActivos.reduce((s, p) => s + (p.existencia || 0) * (p.ult_costo || 0), 0)
  const totalUnidades = productosActivos.reduce((s, p) => s + (p.existencia || 0), 0)
  const ordenesPendientes = ordenes.filter(o => ['Pendiente', 'Pendiente Aprobacion', 'Aprobada', 'Pendiente por Recibir', 'Recibida Parcial'].includes(o.situacion))
  const totalOrdenes = ordenes.reduce((sum, o) => {
    const sub = o.detalles.reduce((s, d) => s + d.cantidad * d.costo_unitario, 0)
    return sum + sub + sub * (o.pct_impuesto || 0) / 100
  }, 0)
  const bajoMinimo = productosActivos.filter(p => p.minimo && (p.existencia || 0) < p.minimo)
  const sinStock = productosActivos.filter(p => (p.existencia || 0) <= 0)

  // Órdenes por estado
  const estadosOrden: Record<string, { count: number; monto: number }> = {}
  ordenes.forEach(o => {
    const sub = o.detalles.reduce((s, d) => s + d.cantidad * d.costo_unitario, 0)
    const tot = sub + sub * (o.pct_impuesto || 0) / 100
    if (!estadosOrden[o.situacion]) estadosOrden[o.situacion] = { count: 0, monto: 0 }
    estadosOrden[o.situacion].count += 1
    estadosOrden[o.situacion].monto += tot
  })

  // Valor por bodega
  const bodegasConSaldo = bodegas.filter(b => (b.saldos || []).length > 0)
  const dataBodegas = bodegasConSaldo.map(b => {
    const saldos = b.saldos || []
    return {
      id: b.id, nombre: b.nombre,
      valor: saldos.reduce((s, x) => s + (x.valor_existencia || 0), 0),
      items: saldos.reduce((s, x) => s + (x.existencia || 0), 0),
      cantSaldos: saldos.length,
    }
  }).sort((a, b) => b.valor - a.valor)

  const bigCards = [
    { label: 'Valor Inventario M&S', value: `$ ${fmtMoney(valorInventario)}`, icon: '💰' },
    { label: 'Total OCs', value: `$ ${fmtMoney(totalOrdenes)}`, icon: '🧾' },
    { label: 'Bajo Mínimo', value: bajoMinimo.length, icon: '⚠️' },
    { label: 'Sin Stock', value: sinStock.length, icon: '🚨' },
  ]

  const smallCards = [
    { label: 'Productos Activos', value: productosActivos.length, icon: '📦' },
    { label: 'Unidades en Stock', value: totalUnidades.toLocaleString('es-CO'), icon: '📊' },
    { label: 'Órdenes Compra', value: ordenes.length, icon: '🛒' },
    { label: 'OCs Pendientes', value: ordenesPendientes.length, icon: '⏳' },
    { label: 'Recepción Facturas', value: recepciones.length, icon: '📋' },
    { label: 'Salidas Almacén', value: salidas.length, icon: '📤' },
    { label: 'Transferencias', value: transferencias.length, icon: '🔄' },
    { label: 'Ajustes', value: ajustes.length, icon: '⚖️' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔷</span>
          <h1 className="text-2xl font-extrabold text-white">Dashboard Materiales y Suministros</h1>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: COLOR_BG, color: '#fff', border: `1px solid ${COLOR_BORDER}` }}>
          <span>📦 Vista filtrada:</span><span>{TIPO}</span>
        </div>
      </div>

      {/* Big KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {bigCards.map(c => (
          <div key={c.label} className="rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${COLOR_BORDER}` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{c.icon}</span>
              <div className="w-2 h-2 rounded-full" style={{ background: COLOR }} />
            </div>
            <p className="text-2xl font-bold text-white">{c.value}</p>
            <p className="text-sm mt-1 text-white/50">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Small KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {smallCards.map(c => (
          <div key={c.label} className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-xl">{c.icon}</span>
            <p className="text-xl font-bold text-white mt-2">{c.value}</p>
            <p className="text-xs mt-1 text-white/40">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Bajo Mínimo */}
      {bajoMinimo.length > 0 && (
        <Link href="/productos" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">⚠️ Productos Bajo Mínimo</h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {bajoMinimo.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div>
                  <span className="font-mono text-xs text-white/50">{p.codigo}</span>
                  <span className="text-white/80 text-sm ml-2">{p.descripcion}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-red-400 font-bold">{p.existencia || 0}</span>
                  <span className="text-white/30">/</span>
                  <span className="text-white/50">{p.minimo} mín</span>
                </div>
              </div>
            ))}
          </div>
        </Link>
      )}

      {/* Órdenes por Estado */}
      {Object.keys(estadosOrden).length > 0 && (
        <Link href="/ordenes-compra" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">📊 Órdenes de Compra por Estado</h2>
          {(() => {
            const COLORS: Record<string, string> = {
              'Pendiente': '#fbbf24', 'Pendiente Aprobacion': '#fbbf24',
              'Aprobada': '#60a5fa', 'Pendiente por Recibir': '#60a5fa',
              'Recibida Parcial': '#ffffff', 'Recibida': '#22c55e', 'Recibida Completa': '#22c55e',
              'Anulada': '#dc2626', 'Rechazada': '#dc2626',
            }
            const entries = Object.entries(estadosOrden)
            const maxMonto = Math.max(...entries.map(([, v]) => v.monto), 1)
            return (
              <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))` }}>
                {entries.map(([estado, { count, monto }]) => {
                  const c = COLORS[estado] || '#94a3b8'
                  const h = (monto / maxMonto) * 100
                  return (
                    <div key={estado} className="flex flex-col items-center">
                      <div className="flex items-end justify-center h-48 w-full">
                        <div className="flex flex-col items-center justify-end h-full" style={{ width: '40%' }}>
                          <span className="text-sm font-black mb-2 whitespace-nowrap" style={{ color: c }}>
                            ${fmtMoney(monto)} <span className="text-white/70">({count})</span>
                          </span>
                          <div className="w-full rounded-t-lg" style={{
                            height: `${h}%`, background: `linear-gradient(180deg, ${c}, ${c}99)`,
                            minHeight: monto > 0 ? '4px' : '0', boxShadow: `0 0 10px ${c}66`,
                          }} />
                        </div>
                      </div>
                      <div className="w-full mt-2 pt-2" style={{ borderTop: `2px solid ${c}66` }}>
                        <p className="text-xs font-bold text-center" style={{ color: c }}>{estado}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </Link>
      )}

      {/* Valor por Bodega */}
      {dataBodegas.length > 0 && (
        <Link href="/bodegas" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-2">🏭 Valor de Inventario por Bodega</h2>
          <p className="text-xl font-black mb-6 text-white">Total: ${fmtMoney(dataBodegas.reduce((s, d) => s + d.valor, 0))}</p>
          {(() => {
            const COLORES = ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#dc2626']
            const max = Math.max(...dataBodegas.map(d => d.valor), 1)
            return (
              <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${dataBodegas.length}, minmax(0, 1fr))` }}>
                {dataBodegas.map((d, i) => {
                  const c = COLORES[i % COLORES.length]
                  const h = (d.valor / max) * 100
                  return (
                    <div key={d.id} className="flex flex-col items-center">
                      <div className="flex items-end justify-center h-56 w-full">
                        <div className="flex flex-col items-center justify-end h-full" style={{ width: '32%' }}>
                          <span className="text-base font-black mb-2 whitespace-nowrap text-white">${fmtMoney(d.valor)}</span>
                          <div className="w-full rounded-t-lg" style={{
                            height: `${h}%`, background: `linear-gradient(180deg, ${c}, ${c}99)`,
                            minHeight: d.valor > 0 ? '4px' : '0', boxShadow: `0 0 12px ${c}66`,
                          }} />
                        </div>
                      </div>
                      <div className="w-full mt-3 pt-2" style={{ borderTop: `2px solid ${c}66` }}>
                        <p className="text-sm font-black text-center text-white">{d.nombre}</p>
                        <p className="text-xs text-white/60 text-center mt-1">{d.cantSaldos} ítems · {d.items.toLocaleString('es-CO')} u</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </Link>
      )}
    </div>
  )
}
