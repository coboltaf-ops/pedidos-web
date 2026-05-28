'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useDespachosStore } from '@/features/despachos/store/despachos-store'
import { useClientesStore } from '@/features/clientes/store/clientes-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { fmtMoney } from '@/shared/lib/format-number'

const TIPO = 'Producto Terminado'
const COLOR = '#22c55e'
const COLOR_BORDER = 'rgba(34,197,94,0.4)'
const COLOR_BG = 'rgba(34,197,94,0.15)'

export default function DashboardProductoTerminadoPage() {
  const setTipoActivo = useTipoInventarioSesion(s => s.setTipoActivo)
  useEffect(() => { setTipoActivo(TIPO) }, [setTipoActivo])

  const todosProductos = useProductosStore(s => s.productos)
  const todosDespachos = useDespachosStore(s => s.despachos)
  const clientes = useClientesStore(s => s.clientes)

  const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim()
  const matchTipo = (v: unknown) => norm(String(v || '')) === TIPO

  const productos = todosProductos.filter(p => matchTipo(p.tipo_inventario))
  const despachos = todosDespachos.filter(d => matchTipo(d.tipo_inventario) && d.estado === 'Registrado')

  // KPIs
  const productosActivos = productos.filter(p => p.situacion === 'Activo')
  const ventasTotales = despachos.reduce((s, d) => s + (d.monto_total || 0), 0)
  const valorInventario = productosActivos.reduce((s, p) => s + (p.existencia || 0) * (p.ult_costo || 0), 0)
  const totalUnidadesDespachadas = despachos.reduce((s, d) => s + d.renglones.reduce((rs, r) => rs + (r.cantidad || 0), 0), 0)

  // Margen promedio (de productos PT con margen definido)
  const conMargen = productosActivos.filter(p => typeof p.margen_ganancia === 'number' && p.margen_ganancia > 0)
  const margenPromedio = conMargen.length
    ? conMargen.reduce((s, p) => s + (p.margen_ganancia || 0), 0) / conMargen.length
    : 0
  const conMargenContrib = productosActivos.filter(p => typeof p.margen_contribucion === 'number' && p.margen_contribucion > 0)
  const margenContribPromedio = conMargenContrib.length
    ? conMargenContrib.reduce((s, p) => s + (p.margen_contribucion || 0), 0) / conMargenContrib.length
    : 0

  // Top clientes por ventas (de despachos)
  const ventasPorCliente: Record<string, { monto: number; despachos: number }> = {}
  despachos.forEach(d => {
    const c = d.cliente || 'Sin cliente'
    if (!ventasPorCliente[c]) ventasPorCliente[c] = { monto: 0, despachos: 0 }
    ventasPorCliente[c].monto += d.monto_total || 0
    ventasPorCliente[c].despachos += 1
  })
  const topClientes = Object.entries(ventasPorCliente)
    .sort(([, a], [, b]) => b.monto - a.monto)
    .slice(0, 5)

  // Top productos despachados
  const ventasPorProducto: Record<string, { monto: number; cantidad: number }> = {}
  despachos.forEach(d => {
    d.renglones.forEach(r => {
      const key = r.nombre || r.codigo || 'Sin producto'
      if (!ventasPorProducto[key]) ventasPorProducto[key] = { monto: 0, cantidad: 0 }
      ventasPorProducto[key].monto += r.subtotal || 0
      ventasPorProducto[key].cantidad += r.cantidad || 0
    })
  })
  const topProductos = Object.entries(ventasPorProducto)
    .sort(([, a], [, b]) => b.monto - a.monto)
    .slice(0, 5)

  // Productos por Clase de Cliente
  const porClase: Record<string, number> = {}
  productosActivos.forEach(p => {
    const cl = p.clase_cliente || 'Sin clasificar'
    porClase[cl] = (porClase[cl] || 0) + 1
  })
  const claseEntries = Object.entries(porClase).sort(([, a], [, b]) => b - a)

  // Despachos recientes
  const despachosRecientes = [...despachos]
    .sort((a, b) => (b.fecha_emision || '').localeCompare(a.fecha_emision || ''))
    .slice(0, 10)

  const bigCards = [
    { label: 'Ventas Totales (Despachos)', value: `$ ${fmtMoney(ventasTotales)}`, icon: '💵' },
    { label: 'Valor Inventario PT', value: `$ ${fmtMoney(valorInventario)}`, icon: '💰' },
    { label: 'Margen Ganancia Promedio', value: `${margenPromedio.toFixed(1)}%`, icon: '📈' },
    { label: 'Margen Contribución Promedio', value: `${margenContribPromedio.toFixed(1)}%`, icon: '📊' },
  ]

  const smallCards = [
    { label: 'Productos PT Activos', value: productosActivos.length, icon: '📦' },
    { label: 'Despachos Registrados', value: despachos.length, icon: '🚚' },
    { label: 'Unidades Despachadas', value: totalUnidadesDespachadas.toLocaleString('es-CO'), icon: '📤' },
    { label: 'Clientes Atendidos', value: Object.keys(ventasPorCliente).length, icon: '👥' },
    { label: 'Total Clientes', value: clientes.length, icon: '🏢' },
    { label: 'Clases de Cliente', value: claseEntries.length, icon: '🏷️' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🟢</span>
          <h1 className="text-2xl font-extrabold text-white">Dashboard Producto Terminado</h1>
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
        {/* Top Clientes */}
        <Link href="/clientes" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">🏆 Top 5 Clientes por Ventas</h2>
          {topClientes.length === 0 ? (
            <p className="text-white/40 text-sm">Aún no hay despachos registrados</p>
          ) : (
            <div className="space-y-3">
              {topClientes.map(([cli, { monto, despachos: cnt }], i) => {
                const max = topClientes[0][1].monto
                const pct = (monto / max) * 100
                return (
                  <div key={cli}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium truncate" title={cli}>{i + 1}. {cli}</span>
                      <span className="text-green-300 font-bold text-sm whitespace-nowrap">$ {fmtMoney(monto)} <span className="text-white/50 text-xs">({cnt})</span></span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${COLOR}, #86efac)` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Link>

        {/* Top Productos */}
        <Link href="/productos" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">📦 Top 5 Productos Despachados</h2>
          {topProductos.length === 0 ? (
            <p className="text-white/40 text-sm">Aún no hay despachos registrados</p>
          ) : (
            <div className="space-y-3">
              {topProductos.map(([prod, { monto, cantidad }], i) => {
                const max = topProductos[0][1].monto
                const pct = (monto / max) * 100
                return (
                  <div key={prod}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium truncate" title={prod}>{i + 1}. {prod}</span>
                      <span className="text-green-300 font-bold text-sm whitespace-nowrap">$ {fmtMoney(monto)} <span className="text-white/50 text-xs">({cantidad}u)</span></span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${COLOR}, #86efac)` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Link>
      </div>

      {/* Productos por Clase de Cliente */}
      {claseEntries.length > 0 && (
        <Link href="/productos" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">🏷️ Productos PT por Clase de Cliente</h2>
          {(() => {
            const COLORES = ['#22c55e', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6', '#dc2626']
            const max = Math.max(...claseEntries.map(([, c]) => c), 1)
            return (
              <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${claseEntries.length}, minmax(0, 1fr))` }}>
                {claseEntries.map(([cl, cnt], i) => {
                  const c = COLORES[i % COLORES.length]
                  const h = (cnt / max) * 100
                  return (
                    <div key={cl} className="flex flex-col items-center">
                      <div className="flex items-end justify-center h-48 w-full">
                        <div className="flex flex-col items-center justify-end h-full" style={{ width: '40%' }}>
                          <span className="text-lg font-black mb-2 text-white">{cnt}</span>
                          <div className="w-full rounded-t-lg" style={{
                            height: `${h}%`, background: `linear-gradient(180deg, ${c}, ${c}99)`,
                            minHeight: cnt > 0 ? '4px' : '0', boxShadow: `0 0 12px ${c}66`,
                          }} />
                        </div>
                      </div>
                      <div className="w-full mt-3 pt-2" style={{ borderTop: `2px solid ${c}66` }}>
                        <p className="text-xs font-bold text-center" style={{ color: c }}>{cl}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </Link>
      )}

      {/* Despachos Recientes */}
      {despachosRecientes.length > 0 && (
        <Link href="/despachos" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">🚚 Despachos Recientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/50 border-b border-white/10">
                  <th className="py-2 px-2">Consec.</th>
                  <th className="py-2 px-2">Fecha</th>
                  <th className="py-2 px-2">Cliente</th>
                  <th className="py-2 px-2">OC</th>
                  <th className="py-2 px-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {despachosRecientes.map(d => (
                  <tr key={d.id} className="border-b border-white/5">
                    <td className="py-2 px-2 font-mono text-xs text-white/60">{d.consecutivo}</td>
                    <td className="py-2 px-2 text-white/80">{d.fecha_emision}</td>
                    <td className="py-2 px-2 text-white">{d.cliente}</td>
                    <td className="py-2 px-2 text-white/70">{d.orden_compra || '—'}</td>
                    <td className="py-2 px-2 text-right text-green-300 font-bold">$ {fmtMoney(d.monto_total || 0)}</td>
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
