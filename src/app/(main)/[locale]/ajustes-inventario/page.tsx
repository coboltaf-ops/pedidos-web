'use client'

import { useTranslations } from 'next-intl'

import { useState, useRef } from 'react'
import { todayColombia, fDate } from '@/shared/lib/format-date'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import type { SaldoBodega, MovimientoBodega } from '@/features/bodegas/types'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useAjustesStore } from '@/features/ajustes-inventario/store/ajustes-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { codigoMatchesTipo } from '@/shared/lib/tipo-inventario-prefijo'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { exportToPDF, exportToExcel, printReport } from '@/shared/lib/export-report'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'
import VoiceSearchButton from '@/shared/components/voice-search-button'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type RenglonAjuste = {
  id: string
  codigo_producto: string
  descripcion: string
  unidad_medida: string
  cantidad: number
}

type AjusteInventario = {
  id: string
  nro_ajuste: string
  fecha_emision: string
  tipo_inventario: string
  bodega_id: string
  bodega_nombre: string
  persona_autoriza: string
  fecha_aprobacion: string
  tipo_ajuste_id: string
  tipo_ajuste_nombre: string
  tipo_ajuste_signo: '+' | '-' | ''
  renglones: RenglonAjuste[]
  estado: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = todayColombia()

const emptyRenglon = (): RenglonAjuste => ({
  id: crypto.randomUUID(), codigo_producto: '', descripcion: '', unidad_medida: 'Unidad', cantidad: 1,
})

const emptyForm = (nro_ajuste: string, tipoInv = ''): AjusteInventario => ({
  id: '', nro_ajuste,
  fecha_emision: today, tipo_inventario: tipoInv, bodega_id: '', bodega_nombre: '',
  persona_autoriza: '', fecha_aprobacion: '',
  tipo_ajuste_id: '', tipo_ajuste_nombre: '', tipo_ajuste_signo: '',
  renglones: [emptyRenglon()], estado: 'Pendiente',
})

const nextNroAjuste = (ajustes: AjusteInventario[]) => {
  const maxNum = ajustes.reduce((max, a) => {
    const num = parseInt(a.nro_ajuste.replace('AJU-', ''), 10)
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)
  return `AJU-${String(maxNum + 1).padStart(5, '0')}`
}

const inputSt: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
}
const selectSt: React.CSSProperties = {
  background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
}
const estadoStyle = (s: string): React.CSSProperties => {
  if (s === 'Aprobada y Ejecutada') return { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' }
  if (s === 'Aprobado') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Anulado')  return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
  return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
}
const signoStyle = (signo: string): React.CSSProperties => {
  if (signo === '+') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (signo === '-') return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
  return { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }
}

// ─── PDF individual ──────────────────────────────────────────────────────────

function generateAjustePDF(a: AjusteInventario, empresaInfo?: { nombre: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string }, logoBase64?: string) {
  const rows = a.renglones.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${r.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#000;font-weight:600">${r.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${r.unidad_medida || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">${a.tipo_ajuste_signo}${r.cantidad}</td>
    </tr>`).join('')

  const signoColor = a.tipo_ajuste_signo === '+' ? '#1e40af' : '#dc2626'
  const signoLabel = a.tipo_ajuste_signo === '+' ? '+ Incrementa inventario' : '− Reduce inventario'
  const logoImg = logoBase64 ? `<img src="${logoBase64}" style="width:50px;height:50px;border-radius:6px;" />` : ''

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Ajuste de Inventario ${a.nro_ajuste}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#111; background:#fff; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #1e3a8a; }
    .company { font-size:22px; font-weight:700; color:#000; }
    .doc-title { text-align:right; }
    .doc-title h2 { font-size:20px; font-weight:700; color:#000; margin-bottom:2px; }
    .doc-title .consecutivo { font-size:18px; font-family:monospace; font-weight:900; color:#000; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; background:#000; color:#fff; border:1px solid #000; margin-top:6px; }
    .badge-tipo { display:inline-block; padding:4px 14px; border-radius:20px; font-size:11px; font-weight:700; color:#fff; margin-top:6px; margin-right:6px; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:28px; padding:20px; background:#eef2ff; border-radius:8px; border:1px solid #c7d2fe; }
    .field label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#1e3a8a; font-weight:700; display:block; margin-bottom:3px; }
    .field span { font-weight:600; color:#111; font-size:13px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#1e3a8a; }
    thead th { padding:10px 12px; color:#fff; font-size:11px; text-transform:uppercase; letter-spacing:.06em; text-align:left; }
    thead th:nth-child(3), thead th:nth-child(4) { text-align:center; }
    tbody td { padding:8px 12px; font-size:13px; color:#000; font-weight:600; border-bottom:1px solid #e5e7eb; }
    .footer { margin-top:40px; display:flex; justify-content:space-between; }
    .sign-box { text-align:center; }
    .sign-line { width:180px; border-top:2px solid #000; margin:0 auto 6px; padding-top:6px; font-size:11px; font-weight:700; color:#000; }
    @media print { body { padding:16px; } }
  </style></head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      ${logoImg}
      <div>
        <div class="company">${empresaInfo?.nombre || 'Empresa'}</div>
        ${empresaInfo ? `<div style="font-size:11px;color:#000;font-weight:700;margin-top:2px;line-height:1.4">${empresaInfo.tipo_identificacion}: ${empresaInfo.nro_documento}<br/>${empresaInfo.direccion || ''}${empresaInfo.ciudad ? `, ${empresaInfo.ciudad}` : ''}</div>` : ''}
      </div>
    </div>
    <div class="doc-title">
      <h2>AJUSTE DE INVENTARIO</h2>
      <div class="consecutivo">${a.nro_ajuste}</div>
      <div class="badge-tipo" style="background:${signoColor}">${a.tipo_ajuste_signo} ${a.tipo_ajuste_nombre}</div>
      <div class="badge">${a.estado}</div>
    </div>
  </div>

  <div class="grid">
    <div class="field"><label>Nro. Ajuste</label><span>${a.nro_ajuste}</span></div>
    <div class="field"><label>Fecha Emisión</label><span>${fDate(a.fecha_emision)}</span></div>
    <div class="field"><label>Bodega</label><span>${a.bodega_nombre || '—'}</span></div>
    <div class="field"><label>Persona que Autoriza</label><span>${a.persona_autoriza || '—'}</span></div>
    <div class="field"><label>Fecha Aprobación</label><span>${fDate(a.fecha_aprobacion)}</span></div>
    <div class="field"><label>Tipo de Ajuste</label><span style="color:${signoColor};font-weight:700">${signoLabel}</span></div>
  </div>

  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th><th style="text-align:center">Unidad</th>
      <th style="text-align:center">Cantidad</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="text-align:right;margin-bottom:24px;font-size:14px;font-weight:700;color:#111">
    Total Renglones: ${a.renglones.length} ítem${a.renglones.length !== 1 ? 's' : ''}
  </div>

  <div class="footer">
    <div class="sign-box"><div class="sign-line">Autorizado por</div><div style="font-size:11px;font-weight:700;color:#000">${a.persona_autoriza || '_______________'}</div></div>
    <div class="sign-box"><div class="sign-line">Ejecutado por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
    <div class="sign-box"><div class="sign-line">Revisado por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
  </div>

  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function AjustesInventarioPage() {
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
  const permisos = usePermisos('ajustes-inventario')
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const todasBodegas = useBodegasStore(s => s.bodegas)
  const updateBodega = useBodegasStore(s => s.updateBodega)
  const bodegas     = todasBodegas.filter(b => b.situacion === 'Activa' && (!tipoActivo || b.tipo_inventario === tipoActivo))
  const tiposAjuste = useReferenceStore(s => s.data.tipo_ajuste ?? []).filter(t => t.situacion)
  const todosProductos = useProductosStore(s => s.productos)
  const updateProducto = useProductosStore(s => s.updateProducto)
  const productos = todosProductos.filter(p =>
    p.situacion === 'Activo' && !!p.descripcion && !!p.codigo &&
    codigoMatchesTipo(p.codigo, tipoActivo || '')
  )
  const empresas    = useEmpresaStore(s => s.empresas)

  const [tab, setTab]           = useState<'registros' | 'reportes' | 'especificos'>('registros')
  const { ajustes: todosAjustes } = useAjustesStore()
  const ajustes = (tipoActivo ? todosAjustes.filter(a => (a as unknown as { tipo_inventario?: string }).tipo_inventario === tipoActivo) : todosAjustes) as AjusteInventario[]
  const setAjustes = (fn: (prev: AjusteInventario[]) => AjusteInventario[]) => useAjustesStore.setState(s => ({ ajustes: fn(s.ajustes as AjusteInventario[]) as AjusteInventario[] }))
  const [form, setForm]         = useState<AjusteInventario>(emptyForm('AJU-00001', tipoActivo || ''))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewItem, setViewItem] = useState<AjusteInventario | null>(null)

  // ── Búsqueda de productos (igual que Salidas) ──────────────────────────────
  const searchProdRef = useRef<HTMLInputElement>(null)
  const [searchProd, setSearchProd] = useState('')
  const [sinExistMsg, setSinExistMsg] = useState('')
  const [cantExistMsg, setCantExistMsg] = useState('')

  // ── Reporte ──────────────────────────────────────────────────────────────────
  const [rptTitle,    setRptTitle]    = useState(tRpt('ajustesInventario'))
  const [rptDesde,    setRptDesde]    = useState('')
  const [rptHasta,    setRptHasta]    = useState('')
  const [rptBodega,   setRptBodega]   = useState('')
  const [rptTipo,     setRptTipo]     = useState('')
  const [rptEstado,   setRptEstado]   = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const filteredReport = ajustes.filter(a => {
    if (rptDesde  && a.fecha_emision < rptDesde)  return false
    if (rptHasta  && a.fecha_emision > rptHasta)  return false
    if (rptBodega && a.bodega_id    !== rptBodega) return false
    if (rptTipo   && a.tipo_ajuste_id !== rptTipo) return false
    if (rptEstado && a.estado       !== rptEstado) return false
    return true
  })

  const reportColumns = [
    { header: 'Nro. Ajuste',       key: 'nro_ajuste',        width: 14 },
    { header: 'Fecha Emisión',     key: 'fecha_emision',     width: 14 },
    { header: 'Bodega',            key: 'bodega_nombre',     width: 22 },
    { header: 'Persona Autoriza',  key: 'persona_autoriza',  width: 22 },
    { header: 'Tipo de Ajuste',    key: 'tipo_label',        width: 26 },
    { header: tH('itemsAccent'),             key: 'items',             width: 8  },
    { header: 'Estado',            key: 'estado',            width: 12 },
  ]

  const reportRows = filteredReport.map(a => ({
    nro_ajuste:       a.nro_ajuste,
    fecha_emision:    a.fecha_emision,
    bodega_nombre:    a.bodega_nombre,
    persona_autoriza: a.persona_autoriza,
    tipo_label:       `${a.tipo_ajuste_signo} ${a.tipo_ajuste_nombre}`,
    items:            a.renglones.length,
    estado:           a.estado,
  }))

  const subtitle = [
    rptDesde  ? `Desde: ${rptDesde}`           : '',
    rptHasta  ? `Hasta: ${rptHasta}`           : '',
    rptBodega ? `Bodega: ${bodegas.find(b=>b.id===rptBodega)?.nombre}` : '',
    rptTipo   ? `Tipo: ${tiposAjuste.find(t=>t.id===rptTipo)?.descripcion}` : '',
    rptEstado ? `Estado: ${rptEstado}`         : '',
  ].filter(Boolean).join('  |  ')

  const doExport = async (format: 'pdf' | 'excel' | 'print') => {
    setIsExporting(true)
    const opts = {
      title: rptTitle,
      subtitle,
      columns: reportColumns,
      rows: reportRows,
      filename: `ajustes-inventario-${today}`,
    }
    try {
      if (format === 'pdf')   await exportToPDF(opts)
      if (format === 'excel') await exportToExcel(opts)
      if (format === 'print') printReport(opts)
    } finally {
      setIsExporting(false)
    }
  }

  // ── Handlers formulario ───────────────────────────────────────────────────────
  const handleBodega = (id: string) => {
    const b = bodegas.find(b => b.id === id)
    setForm({ ...form, bodega_id: id, bodega_nombre: b?.nombre ?? '' })
  }
  const handleTipoAjuste = (id: string) => {
    const t = tiposAjuste.find(t => t.id === id)
    setForm({ ...form, tipo_ajuste_id: id, tipo_ajuste_nombre: t?.descripcion ?? '', tipo_ajuste_signo: (t?.tipo as '+' | '-') ?? '' })
  }
  const updateRenglon = (idx: number, field: keyof RenglonAjuste, value: string | number) => {
    const renglones = [...form.renglones]
    renglones[idx] = { ...renglones[idx], [field]: value }
    setForm({ ...form, renglones })
  }
  const removeRenglon = (idx: number) => setForm({ ...form, renglones: form.renglones.filter((_, i) => i !== idx) })
  const [errorMsg, setErrorMsg] = useState('')
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.fecha_emision) { setErrorMsg('Debe indicar la Fecha de Emisión.'); return }
    if (!form.bodega_id) { setErrorMsg('Debe seleccionar la Bodega.'); return }
    if (!form.tipo_ajuste_id) { setErrorMsg('Debe seleccionar el Tipo de Ajuste.'); return }
    if (!form.persona_autoriza.trim()) { setErrorMsg('Debe indicar la Persona que Autoriza.'); return }

    const renglonesValidos = form.renglones.filter(r => r.codigo_producto && r.cantidad > 0)
    if (renglonesValidos.length === 0) { setErrorMsg('Debe agregar al menos un producto con cantidad > 0.'); return }

    const esSuma = form.tipo_ajuste_signo === '+'
    const tipoMov = esSuma ? 'Entrada por Ajuste' : 'Salida por Ajuste' as const

    // Buscar bodega
    const bodega = todasBodegas.find(b => b.id === form.bodega_id)
    if (!bodega) { setErrorMsg('Bodega no encontrada.'); return }

    const saldosBodega: SaldoBodega[] = bodega.saldos ? [...bodega.saldos] : []
    const movimientosBodega: MovimientoBodega[] = bodega.movimientos ? [...bodega.movimientos] : []

    // Si es resta, validar existencia suficiente
    if (!esSuma) {
      for (const r of renglonesValidos) {
        const sal = saldosBodega.find(s => s.codigo === r.codigo_producto)
        if (!sal || sal.existencia < r.cantidad) {
          setErrorMsg(`No hay suficiente existencia de "${r.descripcion}" en ${bodega.nombre} (disponible: ${sal?.existencia || 0}).`)
          return
        }
      }
    }

    // ── PROCESAMIENTO ATOMICO ──

    for (const r of renglonesValidos) {
      const prod = todosProductos.find(p => p.codigo === r.codigo_producto)
      if (!prod) continue

      const delta = esSuma ? r.cantidad : -r.cantidad

      // ── 1. ACTUALIZAR SALDO EN BODEGA ──
      const idxSal = saldosBodega.findIndex(s => s.codigo === r.codigo_producto)
      let existAntBodega: number
      let cpAntBodega: number
      let nuevaExistBodega: number
      let nuevoCpBodega: number

      if (idxSal >= 0) {
        const saldo = saldosBodega[idxSal]
        existAntBodega = saldo.existencia
        cpAntBodega = saldo.costo_promedio
        nuevaExistBodega = existAntBodega + delta

        if (esSuma) {
          // Entrada: recalcular CP ponderado (usa CP actual del producto como costo de entrada)
          const valorAnt = existAntBodega * cpAntBodega
          const costoEntrada = prod.costo_promedio || prod.ult_costo || 0
          const valorEntrada = r.cantidad * costoEntrada
          nuevoCpBodega = nuevaExistBodega > 0
            ? Math.round(((valorAnt + valorEntrada) / nuevaExistBodega) * 100) / 100
            : costoEntrada
        } else {
          // Salida: CP no cambia
          nuevoCpBodega = cpAntBodega
        }

        saldosBodega[idxSal] = {
          ...saldo,
          existencia: nuevaExistBodega,
          costo_promedio: nuevoCpBodega,
          valor_existencia: Math.round(nuevaExistBodega * nuevoCpBodega * 100) / 100,
        }
      } else if (esSuma) {
        // Producto nuevo en bodega (solo si es entrada)
        existAntBodega = 0
        cpAntBodega = 0
        nuevaExistBodega = r.cantidad
        nuevoCpBodega = prod.costo_promedio || prod.ult_costo || 0
        saldosBodega.push({
          producto_id: prod.id,
          codigo: prod.codigo,
          descripcion: prod.descripcion,
          unidad_medida: prod.unidad_medida,
          existencia: nuevaExistBodega,
          costo_promedio: nuevoCpBodega,
          valor_existencia: Math.round(nuevaExistBodega * nuevoCpBodega * 100) / 100,
        })
      } else {
        continue // No se puede restar de un producto que no existe en bodega
      }

      // ── 2. CREAR MOVIMIENTO EN BODEGA ──
      movimientosBodega.push({
        id: crypto.randomUUID(),
        fecha: form.fecha_emision,
        tipo: tipoMov,
        documento_origen: form.nro_ajuste,
        producto_id: prod.id,
        producto_codigo: prod.codigo,
        producto_descripcion: prod.descripcion,
        unidad_medida: prod.unidad_medida,
        cantidad: delta,
        costo_promedio: nuevoCpBodega,
        valor: Math.round(delta * nuevoCpBodega * 100) / 100,
        existencia_anterior: existAntBodega,
        existencia_despues: nuevaExistBodega,
        cp_anterior: cpAntBodega,
        motivo_ajuste: form.tipo_ajuste_nombre,
        persona_emite: form.persona_autoriza,
        observaciones: `Ajuste ${form.tipo_ajuste_nombre} (${form.tipo_ajuste_signo}) — ${form.nro_ajuste}`,
      })

      // ── 3. ACTUALIZAR MAESTRO DE PRODUCTOS ──
      const existAntProd = prod.existencia || 0
      const nuevaExistProd = existAntProd + delta
      const cpProd = prod.costo_promedio || prod.ult_costo || 0

      updateProducto(prod.id, {
        existencia: nuevaExistProd,
        costo_promedio: esSuma ? nuevoCpBodega : cpProd, // En entrada recalcula, en salida mantiene
        fecha_ult_movimiento: form.fecha_emision,
        nro_ult_documento: form.nro_ajuste,
        tipo_ult_movimiento: 'Ajuste de Inventario',
      })
    }

    // ── 4. GUARDAR BODEGA ACTUALIZADA ──
    updateBodega(bodega.id, {
      saldos: saldosBodega,
      movimientos: movimientosBodega,
    })

    // ── 5. GUARDAR EL AJUSTE ──
    setAjustes(prev => [...prev, { ...form, id: crypto.randomUUID(), estado: 'Aprobada y Ejecutada' }])
    setIsFormOpen(false)
    setSearchProd('')
    setSinExistMsg('')
    setCantExistMsg('')
    setErrorMsg('')
    setForm(emptyForm(nextNroAjuste(todosAjustes), tipoActivo || ''))
  }
  const handleDelete = (id: string) => {
    if (confirm(tCf('delAjuste'))) setAjustes(prev => prev.filter(a => a.id !== id))
  }

  // ─── Vista Detalle ────────────────────────────────────────────────────────────
  if (viewItem) return (
    <div>
      <button onClick={() => setViewItem(null)} className="mb-6 flex items-center gap-2 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
        ← Volver a Ajustes de Inventario
      </button>
      <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('ajusteInventarioDetail')}</h1>
            <p className="text-2xl font-mono mt-1" style={{ color: '#fff' }}>{viewItem.nro_ajuste}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => {
              const emp = empresas[0]
              const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined
              generateAjustePDF(viewItem, empData, emp?.logo || LOGO_BASE64)
            }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-colors"
              style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
              🖨 Generar PDF
            </button>
            <span className="px-4 py-2 rounded-full text-sm font-bold" style={signoStyle(viewItem.tipo_ajuste_signo)}>
              {viewItem.tipo_ajuste_signo} {viewItem.tipo_ajuste_nombre}
            </span>
            <span className="px-4 py-2 rounded-full text-sm font-medium" style={estadoStyle(viewItem.estado)}>{viewItem.estado}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Nro. Ajuste',          value: viewItem.nro_ajuste },
            { label: 'Fecha Emisión',         value: viewItem.fecha_emision },
            { label: 'Bodega',               value: viewItem.bodega_nombre },
            { label: 'Persona que Autoriza', value: viewItem.persona_autoriza },
            { label: 'Fecha Aprobación',     value: viewItem.fecha_aprobacion || '—' },
            { label: 'Tipo de Ajuste',       value: `${viewItem.tipo_ajuste_signo} ${viewItem.tipo_ajuste_nombre}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#f97316' }}>{label}</p>
              <p className="text-white font-medium">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <table className="w-full text-base text-left">
            <thead style={{ background: 'rgba(255,255,255,0.07)' }}>
              <tr>{['#','Código','Descripción',tH('unidMedida'),'Cantidad'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {viewItem.renglones.map((r, idx) => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-5 py-3 text-white/40 text-xs">{idx + 1}</td>
                  <td className="px-5 py-3 font-mono text-xs text-white">{r.codigo_producto}</td>
                  <td className="px-5 py-3 text-white/80">{r.descripcion}</td>
                  <td className="px-5 py-3 text-white/50">{r.unidad_medida || '—'}</td>
                  <td className="px-5 py-3">
                    <span className="font-bold px-3 py-1 rounded-lg text-sm" style={signoStyle(viewItem.tipo_ajuste_signo)}>
                      {viewItem.tipo_ajuste_signo}{r.cantidad}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // ─── Vista Principal ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Título + botón */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('ajustesInventario')}</h1>
          <p className="text-white/50 mt-1">{tSub('ajustesInventario')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button
            onClick={() => { setForm(emptyForm(nextNroAjuste(todosAjustes), tipoActivo || '')); setIsFormOpen(true) }}
            className="px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newAdjustment')}
          </button>
        )}
      </div>

      {/* ── Pestañas ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {(['registros', 'reportes', 'especificos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t
              ? { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
              : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}>
            {t === 'registros' ? tTab('registrosEmoji') : t === 'reportes' ? tTab('reportesEmoji') : tTab('especificosEmoji')}
          </button>
        ))}
      </div>

      {/* ══════════════════ TAB REGISTROS ══════════════════ */}
      {tab === 'registros' && (
        <>
          {/* Formulario */}
          {isFormOpen && (
            <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-lg font-semibold text-white">{tSec('nuevoAjuste')}</h2>
                <span className="font-mono text-sm px-3 py-1 rounded-lg"
                  style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                  {form.nro_ajuste}
                </span>
              </div>
              <form onSubmit={handleSave}>
                {errorMsg && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Nro. Ajuste</label>
                    <input readOnly value={form.nro_ajuste} className="w-full rounded-xl px-4 py-2.5 outline-none font-mono"
                      style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }} />
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Emisión *</label>
                    <input type="date" required value={form.fecha_emision}
                      onChange={e => setForm({ ...form, fecha_emision: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Tipo de Inventario</label>
                    <input readOnly value={form.tipo_inventario || '—'}
                      className="w-full rounded-xl px-4 py-2.5 outline-none font-semibold"
                      style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }}
                      title="Definido por el Tipo de Inventario activo de la sesión." />
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Bodega *</label>
                    <select required value={form.bodega_id} onChange={e => handleBodega(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                      <option value="">{tOp('seleccione')}</option>
                      {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Persona que Autoriza *</label>
                    <input required value={form.persona_autoriza}
                      onChange={e => setForm({ ...form, persona_autoriza: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Aprobación</label>
                    <input type="date" value={form.fecha_aprobacion}
                      onChange={e => setForm({ ...form, fecha_aprobacion: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Tipo de Ajuste *</label>
                    <select required value={form.tipo_ajuste_id} onChange={e => handleTipoAjuste(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                      <option value="">{tOp('seleccione')}</option>
                      {tiposAjuste.map(t => <option key={t.id} value={t.id}>{t.tipo} {t.descripcion}</option>)}
                    </select>
                    {form.tipo_ajuste_signo && (
                      <p className="mt-1.5 text-xs px-2 py-0.5 rounded inline-block font-medium" style={signoStyle(form.tipo_ajuste_signo)}>
                        {form.tipo_ajuste_signo === '+' ? '+ Incrementa inventario' : '− Reduce inventario'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Estado</label>
                    <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                      {[tF('pendiente'),'Aprobado','Anulado'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Buscar producto */}
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
                    const isReduccion = form.tipo_ajuste_signo === '-'
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
                              if (isReduccion && (p.existencia || 0) <= 0) {
                                setSinExistMsg(`Producto "${p.descripcion}" sin existencia. Seleccione otro producto.`)
                                setSearchProd('')
                                return
                              }
                              const exists = form.renglones.some(r => r.codigo_producto === p.codigo)
                              if (exists) { setSinExistMsg(`"${p.descripcion}" ya está en los renglones.`); setSearchProd(''); return }
                              const nuevo: RenglonAjuste = {
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

                {/* Renglones */}
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
                                  if (form.tipo_ajuste_signo === '-') {
                                    const prod = productos.find(p => p.codigo === r.codigo_producto)
                                    const exist = prod?.existencia || 0
                                    if (val > exist) {
                                      setCantExistMsg(`"${r.descripcion}" no tiene esa existencia. Disponible: ${exist}`)
                                      updateRenglon(idx, 'cantidad', 0)
                                      return
                                    }
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

                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2.5 rounded-xl text-white font-medium"
                    style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                    {tBtn('saveAdjustment')}
                  </button>
                  <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-2.5 rounded-xl text-white/70"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {tBtn('cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabla de registros */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>{[tF('nroAjuste'),'Fecha Emisión','Bodega','Persona Autoriza','Tipo de Ajuste','Renglones','Estado',tTbl('actions')].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {ajustes.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-5 py-4 font-mono font-bold" style={{ color: '#fff' }}>{a.nro_ajuste}</td>
                    <td className="px-5 py-4 text-white/60">{fDate(a.fecha_emision)}</td>
                    <td className="px-5 py-4 text-white font-bold">{a.bodega_nombre}</td>
                    <td className="px-5 py-4 text-white/60">{a.persona_autoriza}</td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-1 rounded-lg text-xs font-bold mr-1" style={signoStyle(a.tipo_ajuste_signo)}>{a.tipo_ajuste_signo}</span>
                      <span className="text-white/70 text-xs">{a.tipo_ajuste_nombre}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(96,165,250,0.15)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                        {a.renglones.length} ítem{a.renglones.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium" style={estadoStyle(a.estado)}>{a.estado}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => setViewItem(a)} className="px-3 py-1 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>Ver</button>
                        {permisos.eliminar && a.estado !== 'Aprobada y Ejecutada' && <button onClick={() => handleDelete(a.id)} className="px-3 py-1 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {ajustes.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-16 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <div className="text-4xl mb-3">⚖️</div>
                    <p>No hay ajustes registrados. Crea el primero con <strong>{tBtn('newAdjustment')}</strong>.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════ TAB REPORTES ══════════════════ */}
      {tab === 'reportes' && (
        <div className="space-y-6">

          {/* Panel título + filtros */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h2 className="text-lg font-semibold text-white mb-5">Configurar Reporte</h2>

            {/* Título personalizado */}
            <div className="mb-5">
              <label className="block text-xl font-extrabold text-white mb-1">Título del Reporte</label>
              <input value={rptTitle} onChange={e => setRptTitle(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none text-lg font-semibold" style={inputSt}
                placeholder="Ej: Reporte Mensual de Ajustes — Marzo 2026" />
            </div>

            {/* Filtros en grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
                <label className="block text-xl font-extrabold text-white mb-1">Bodega</label>
                <select value={rptBodega} onChange={e => setRptBodega(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                  <option value="">Todas</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Tipo de Ajuste</label>
                <select value={rptTipo} onChange={e => setRptTipo(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                  <option value="">Todos</option>
                  {tiposAjuste.map(t => <option key={t.id} value={t.id}>{t.tipo} {t.descripcion}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Estado</label>
                <select value={rptEstado} onChange={e => setRptEstado(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                  <option value="">Todos</option>
                  {[tF('pendiente'),'Aprobado','Anulado'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Botones de exportación */}
            <div className="flex flex-wrap gap-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="w-full text-xs text-white/40 mb-1">
                {filteredReport.length} registro{filteredReport.length !== 1 ? 's' : ''} encontrado{filteredReport.length !== 1 ? 's' : ''}
              </p>
              <button disabled={isExporting || filteredReport.length === 0} onClick={() => doExport('pdf')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
                📄 Exportar PDF
              </button>
              <button disabled={isExporting || filteredReport.length === 0} onClick={() => doExport('excel')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-40"
                style={{ background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(37,99,235,1)' }}>
                📊 Exportar Excel
              </button>
              <button disabled={isExporting || filteredReport.length === 0} onClick={() => doExport('print')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-40"
                style={{ background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(37,99,235,1)' }}>
                🖨️ Imprimir
              </button>
            </div>
          </div>

          {/* Vista previa */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="px-6 py-4" style={{ background: 'rgba(96,165,250,0.1)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs uppercase tracking-wider text-white/40 mb-0.5">Vista Previa</p>
              <p className="text-white font-semibold">{rptTitle}</p>
              {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
            </div>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>{reportColumns.map(c => (
                  <th key={c.key} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'rgba(255,255,255,0.6)' }}>{c.header}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filteredReport.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-5 py-3 font-mono font-bold" style={{ color: '#fff' }}>{a.nro_ajuste}</td>
                    <td className="px-5 py-3 text-white/60">{fDate(a.fecha_emision)}</td>
                    <td className="px-5 py-3 text-white/80">{a.bodega_nombre}</td>
                    <td className="px-5 py-3 text-white/60">{a.persona_autoriza}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold mr-1" style={signoStyle(a.tipo_ajuste_signo)}>{a.tipo_ajuste_signo}</span>
                      <span className="text-white/70 text-xs">{a.tipo_ajuste_nombre}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-white/60">{a.renglones.length}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={estadoStyle(a.estado)}>{a.estado}</span>
                    </td>
                  </tr>
                ))}
                {filteredReport.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Sin resultados con los filtros actuales.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB REPORTES ESPECÍFICOS ══════════════════ */}
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
