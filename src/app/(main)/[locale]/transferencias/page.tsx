'use client'

import { useTranslations } from 'next-intl'

import { useState, useMemo, useRef } from 'react'
import { todayColombia } from '@/shared/lib/format-date'
import { useBodegasStore, type SaldoBodega, type MovimientoBodega } from '@/features/bodegas/store/bodegas-store'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useTransferenciasStore } from '@/features/transferencias/store/transferencias-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { codigoMatchesTipo } from '@/shared/lib/tipo-inventario-prefijo'
import { fDate } from '@/shared/lib/format-date'
import { exportToPDF, exportToExcel, printReport } from '@/shared/lib/export-report'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'
import VoiceSearchButton from '@/shared/components/voice-search-button'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type RenglonTransferencia = {
  id: string
  codigo_producto: string
  descripcion: string
  unidad_medida: string
  cantidad: number
}

type Transferencia = {
  id: string
  nro_transferencia: number
  consecutivo: string
  fecha_emision: string
  tipo_inventario: string
  bodega_salida_id: string
  bodega_salida_nombre: string
  bodega_entrada_id: string
  bodega_entrada_nombre: string
  persona_emite: string
  persona_recibe: string
  fecha_aprobacion: string
  fecha_aprobacion_recepcion: string
  observaciones: string
  renglones: RenglonTransferencia[]
  estado: string
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

function generateTransferenciaPDF(t: Transferencia, empresaInfo?: { nombre?: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string }, empresaLogo: string = LOGO_BASE64) {
  const rows = t.renglones.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${r.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#000;font-weight:600">${r.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${r.unidad_medida}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">${r.cantidad}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Transferencia ${t.consecutivo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#111; background:#fff; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #1e3a8a; }
    .company { font-size:22px; font-weight:800; color:#000; line-height:1.15; white-space:nowrap; }
    .doc-title { text-align:right; }
    .doc-title h2 { font-size:20px; font-weight:700; color:#000; margin-bottom:2px; }
    .doc-title .consecutivo { font-size:18px; font-family:monospace; font-weight:900; color:#000; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; background:#000; color:#fff; border:1px solid #000; margin-top:6px; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:28px; padding:20px; background:#eef2ff; border-radius:8px; border:1px solid #c7d2fe; }
    .field label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#1e3a8a; font-weight:700; display:block; margin-bottom:3px; }
    .field span { font-weight:600; color:#111; font-size:13px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#1e3a8a; }
    thead th { padding:10px 12px; color:#fff; font-size:11px; text-transform:uppercase; letter-spacing:.06em; text-align:left; }
    thead th:nth-child(3) { text-align:center; }
    thead th:nth-child(4) { text-align:center; }
    tbody td { padding:8px 12px; font-size:13px; color:#000; font-weight:600; border-bottom:1px solid #e5e7eb; }
    .obs { border:1.5px solid #1e3a8a; border-radius:8px; overflow:hidden; margin-bottom:20px; }
    .obs-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#fff; background:#1e3a8a; padding:8px 14px; font-weight:600; }
    .obs-content { padding:12px 14px; font-size:13px; color:#1f2937; background:#f8fafc; }
    .footer { margin-top:40px; display:flex; justify-content:space-between; }
    .sign-box { text-align:center; }
    .sign-line { width:180px; border-top:2px solid #000; margin:0 auto 6px; padding-top:6px; font-size:11px; font-weight:700; color:#000; }
    @media print { body { padding:16px; } }
  </style></head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="${empresaLogo}" style="width:180px;height:180px;border-radius:12px;object-fit:contain;background:#fff;padding:8px;" />
      <div>
        <div class="company">${empresaInfo?.nombre || 'EMPRESA'}</div>
        ${empresaInfo ? `<div style="font-size:15px;color:#000;font-weight:600;margin-top:6px;line-height:1.5">${empresaInfo.tipo_identificacion}: ${empresaInfo.nro_documento}<br/>${empresaInfo.direccion || ''}${empresaInfo.ciudad ? `, ${empresaInfo.ciudad}` : ''}</div>` : ''}
      </div>
    </div>
    <div class="doc-title">
      <h2>TRANSFERENCIA DE PRODUCTOS</h2>
      <div class="consecutivo">${t.consecutivo}</div>
      <div class="badge">${t.estado}</div>
    </div>
  </div>

  <div class="grid">
    <div class="field"><label>Nro. Transferencia</label><span>${t.consecutivo}</span></div>
    <div class="field"><label>Fecha Emisión</label><span>${fDate(t.fecha_emision)}</span></div>
    <div class="field"><label>Bodega Salida</label><span>${t.bodega_salida_nombre || '—'}</span></div>
    <div class="field"><label>Bodega Entrada</label><span>${t.bodega_entrada_nombre || '—'}</span></div>
    <div class="field"><label>Persona que Emite</label><span>${t.persona_emite || '—'}</span></div>
    <div class="field"><label>Persona que Recibe</label><span>${t.persona_recibe || '—'}</span></div>
    <div class="field"><label>Fecha Aprobación</label><span>${fDate(t.fecha_aprobacion)}</span></div>
    <div class="field"><label>Fecha Aprob. Recepción</label><span>${fDate(t.fecha_aprobacion_recepcion)}</span></div>
  </div>

  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th><th style="text-align:center">Unidad</th>
      <th style="text-align:center">Cantidad</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${t.observaciones ? `<div class="obs"><div class="obs-label">Observaciones</div><div class="obs-content">${t.observaciones}</div></div>` : ''}

  <div class="footer">
    <div class="sign-box"><div class="sign-line">Emitido por</div><div style="font-size:11px;font-weight:700;color:#000">${t.persona_emite || '_______________'}</div></div>
    <div class="sign-box"><div class="sign-line">Recibido por</div><div style="font-size:11px;font-weight:700;color:#000">${t.persona_recibe || '_______________'}</div></div>
    <div class="sign-box"><div class="sign-line">Aprobado por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
    <div class="sign-box"><div class="sign-line">Recibido por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
  </div>

  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = todayColombia()

const emptyRenglon = (): RenglonTransferencia => ({
  id: crypto.randomUUID(), codigo_producto: '', descripcion: '', unidad_medida: 'Unidad', cantidad: 1,
})

const emptyForm = (nro: number, tipoInv = ''): Transferencia => ({
  id: '', nro_transferencia: nro,
  consecutivo: `TRF-${String(nro).padStart(5, '0')}`,
  fecha_emision: today,
  tipo_inventario: tipoInv,
  bodega_salida_id: '', bodega_salida_nombre: '',
  bodega_entrada_id: '', bodega_entrada_nombre: '',
  persona_emite: '', persona_recibe: '',
  fecha_aprobacion: '', fecha_aprobacion_recepcion: '',
  observaciones: '', renglones: [emptyRenglon()], estado: 'Pendiente',
})

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selectSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const estadoStyle = (s: string): React.CSSProperties => {
  if (s === 'Aprobada') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Anulada')  return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
  return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TransferenciasPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tSec = useTranslations('sections')
  const tRpt = useTranslations('reportTitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('transferencias')
  const empresas = useEmpresaStore(s => s.empresas)
  const todasBodegas = useBodegasStore(s => s.bodegas)
  const updateBodega = useBodegasStore(s => s.updateBodega)
  const refData = useReferenceStore(s => s.data)
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const todosProductos = useProductosStore(s => s.productos)
  const updateProducto = useProductosStore(s => s.updateProducto)
  const productos = todosProductos.filter(p =>
    p.situacion === 'Activo' && !!p.descripcion && !!p.codigo &&
    codigoMatchesTipo(p.codigo, tipoActivo || '')
  )
  const [searchProd, setSearchProd] = useState('')
  const [sinExistMsg, setSinExistMsg] = useState('')
  const [cantExistMsg, setCantExistMsg] = useState('')
  const searchProdRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'registros' | 'reportes' | 'especificos'>('registros')

  const { transferencias: todasTransferencias } = useTransferenciasStore()
  const transferencias = tipoActivo ? todasTransferencias.filter(t => t.tipo_inventario === tipoActivo) : todasTransferencias
  const bodegas = todasBodegas.filter(b => b.situacion === 'Activa' && (!tipoActivo || b.tipo_inventario === tipoActivo))
  const setTransferencias = (fn: (prev: Transferencia[]) => Transferencia[]) => useTransferenciasStore.setState(s => ({ transferencias: fn(s.transferencias) }))
  const [form, setForm] = useState<Transferencia>(emptyForm(1, tipoActivo || ''))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewItem, setViewItem] = useState<Transferencia | null>(null)

  // ── Estado Reportes ─────────────────────────────────────────────────────────
  const [rptTitle, setRptTitle] = useState(tRpt('transferencias'))
  const [rptDesde, setRptDesde] = useState('')
  const [rptHasta, setRptHasta] = useState('')
  const [rptBodegaSalida, setRptBodegaSalida] = useState('')
  const [rptEstado, setRptEstado] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // ── Bodega handlers ──────────────────────────────────────────────────────────
  const handleBodegaSalida = (id: string) => {
    const b = bodegas.find(b => b.id === id)
    setForm({ ...form, bodega_salida_id: id, bodega_salida_nombre: b?.nombre ?? '' })
  }

  const handleBodegaEntrada = (id: string) => {
    const b = bodegas.find(b => b.id === id)
    setForm({ ...form, bodega_entrada_id: id, bodega_entrada_nombre: b?.nombre ?? '' })
  }

  // ── Renglones ────────────────────────────────────────────────────────────────
  const updateRenglon = (idx: number, field: keyof RenglonTransferencia, value: string | number) => {
    const renglones = [...form.renglones]
    renglones[idx] = { ...renglones[idx], [field]: value }
    setForm({ ...form, renglones })
  }

  const removeRenglon = (idx: number) =>
    setForm({ ...form, renglones: form.renglones.filter((_, i) => i !== idx) })

  // ── Guardar ──────────────────────────────────────────────────────────────────
  const [errorMsg, setErrorMsg] = useState('')
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.fecha_emision) { setErrorMsg('Debe indicar la Fecha de Emisión.'); return }
    if (!form.bodega_salida_id) { setErrorMsg('Debe seleccionar la Bodega de Salida.'); return }
    if (!form.bodega_entrada_id) { setErrorMsg('Debe seleccionar la Bodega de Entrada.'); return }
    if (form.bodega_salida_id === form.bodega_entrada_id) { setErrorMsg('La bodega de salida y entrada no pueden ser la misma.'); return }
    if (!form.renglones.length || form.renglones[0].codigo_producto === '') { setErrorMsg('Debe agregar al menos un producto.'); return }

    const renglonesValidos = form.renglones.filter(r => r.codigo_producto && r.cantidad > 0)
    if (renglonesValidos.length === 0) { setErrorMsg('Debe ingresar al menos un renglon con cantidad > 0.'); return }

    // Validar disponibilidad: la bodega origen debe tener saldo suficiente
    const bodOrigen = todasBodegas.find(b => b.id === form.bodega_salida_id)
    const bodDestino = todasBodegas.find(b => b.id === form.bodega_entrada_id)
    if (!bodOrigen || !bodDestino) { setErrorMsg('Bodegas no encontradas.'); return }

    const saldosOrigen: SaldoBodega[] = bodOrigen.saldos ? [...bodOrigen.saldos] : []
    for (const r of renglonesValidos) {
      const sal = saldosOrigen.find(s => s.codigo === r.codigo_producto)
      if (!sal || sal.existencia < r.cantidad) {
        setErrorMsg(`No hay suficiente existencia de "${r.descripcion}" en la bodega origen (disponible: ${sal?.existencia || 0}).`)
        return
      }
    }

    // ── PROCESAMIENTO ATOMICO ──
    const movimientosOrigen: MovimientoBodega[] = bodOrigen.movimientos ? [...bodOrigen.movimientos] : []
    const saldosDestino: SaldoBodega[] = bodDestino.saldos ? [...bodDestino.saldos] : []
    const movimientosDestino: MovimientoBodega[] = bodDestino.movimientos ? [...bodDestino.movimientos] : []
    const docOrigen = form.consecutivo

    for (const r of renglonesValidos) {
      const prod = todosProductos.find(p => p.codigo === r.codigo_producto)
      if (!prod) continue

      // ── 1. BODEGA ORIGEN: restar existencia (CP no cambia) ──
      const idxO = saldosOrigen.findIndex(s => s.codigo === r.codigo_producto)
      const sO = saldosOrigen[idxO]
      const cpOrigen = sO.costo_promedio
      const existAntO = sO.existencia
      const nuevaExtO = sO.existencia - r.cantidad
      saldosOrigen[idxO] = {
        ...sO,
        existencia: nuevaExtO,
        valor_existencia: Math.round(nuevaExtO * cpOrigen * 100) / 100,
      }
      movimientosOrigen.push({
        id: crypto.randomUUID(),
        fecha: form.fecha_emision,
        tipo: 'Transferencia Salida',
        documento_origen: docOrigen,
        producto_id: prod.id,
        producto_codigo: prod.codigo,
        producto_descripcion: prod.descripcion,
        unidad_medida: prod.unidad_medida,
        cantidad: -r.cantidad,
        costo_promedio: cpOrigen,
        valor: Math.round(-r.cantidad * cpOrigen * 100) / 100,
        existencia_anterior: existAntO,
        existencia_despues: nuevaExtO,
        cp_anterior: cpOrigen,
        bodega_origen: bodOrigen.nombre,
        bodega_destino: bodDestino.nombre,
        persona_emite: form.persona_emite,
        persona_recibe: form.persona_recibe,
        observaciones: `Transferencia hacia ${bodDestino.nombre}`,
      })

      // ── 2. BODEGA DESTINO: sumar y recalcular CP ponderado ──
      const idxD = saldosDestino.findIndex(s => s.codigo === r.codigo_producto)
      const existAntD = idxD >= 0 ? saldosDestino[idxD].existencia : 0
      const cpAntD = idxD >= 0 ? saldosDestino[idxD].costo_promedio : 0
      let nuevoCpD: number
      let nuevaExtD: number
      if (idxD >= 0) {
        const sD = saldosDestino[idxD]
        const valorAnt = sD.existencia * sD.costo_promedio
        const valorRec = r.cantidad * cpOrigen
        nuevaExtD = sD.existencia + r.cantidad
        nuevoCpD = nuevaExtD > 0 ? Math.round(((valorAnt + valorRec) / nuevaExtD) * 100) / 100 : cpOrigen
        saldosDestino[idxD] = {
          ...sD,
          existencia: nuevaExtD,
          costo_promedio: nuevoCpD,
          valor_existencia: Math.round(nuevaExtD * nuevoCpD * 100) / 100,
        }
      } else {
        nuevaExtD = r.cantidad
        nuevoCpD = cpOrigen
        saldosDestino.push({
          producto_id: prod.id,
          codigo: prod.codigo,
          descripcion: prod.descripcion,
          unidad_medida: prod.unidad_medida,
          existencia: nuevaExtD,
          costo_promedio: nuevoCpD,
          valor_existencia: Math.round(nuevaExtD * nuevoCpD * 100) / 100,
        })
      }
      movimientosDestino.push({
        id: crypto.randomUUID(),
        fecha: form.fecha_emision,
        tipo: 'Transferencia Entrada',
        documento_origen: docOrigen,
        producto_id: prod.id,
        producto_codigo: prod.codigo,
        producto_descripcion: prod.descripcion,
        unidad_medida: prod.unidad_medida,
        cantidad: r.cantidad,
        costo_promedio: nuevoCpD,
        valor: Math.round(r.cantidad * nuevoCpD * 100) / 100,
        existencia_anterior: existAntD,
        existencia_despues: nuevaExtD,
        cp_anterior: cpAntD,
        bodega_origen: bodOrigen.nombre,
        bodega_destino: bodDestino.nombre,
        persona_emite: form.persona_emite,
        persona_recibe: form.persona_recibe,
        observaciones: `Transferencia desde ${bodOrigen.nombre}`,
      })
    }

    // ── 3. ACTUALIZAR BODEGAS ──
    const bodOrigenActualizada = { ...bodOrigen, saldos: saldosOrigen, movimientos: movimientosOrigen }
    const bodDestinoActualizada = { ...bodDestino, saldos: saldosDestino, movimientos: movimientosDestino }
    updateBodega(bodOrigen.id, bodOrigenActualizada)
    updateBodega(bodDestino.id, bodDestinoActualizada)

    // ── 4. ACTUALIZAR MAESTRO DE PRODUCTOS (recalcular CP global ponderado) ──
    // La existencia total NO cambia, pero el CP del Maestro = promedio ponderado de todas las bodegas
    // Construir el "estado futuro" de las bodegas para el calculo
    const bodegasFuturas = todasBodegas.map(b => {
      if (b.id === bodOrigen.id) return bodOrigenActualizada
      if (b.id === bodDestino.id) return bodDestinoActualizada
      return b
    })

    for (const r of renglonesValidos) {
      const prod = todosProductos.find(p => p.codigo === r.codigo_producto)
      if (!prod) continue
      let totalExt = 0
      let totalValor = 0
      for (const b of bodegasFuturas) {
        const sal = (b.saldos || []).find(s => s.producto_id === prod.id)
        if (sal) {
          totalExt += sal.existencia
          totalValor += sal.existencia * sal.costo_promedio
        }
      }
      const nuevoCpMaestro = totalExt > 0 ? Math.round((totalValor / totalExt) * 100) / 100 : (prod.costo_promedio || 0)
      updateProducto(prod.id, {
        existencia: totalExt,
        costo_promedio: nuevoCpMaestro,
        fecha_ult_movimiento: form.fecha_emision,
        nro_ult_documento: form.consecutivo,
        tipo_ult_movimiento: 'Transferencia entre Bodegas',
      })
    }

    // ── 5. GUARDAR LA TRANSFERENCIA ──
    setTransferencias(prev => [...prev, { ...form, id: crypto.randomUUID(), estado: 'Aprobada' }])
    setIsFormOpen(false)
    setForm(emptyForm(todasTransferencias.length + 2, tipoActivo || ''))
  }

  const handleDelete = (id: string) => {
    if (confirm(tCf('delTransferencia'))) setTransferencias(prev => prev.filter(t => t.id !== id))
  }

  // ── Reporte filtrado ─────────────────────────────────────────────────────────
  const filteredReport = useMemo(() => {
    return transferencias.filter(t => {
      if (rptDesde && t.fecha_emision < rptDesde) return false
      if (rptHasta && t.fecha_emision > rptHasta) return false
      if (rptBodegaSalida && t.bodega_salida_id !== rptBodegaSalida) return false
      if (rptEstado && t.estado !== rptEstado) return false
      return true
    })
  }, [transferencias, rptDesde, rptHasta, rptBodegaSalida, rptEstado])

  // Bodegas únicas presentes en las transferencias
  const bodegasSalidaUnicas = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of transferencias) {
      if (!map.has(t.bodega_salida_id)) map.set(t.bodega_salida_id, t.bodega_salida_nombre)
    }
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [transferencias])

  const rptCols = [
    { header: tH('nro'),            key: 'consecutivo',          width: 14 },
    { header: 'Fecha',           key: 'fecha_emision',        width: 14 },
    { header: 'Bodega Salida',   key: 'bodega_salida_nombre', width: 20 },
    { header: 'Bodega Entrada',  key: 'bodega_entrada_nombre',width: 20 },
    { header: 'Persona Emite',   key: 'persona_emite',        width: 20 },
    { header: tH('itemsAccent'),           key: 'items',                width: 8  },
    { header: 'Estado',          key: 'estado',               width: 12 },
  ]

  const buildRptRows = (rows: Transferencia[]) =>
    rows.map(t => ({
      consecutivo:          t.consecutivo,
      fecha_emision:        fDate(t.fecha_emision),
      bodega_salida_nombre: t.bodega_salida_nombre,
      bodega_entrada_nombre:t.bodega_entrada_nombre,
      persona_emite:        t.persona_emite,
      items:                t.renglones.length,
      estado:               t.estado,
    }))

  const buildSubtitle = () => {
    const parts: string[] = []
    if (rptDesde) parts.push(`Desde: ${rptDesde}`)
    if (rptHasta) parts.push(`Hasta: ${rptHasta}`)
    if (rptBodegaSalida) {
      const b = bodegasSalidaUnicas.find(x => x.id === rptBodegaSalida)
      if (b) parts.push(`Bodega Salida: ${b.nombre}`)
    }
    if (rptEstado) parts.push(`Estado: ${rptEstado}`)
    return parts.length ? parts.join(' | ') : undefined
  }

  const doExport = async (format: 'pdf' | 'excel' | 'print') => {
    setIsExporting(true)
    const opts = {
      title: rptTitle,
      subtitle: buildSubtitle(),
      columns: rptCols,
      rows: buildRptRows(filteredReport),
      filename: `transferencias-${today}`,
    }
    try {
      if (format === 'pdf') await exportToPDF(opts)
      else if (format === 'excel') await exportToExcel(opts)
      else printReport(opts)
    } finally {
      setIsExporting(false)
    }
  }

  // ─── Vista Detalle ───────────────────────────────────────────────────────────
  if (viewItem) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setViewItem(null)} className="flex items-center gap-2 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
            ← Volver a Transferencias
          </button>
          <button onClick={() => {
            const emp = empresas[0]
            const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined
            generateTransferenciaPDF(viewItem, empData, emp?.logo || LOGO_BASE64)
          }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-colors"
            style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
            🖨 Generar PDF
          </button>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Transferencia de Productos</h1>
              <p className="text-2xl font-mono mt-1" style={{ color: '#fff' }}>{viewItem.consecutivo}</p>
            </div>
            <span className="px-4 py-2 rounded-full text-sm font-medium" style={estadoStyle(viewItem.estado)}>{viewItem.estado}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: tH('nroTransferencia'), value: viewItem.consecutivo },
              { label: 'Fecha Emisión', value: fDate(viewItem.fecha_emision) },
              { label: 'Bodega Salida', value: viewItem.bodega_salida_nombre },
              { label: 'Bodega Entrada', value: viewItem.bodega_entrada_nombre },
              { label: 'Persona que Emite', value: viewItem.persona_emite },
              { label: 'Persona que Recibe', value: viewItem.persona_recibe || '—' },
              { label: 'Fecha Aprobación', value: fDate(viewItem.fecha_aprobacion) },
              { label: 'Fecha Aprob. Recepción', value: fDate(viewItem.fecha_aprobacion_recepcion) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#f97316' }}>{label}</p>
                <p className="text-white font-medium">{value}</p>
              </div>
            ))}
          </div>

          {/* Renglones */}
          <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.07)' }}>
                <tr>
                  {[tF('codigo'), tF('descripcion'), tF('unidadMedida'), tF('cantidad')].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewItem.renglones.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-5 py-3 font-mono text-xs text-white">{r.codigo_producto}</td>
                    <td className="px-5 py-3 text-white/80">{r.descripcion}</td>
                    <td className="px-5 py-3 text-white/50 text-xs">{r.unidad_medida || '—'}</td>
                    <td className="px-5 py-3 text-white font-bold text-center">{r.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {viewItem.observaciones && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>Observaciones</p>
              <p style={{ color: 'rgba(255,255,255,0.7)' }}>{viewItem.observaciones}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Vista Principal ──────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('transferencias')}</h1>
          <p className="text-white/50 mt-1">{tSub('transferencias')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button
            onClick={() => { setForm(emptyForm(todasTransferencias.length + 1, tipoActivo || '')); setIsFormOpen(true) }}
            className="px-5 py-2.5 rounded-xl font-medium text-white whitespace-nowrap mr-28"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newTransfer')}
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {([
          { key: 'registros', label: tTab('registros') },
          { key: 'reportes',  label: tTab('reportesEmoji') },
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

      {/* ── Tab Registros ──────────────────────────────────────────────────────── */}
      {tab === 'registros' && (
        <>
          {/* ── Formulario ────────────────────────────────────────────────────── */}
          {isFormOpen && (
            <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-lg font-semibold text-white">{tSec('nuevaTransferencia')}</h2>
                <span className="font-mono text-sm px-3 py-1 rounded-lg" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                  {form.consecutivo}
                </span>
              </div>

              <form onSubmit={handleSave}>
                {/* Cabecera */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

                  {/* Nro Transferencia — solo lectura */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Nro. Transferencia</label>
                    <input readOnly value={form.consecutivo}
                      className="w-full rounded-xl px-4 py-2.5 outline-none font-mono"
                      style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }} />
                  </div>

                  {/* Fecha Emisión */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Emisión *</label>
                    <input type="date" required value={form.fecha_emision}
                      onChange={e => setForm({ ...form, fecha_emision: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
                  </div>

                  {/* Tipo de Inventario (heredado de la sesión) */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Tipo de Inventario</label>
                    <input readOnly value={form.tipo_inventario || '—'}
                      className="w-full rounded-xl px-4 py-2.5 outline-none font-semibold"
                      style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }}
                      title="Definido por el Tipo de Inventario activo de la sesión." />
                  </div>

                  {/* Bodega Salida */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Bodega Salida *</label>
                    <select required value={form.bodega_salida_id} onChange={e => handleBodegaSalida(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                      <option value="">{tOp('seleccione')}</option>
                      {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>

                  {/* Bodega Entrada */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Bodega Entrada *</label>
                    <select required value={form.bodega_entrada_id} onChange={e => handleBodegaEntrada(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                      <option value="">{tOp('seleccione')}</option>
                      {bodegas.filter(b => b.id !== form.bodega_salida_id).map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>

                  {/* Persona que Emite */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Persona que Emite *</label>
                    <input required value={form.persona_emite}
                      onChange={e => setForm({ ...form, persona_emite: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
                      placeholder="Nombre completo" />
                  </div>

                  {/* Persona que Recibe */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Persona que Recibe</label>
                    <input value={form.persona_recibe}
                      onChange={e => setForm({ ...form, persona_recibe: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
                      placeholder="Nombre completo" />
                  </div>

                  {/* Fecha Aprobación */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Aprobación</label>
                    <input type="date" value={form.fecha_aprobacion}
                      onChange={e => setForm({ ...form, fecha_aprobacion: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
                  </div>

                  {/* Fecha Aprobación Recepción */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Aprobación Recepción</label>
                    <input type="date" value={form.fecha_aprobacion_recepcion}
                      onChange={e => setForm({ ...form, fecha_aprobacion_recepcion: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Estado</label>
                    <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                      {[tF('pendiente'), 'Aprobada', 'Anulada'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Buscar Producto ──────────────────────────────────────────── */}
                <div className="mb-4">
                  <label className="block text-xl text-white font-extrabold mb-2">Buscar producto para agregar al detalle</label>
                  <div className="flex items-center gap-2 max-w-md">
                    <input ref={searchProdRef} value={searchProd}
                      onFocus={() => { setSinExistMsg(''); setCantExistMsg('') }}
                      onChange={e => { setSearchProd(e.target.value); setSinExistMsg('') }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setSinExistMsg(''); setSearchProd('') } }}
                      className="w-full rounded-xl px-4 py-2.5 text-white outline-none text-base text-white font-bold"
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
                              setSinExistMsg('')
                              if ((p.existencia || 0) <= 0) {
                                setSinExistMsg(`Producto "${p.descripcion}" sin existencia. Seleccione otro producto.`)
                                setSearchProd('')
                                return
                              }
                              const exists = form.renglones.some(r => r.codigo_producto === p.codigo)
                              if (exists) { setSinExistMsg(`"${p.descripcion}" ya está en los renglones.`); setSearchProd(''); return }
                              const nuevo: RenglonTransferencia = {
                                id: crypto.randomUUID(),
                                codigo_producto: p.codigo,
                                descripcion: p.descripcion,
                                unidad_medida: p.unidad_medida,
                                cantidad: 1,
                              }
                              const renglones = form.renglones[0]?.codigo_producto === ''
                                ? [nuevo] : [...form.renglones, nuevo]
                              setForm({ ...form, renglones })
                              setSearchProd('')
                            }}
                            className="w-full flex items-center gap-4 px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span className="font-mono text-xs" style={{ color: '#fff' }}>{p.codigo}</span>
                            <span className="text-white/80 flex-1">{p.descripcion}</span>
                            <span className="text-white/40 text-xs">{p.unidad_medida}</span>
                            <span className="text-white/40 text-xs">Exist: {p.existencia}</span>
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                  {sinExistMsg && (
                    <div className="mt-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                      ⚠ {sinExistMsg}
                    </div>
                  )}
                </div>

                {/* ── Renglones ──────────────────────────────────────────────────── */}
                {form.renglones.length > 0 && form.renglones[0].codigo_producto !== '' && (
                <div className="mb-6">
                  <h3 className="text-white font-medium mb-3">Renglones</h3>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    <table className="w-full text-base text-left">
                      <thead style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <tr>
                          {[tF('codigo'), tF('descripcion'), tH('unidMedida'), tF('cantidad'), ''].map(h => (
                            <th key={h} className="px-3 py-2.5 font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.renglones.map((r, idx) => (
                          <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <td className="px-3 py-2 font-mono text-xs text-white">{r.codigo_producto}</td>
                            <td className="px-3 py-2 text-white font-bold">{r.descripcion}</td>
                            <td className="px-3 py-2 text-white font-bold">{r.unidad_medida || '—'}</td>
                            <td className="px-2 py-2">
                              <input type="number" min="0.01" step="0.01" value={r.cantidad || ''}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0
                                  const prod = productos.find(p => p.codigo === r.codigo_producto)
                                  const exist = prod?.existencia || 0
                                  if (val > exist) {
                                    setCantExistMsg(`"${r.descripcion}" no tiene esa existencia. Disponible: ${exist}`)
                                    updateRenglon(idx, 'cantidad', 0)
                                    return
                                  }
                                  setCantExistMsg('')
                                  updateRenglon(idx, 'cantidad', val)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && cantExistMsg) {
                                    e.preventDefault()
                                    setCantExistMsg('')
                                    removeRenglon(idx)
                                    searchProdRef.current?.focus()
                                  }
                                }}
                                className="w-24 rounded-lg px-2 py-1.5 text-white outline-none text-center font-bold"
                                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)' }} />
                            </td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => removeRenglon(idx)}
                                className="text-red-400 hover:text-red-300 px-2 py-1">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                {cantExistMsg && (
                  <div className="mt-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                    ⚠ {cantExistMsg} — Presione Enter para buscar otro producto
                  </div>
                )}
                </div>
                )}

                {/* Observaciones */}
                <div className="mb-6">
                  <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
                  <textarea rows={3} value={form.observaciones}
                    onChange={e => setForm({ ...form, observaciones: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none resize-none"
                    style={inputSt} placeholder="Notas u observaciones sobre la transferencia..." />
                </div>

                {errorMsg && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                    ⚠ {errorMsg}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2.5 rounded-xl text-white font-medium"
                    style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                    {tBtn('saveTransfer')}
                  </button>
                  <button type="button" onClick={() => { setIsFormOpen(false); setErrorMsg('') }}
                    className="px-6 py-2.5 rounded-xl text-white/70"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {tBtn('cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Tabla ──────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {[tH('nroTransferencia'), tF('fechaEmision'), tF('bodegaSalida'), tF('bodegaEntrada'), tF('personaEmiteShort'), tF('renglones'), tF('estado'), tTbl('actions')].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transferencias.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-5 py-4 font-mono font-bold" style={{ color: '#fff' }}>{t.consecutivo}</td>
                    <td className="px-5 py-4 text-white/60">{fDate(t.fecha_emision)}</td>
                    <td className="px-5 py-4 text-white font-bold">{t.bodega_salida_nombre}</td>
                    <td className="px-5 py-4 text-white font-bold">{t.bodega_entrada_nombre}</td>
                    <td className="px-5 py-4 text-white/60">{t.persona_emite}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(96,165,250,0.15)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                        {t.renglones.length} ítem{t.renglones.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium" style={estadoStyle(t.estado)}>{t.estado}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => setViewItem(t)} className="px-3 py-1 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                          {tBtn('view')}
                        </button>
                        {permisos.eliminar && <button onClick={() => handleDelete(t.id)} className="px-3 py-1 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>
                          {tBtn('delete')}
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {transferencias.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-16 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <div className="text-4xl mb-3">🔄</div>
                    <p>No hay transferencias registradas. Crea la primera con <strong>{tBtn('newTransfer')}</strong>.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Tab Reportes ───────────────────────────────────────────────────────── */}
      {tab === 'reportes' && (
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-base font-semibold text-white mb-5">{tRpt('transferencias')}</h2>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-3">
              <label className="block text-xl font-extrabold text-white mb-1">Título del Reporte</label>
              <input value={rptTitle} onChange={e => setRptTitle(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
                placeholder="Reporte de Transferencias entre Bodegas" />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Fecha Desde</label>
              <input type="date" value={rptDesde} onChange={e => setRptDesde(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Fecha Hasta</label>
              <input type="date" value={rptHasta} onChange={e => setRptHasta(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Bodega Salida</label>
              <select value={rptBodegaSalida} onChange={e => setRptBodegaSalida(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                <option value="">Todas</option>
                {bodegasSalidaUnicas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Estado</label>
              <select value={rptEstado} onChange={e => setRptEstado(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Aprobada">Aprobada</option>
                <option value="Anulada">Anulada</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl overflow-x-auto mb-5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.06)' }}>
                <tr>
                  {[tH('nro'), tF('fecha'), tF('bodegaSalida'), tF('bodegaEntrada'), tF('personaEmiteShort'), tH('itemsAccent'), tF('estado')].map(h => (
                    <th key={h} className="px-4 py-2.5 font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReport.slice(0, 5).map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-4 py-2.5 font-mono font-bold" style={{ color: '#fff' }}>{t.consecutivo}</td>
                    <td className="px-4 py-2.5 text-white/60">{fDate(t.fecha_emision)}</td>
                    <td className="px-4 py-2.5 text-white/80">{t.bodega_salida_nombre}</td>
                    <td className="px-4 py-2.5 text-white/80">{t.bodega_entrada_nombre}</td>
                    <td className="px-4 py-2.5 text-white/60">{t.persona_emite}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(96,165,250,0.15)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                        {t.renglones.length}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={estadoStyle(t.estado)}>{t.estado}</span>
                    </td>
                  </tr>
                ))}
                {filteredReport.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {transferencias.length === 0 ? 'No hay transferencias registradas' : 'Sin registros para los filtros seleccionados'}
                  </td></tr>
                )}
              </tbody>
            </table>
            {filteredReport.length > 5 && (
              <div className="px-4 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                Mostrando 5 de {filteredReport.length} registros
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex flex-wrap gap-3">
            <button
              disabled={isExporting || filteredReport.length === 0}
              onClick={() => doExport('pdf')}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.35)', border: '1px solid rgba(239,68,68,0.4)' }}>
              {isExporting ? 'Exportando...' : '⬇ PDF'}
            </button>
            <button
              disabled={isExporting || filteredReport.length === 0}
              onClick={() => doExport('excel')}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(96,165,250,0.35)', border: '1px solid rgba(96,165,250,0.4)' }}>
              {isExporting ? 'Exportando...' : '⬇ Excel'}
            </button>
            <button
              disabled={isExporting || filteredReport.length === 0}
              onClick={() => doExport('print')}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(96,165,250,0.35)', border: '1px solid rgba(96,165,250,0.4)' }}>
              🖨 Imprimir
            </button>
            <span className="self-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {filteredReport.length} registro{filteredReport.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

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
    </div>
  )
}
