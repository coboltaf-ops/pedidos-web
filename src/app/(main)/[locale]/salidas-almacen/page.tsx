'use client'

import { useTranslations } from 'next-intl'

import { useState, useMemo, useRef } from 'react'
import { todayColombia } from '@/shared/lib/format-date'
import { useBodegasStore, type SaldoBodega, type MovimientoBodega } from '@/features/bodegas/store/bodegas-store'
import { useCentrosCostoStore } from '@/features/centros-costo/store/centros-costo-store'
import { useSalidasStore, type SalidaAlmacen, type RenglonSalida } from '@/features/salidas-almacen/store/salidas-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { codigoMatchesTipo } from '@/shared/lib/tipo-inventario-prefijo'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { fDate } from '@/shared/lib/format-date'
import { exportToPDF, exportToExcel, printReport } from '@/shared/lib/export-report'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'
import VoiceSearchButton from '@/shared/components/voice-search-button'

// ─── PDF ──────────────────────────────────────────────────────────────────────

function generateSalidaPDF(s: SalidaAlmacen, empresaInfo?: { nombre?: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string }, empresaLogo: string = LOGO_BASE64) {
  const rows = s.renglones.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${r.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#000;font-weight:600">${r.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${r.unidad_medida}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">${r.cantidad}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Salida de Almacén ${s.consecutivo}</title>
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
      <h2>SALIDA DE ALMACÉN</h2>
      <div class="consecutivo">${s.consecutivo}</div>
      <div class="badge">${s.situacion}</div>
    </div>
  </div>

  <div class="grid">
    <div class="field"><label>Nro. Salida</label><span>${s.consecutivo}</span></div>
    <div class="field"><label>Fecha Emisión</label><span>${fDate(s.fecha_emision)}</span></div>
    <div class="field"><label>Bodega Salida</label><span>${s.bodega_salida_nombre || '—'}</span></div>
    <div class="field"><label>Persona que Emite</label><span>${s.persona_emite || '—'}</span></div>
    <div class="field"><label>Centro de Costo</label><span>${s.centro_costo_nombre || '—'}</span></div>
    <div class="field"><label>Fecha Aprobación</label><span>${fDate(s.fecha_aprobacion)}</span></div>
  </div>

  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th><th style="text-align:center">Unidad</th>
      <th style="text-align:center">Cantidad</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${s.observaciones ? `<div class="obs"><div class="obs-label">Observaciones</div><div class="obs-content">${s.observaciones}</div></div>` : ''}

  <div class="footer">
    <div class="sign-box"><div class="sign-line">Despachado por</div><div style="font-size:11px;font-weight:700;color:#000">${s.persona_emite || '_______________'}</div></div>
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

const emptyRenglon = (): RenglonSalida => ({
  id: crypto.randomUUID(), codigo_producto: '', descripcion: '', unidad_medida: 'Unidad', cantidad: 1,
})

const emptyForm = (nro: number, tipoInv = ''): SalidaAlmacen => ({
  id: '', nro_salida: nro,
  consecutivo: `SAL-${String(nro).padStart(5, '0')}`,
  fecha_emision: today,
  tipo_inventario: tipoInv,
  bodega_salida_id: '', bodega_salida_nombre: '',
  persona_emite: '', fecha_aprobacion: '',
  centro_costo_id: '', centro_costo_nombre: '',
  observaciones: '', renglones: [emptyRenglon()], situacion: 'Pendiente',
})

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selectSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const situacionStyle = (s: string): React.CSSProperties => {
  if (s === 'Aprobada y Ejecutada') return { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' }
  if (s === 'Aprobada') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Anulada')  return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
  return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SalidasAlmacenPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tRpt = useTranslations('reportTitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('salidas-almacen')
  const empresas = useEmpresaStore(s => s.empresas)
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const todasBodegas = useBodegasStore(s => s.bodegas)
  const updateBodega = useBodegasStore(s => s.updateBodega)
  const bodegas = todasBodegas.filter(b => b.situacion === 'Activa' && (!tipoActivo || b.tipo_inventario === tipoActivo))
  const centrosCosto = useCentrosCostoStore(s => s.centros).filter(c => c.situacion === 'Activo')
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

  const [tab, setTab] = useState<'registros' | 'reportes'>('registros')

  const { salidas: todasSalidas } = useSalidasStore()
  const salidas = tipoActivo ? todasSalidas.filter(s => s.tipo_inventario === tipoActivo) : todasSalidas
  const setSalidas = (fn: (prev: SalidaAlmacen[]) => SalidaAlmacen[]) => useSalidasStore.setState(s => ({ salidas: fn(s.salidas) }))
  const [form, setForm] = useState<SalidaAlmacen>(emptyForm(1, tipoActivo || ''))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewItem, setViewItem] = useState<SalidaAlmacen | null>(null)

  // ── Estado Reportes ─────────────────────────────────────────────────────────
  const [rptTitle, setRptTitle] = useState(tRpt('salidasAlmacen'))
  const [rptDesde, setRptDesde] = useState('')
  const [rptHasta, setRptHasta] = useState('')
  const [rptBodega, setRptBodega] = useState('')
  const [rptSituacion, setRptSituacion] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleBodegaSalida = (id: string) => {
    const b = bodegas.find(b => b.id === id)
    setForm({ ...form, bodega_salida_id: id, bodega_salida_nombre: b?.nombre ?? '' })
  }

  const handleCentroCosto = (id: string) => {
    const c = centrosCosto.find(c => c.id === id)
    setForm({ ...form, centro_costo_id: id, centro_costo_nombre: c ? `${c.codigo} - ${c.descripcion}` : '' })
  }

  // ── Renglones ────────────────────────────────────────────────────────────────
  const updateRenglon = (idx: number, field: keyof RenglonSalida, value: string | number) => {
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
    if (!form.persona_emite.trim()) { setErrorMsg('Debe indicar la Persona que Emite.'); return }
    if (!form.centro_costo_id) { setErrorMsg('Debe seleccionar el Centro de Costo.'); return }

    const renglonesValidos = form.renglones.filter(r => r.codigo_producto && r.cantidad > 0)
    if (renglonesValidos.length === 0) { setErrorMsg('Debe agregar al menos un producto con cantidad > 0.'); return }

    // Validar existencia en bodega para cada renglón
    const bodega = todasBodegas.find(b => b.id === form.bodega_salida_id)
    if (!bodega) { setErrorMsg('Bodega no encontrada.'); return }

    const saldosBodega: SaldoBodega[] = bodega.saldos ? [...bodega.saldos] : []
    const movimientosBodega: MovimientoBodega[] = bodega.movimientos ? [...bodega.movimientos] : []

    for (const r of renglonesValidos) {
      const sal = saldosBodega.find(s => s.codigo === r.codigo_producto)
      if (!sal || sal.existencia < r.cantidad) {
        setErrorMsg(`No hay suficiente existencia de "${r.descripcion}" en ${bodega.nombre} (disponible: ${sal?.existencia || 0}).`)
        return
      }
    }

    // ── PROCESAMIENTO ATOMICO ──────────────────────────────────────────────

    for (const r of renglonesValidos) {
      const prod = todosProductos.find(p => p.codigo === r.codigo_producto)
      if (!prod) continue

      // ── 1. ACTUALIZAR SALDO EN BODEGA (restar) ──
      const idxSal = saldosBodega.findIndex(s => s.codigo === r.codigo_producto)
      const saldo = saldosBodega[idxSal]
      const existAnt = saldo.existencia
      const cpBodega = saldo.costo_promedio
      const nuevaExistBodega = existAnt - r.cantidad
      saldosBodega[idxSal] = {
        ...saldo,
        existencia: nuevaExistBodega,
        valor_existencia: Math.round(nuevaExistBodega * cpBodega * 100) / 100,
      }

      // ── 2. CREAR MOVIMIENTO EN BODEGA ──
      movimientosBodega.push({
        id: crypto.randomUUID(),
        fecha: form.fecha_emision,
        tipo: 'Salida a Centro de Costo',
        documento_origen: form.consecutivo,
        producto_id: prod.id,
        producto_codigo: prod.codigo,
        producto_descripcion: prod.descripcion,
        unidad_medida: prod.unidad_medida,
        cantidad: -r.cantidad,
        costo_promedio: cpBodega,
        valor: Math.round(-r.cantidad * cpBodega * 100) / 100,
        existencia_anterior: existAnt,
        existencia_despues: nuevaExistBodega,
        cp_anterior: cpBodega,
        centro_costo: form.centro_costo_nombre,
        persona_emite: form.persona_emite,
        observaciones: `Salida a ${form.centro_costo_nombre}`,
      })

      // ── 3. ACTUALIZAR MAESTRO DE PRODUCTOS (restar existencia) ──
      const existAntProd = prod.existencia || 0
      const nuevaExistProd = existAntProd - r.cantidad
      updateProducto(prod.id, {
        existencia: nuevaExistProd,
        fecha_ult_movimiento: form.fecha_emision,
        nro_ult_documento: form.consecutivo,
        tipo_ult_movimiento: 'Salida a Centro de Costo',
      })
    }

    // ── 4. GUARDAR BODEGA ACTUALIZADA ──
    updateBodega(bodega.id, {
      saldos: saldosBodega,
      movimientos: movimientosBodega,
    })

    // ── 5. GUARDAR LA SALIDA ──
    const salidaFinal = { ...form, situacion: 'Aprobada y Ejecutada' }
    if (editingId) {
      setSalidas(prev => prev.map(s => s.id === editingId ? { ...salidaFinal, id: editingId } : s))
    } else {
      setSalidas(prev => [...prev, { ...salidaFinal, id: crypto.randomUUID() }])
    }
    setIsFormOpen(false)
    setEditingId(null)
    setForm(emptyForm(todasSalidas.length + 2, tipoActivo || ''))
  }

  const handleEdit = (s: SalidaAlmacen) => {
    setForm(s)
    setEditingId(s.id)
    setIsFormOpen(true)
    setErrorMsg('')
  }

  const handleDelete = (id: string) => {
    if (confirm(tCf('delSalida'))) setSalidas(prev => prev.filter(s => s.id !== id))
  }

  // ── Reporte filtrado ─────────────────────────────────────────────────────────
  const filteredReport = useMemo(() => {
    return salidas.filter(s => {
      if (rptDesde && s.fecha_emision < rptDesde) return false
      if (rptHasta && s.fecha_emision > rptHasta) return false
      if (rptBodega && s.bodega_salida_id !== rptBodega) return false
      if (rptSituacion && s.situacion !== rptSituacion) return false
      return true
    })
  }, [salidas, rptDesde, rptHasta, rptBodega, rptSituacion])

  const bodegasUnicas = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of salidas) {
      if (!map.has(s.bodega_salida_id)) map.set(s.bodega_salida_id, s.bodega_salida_nombre)
    }
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [salidas])

  const rptCols = [
    { header: tH('nro'),            key: 'consecutivo',          width: 14 },
    { header: 'Fecha',           key: 'fecha_emision',        width: 14 },
    { header: 'Bodega Salida',   key: 'bodega_salida_nombre', width: 20 },
    { header: 'Centro de Costo', key: 'centro_costo_nombre',  width: 20 },
    { header: 'Persona Emite',   key: 'persona_emite',        width: 18 },
    { header: tH('itemsAccent'),           key: 'items',                width: 8  },
    { header: 'Situación',       key: 'situacion',            width: 12 },
  ]

  const buildRptRows = (rows: SalidaAlmacen[]) =>
    rows.map(s => ({
      consecutivo:          s.consecutivo,
      fecha_emision:        s.fecha_emision,
      bodega_salida_nombre: s.bodega_salida_nombre,
      centro_costo_nombre:  s.centro_costo_nombre,
      persona_emite:        s.persona_emite,
      items:                s.renglones.length,
      situacion:            s.situacion,
    }))

  const buildSubtitle = () => {
    const parts: string[] = []
    if (rptDesde) parts.push(`Desde: ${rptDesde}`)
    if (rptHasta) parts.push(`Hasta: ${rptHasta}`)
    if (rptBodega) {
      const b = bodegasUnicas.find(x => x.id === rptBodega)
      if (b) parts.push(`Bodega: ${b.nombre}`)
    }
    if (rptSituacion) parts.push(`Situación: ${rptSituacion}`)
    return parts.length ? parts.join(' | ') : undefined
  }

  const doExport = async (format: 'pdf' | 'excel' | 'print') => {
    setIsExporting(true)
    const opts = {
      title: rptTitle,
      subtitle: buildSubtitle(),
      columns: rptCols,
      rows: buildRptRows(filteredReport),
      filename: `salidas-almacen-${today}`,
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
            ← Volver a Salidas de Almacén
          </button>
          <button onClick={() => {
            const emp = empresas[0]
            const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined
            generateSalidaPDF(viewItem, empData, emp?.logo || LOGO_BASE64)
          }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-colors"
            style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
            🖨 Generar PDF
          </button>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">{t('salidaAlmacenDetail')}</h1>
              <p className="text-2xl font-mono mt-1" style={{ color: '#fff' }}>{viewItem.consecutivo}</p>
            </div>
            <span className="px-4 py-2 rounded-full text-sm font-medium" style={situacionStyle(viewItem.situacion)}>{viewItem.situacion}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: tH('nroSalida'), value: viewItem.consecutivo },
              { label: 'Fecha Emisión', value: viewItem.fecha_emision },
              { label: 'Bodega Salida', value: viewItem.bodega_salida_nombre },
              { label: 'Persona que Emite', value: viewItem.persona_emite || '—' },
              { label: 'Centro de Costo', value: viewItem.centro_costo_nombre || '—' },
              { label: 'Fecha Aprobación', value: viewItem.fecha_aprobacion || '—' },
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
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('salidasAlmacen')}</h1>
          <p className="text-white/50 mt-1">{tSub('salidasAlmacen')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button
            onClick={() => { setForm(emptyForm(todasSalidas.length + 1, tipoActivo || '')); setIsFormOpen(true) }}
            className="px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newIssue')}
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {([
          { key: 'registros', label: tTab('registrosEmoji') },
          { key: 'reportes',  label: tTab('reportesEmoji') },
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
                <h2 className="text-lg font-semibold text-white">{editingId ? 'Editar' : 'Nueva'} Salida de Almacén —</h2>
                <span className="font-mono text-sm px-3 py-1 rounded-lg" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                  {form.consecutivo}
                </span>
              </div>

              <form onSubmit={handleSave}>
                {/* Cabecera */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

                  {/* Nro Salida — solo lectura */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Nro. Salida</label>
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

                  {/* Persona que Emite */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Persona que Emite *</label>
                    <input required value={form.persona_emite}
                      onChange={e => setForm({ ...form, persona_emite: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
                      placeholder="Nombre completo" />
                  </div>

                  {/* Centro de Costo */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Centro de Costo *</label>
                    <select required value={form.centro_costo_id} onChange={e => handleCentroCosto(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                      <option value="">{tOp('seleccione')}</option>
                      {centrosCosto.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion}</option>)}
                    </select>
                  </div>

                  {/* Fecha Aprobación */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Aprobación</label>
                    <input type="date" value={form.fecha_aprobacion}
                      onChange={e => setForm({ ...form, fecha_aprobacion: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
                  </div>

                  {/* Situación */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
                    <select value={form.situacion} onChange={e => setForm({ ...form, situacion: e.target.value })}
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
                              const nuevo: RenglonSalida = {
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
                    style={inputSt} placeholder="Notas u observaciones sobre la salida..." />
                </div>

                {errorMsg && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                    ⚠ {errorMsg}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2.5 rounded-xl text-white font-medium"
                    style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                    {editingId ? 'Actualizar' : 'Guardar'} Salida
                  </button>
                  <button type="button" onClick={() => { setIsFormOpen(false); setEditingId(null); setErrorMsg('') }}
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
                  {[tH('nroSalida'), tF('fechaEmision'), tF('bodegaSalida'), tF('centroCosto'), tF('personaEmiteShort'), tF('renglones'), tF('situacion'), tTbl('actions')].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salidas.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-white/30">{tE('noSalidas')}</td></tr>
                ) : (
                  salidas.map(s => (
                    <tr key={s.id} className="hover:bg-white/[0.03] transition-colors" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: '#fff' }}>{s.consecutivo}</td>
                      <td className="px-5 py-3 text-white/70">{fDate(s.fecha_emision)}</td>
                      <td className="px-5 py-3 text-white/80">{s.bodega_salida_nombre}</td>
                      <td className="px-5 py-3 text-white/70 text-xs">{s.centro_costo_nombre || '—'}</td>
                      <td className="px-5 py-3 text-white/70">{s.persona_emite || '—'}</td>
                      <td className="px-5 py-3 text-white text-center font-bold">{s.renglones.length}</td>
                      <td className="px-5 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={situacionStyle(s.situacion)}>{s.situacion}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setViewItem(s)} className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                            style={{ color: '#fff', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>Ver</button>
                          {permisos.editar && s.situacion !== 'Aprobada y Ejecutada' && (
                            <button onClick={() => handleEdit(s)} className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                              style={{ color: '#fff', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>{tBtn('edit')}</button>
                          )}
                          {permisos.eliminar && s.situacion !== 'Aprobada y Ejecutada' && (
                            <button onClick={() => handleDelete(s.id)} className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                              style={{ color: '#fff', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{tBtn('delete')}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Tab Reportes ───────────────────────────────────────────────────────── */}
      {tab === 'reportes' && (
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 className="text-lg font-semibold text-white mb-6">{tBtn('generateIssuesReport')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Título del Reporte</label>
              <input value={rptTitle} onChange={e => setRptTitle(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none text-white" style={inputSt} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Desde</label>
              <input type="date" value={rptDesde} onChange={e => setRptDesde(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Hasta</label>
              <input type="date" value={rptHasta} onChange={e => setRptHasta(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Bodega</label>
              <select value={rptBodega} onChange={e => setRptBodega(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                <option value="">Todas</option>
                {bodegasUnicas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
              <select value={rptSituacion} onChange={e => setRptSituacion(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                <option value="">Todas</option>
                {[tF('pendiente'), 'Aprobada', 'Anulada'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <p className="text-white/50 text-sm mb-4">Registros encontrados: <strong className="text-white">{filteredReport.length}</strong></p>

          <div className="flex gap-3">
            <button onClick={() => doExport('pdf')} disabled={isExporting || !filteredReport.length}
              className="px-5 py-2.5 rounded-xl font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
              📄 Exportar PDF
            </button>
            <button onClick={() => doExport('excel')} disabled={isExporting || !filteredReport.length}
              className="px-5 py-2.5 rounded-xl font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(16,185,129,0.4)', border: '1px solid rgba(16,185,129,0.5)' }}>
              📊 Exportar Excel
            </button>
            <button onClick={() => doExport('print')} disabled={isExporting || !filteredReport.length}
              className="px-5 py-2.5 rounded-xl font-medium text-white disabled:opacity-40"
              style={{ background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(37,99,235,1)' }}>
              🖨 Imprimir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
