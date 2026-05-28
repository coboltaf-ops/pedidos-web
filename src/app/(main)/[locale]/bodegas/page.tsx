'use client'

import { useTranslations } from 'next-intl'

import { useState, useMemo, useRef } from 'react'
import { todayColombia } from '@/shared/lib/format-date'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import { useHojaProcesoStore } from '@/features/hoja-proceso/store/hoja-proceso-store'
import { useLoteCeldaStore, type LoteCelda } from '@/features/lote-celda/store/lote-celda-store'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { codigoMatchesTipo } from '@/shared/lib/tipo-inventario-prefijo'
import { fDate } from '@/shared/lib/format-date'
import { exportToPDF, exportToExcel, printReport } from '@/shared/lib/export-report'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { fmtMoney } from '@/shared/lib/format-number'
import ViewRecordModal from '@/shared/components/view-record-modal'
import VoiceSearchButton from '@/shared/components/voice-search-button'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Bodega = {
  id: string; nombre: string; correo: string; telefono: string
  direccion: string; ciudad: string; pais: string; tipo_inventario: string; situacion: string
}

type Movimiento = {
  id: string; consecutivo: string; nro_mov: number; fecha: string
  tipo: 'Entrada' | 'Salida' | 'Ajuste'
  bodega_id: string; bodega_nombre: string
  codigo_producto: string; descripcion_producto: string; unidad_medida: string
  cantidad: number; costo_unitario: number
  referencia: string; observaciones: string
}

// ─── Datos iniciales ──────────────────────────────────────────────────────────

const initialBodegas: Bodega[] = [
  { id: '1', nombre: 'Bodega Central', correo: 'bodega@empresa.com', telefono: '0212-5551234', direccion: 'Av. Principal #45', ciudad: 'Caracas', pais: 'Venezuela', tipo_inventario: 'Materiales  y Suministros', situacion: 'Activa' },
]

const today = todayColombia()

const emptyBodega = (): Bodega => ({ id: '', nombre: '', correo: '', telefono: '', direccion: '', ciudad: '', pais: 'Venezuela', tipo_inventario: '', situacion: 'Activa' })

const emptyMov = (nro: number, bodegas: Bodega[]): Movimiento => ({
  id: '', consecutivo: `MOV-${String(nro).padStart(5, '0')}`, nro_mov: nro,
  fecha: today, tipo: 'Entrada',
  bodega_id: bodegas[0]?.id ?? '', bodega_nombre: bodegas[0]?.nombre ?? '',
  codigo_producto: '', descripcion_producto: '', unidad_medida: 'Unidad',
  cantidad: 0, costo_unitario: 0, referencia: '', observaciones: '',
})

// ─── Estilos helpers ──────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selectSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const sitStyle = (s: string): React.CSSProperties => {
  if (s === 'Activa') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'En Mantenimiento') return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
  return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
}

/**
 * Mapea los tipos internos del store a categoria simple del Kardex.
 * Recepcion Factura, Transferencia entre Bodegas, Salida de Almacen, Ajuste de Inventario, Carga Inicial.
 */
function categoriaMov(tipoInterno: string): string {
  if (tipoInterno === 'Carga Inicial de Saldos') return 'Carga Inicial de Saldos'
  if (tipoInterno === 'Recepción Factura') return 'Recepción Factura'
  if (tipoInterno === 'Transferencia Entrada' || tipoInterno === 'Transferencia Salida') return 'Transferencia entre Bodegas'
  if (tipoInterno === 'Salida a Centro de Costo') return 'Salida de Almacén'
  if (tipoInterno === 'Entrada por Ajuste' || tipoInterno === 'Salida por Ajuste') return 'Ajuste de Inventario'
  return tipoInterno
}

const categoriaStyle = (cat: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    'Carga Inicial de Saldos':    { background: 'rgba(168,85,247,0.2)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.4)' },
    'Recepción Factura':          { background: 'rgba(34,197,94,0.95)',  color: '#fff', border: '1px solid rgba(34,197,94,0.4)' },
    'Transferencia entre Bodegas':{ background: 'rgba(59,130,246,0.2)', color: '#fff', border: '1px solid rgba(59,130,246,0.4)' },
    'Salida de Almacén':          { background: 'rgba(236,72,153,0.2)', color: '#f9a8d4', border: '1px solid rgba(236,72,153,0.4)' },
    'Ajuste de Inventario':       { background: 'rgba(251,146,60,0.2)', color: '#fdba74', border: '1px solid rgba(251,146,60,0.4)' },
  }
  return map[cat] || { background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function BodegasPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tPh = useTranslations('placeholders')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tSec = useTranslations('sections')
  const tTip = useTranslations('tooltips')
  const tRpt = useTranslations('reportTitles')
  const tOp = useTranslations('options')
  const tEs = useTranslations('emptyState')
  const permisos = usePermisos('bodegas')
  const refData = useReferenceStore(s => s.data)

  const [tab, setTab] = useState<'bodegas' | 'movimientos' | 'saldos' | 'lotes' | 'reportes' | 'especificos'>('bodegas')

  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const esMP = tipoActivo === 'Materia Prima'
  const labelBodega = esMP ? 'Celda' : 'Bodega'
  const labelBodegas = esMP ? 'Celdas' : 'Bodegas'

  // ── Estado Bodegas ──────────────────────────────────────────────────────────
  const { bodegas: todasBodegas } = useBodegasStore()
  const bodegas = tipoActivo ? todasBodegas.filter(b => b.tipo_inventario === tipoActivo) : todasBodegas
  const setBodegas = (fn: (prev: Bodega[]) => Bodega[]) => useBodegasStore.setState(s => ({ bodegas: fn(s.bodegas as Bodega[]) }))
  const [formBodega, setFormBodega] = useState<Bodega>(emptyBodega())
  const [isBodegaFormOpen, setIsBodegaFormOpen] = useState(false)
  const [searchBodega, setSearchBodega] = useState('')
  const [viewRecord, setViewRecord] = useState<Bodega | null>(null)

  // ── Estado Movimientos ──────────────────────────────────────────────────────
  const productos = useProductosStore(s => s.productos).filter(p => p.situacion === 'Activo' && !!p.descripcion && !!p.codigo)
  const hojasProceso = useHojaProcesoStore(s => s.hojas)
  const proveedoresAll = useProveedoresStore(s => s.proveedores)
  const proveedoresActivos = useMemo(
    () => proveedoresAll.filter(p => p.situacion === 'Activo').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [proveedoresAll]
  )
  const celdasRef = useReferenceStore(s => s.data.celda)
  const celdasActivas = useMemo(
    () => (celdasRef || []).filter(c => c.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')),
    [celdasRef]
  )
  const productosMP = useMemo(
    () => productos
      .filter(p => p.situacion === 'Activo' && (p.tipo_inventario || '') === 'Materia Prima')
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')),
    [productos]
  )

  // ── Modal "Registrar Lote en Celda" — identificación (sin cantidad) ────────
  const lotesCelda = useLoteCeldaStore(s => s.lotes)
  const addLoteCelda = useLoteCeldaStore(s => s.addLote)
  const updateLoteCelda = useLoteCeldaStore(s => s.updateLote)
  const deleteLoteCelda = useLoteCeldaStore(s => s.deleteLote)
  const [isLoteFormOpen, setIsLoteFormOpen] = useState(false)
  const [editLoteId, setEditLoteId] = useState<string | null>(null)
  const [loteFormError, setLoteFormError] = useState('')
  const [loteForm, setLoteForm] = useState({
    nro_celda: '',
    producto_id: '',
    lote: '',
    fecha: today,
    proveedor_id: '',
    nro_remision: '',
  })

  const resetLoteForm = () => {
    setLoteForm({
      nro_celda: '',
      producto_id: '',
      lote: '',
      fecha: today,
      proveedor_id: '',
      nro_remision: '',
    })
    setEditLoteId(null)
    setLoteFormError('')
  }

  const editarLote = (l: LoteCelda) => {
    setEditLoteId(l.id)
    setLoteForm({
      nro_celda: l.nro_celda,
      producto_id: l.producto_id,
      lote: l.lote,
      fecha: l.fecha,
      proveedor_id: l.proveedor_id,
      nro_remision: l.nro_remision,
    })
    setLoteFormError('')
    setIsLoteFormOpen(true)
  }

  const guardarLote = () => {
    setLoteFormError('')
    if (!loteForm.nro_celda) { setLoteFormError('Seleccione una Celda.'); return }
    if (!loteForm.producto_id) { setLoteFormError('Seleccione el Producto.'); return }
    if (!loteForm.lote.trim()) { setLoteFormError('Indique el Nro. de Lote.'); return }
    const prod = productosMP.find(p => p.id === loteForm.producto_id)
    const prov = proveedoresActivos.find(p => p.id === loteForm.proveedor_id)
    const datos = {
      nro_celda: loteForm.nro_celda,
      producto_id: loteForm.producto_id,
      codigo_producto: prod?.codigo || '',
      nombre_producto: prod?.descripcion || '',
      lote: loteForm.lote.trim(),
      fecha: loteForm.fecha,
      proveedor_id: loteForm.proveedor_id,
      proveedor_nombre: prov?.nombre || '',
      nro_remision: loteForm.nro_remision.trim(),
    }
    if (editLoteId) {
      updateLoteCelda(editLoteId, datos)
    } else {
      const nuevo: LoteCelda = { id: crypto.randomUUID(), ...datos }
      addLoteCelda(nuevo)
    }
    setIsLoteFormOpen(false)
    resetLoteForm()
  }
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [formMov, setFormMov] = useState<Movimiento>(emptyMov(1, initialBodegas))
  const [isMovFormOpen, setIsMovFormOpen] = useState(false)
  const [filterBodega, setFilterBodega] = useState('')
  const [filterMovProducto, setFilterMovProducto] = useState('')
  const [filterMovDesde, setFilterMovDesde] = useState('')
  const [filterMovHasta, setFilterMovHasta] = useState('')
  const [searchProd, setSearchProd] = useState('')
  const searchProdRef = useRef<HTMLInputElement>(null)

  // ── Estado Reportes ─────────────────────────────────────────────────────────
  const [rptBodegaTitle, setRptBodegaTitle] = useState(tRpt('bodegas'))
  const [rptBodegaSituacion, setRptBodegaSituacion] = useState('')

  const [rptMovTitle, setRptMovTitle] = useState(tRpt('movimientosBodega'))
  const [rptMovDesde, setRptMovDesde] = useState('')
  const [rptMovHasta, setRptMovHasta] = useState('')
  const [rptMovBodega, setRptMovBodega] = useState('')
  const [rptMovTipo, setRptMovTipo] = useState('')
  const [rptMovProducto, setRptMovProducto] = useState('')

  const [isExportingBodega, setIsExportingBodega] = useState(false)
  const [isExportingMov, setIsExportingMov] = useState(false)

  // ── Saldos calculados (legacy: desde movimientos locales) ──────────────────
  const saldosLegacy = useMemo(() => {
    const map = new Map<string, { bodega_id: string; bodega_nombre: string; codigo_producto: string; descripcion_producto: string; unidad_medida: string; costo_unitario: number; saldo: number }>()
    for (const m of movimientos) {
      const key = `${m.bodega_id}||${m.codigo_producto}`
      const prev = map.get(key) ?? { bodega_id: m.bodega_id, bodega_nombre: m.bodega_nombre, codigo_producto: m.codigo_producto, descripcion_producto: m.descripcion_producto, unidad_medida: m.unidad_medida, costo_unitario: m.costo_unitario, saldo: 0 }
      const delta = m.tipo === 'Entrada' ? m.cantidad : m.tipo === 'Salida' ? -m.cantidad : m.cantidad
      map.set(key, { ...prev, saldo: prev.saldo + delta, costo_unitario: m.costo_unitario })
    }
    return Array.from(map.values())
  }, [movimientos])

  // ── Saldos del NUEVO store (los que vienen de Recepcion de Facturas, etc.) ──
  const saldosStore = useMemo(() => {
    const out: { bodega_id: string; bodega_nombre: string; codigo_producto: string; descripcion_producto: string; unidad_medida: string; costo_unitario: number; saldo: number }[] = []
    for (const b of bodegas) {
      if (!b.saldos) continue
      for (const s of b.saldos) {
        out.push({
          bodega_id: b.id,
          bodega_nombre: b.nombre,
          codigo_producto: s.codigo,
          descripcion_producto: s.descripcion,
          unidad_medida: s.unidad_medida,
          costo_unitario: s.costo_promedio,
          saldo: s.existencia,
        })
      }
    }
    return out
  }, [bodegas])

  // ── Saldos derivados de Hoja de Proceso (por celda + producto) ──
  const saldosHojaProceso = useMemo(() => {
    const out: { bodega_id: string; bodega_nombre: string; codigo_producto: string; descripcion_producto: string; unidad_medida: string; costo_unitario: number; saldo: number }[] = []
    const map = new Map<string, typeof out[number]>()
    for (const h of hojasProceso) {
      if (h.estado !== 'Registrado') continue
      const celdaKey = (h.nro_celda || '').trim().toUpperCase()
      if (!celdaKey) continue
      const bodega_id = `celda:${celdaKey}`
      const bodega_nombre = `Celda ${h.nro_celda}`
      const key = `${bodega_id}||${h.codigo_producto}`
      const delta = h.movimiento === 'Entra' ? h.cantidad_kg : -h.cantidad_kg
      const prev = map.get(key)
      if (prev) {
        map.set(key, { ...prev, saldo: prev.saldo + delta })
      } else {
        map.set(key, {
          bodega_id,
          bodega_nombre,
          codigo_producto: h.codigo_producto,
          descripcion_producto: h.nombre_producto,
          unidad_medida: h.unidad_medida || 'kg',
          costo_unitario: 0,
          saldo: delta,
        })
      }
    }
    for (const v of map.values()) out.push(v)
    return out
  }, [hojasProceso])

  // ── Saldos combinados — fuente estricta según tipo de inventario activo ──
  //   Materia Prima (Celdas): solo Hoja de Proceso
  //   Otros tipos (Bodegas): legacy + store de bodegas
  const saldos = useMemo(() => {
    if (esMP) return saldosHojaProceso
    const map = new Map<string, { bodega_id: string; bodega_nombre: string; codigo_producto: string; descripcion_producto: string; unidad_medida: string; costo_unitario: number; saldo: number }>()
    for (const s of [...saldosLegacy, ...saldosStore]) {
      if (tipoActivo && !codigoMatchesTipo(s.codigo_producto, tipoActivo)) continue
      const key = `${s.bodega_id}||${s.codigo_producto}`
      const prev = map.get(key)
      if (prev) {
        map.set(key, { ...prev, saldo: prev.saldo + s.saldo, costo_unitario: s.costo_unitario })
      } else {
        map.set(key, s)
      }
    }
    return Array.from(map.values())
  }, [esMP, saldosLegacy, saldosStore, saldosHojaProceso, tipoActivo])

  // ── Movimientos del NUEVO store (los que vienen de Recepcion de Facturas, etc.) ──
  const movimientosStore = useMemo(() => {
    const out: Movimiento[] = []
    for (const b of bodegas) {
      if (!b.movimientos) continue
      for (const m of b.movimientos) {
        out.push({
          id: m.id,
          consecutivo: m.documento_origen,
          nro_mov: 0,
          fecha: m.fecha,
          tipo: (m.cantidad >= 0 ? 'Entrada' : 'Salida') as Movimiento['tipo'],
          bodega_id: b.id,
          bodega_nombre: b.nombre,
          codigo_producto: m.producto_codigo,
          descripcion_producto: m.producto_descripcion,
          unidad_medida: m.unidad_medida,
          cantidad: Math.abs(m.cantidad),
          costo_unitario: m.costo_promedio,
          referencia: m.tipo,
          observaciones: m.observaciones || '',
        })
      }
    }
    return out
  }, [bodegas])

  // ── Movimientos derivados de Hoja de Proceso ─────────────────────────────────
  const movimientosHojaProceso = useMemo(() => {
    return hojasProceso
      .filter(h => h.estado === 'Registrado')
      .map<Movimiento>(h => ({
        id: `hp-${h.id}`,
        consecutivo: h.consecutivo,
        nro_mov: h.nro_operacion || 0,
        fecha: h.fecha,
        tipo: h.movimiento === 'Entra' ? 'Entrada' : 'Salida',
        bodega_id: `celda:${(h.nro_celda || '').trim().toUpperCase()}`,
        bodega_nombre: h.nro_celda ? `Celda ${h.nro_celda}` : 'Celda sin asignar',
        codigo_producto: h.codigo_producto,
        descripcion_producto: h.nombre_producto,
        unidad_medida: h.unidad_medida || 'kg',
        cantidad: h.cantidad_kg,
        costo_unitario: 0,
        referencia: 'Hoja de Proceso',
        observaciones: h.observaciones || '',
      }))
  }, [hojasProceso])

  // Movimientos combinados — fuente estricta según tipo de inventario activo
  //   Materia Prima (Celdas): solo Hoja de Proceso
  //   Otros tipos (Bodegas): legacy + store de bodegas
  const movimientosCombinados = useMemo(() => {
    if (esMP) return movimientosHojaProceso
    const all = [...movimientos, ...movimientosStore]
    return tipoActivo ? all.filter(m => codigoMatchesTipo(m.codigo_producto, tipoActivo)) : all
  }, [esMP, movimientos, movimientosStore, movimientosHojaProceso, tipoActivo])

  // ── Reportes filtrados ──────────────────────────────────────────────────────
  const filteredRptBodegas = useMemo(() => {
    return bodegas.filter(b => !rptBodegaSituacion || b.situacion === rptBodegaSituacion)
  }, [bodegas, rptBodegaSituacion])

  const filteredRptMovimientos = useMemo(() => {
    const q = rptMovProducto.toLowerCase().trim()
    return movimientosCombinados.filter(m => {
      if (rptMovDesde && m.fecha < rptMovDesde) return false
      if (rptMovHasta && m.fecha > rptMovHasta) return false
      if (rptMovBodega && m.bodega_id !== rptMovBodega) return false
      if (rptMovTipo) {
        const cat = m.referencia ? categoriaMov(m.referencia) : m.tipo
        if (cat !== rptMovTipo) return false
      }
      if (q && !m.codigo_producto.toLowerCase().includes(q) && !m.descripcion_producto.toLowerCase().includes(q)) return false
      return true
    })
  }, [movimientosCombinados, rptMovDesde, rptMovHasta, rptMovBodega, rptMovTipo, rptMovProducto])

  // ── Handlers Bodegas ────────────────────────────────────────────────────────
  const handleSaveBodega = (e: React.FormEvent) => {
    e.preventDefault()
    if (formBodega.id) setBodegas(prev => prev.map(r => r.id === formBodega.id ? { ...formBodega } : r))
    else setBodegas(prev => [...prev, { ...formBodega, id: crypto.randomUUID() }])
    setIsBodegaFormOpen(false)
  }

  // ── Handlers Movimientos ────────────────────────────────────────────────────
  const handleBodegaChange = (bodegaId: string) => {
    const b = bodegas.find(b => b.id === bodegaId)
    setFormMov({ ...formMov, bodega_id: bodegaId, bodega_nombre: b?.nombre ?? '' })
  }

  const handleSaveMov = (e: React.FormEvent) => {
    e.preventDefault()
    setMovimientos(prev => [...prev, { ...formMov, id: crypto.randomUUID() }])
    setIsMovFormOpen(false)
    setSearchProd('')
    setFormMov(emptyMov(movimientos.length + 2, bodegas))
  }

  // ── Export handlers ─────────────────────────────────────────────────────────
  const colsBodegas = [
    { header: 'Nombre',    key: 'nombre',    width: 22 },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'Ciudad',    key: 'ciudad',    width: 16 },
    { header: 'País',      key: 'pais',      width: 14 },
    { header: 'Situación', key: 'situacion', width: 14 },
  ]

  const colsMovimientos = [
    { header: 'Consecutivo',   key: 'consecutivo',         width: 14 },
    { header: 'Fecha',         key: 'fecha',               width: 12 },
    { header: 'Tipo',          key: 'tipo',                width: 10 },
    { header: 'Bodega',        key: 'bodega_nombre',       width: 20 },
    { header: 'Código',        key: 'codigo_producto',     width: 14 },
    { header: 'Descripción',   key: 'descripcion_producto', width: 28 },
    { header: 'Cantidad',      key: 'cantidad',            width: 10 },
    { header: tH('costoUnit'),   key: 'costo_unitario',      width: 12 },
    { header: tH('total'),         key: 'total',               width: 12 },
    { header: 'Referencia',    key: 'referencia',          width: 14 },
  ]

  const buildMovRows = (rows: Movimiento[]) =>
    rows.map(m => ({
      consecutivo: m.consecutivo,
      fecha: m.fecha,
      tipo: m.tipo,
      bodega_nombre: m.bodega_nombre,
      codigo_producto: m.codigo_producto,
      descripcion_producto: m.descripcion_producto,
      cantidad: m.cantidad,
      costo_unitario: fmtMoney(m.costo_unitario),
      total: fmtMoney(m.cantidad * m.costo_unitario),
      referencia: m.referencia || '—',
    }))

  const buildBodegaSubtitle = () => {
    const parts: string[] = []
    if (rptBodegaSituacion) parts.push(`Situación: ${rptBodegaSituacion}`)
    return parts.length ? parts.join(' | ') : undefined
  }

  const buildMovSubtitle = () => {
    const parts: string[] = []
    if (rptMovDesde) parts.push(`Desde: ${rptMovDesde}`)
    if (rptMovHasta) parts.push(`Hasta: ${rptMovHasta}`)
    if (rptMovBodega) {
      const b = bodegas.find(x => x.id === rptMovBodega)
      if (b) parts.push(`Bodega: ${b.nombre}`)
    }
    if (rptMovTipo) parts.push(`Tipo: ${rptMovTipo}`)
    return parts.length ? parts.join(' | ') : undefined
  }

  const doExportBodega = async (format: 'pdf' | 'excel' | 'print') => {
    setIsExportingBodega(true)
    const opts = {
      title: rptBodegaTitle,
      subtitle: buildBodegaSubtitle(),
      columns: colsBodegas,
      rows: filteredRptBodegas as unknown as Record<string, string | number>[],
      filename: `bodegas-${today}`,
    }
    try {
      if (format === 'pdf') await exportToPDF(opts)
      else if (format === 'excel') await exportToExcel(opts)
      else printReport(opts)
    } finally {
      setIsExportingBodega(false)
    }
  }

  const doExportMov = async (format: 'pdf' | 'excel' | 'print') => {
    setIsExportingMov(true)
    const opts = {
      title: rptMovTitle,
      subtitle: buildMovSubtitle(),
      columns: colsMovimientos,
      rows: buildMovRows(filteredRptMovimientos),
      filename: `movimientos-bodega-${today}`,
    }
    try {
      if (format === 'pdf') await exportToPDF(opts)
      else if (format === 'excel') await exportToExcel(opts)
      else printReport(opts)
    } finally {
      setIsExportingMov(false)
    }
  }

  const filteredBodegas = bodegas.filter(r =>
    r.nombre.toLowerCase().includes(searchBodega.toLowerCase()) ||
    r.ciudad.toLowerCase().includes(searchBodega.toLowerCase())
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))

  const filteredMovimientos = useMemo(() => {
    const cod = filterMovProducto.trim().toLowerCase()
    return movimientosCombinados.filter(m => {
      if (filterBodega && m.bodega_id !== filterBodega) return false
      if (cod && m.codigo_producto.toLowerCase() !== cod) return false
      if (filterMovDesde && m.fecha < filterMovDesde) return false
      if (filterMovHasta && m.fecha > filterMovHasta) return false
      return true
    })
  }, [movimientosCombinados, filterBodega, filterMovProducto, filterMovDesde, filterMovHasta])

  const filteredSaldos = useMemo(() => {
    const cod = filterMovProducto.trim().toLowerCase()
    return saldos.filter(s => {
      if (filterBodega && s.bodega_id !== filterBodega) return false
      if (cod && s.codigo_producto.toLowerCase() !== cod) return false
      return true
    })
  }, [saldos, filterBodega, filterMovProducto])

  // ─── TAB: BODEGAS ────────────────────────────────────────────────────────────
  const renderBodegas = () => (
    <>
      {isBodegaFormOpen && (
        <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <h2 className="text-lg font-semibold text-white mb-4">{formBodega.id ? 'Editar' : 'Nueva'} {labelBodega}</h2>
          <form onSubmit={handleSaveBodega} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              { label: tF('nombreRequired'), key: 'nombre', placeholder: `${labelBodega} Central` },
              { label: tF('direccion'), key: 'direccion', placeholder: 'Av. Principal #123' },
            ] as { label: string; key: keyof Bodega; placeholder: string }[]).map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xl font-extrabold text-white mb-1">{label}</label>
                <input required={label.includes('*')} value={String(formBodega[key])}
                  onChange={e => {
                    const nuevo = { ...formBodega, [key]: e.target.value }
                    // Autocompletar al escribir el nombre cuando es Materia Prima (Celdas SPIN)
                    if (esMP && key === 'nombre' && e.target.value.trim().length > 0) {
                      if (!nuevo.direccion) nuevo.direccion = 'Bodega Ppal SPIN Caldas'
                      if (!nuevo.ciudad) nuevo.ciudad = 'Caldas'
                      if (!nuevo.pais) nuevo.pais = 'Colombia'
                      if (!nuevo.tipo_inventario) nuevo.tipo_inventario = 'Materia Prima'
                    }
                    setFormBodega(nuevo)
                  }}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} placeholder={placeholder} />
              </div>
            ))}
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Ciudad</label>
              {(() => {
                const opts = (refData.ciudad ?? []).filter(c => c.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
                const valActual = formBodega.ciudad
                const existeOpt = !valActual || opts.some(c => c.descripcion === valActual)
                return (
                  <select value={valActual} onChange={e => setFormBodega({ ...formBodega, ciudad: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                    <option value="">{tOp('seleccione')}</option>
                    {!existeOpt && <option value={valActual}>{valActual}</option>}
                    {opts.map(c => <option key={c.id} value={c.descripcion}>{c.descripcion}</option>)}
                  </select>
                )
              })()}
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">País</label>
              {(() => {
                const opts = (refData.pais ?? []).filter(p => p.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
                const valActual = formBodega.pais
                const existeOpt = !valActual || opts.some(p => p.descripcion === valActual)
                return (
                  <select value={valActual} onChange={e => setFormBodega({ ...formBodega, pais: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                    <option value="">{tOp('seleccione')}</option>
                    {!existeOpt && <option value={valActual}>{valActual}</option>}
                    {opts.map(p => <option key={p.id} value={p.descripcion}>{p.descripcion}</option>)}
                  </select>
                )
              })()}
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Tipo de Inventario que Maneja <span className="text-red-400">*</span></label>
              <select required value={formBodega.tipo_inventario} onChange={e => setFormBodega({ ...formBodega, tipo_inventario: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                <option value="">{tOp('seleccione')}</option>
                {(refData.tipo_inventario ?? []).filter(t => t.situacion).map(t => (
                  <option key={t.id} value={t.descripcion}>{t.descripcion}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
              <select value={formBodega.situacion} onChange={e => setFormBodega({ ...formBodega, situacion: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                {refData.situacion_bodega.map(s => <option key={s.id} value={s.descripcion}>{s.descripcion}</option>)}
              </select>
            </div>
            <div className="lg:col-span-3 flex gap-3 pt-2">
              <button type="submit" className="px-6 py-2 rounded-xl text-white font-medium" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{tBtn('save')}</button>
              <button type="button" onClick={() => setIsBodegaFormOpen(false)} className="px-6 py-2 rounded-xl text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>{tBtn('cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {!esMP && (
          <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 max-w-xs">
              <input value={searchBodega} onChange={e => setSearchBodega(e.target.value)}
                className="w-full rounded-xl px-4 py-2 text-white outline-none text-base text-white font-bold" style={inputSt}
                placeholder={tPh('buscarBodega')} />
              <VoiceSearchButton onResult={setSearchBodega} />
            </div>
          </div>
        )}
        <table className="w-full text-base text-left">
          <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
            <tr>
              {[tF('nombre'), tH('ciudadPais'), 'Tipo Inv.', tF('situacion'), tTbl('actions')].map(h => (
                <th key={h} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredBodegas.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td className="px-6 py-4 font-medium text-white">{r.nombre}</td>
                <td className="px-6 py-4 text-white/70">{r.ciudad}, {r.pais}</td>
                <td className="px-6 py-4 text-white/70 text-xs">{r.tipo_inventario || '—'}</td>
                <td className="px-6 py-4"><span className="px-3 py-1 rounded-full text-xs font-medium" style={sitStyle(r.situacion)}>{r.situacion}</span></td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => setViewRecord(r)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)' }}>Ver</button>
                    {permisos.editar && <button onClick={() => { setFormBodega({ ...r }); setIsBodegaFormOpen(true) }} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>{tBtn('edit')}</button>}
                    {permisos.eliminar && <button onClick={() => { if (confirm(tCf('delBodega'))) setBodegas(prev => prev.filter(b => b.id !== r.id)) }} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>}
                  </div>
                </td>
              </tr>
            ))}
            {filteredBodegas.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tE('noBodegas')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )

  // ─── TAB: MOVIMIENTOS ────────────────────────────────────────────────────────
  const renderMovimientos = () => (
    <>
      {isMovFormOpen && (
        <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-semibold text-white">{tSec('nuevoMovimiento')}</h2>
            <span className="font-mono text-sm px-3 py-1 rounded-lg" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>{formMov.consecutivo}</span>
          </div>
          <form onSubmit={handleSaveMov}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Tipo */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Tipo *</label>
                <select required value={formMov.tipo} onChange={e => setFormMov({ ...formMov, tipo: e.target.value as Movimiento['tipo'] })}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                  <option value="Entrada">Entrada</option>
                  <option value="Salida">Salida</option>
                  <option value="Ajuste">Ajuste</option>
                </select>
              </div>
              {/* Fecha */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Fecha *</label>
                <input type="date" required value={formMov.fecha} onChange={e => setFormMov({ ...formMov, fecha: e.target.value })}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
              </div>
              {/* Bodega */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Bodega *</label>
                <select required value={formMov.bodega_id} onChange={e => handleBodegaChange(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                  <option value="">{tOp('seleccione')}</option>
                  {bodegas.filter(b => b.situacion === 'Activa').map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              {/* Referencia */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Referencia</label>
                <input value={formMov.referencia} onChange={e => setFormMov({ ...formMov, referencia: e.target.value })}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
                  placeholder="OC-00001 / RF-00001" />
              </div>
              {/* Campo oculto para validación de producto requerido */}
              <input type="text" required value={formMov.codigo_producto} onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden="true" />
              {/* Buscador de Producto */}
              <div className="lg:col-span-4">
                <label className="block text-xl font-extrabold text-white mb-1">Buscar Producto *</label>
                {formMov.codigo_producto ? (
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.3)' }}>
                    <span className="font-mono text-xs font-bold" style={{ color: '#fff' }}>{formMov.codigo_producto}</span>
                    <span className="text-white flex-1">{formMov.descripcion_producto}</span>
                    <span className="text-white/50 text-xs">{formMov.unidad_medida}</span>
                    <button type="button" onClick={() => { setFormMov({ ...formMov, codigo_producto: '', descripcion_producto: '', unidad_medida: 'Unidad', costo_unitario: 0, cantidad: 0 }); setSearchProd(''); setTimeout(() => searchProdRef.current?.focus(), 50) }}
                      className="text-white/40 hover:text-white/70 text-xs px-2 py-1 rounded-lg transition-colors" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <input ref={searchProdRef} value={searchProd}
                        onChange={e => setSearchProd(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setSearchProd('') }}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                        placeholder="Escriba nombre o código del producto..." />
                      <VoiceSearchButton onResult={setSearchProd} />
                    </div>
                    {searchProd.trim().length > 0 && (() => {
                      const matches = productos.filter(p =>
                        p.codigo.toLowerCase().includes(searchProd.toLowerCase()) ||
                        p.descripcion.toLowerCase().includes(searchProd.toLowerCase())
                      ).slice(0, 8)
                      if (matches.length === 0) return <p className="text-white/30 text-xs mt-2">No se encontraron productos</p>
                      return (
                        <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                          {matches.map(p => (
                            <button key={p.id} type="button"
                              onClick={() => {
                                setFormMov({ ...formMov, codigo_producto: p.codigo, descripcion_producto: p.descripcion, unidad_medida: p.unidad_medida, costo_unitario: p.ult_costo })
                                setSearchProd('')
                              }}
                              className="w-full flex items-center gap-4 px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <span className="font-mono text-xs" style={{ color: '#fff' }}>{p.codigo}</span>
                              <span className="text-white/80 flex-1">{p.descripcion}</span>
                              <span className="text-white/40 text-xs">{p.unidad_medida}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
              {/* Cantidad */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Cantidad *</label>
                <input type="number" required min="0.01" step="0.01" value={formMov.cantidad || ''}
                  onChange={e => setFormMov({ ...formMov, cantidad: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
              </div>
              {/* Observaciones */}
              <div className="lg:col-span-2">
                <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
                <input value={formMov.observaciones} onChange={e => setFormMov({ ...formMov, observaciones: e.target.value })}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} placeholder="Notas opcionales" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-6 py-2 rounded-xl text-white font-medium" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{tBtn('registerMovement')}</button>
              <button type="button" onClick={() => { setIsMovFormOpen(false); setSearchProd('') }} className="px-6 py-2 rounded-xl text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>{tBtn('cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <select value={filterBodega} onChange={e => setFilterBodega(e.target.value)}
          className="rounded-xl px-4 py-2 text-sm outline-none" style={selectSt}>
          <option value="">{esMP ? 'Todas las celdas' : 'Todas las bodegas'}</option>
          {esMP ? (() => {
            const celdasHP = Array.from(new Set(movimientosHojaProceso.map(m => m.bodega_id)))
            return celdasHP.map(id => {
              const nombre = movimientosHojaProceso.find(m => m.bodega_id === id)?.bodega_nombre || id
              return <option key={id} value={id}>{nombre}</option>
            })
          })() : bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        <select value={filterMovProducto} onChange={e => setFilterMovProducto(e.target.value)}
          className="rounded-xl px-4 py-2 text-sm outline-none" style={selectSt}>
          <option value="">Todos los productos</option>
          {productos
            .filter(p => !tipoActivo || codigoMatchesTipo(p.codigo, tipoActivo))
            .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
            .map(p => (
              <option key={p.id} value={p.codigo}>
                {(p.codigo_alterno || p.codigo)} — {p.descripcion}
              </option>
            ))}
        </select>
        <input type="date" value={filterMovDesde} onChange={e => setFilterMovDesde(e.target.value)}
          className="rounded-xl px-4 py-2 text-sm outline-none" style={inputSt}
          title="Fecha Desde" />
        <input type="date" value={filterMovHasta} onChange={e => setFilterMovHasta(e.target.value)}
          className="rounded-xl px-4 py-2 text-sm outline-none" style={inputSt}
          title="Fecha Hasta" />
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <table className="w-full text-base text-left">
          <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
            <tr>
              {[tF('consecutivo'), tF('fecha'), tF('tipo'), esMP ? 'Celda' : tF('bodega'), tF('codigo'), tF('descripcion'), tF('unidad'), tF('cantidad'), tH('costoUnit'), tH('total'), tF('referencia')].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMovimientos.map(m => {
              const cat = m.referencia ? categoriaMov(m.referencia) : (m.tipo === 'Entrada' ? 'Entrada' : 'Salida')
              return (
              <tr key={m.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: '#fff' }}>{m.consecutivo}</td>
                <td className="px-4 py-3 text-white/60">{fDate(m.fecha)}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={categoriaStyle(cat)}>{cat}</span></td>
                <td className="px-4 py-3 text-white/80">{m.bodega_nombre}</td>
                <td className="px-4 py-3 font-mono text-xs text-white">{m.codigo_producto}</td>
                <td className="px-4 py-3 text-white/80 max-w-xs truncate">{m.descripcion_producto}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{m.unidad_medida}</td>
                <td className="px-4 py-3 text-center font-bold" style={{ color: m.tipo === 'Entrada' ? '#93c5fd' : m.tipo === 'Salida' ? '#fca5a5' : '#fcd34d' }}>
                  {m.tipo === 'Salida' ? '-' : '+'}{m.cantidad}
                </td>
                <td className="px-4 py-3 text-white/60 text-right">${fmtMoney(m.costo_unitario)}</td>
                <td className="px-4 py-3 text-white text-right font-medium">${fmtMoney(m.cantidad * m.costo_unitario)}</td>
                <td className="px-4 py-3 text-white font-mono text-xs font-bold">{m.referencia || '—'}</td>
              </tr>
              )
            })}
            {filteredMovimientos.length === 0 && (
              <tr><td colSpan={11} className="px-6 py-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tE('noMovimientos')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )

  // ─── TAB: SALDOS ─────────────────────────────────────────────────────────────
  const renderSaldos = () => (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterBodega} onChange={e => setFilterBodega(e.target.value)}
          className="rounded-xl px-4 py-2 text-sm outline-none" style={selectSt}>
          <option value="">{esMP ? 'Todas las celdas' : 'Todas las bodegas'}</option>
          {esMP ? (() => {
            const ids = Array.from(new Set(saldosHojaProceso.map(s => s.bodega_id)))
            return ids.map(id => {
              const nombre = saldosHojaProceso.find(s => s.bodega_id === id)?.bodega_nombre || id
              return <option key={id} value={id}>{nombre}</option>
            })
          })() : bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        <select value={filterMovProducto} onChange={e => setFilterMovProducto(e.target.value)}
          className="rounded-xl px-4 py-2 text-sm outline-none" style={selectSt}>
          <option value="">Todos los productos</option>
          {productos
            .filter(p => !tipoActivo || codigoMatchesTipo(p.codigo, tipoActivo))
            .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
            .map(p => (
              <option key={p.id} value={p.codigo}>
                {(p.codigo_alterno || p.codigo)} — {p.descripcion}
              </option>
            ))}
        </select>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <table className="w-full text-base text-left">
          <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
            <tr>
              {[esMP ? 'Celda' : tF('bodega'), tF('codigo'), tF('descripcion'), tF('unidad'), tH('saldoActual'), tH('costoUnit'), tH('valorTotal')].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSaldos.map((s, i) => (
              <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td className="px-5 py-4 text-white font-bold">{s.bodega_nombre}</td>
                <td className="px-5 py-4 font-mono text-xs text-white">{s.codigo_producto}</td>
                <td className="px-5 py-4 text-white font-bold">{s.descripcion_producto}</td>
                <td className="px-5 py-4 text-white/50 text-xs">{s.unidad_medida}</td>
                <td className="px-5 py-4 text-center">
                  <span className="font-bold text-lg" style={{ color: s.saldo > 0 ? '#93c5fd' : s.saldo < 0 ? '#fca5a5' : '#fcd34d' }}>{s.saldo}</span>
                </td>
                <td className="px-5 py-4 text-white/60 text-right">${fmtMoney(s.costo_unitario)}</td>
                <td className="px-5 py-4 text-right font-bold" style={{ color: '#fff' }}>${fmtMoney(s.saldo * s.costo_unitario)}</td>
              </tr>
            ))}
            {filteredSaldos.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {movimientos.length === 0 ? 'Registra movimientos para ver los saldos' : 'Sin saldos para los filtros seleccionados'}
              </td></tr>
            )}
          </tbody>
        </table>
        {filteredSaldos.length > 0 && (
          <div className="px-5 py-3 flex justify-end gap-2 text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Valor Total Inventario:</span>
            <span className="font-bold" style={{ color: '#fff' }}>${fmtMoney(filteredSaldos.reduce((s, r) => s + r.saldo * r.costo_unitario, 0))}</span>
          </div>
        )}
      </div>
    </>
  )

  // ─── TAB: REPORTES ───────────────────────────────────────────────────────────
  const renderReportes = () => (
    <div className="space-y-8">

      {/* ── Panel 1: Reporte de Bodegas / Celdas ───────────────────────────────── */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 className="text-base font-semibold text-white mb-5">{esMP ? 'Reporte de Celdas' : tRpt('bodegas')}</h2>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xl font-extrabold text-white mb-1">Título del Reporte</label>
            <input value={rptBodegaTitle} onChange={e => setRptBodegaTitle(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
              placeholder="Reporte de Bodegas" />
          </div>
          <div>
            <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
            <select value={rptBodegaSituacion} onChange={e => setRptBodegaSituacion(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
              <option value="">Todas</option>
              {refData.situacion_bodega.map(s => <option key={s.id} value={s.descripcion}>{s.descripcion}</option>)}
            </select>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl overflow-x-auto mb-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <table className="w-full text-base text-left">
            <thead style={{ background: 'rgba(255,255,255,0.06)' }}>
              <tr>
                {[tF('nombre'), tF('direccion'), tF('ciudad'), tF('pais'), tF('situacion')].map(h => (
                  <th key={h} className="px-4 py-2.5 font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRptBodegas.slice(0, 5).map(b => (
                <tr key={b.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-4 py-2.5 text-white font-medium">{b.nombre}</td>
                  <td className="px-4 py-2.5 text-white/70">{b.direccion}</td>
                  <td className="px-4 py-2.5 text-white/70">{b.ciudad}</td>
                  <td className="px-4 py-2.5 text-white/70">{b.pais}</td>
                  <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-full text-xs" style={sitStyle(b.situacion)}>{b.situacion}</span></td>
                </tr>
              ))}
              {filteredRptBodegas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tEs('sinRegistrosFiltros')}</td></tr>
              )}
            </tbody>
          </table>
          {filteredRptBodegas.length > 5 && (
            <div className="px-4 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              Mostrando 5 de {filteredRptBodegas.length} registros
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-wrap gap-3">
          <button
            disabled={isExportingBodega || filteredRptBodegas.length === 0}
            onClick={() => doExportBodega('pdf')}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.35)', border: '1px solid rgba(239,68,68,0.4)' }}>
            {isExportingBodega ? 'Exportando...' : '⬇ PDF'}
          </button>
          <button
            disabled={isExportingBodega || filteredRptBodegas.length === 0}
            onClick={() => doExportBodega('excel')}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'rgba(96,165,250,0.35)', border: '1px solid rgba(96,165,250,0.4)' }}>
            {isExportingBodega ? 'Exportando...' : '⬇ Excel'}
          </button>
          <button
            disabled={isExportingBodega || filteredRptBodegas.length === 0}
            onClick={() => doExportBodega('print')}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'rgba(96,165,250,0.35)', border: '1px solid rgba(96,165,250,0.4)' }}>
            🖨 Imprimir
          </button>
          <span className="self-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {filteredRptBodegas.length} registro{filteredRptBodegas.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Panel 2: Reporte de Movimientos ───────────────────────────────────── */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 className="text-base font-semibold text-white mb-5">{esMP ? 'Reporte de Movimientos de Celda' : tRpt('movimientosBodega')}</h2>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-3">
            <label className="block text-xl font-extrabold text-white mb-1">Título del Reporte</label>
            <input value={rptMovTitle} onChange={e => setRptMovTitle(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
              placeholder="Reporte de Movimientos de Bodega" />
          </div>
          <div>
            <label className="block text-xl font-extrabold text-white mb-1">Fecha Desde</label>
            <input type="date" value={rptMovDesde} onChange={e => setRptMovDesde(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
          </div>
          <div>
            <label className="block text-xl font-extrabold text-white mb-1">Fecha Hasta</label>
            <input type="date" value={rptMovHasta} onChange={e => setRptMovHasta(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
          </div>
          <div>
            <label className="block text-xl font-extrabold text-white mb-1">{esMP ? 'Celda' : 'Bodega'}</label>
            <select value={rptMovBodega} onChange={e => setRptMovBodega(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
              <option value="">{esMP ? 'Todas las celdas' : 'Todas las bodegas'}</option>
              {esMP ? (() => {
                const ids = Array.from(new Set(movimientosHojaProceso.map(m => m.bodega_id)))
                return ids.map(id => {
                  const nombre = movimientosHojaProceso.find(m => m.bodega_id === id)?.bodega_nombre || id
                  return <option key={id} value={id}>{nombre}</option>
                })
              })() : bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xl font-extrabold text-white mb-1">Tipo de Movimiento</label>
            <select value={rptMovTipo} onChange={e => setRptMovTipo(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
              <option value="">Todos</option>
              <option value="Carga Inicial de Saldos">Carga Inicial de Saldos</option>
              <option value="Recepción Factura">Recepción Factura</option>
              <option value="Transferencia entre Bodegas">Transferencia entre Bodegas</option>
              <option value="Salida de Almacén">Salida de Almacén</option>
              <option value="Ajuste de Inventario">Ajuste de Inventario</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xl font-extrabold text-white mb-1">Producto (código o nombre)</label>
            <input value={rptMovProducto} onChange={e => setRptMovProducto(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
              placeholder="Buscar por código (PROD-00001) o nombre..." />
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl overflow-x-auto mb-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <table className="w-full text-base text-left">
            <thead style={{ background: 'rgba(255,255,255,0.06)' }}>
              <tr>
                {[tF('consecutivo'), tF('fecha'), tF('tipo'), esMP ? 'Celda' : tF('bodega'), tF('codigo'), tF('descripcion'), tF('cantidad'), tH('costoUnit'), tH('total'), tF('referencia')].map(h => (
                  <th key={h} className="px-4 py-2.5 font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRptMovimientos.slice(0, 5).map(m => {
                const cat = m.referencia ? categoriaMov(m.referencia) : (m.tipo === 'Entrada' ? 'Entrada' : 'Salida')
                return (
                <tr key={m.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-4 py-2.5 font-mono font-bold" style={{ color: '#fff' }}>{m.consecutivo}</td>
                  <td className="px-4 py-2.5 text-white/60">{fDate(m.fecha)}</td>
                  <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-full text-xs whitespace-nowrap" style={categoriaStyle(cat)}>{cat}</span></td>
                  <td className="px-4 py-2.5 text-white/80">{m.bodega_nombre}</td>
                  <td className="px-4 py-2.5 font-mono text-white">{m.codigo_producto}</td>
                  <td className="px-4 py-2.5 text-white/70 max-w-xs truncate">{m.descripcion_producto}</td>
                  <td className="px-4 py-2.5 text-center text-white font-bold">{m.cantidad}</td>
                  <td className="px-4 py-2.5 text-white/60 text-right">${fmtMoney(m.costo_unitario)}</td>
                  <td className="px-4 py-2.5 text-white text-right font-medium">${fmtMoney(m.cantidad * m.costo_unitario)}</td>
                  <td className="px-4 py-2.5 text-white font-mono font-bold">{m.referencia || '—'}</td>
                </tr>
                )
              })}
              {filteredRptMovimientos.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {movimientos.length === 0 ? 'No hay movimientos registrados' : 'Sin registros para los filtros seleccionados'}
                </td></tr>
              )}
            </tbody>
          </table>
          {filteredRptMovimientos.length > 5 && (
            <div className="px-4 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              Mostrando 5 de {filteredRptMovimientos.length} registros
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-wrap gap-3">
          <button
            disabled={isExportingMov || filteredRptMovimientos.length === 0}
            onClick={() => doExportMov('pdf')}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.35)', border: '1px solid rgba(239,68,68,0.4)' }}>
            {isExportingMov ? 'Exportando...' : '⬇ PDF'}
          </button>
          <button
            disabled={isExportingMov || filteredRptMovimientos.length === 0}
            onClick={() => doExportMov('excel')}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'rgba(96,165,250,0.35)', border: '1px solid rgba(96,165,250,0.4)' }}>
            {isExportingMov ? 'Exportando...' : '⬇ Excel'}
          </button>
          <button
            disabled={isExportingMov || filteredRptMovimientos.length === 0}
            onClick={() => doExportMov('print')}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'rgba(96,165,250,0.35)', border: '1px solid rgba(96,165,250,0.4)' }}>
            🖨 Imprimir
          </button>
          <span className="self-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {filteredRptMovimientos.length} registro{filteredRptMovimientos.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{esMP ? labelBodegas : t('bodegas')}</h1>
          <p className="text-white/50 mt-1">{tSub('bodegas')}</p>
        </div>
        {tab === 'bodegas' && permisos.editar && (
          <button onClick={() => { setFormBodega(emptyBodega()); setIsBodegaFormOpen(true) }}
            className="px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {esMP ? '+ Nueva Celda' : tBtn('newWarehouse')}
          </button>
        )}
        {tab === 'lotes' && permisos.editar && esMP && (
          <button onClick={() => { resetLoteForm(); setIsLoteFormOpen(true) }}
            className="px-5 py-2.5 rounded-xl font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', border: '1px solid rgba(37,99,235,1)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
            + Identificar Lote
          </button>
        )}
        {tab === 'movimientos' && permisos.editar && !esMP && (
          <button onClick={() => { setFormMov(emptyMov(movimientos.length + 1, bodegas)); setIsMovFormOpen(true) }}
            className="px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newMovement')}
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {([
          { key: 'bodegas', label: esMP ? labelBodegas : tTab('bodegas') },
          { key: 'movimientos', label: tTab('movimientos') },
          { key: 'saldos', label: tTab('saldoInventario') },
          ...(esMP ? [{ key: 'lotes' as const, label: '📋 Lotes' }] : []),
          { key: 'reportes', label: tTab('reportesEmoji') },
          { key: 'especificos', label: tTab('especificosEmoji') },
        ] as { key: typeof tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.key
              ? { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
              : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bodegas' && renderBodegas()}
      {tab === 'movimientos' && renderMovimientos()}
      {tab === 'saldos' && renderSaldos()}
      {tab === 'lotes' && esMP && (
        <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <table className="w-full text-base text-left">
            <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
              <tr>
                {['Celda', 'Código', 'Producto', 'Nro. Lote', 'Fecha', 'Proveedor', 'Nro. Remisión', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lotesCelda.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-white/30">No hay lotes identificados. Crea el primero con <strong>+ Identificar Lote</strong>.</td></tr>
              )}
              {[...lotesCelda].sort((a, b) => a.nro_celda.localeCompare(b.nro_celda, 'es')).map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-4 py-3 font-mono font-extrabold text-white">{l.nro_celda}</td>
                  <td className="px-4 py-3 font-mono text-white">{l.codigo_producto}</td>
                  <td className="px-4 py-3 text-white font-bold">{l.nombre_producto}</td>
                  <td className="px-4 py-3 font-mono text-white">{l.lote || '—'}</td>
                  <td className="px-4 py-3 text-white">{l.fecha ? fDate(l.fecha) : '—'}</td>
                  <td className="px-4 py-3 text-white/80">{l.proveedor_nombre || '—'}</td>
                  <td className="px-4 py-3 font-mono text-white">{l.nro_remision || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {permisos.editar && (
                        <button onClick={() => editarLote(l)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                          style={{ background: 'rgba(245,158,11,1)', border: '1px solid rgba(217,119,6,1)' }}>Editar</button>
                      )}
                      {permisos.eliminar && (
                        <button onClick={() => { if (confirm('¿Eliminar este lote?')) deleteLoteCelda(l.id) }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                          style={{ background: 'rgba(220,38,38,1)', border: '1px solid rgba(185,28,28,1)' }}>Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'reportes' && renderReportes()}

      {tab === 'especificos' && (
        <div className="glass-card p-6 md:p-8">
          <h2 className="text-xl font-bold text-white mb-4">{tTab('especificos')}</h2>
          <p className="text-white/50 text-sm mb-6">{tSub('seleccioneReporte')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/40 text-sm">Los reportes específicos se irán agregando según sus necesidades</p>
            </div>
          </div>
        </div>
      )}

      {viewRecord && (
        <ViewRecordModal
          title={esMP ? `Detalle ${labelBodega}` : tTip('detalleBodega')}
          fields={[
            { label: tF('nombre'), value: viewRecord.nombre },
            { label: tF('direccion'), value: viewRecord.direccion },
            { label: tF('ciudad'), value: viewRecord.ciudad },
            { label: tF('pais'), value: viewRecord.pais },
            { label: 'Tipo Inventario', value: viewRecord.tipo_inventario },
            { label: tF('situacion'), value: viewRecord.situacion },
          ]}
          onClose={() => setViewRecord(null)}
        />
      )}

      {isLoteFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
            style={{ background: 'rgba(34,197,94,0.95)', border: '2px solid #16a34a' }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-extrabold text-white">📋 {editLoteId ? 'Editar' : 'Identificar'} Lote en Celda</h2>
              <button onClick={() => { setIsLoteFormOpen(false); resetLoteForm() }} className="text-white/40 hover:text-white text-3xl leading-none">&times;</button>
            </div>

            {loteFormError && (
              <div className="mb-4 px-4 py-3 rounded-xl text-base font-bold"
                style={{ background: 'rgba(239,68,68,0.18)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}>
                {loteFormError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-extrabold mb-1" style={{ color: '#86efac' }}>Celda *</label>
                <select value={loteForm.nro_celda} onChange={e => setLoteForm({ ...loteForm, nro_celda: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold outline-none" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#fff' }}>
                  <option value="">Seleccione una celda…</option>
                  {celdasActivas.map(c => <option key={c.id} value={c.descripcion}>{c.descripcion}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-base font-extrabold mb-1" style={{ color: '#86efac' }}>Producto (Código y Nombre) *</label>
                <select value={loteForm.producto_id} onChange={e => setLoteForm({ ...loteForm, producto_id: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold outline-none" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#fff' }}>
                  <option value="">Seleccione una Materia Prima…</option>
                  {productosMP.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-base font-extrabold mb-1" style={{ color: '#86efac' }}>Nro. Lote *</label>
                <input value={loteForm.lote} onChange={e => setLoteForm({ ...loteForm, lote: e.target.value })}
                  placeholder="LOTE-2026-0001"
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold font-mono outline-none"
                  style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#fff' }} />
              </div>
              <div>
                <label className="block text-base font-extrabold mb-1" style={{ color: '#86efac' }}>Fecha</label>
                <input type="date" value={loteForm.fecha} onChange={e => setLoteForm({ ...loteForm, fecha: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-base text-white outline-none"
                  style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#fff' }} />
              </div>

              <div>
                <label className="block text-base font-extrabold mb-1" style={{ color: '#86efac' }}>Proveedor</label>
                <select value={loteForm.proveedor_id} onChange={e => setLoteForm({ ...loteForm, proveedor_id: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold outline-none" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#fff' }}>
                  <option value="">Seleccione un proveedor…</option>
                  {proveedoresActivos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-base font-extrabold mb-1" style={{ color: '#86efac' }}>Nro. Remisión</label>
                <input value={loteForm.nro_remision} onChange={e => setLoteForm({ ...loteForm, nro_remision: e.target.value })}
                  placeholder="REM-0001"
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold font-mono outline-none"
                  style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#fff' }} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setIsLoteFormOpen(false); resetLoteForm() }}
                className="px-6 py-2.5 rounded-xl text-base font-bold transition-all"
                style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid #16a34a', color: '#dcfce7' }}>
                Cancelar
              </button>
              <button onClick={guardarLote}
                className="px-8 py-2.5 rounded-xl text-base font-extrabold text-white transition-all"
                style={{ background: 'rgba(34,197,94,0.3)', border: '2px solid #16a34a', boxShadow: '0 4px 12px rgba(34,197,94,0.35)' }}>
                💾 {editLoteId ? 'Actualizar' : 'Guardar'} Lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
