'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useOrdenesStore } from '@/features/ordenes-compra/store/ordenes-store'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import { useTransferenciasStore } from '@/features/transferencias/store/transferencias-store'
import { useAjustesStore } from '@/features/ajustes-inventario/store/ajustes-store'
import { usePesajeStore } from '@/features/pesaje/store/pesaje-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { fmtMoney } from '@/shared/lib/format-number'

const TIPO = 'Materia Prima'
const COLOR = '#f97316'
const COLOR_BG = 'rgba(249,115,22,0.15)'
const COLOR_BORDER = 'rgba(249,115,22,0.4)'

export default function DashboardMateriaPrimaPage() {
  const setTipoActivo = useTipoInventarioSesion(s => s.setTipoActivo)

  useEffect(() => { setTipoActivo(TIPO) }, [setTipoActivo])

  const todosProductos = useProductosStore(s => s.productos)
  const todasOrdenes = useOrdenesStore(s => s.ordenes)
  const todasBodegas = useBodegasStore(s => s.bodegas)
  const todasTransferencias = useTransferenciasStore(s => s.transferencias)
  const todosAjustes = useAjustesStore(s => s.ajustes)
  const todosPesajes = usePesajeStore(s => s.pesajes)

  const productos = todosProductos.filter(p => (p.tipo_inventario || '') === TIPO)
  const ordenes = todasOrdenes.filter(o => o.tipo_inventario === TIPO)
  const bodegas = todasBodegas.filter(b => b.tipo_inventario === TIPO)
  const transferencias = todasTransferencias.filter(t => (t as unknown as { tipo_inventario?: string }).tipo_inventario === TIPO)
  const ajustes = todosAjustes.filter(a => (a as unknown as { tipo_inventario?: string }).tipo_inventario === TIPO)
  const pesajes = todosPesajes.filter(p => p.tipo_inventario === TIPO && p.estado === 'Registrado')

  // KPIs
  const productosActivos = productos.filter(p => p.situacion === 'Activo')
  const valorInventario = productosActivos.reduce((s, p) => s + (p.existencia || 0) * (p.ult_costo || 0), 0)
  const totalKg = pesajes.reduce((s, p) => s + (p.peso_neto || 0), 0)
  const ordenesPendientes = ordenes.filter(o => ['Pendiente', 'Pendiente Aprobacion', 'Aprobada', 'Pendiente por Recibir', 'Recibida Parcial'].includes(o.situacion))
  const totalOrdenes = ordenes.reduce((sum, o) => {
    const sub = o.detalles.reduce((s, d) => s + d.cantidad * d.costo_unitario, 0)
    return sum + sub + sub * (o.pct_impuesto || 0) / 100
  }, 0)

  // Top proveedores por kg recibidos (de pesajes)
  const kgPorProveedor: Record<string, number> = {}
  pesajes.forEach(p => {
    const prov = p.proveedor || 'Sin proveedor'
    kgPorProveedor[prov] = (kgPorProveedor[prov] || 0) + (p.peso_neto || 0)
  })
  const topProveedores = Object.entries(kgPorProveedor)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Top materias primas por kg recibidos
  const kgPorProducto: Record<string, number> = {}
  pesajes.forEach(p => {
    const prod = p.producto_materia_prima || 'Sin producto'
    kgPorProducto[prod] = (kgPorProducto[prod] || 0) + (p.peso_neto || 0)
  })
  const topProductos = Object.entries(kgPorProducto)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Recepciones recientes (últimos 10 pesajes)
  const pesajesRecientes = [...pesajes]
    .sort((a, b) => (b.fecha_emision || '').localeCompare(a.fecha_emision || ''))
    .slice(0, 10)

  // Bajo mínimo
  const bajoMinimo = productosActivos.filter(p => p.minimo && (p.existencia || 0) < p.minimo)

  // Órdenes por estado
  const estadosOrden: Record<string, { count: number; monto: number }> = {}
  ordenes.forEach(o => {
    const sub = o.detalles.reduce((s, d) => s + d.cantidad * d.costo_unitario, 0)
    const tot = sub + sub * (o.pct_impuesto || 0) / 100
    if (!estadosOrden[o.situacion]) estadosOrden[o.situacion] = { count: 0, monto: 0 }
    estadosOrden[o.situacion].count += 1
    estadosOrden[o.situacion].monto += tot
  })

  const bigCards = [
    { label: 'Kg Recibidos (Pesajes)', value: `${totalKg.toLocaleString('es-CO')} kg`, icon: '⚖️' },
    { label: 'Valor Inventario MP', value: `$ ${fmtMoney(valorInventario)}`, icon: '💰' },
    { label: 'Total Órdenes Compra', value: `$ ${fmtMoney(totalOrdenes)}`, icon: '🧾' },
    { label: 'OCs Pendientes', value: ordenesPendientes.length, icon: '⏳' },
  ]

  const smallCards = [
    { label: 'Productos MP Activos', value: productosActivos.length, icon: '📦' },
    { label: 'Pesajes Registrados', value: pesajes.length, icon: '🚛' },
    { label: 'Órdenes Compra', value: ordenes.length, icon: '🛒' },
    { label: 'Bodegas MP', value: bodegas.length, icon: '🏭' },
    { label: 'Transferencias', value: transferencias.length, icon: '🔄' },
    { label: 'Ajustes MP', value: ajustes.length, icon: '⚖️' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔶</span>
          <h1 className="text-2xl font-extrabold text-white">Dashboard Materia Prima</h1>
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {smallCards.map(c => (
          <div key={c.label} className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-xl">{c.icon}</span>
            <p className="text-xl font-bold text-white mt-2">{c.value}</p>
            <p className="text-xs mt-1 text-white/40">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Proveedores por Kg */}
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">🏆 Top 5 Proveedores por Kg Recibidos</h2>
          {topProveedores.length === 0 ? (
            <p className="text-white/40 text-sm">Aún no hay pesajes registrados</p>
          ) : (
            <div className="space-y-3">
              {topProveedores.map(([prov, kg], i) => {
                const max = topProveedores[0][1]
                const pct = (kg / max) * 100
                return (
                  <div key={prov}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium">{i + 1}. {prov}</span>
                      <span className="text-orange-300 font-bold text-sm">{kg.toLocaleString('es-CO')} kg</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${COLOR}, #fdba74)` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Materias Primas por Kg */}
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">📦 Top 5 Materias Primas Recibidas (Kg)</h2>
          {topProductos.length === 0 ? (
            <p className="text-white/40 text-sm">Aún no hay pesajes registrados</p>
          ) : (
            <div className="space-y-3">
              {topProductos.map(([prod, kg], i) => {
                const max = topProductos[0][1]
                const pct = (kg / max) * 100
                return (
                  <div key={prod}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium truncate" title={prod}>{i + 1}. {prod}</span>
                      <span className="text-orange-300 font-bold text-sm whitespace-nowrap">{kg.toLocaleString('es-CO')} kg</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${COLOR}, #fdba74)` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bajo Mínimo */}
      {bajoMinimo.length > 0 && (
        <Link href="/productos" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">⚠️ Materias Primas Bajo Mínimo</h2>
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

      {/* Pesajes Recientes */}
      {pesajesRecientes.length > 0 && (
        <Link href="/pesaje" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">🚛 Recepciones Recientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/50 border-b border-white/10">
                  <th className="py-2 px-2">Consec.</th>
                  <th className="py-2 px-2">Fecha</th>
                  <th className="py-2 px-2">Proveedor</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Peso Neto (kg)</th>
                </tr>
              </thead>
              <tbody>
                {pesajesRecientes.map(p => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-xs text-white/60">{p.consecutivo}</td>
                    <td className="py-2 px-2 text-white/80">{p.fecha_emision}</td>
                    <td className="py-2 px-2 text-white">{p.proveedor}</td>
                    <td className="py-2 px-2 text-white/80">{p.producto_materia_prima}</td>
                    <td className="py-2 px-2 text-right text-orange-300 font-bold">{(p.peso_neto || 0).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Link>
      )}
    </div>
  )
}
