'use client'

import { useTranslations } from 'next-intl'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { useBodegasStore, type MovimientoBodega } from '@/features/bodegas/store/bodegas-store'
import { fDate } from '@/shared/lib/format-date'
import { fmtMoney } from '@/shared/lib/format-number'
import { exportToPDF, exportToExcel, printReport } from '@/shared/lib/export-report'
import { usePermisos } from '@/shared/hooks/use-permisos'

type MovimientoConBodega = MovimientoBodega & {
  bodega_id: string
  bodega_nombre: string
}

type RenglonKardex = MovimientoConBodega & {
  saldo_acumulado: number
  saldo_valor: number
}

const tipoColor: Record<string, { bg: string; color: string; border: string }> = {
  'Carga Inicial de Saldos':    { bg: 'rgba(168,85,247,0.2)',  color: '#c4b5fd', border: 'rgba(168,85,247,0.4)' },
  'Recepción Factura':          { bg: 'rgba(34,197,94,0.2)',   color: '#fff', border: 'rgba(34,197,94,0.4)' },
  'Transferencia entre Bodegas':{ bg: 'rgba(59,130,246,0.2)',  color: '#fff', border: 'rgba(59,130,246,0.4)' },
  'Salida de Almacén':          { bg: 'rgba(236,72,153,0.2)',  color: '#f9a8d4', border: 'rgba(236,72,153,0.4)' },
  'Ajuste de Inventario':       { bg: 'rgba(251,146,60,0.2)',  color: '#fdba74', border: 'rgba(251,146,60,0.4)' },
}

/**
 * Mapea los tipos internos del store a la categoria simple del Kardex
 * que el usuario quiere ver: Recepcion, Transferencia, Salida, Ajuste, Carga Inicial.
 */
function categoriaKardex(tipoInterno: string): string {
  if (tipoInterno === 'Carga Inicial de Saldos') return 'Carga Inicial de Saldos'
  if (tipoInterno === 'Recepción Factura') return 'Recepción Factura'
  if (tipoInterno === 'Transferencia Entrada' || tipoInterno === 'Transferencia Salida') return 'Transferencia entre Bodegas'
  if (tipoInterno === 'Salida a Centro de Costo') return 'Salida de Almacén'
  if (tipoInterno === 'Entrada por Ajuste' || tipoInterno === 'Salida por Ajuste') return 'Ajuste de Inventario'
  return tipoInterno
}

function KardexContent() {
  const t = useTranslations('pages')
  const tF = useTranslations('fields')
  const tPh = useTranslations('placeholders')
  const tH = useTranslations('headers')
  const tSub = useTranslations('subtitles')
  const tHelp = useTranslations('help')
  const permisos = usePermisos('productos')
  const todosProductos = useProductosStore(s => s.productos).filter(p => !!p.codigo && !!p.descripcion)

  // Tipo de Inventario activo de sesión (única fuente de verdad)
  const tipoInvFiltro = useTipoInventarioSesion(s => s.tipoActivo) || ''
  const productos = tipoInvFiltro
    ? todosProductos.filter(p => p.tipo_inventario === tipoInvFiltro)
    : todosProductos
  const bodegas = useBodegasStore(s => s.bodegas)
  const searchParams = useSearchParams()

  const [productoId, setProductoId] = useState(searchParams?.get('producto') || '')
  const [bodegaFilter, setBodegaFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Producto seleccionado
  const producto = useMemo(() =>
    productos.find(p => p.id === productoId)
  , [productos, productoId])

  // Consolidar todos los movimientos del producto en TODAS las bodegas
  const movimientos = useMemo(() => {
    if (!producto) return [] as MovimientoConBodega[]
    const out: MovimientoConBodega[] = []
    for (const b of bodegas) {
      const movs = b.movimientos || []
      for (const m of movs) {
        if (m.producto_id !== producto.id && m.producto_codigo !== producto.codigo) continue
        out.push({ ...m, bodega_id: b.id, bodega_nombre: b.nombre })
      }
    }
    // Ordenar cronologicamente: por fecha asc, luego por orden de creacion (id)
    return out.sort((a, b) => {
      const fa = a.fecha || ''
      const fb = b.fecha || ''
      if (fa < fb) return -1
      if (fa > fb) return 1
      // Mismo dia: mantener orden por tipo (entradas primero) y luego por id
      const ea = a.cantidad >= 0 ? 0 : 1
      const eb = b.cantidad >= 0 ? 0 : 1
      if (ea !== eb) return ea - eb
      return a.id.localeCompare(b.id)
    })
  }, [producto, bodegas])

  // Filtrar
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      if (bodegaFilter && m.bodega_id !== bodegaFilter) return false
      if (tipoFilter && categoriaKardex(m.tipo) !== tipoFilter) return false
      if (desde && m.fecha < desde) return false
      if (hasta && m.fecha > hasta) return false
      return true
    })
  }, [movimientos, bodegaFilter, tipoFilter, desde, hasta])

  // Calcular saldo acumulado y valor (sobre los filtrados)
  const renglones = useMemo<RenglonKardex[]>(() => {
    let saldo = 0
    return movimientosFiltrados.map(m => {
      saldo += m.cantidad
      const cp = m.costo_promedio || 0
      const saldoValor = Math.round(saldo * cp * 100) / 100
      return { ...m, saldo_acumulado: saldo, saldo_valor: saldoValor }
    })
  }, [movimientosFiltrados])

  // Totales
  const totalEntradas = renglones.filter(r => r.cantidad > 0).reduce((s, r) => s + r.cantidad, 0)
  const totalSalidas = renglones.filter(r => r.cantidad < 0).reduce((s, r) => s + Math.abs(r.cantidad), 0)
  const saldoFinal = renglones.length > 0 ? renglones[renglones.length - 1].saldo_acumulado : 0
  const valorFinal = renglones.length > 0 ? renglones[renglones.length - 1].saldo_valor : 0

  // Tipos disponibles para filtro (categorias agrupadas)
  const tiposDisponibles = useMemo(() =>
    Array.from(new Set(movimientos.map(m => categoriaKardex(m.tipo))))
  , [movimientos])

  // Bodegas que tienen movimientos para este producto
  const bodegasConMovs = useMemo(() => {
    const ids = new Set(movimientos.map(m => m.bodega_id))
    return bodegas.filter(b => ids.has(b.id))
  }, [movimientos, bodegas])

  // Buscador de productos
  const [searchProd, setSearchProd] = useState('')
  const productosFiltrados = useMemo(() => {
    if (searchProd.length < 2) return productos.slice(0, 20)
    const q = searchProd.toLowerCase()
    return productos.filter(p =>
      p.codigo.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [productos, searchProd])

  // Export
  const buildExportData = () => {
    const cols = [
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 22 },
      { header: 'Bodega', key: 'bodega', width: 22 },
      { header: tH('documento'), key: 'documento', width: 16 },
      { header: tH('entradas'), key: 'entradas', width: 10 },
      { header: tH('salidas'), key: 'salidas', width: 10 },
      { header: tH('saldo'), key: 'saldo', width: 10 },
      { header: tH('costoProm'), key: 'costo', width: 14 },
      { header: tH('saldoValor'), key: 'saldo_valor', width: 16 },
    ]
    const rows = renglones.map(r => ({
      fecha: fDate(r.fecha),
      tipo: categoriaKardex(r.tipo),
      bodega: r.bodega_nombre,
      documento: r.documento_origen,
      entradas: r.cantidad > 0 ? r.cantidad : '',
      salidas: r.cantidad < 0 ? Math.abs(r.cantidad) : '',
      saldo: r.saldo_acumulado,
      costo: fmtMoney(r.costo_promedio),
      saldo_valor: fmtMoney(r.saldo_valor),
    }))
    return {
      title: `Kardex de ${producto?.codigo || ''} - ${producto?.descripcion || ''}`,
      subtitle: `${renglones.length} movimientos`,
      columns: cols,
      rows,
      filename: `kardex-${producto?.codigo || 'producto'}`,
    }
  }

  const doExport = async (fmt: 'pdf' | 'excel' | 'print') => {
    if (!producto || renglones.length === 0) return
    setIsExporting(true)
    try {
      const opts = buildExportData()
      if (fmt === 'pdf') await exportToPDF(opts)
      else if (fmt === 'excel') await exportToExcel(opts)
      else printReport(opts)
    } finally {
      setIsExporting(false)
    }
  }

  if (!permisos.leer) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/60 text-lg">No tienes permisos para acceder a esta seccion.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">{t('kardex')}</h1>
        <p className="text-white/50 mt-1">{tHelp('kardexSubtitle')}</p>
      </div>

      {/* Selector de producto */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <label className="block text-lg font-extrabold text-blue-600 mb-3">Seleccionar Producto</label>
        <input
          type="text"
          value={searchProd}
          onChange={e => setSearchProd(e.target.value)}
          placeholder={tPh('buscarCodigoDesc')}
          className="w-full rounded-xl px-4 py-2.5 text-white outline-none mb-3"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {productosFiltrados.map(p => (
            <button
              key={p.id}
              onClick={() => setProductoId(p.id)}
              className="text-left px-3 py-2 rounded-lg transition-all"
              style={productoId === p.id
                ? { background: 'rgba(96,165,250,0.25)', border: '1px solid rgba(37,99,235,1)' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              <p className="text-xs font-mono font-bold text-blue-300">{p.codigo}</p>
              <p className="text-xs text-white truncate">{p.descripcion}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Si hay producto seleccionado */}
      {producto && (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl p-5" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <p className="text-xs text-green-300 uppercase tracking-wider mb-1">Total Entradas</p>
              <p className="text-2xl font-black text-white">{totalEntradas.toLocaleString('es-CO')}</p>
              <p className="text-xs text-green-300/70 mt-1">{producto.unidad_medida}</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-xs text-red-300 uppercase tracking-wider mb-1">Total Salidas</p>
              <p className="text-2xl font-black text-white">{totalSalidas.toLocaleString('es-CO')}</p>
              <p className="text-xs text-red-300/70 mt-1">{producto.unidad_medida}</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)' }}>
              <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">Saldo Final</p>
              <p className="text-2xl font-black text-white">{saldoFinal.toLocaleString('es-CO')}</p>
              <p className="text-xs text-blue-300/70 mt-1">{producto.unidad_medida}</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <p className="text-xs text-amber-300 uppercase tracking-wider mb-1">Valor Final</p>
              <p className="text-2xl font-black text-white">${fmtMoney(valorFinal)}</p>
              <p className="text-xs text-amber-300/70 mt-1">CP: ${fmtMoney(producto.costo_promedio || 0)}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-xs uppercase tracking-wider text-white/60 mb-3 font-semibold">Filtros</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Bodega</label>
                <select value={bodegaFilter} onChange={e => setBodegaFilter(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none"
                  style={{ background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <option value="">Todas</option>
                  {bodegasConMovs.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Tipo</label>
                <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none"
                  style={{ background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <option value="">Todos</option>
                  {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => doExport('pdf')} disabled={isExporting || renglones.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.4)' }}>
                📄 PDF
              </button>
              <button onClick={() => doExport('excel')} disabled={isExporting || renglones.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}>
                📊 Excel
              </button>
              <button onClick={() => doExport('print')} disabled={isExporting || renglones.length === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}>
                🖨️ Imprimir
              </button>
            </div>
          </div>

          {/* Tabla Kardex */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-sm font-bold text-white">{producto.codigo} — {producto.descripcion}</p>
              <p className="text-xs text-white/40 mt-1">{renglones.length} movimientos | Unidad: {producto.unidad_medida}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-base text-left" style={{ minWidth: '1100px' }}>
                <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <tr>
                    {['#', tF('fecha'), tF('tipo'), tF('bodega'), tH('documento'), tH('entradas'), tH('salidas'), tH('saldo'), tH('cpMov'), tH('saldoValor'), tF('observaciones')].map(h => (
                      <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((r, i) => {
                    const categoria = categoriaKardex(r.tipo)
                    const cfg = tipoColor[categoria] || { bg: 'rgba(255,255,255,0.08)', color: '#fff', border: 'rgba(255,255,255,0.2)' }
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="px-3 py-2.5 text-xs text-white/40 font-mono">{i + 1}</td>
                        <td className="px-3 py-2.5 text-white/70 text-xs whitespace-nowrap">{fDate(r.fecha)}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                            {categoria}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-white/70 text-xs">{r.bodega_nombre}</td>
                        <td className="px-3 py-2.5 text-blue-300 text-xs font-mono font-bold">{r.documento_origen}</td>
                        <td className="px-3 py-2.5 text-right text-green-300 font-bold whitespace-nowrap">
                          {r.cantidad > 0 ? r.cantidad.toLocaleString('es-CO') : ''}
                        </td>
                        <td className="px-3 py-2.5 text-right text-red-300 font-bold whitespace-nowrap">
                          {r.cantidad < 0 ? Math.abs(r.cantidad).toLocaleString('es-CO') : ''}
                        </td>
                        <td className="px-3 py-2.5 text-right text-white font-black whitespace-nowrap">
                          {r.saldo_acumulado.toLocaleString('es-CO')}
                        </td>
                        <td className="px-3 py-2.5 text-right text-white/70 whitespace-nowrap">${fmtMoney(r.costo_promedio)}</td>
                        <td className="px-3 py-2.5 text-right text-amber-300 font-semibold whitespace-nowrap">${fmtMoney(r.saldo_valor)}</td>
                        <td className="px-3 py-2.5 text-white font-medium text-xs">{r.observaciones || '—'}</td>
                      </tr>
                    )
                  })}
                  {renglones.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        No hay movimientos para este producto con los filtros seleccionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!producto && (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-5xl mb-3">📒</div>
          <p className="text-white/50 text-base">{tSub('kardex')}</p>
        </div>
      )}
    </div>
  )
}

export default function KardexPage() {
  return (
    <Suspense fallback={<div className="text-white/50">Cargando...</div>}>
      <KardexContent />
    </Suspense>
  )
}
