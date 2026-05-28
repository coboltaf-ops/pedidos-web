'use client'

import { useTranslations } from 'next-intl'

import { useState, useCallback } from 'react'
import { todayColombia } from '@/shared/lib/format-date'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { prefixForTipo, codigoMatchesTipo } from '@/shared/lib/tipo-inventario-prefijo'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useCorreosStore } from '@/features/correos-enviados/store/correos-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import { useCentrosCostoStore } from '@/features/centros-costo/store/centros-costo-store'
import { useOrdenesStore } from '@/features/ordenes-compra/store/ordenes-store'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { fDate } from '@/shared/lib/format-date'
import ReportPanel from '@/shared/components/report-panel'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { fmtMoney } from '@/shared/lib/format-number'

/* ── Modal Enviar Email ─────────────────────────────────────────────── */
function EmailModal({ orden, proveedorEmail, onClose, onEmailSent, onSuccess }: {
  orden: OrdenCompra
  proveedorEmail: string
  onClose: () => void
  onEmailSent: (data: { to: string; asunto: string; mensaje: string; estado: 'Enviado' | 'Abierto en cliente' }) => void
  onSuccess: () => void
}) {
  const tBtn = useTranslations('buttons')
  const tF = useTranslations('fields')
  const [to, setTo] = useState(proveedorEmail)
  const [asunto, setAsunto] = useState(`Orden de Compra ${orden.consecutivo}`)
  const [mensaje, setMensaje] = useState(`Estimado proveedor,\n\nAdjuntamos la Orden de Compra ${orden.consecutivo} para su revisión y procesamiento.\n\nQuedamos atentos a su confirmación.\n\nSaludos cordiales.`)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleSend = useCallback(async () => {
    if (!to) return

    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/send-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          proveedorNombre: orden.proveedor,
          consecutivo: orden.consecutivo,
          fecha_emision: fDate(orden.fecha_emision),
          fecha_vencimiento: fDate(orden.fecha_vencimiento),
          comprador: orden.comprador,
          tipo_moneda: orden.tipo_moneda,
          condicion_pago: orden.condicion_pago,
          observaciones: orden.observaciones,
          pct_impuesto: orden.pct_impuesto,
          detalles: orden.detalles,
          asunto,
          mensaje,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onEmailSent({ to, asunto, mensaje, estado: 'Enviado' })
        onClose()
        onSuccess()
      } else {
        setResult({ ok: false, msg: data.error || 'Error al enviar' })
      }
    } catch {
      setResult({ ok: false, msg: 'Error de conexión al enviar el email' })
    } finally {
      setSending(false)
    }
  }, [to, asunto, mensaje, orden, onEmailSent, onClose])

  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'rgba(12,26,61,0.98)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">📧 Enviar Orden por Email</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl p-3" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <p className="text-xs text-white/50">Orden</p>
            <p className="text-white font-mono font-bold">{orden.consecutivo}</p>
            <p className="text-white/60 text-sm mt-1">{orden.proveedor}</p>
          </div>

          <div>
            <label className="block text-xl text-white font-extrabold mb-1">Email del Proveedor *</label>
            <input type="email" value={to} onChange={e => setTo(e.target.value)} required
              className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={inputStyle}
              placeholder="email@proveedor.com" />
          </div>

          <div>
            <label className="block text-xl text-white font-extrabold mb-1">Asunto</label>
            <input value={asunto} onChange={e => setAsunto(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={inputStyle} />
          </div>

          <div>
            <label className="block text-xl text-white font-extrabold mb-1">Mensaje (opcional)</label>
            <textarea rows={4} value={mensaje} onChange={e => setMensaje(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold resize-none" style={inputStyle} />
          </div>

          {result && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{
              background: result.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${result.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: result.ok ? '#86efac' : '#fca5a5',
            }}>
              {result.ok ? '✅' : '❌'} {result.msg}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSend} disabled={sending || !to}
              className="flex-1 px-5 py-2.5 rounded-xl font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
              {sending ? '⏳ Enviando...' : '📧 Enviar Email'}
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {tBtn('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type EstadoRenglon = 'Pendiente' | 'Recibido' | 'Anulado'

type DetalleOrden = {
  id: string; codigo_producto: string; descripcion: string; cantidad: number
  costo_unitario: number; unidad_medida: string; subtotal: number; recibido: boolean
  estado_renglon?: EstadoRenglon
  cantidad_recibida?: number
}

/**
 * Calcula el estado visual de un renglón segun su cantidad pedida vs recibida
 * y el estado_renglon (para detectar Anulado).
 */
type EstadoRenglonVisual = 'Pendiente' | 'Recibido Parcial' | 'Recepcion Completa' | 'Anulado'

const calcEstadoRenglon = (d: DetalleOrden): EstadoRenglonVisual => {
  if (d.estado_renglon === 'Anulado') return 'Anulado'
  const recibida = d.cantidad_recibida || 0
  if (recibida <= 0) return 'Pendiente'
  if (recibida >= d.cantidad) return 'Recepcion Completa'
  return 'Recibido Parcial'
}

type OrdenCompra = {
  id: string; nro_orden: number; consecutivo: string; fecha_emision: string; fecha_vencimiento: string
  tipo_inventario: string
  proveedor: string; fecha_llegada: string; tipo_moneda: string; comprador: string
  condicion_pago: string; fecha_aprobacion: string; observaciones: string
  detalles: DetalleOrden[]; pct_impuesto: number; bodega_llegada: string; centro_costo: string; situacion: string
}

const emptyDetalle = (): DetalleOrden => ({ id: crypto.randomUUID(), codigo_producto: '', descripcion: '', cantidad: 1, costo_unitario: 0, unidad_medida: 'Unidad', subtotal: 0, recibido: false, estado_renglon: 'Pendiente', cantidad_recibida: 0 })

const today = todayColombia()

const emptyOrden = (nro: number, tipoInv = ''): OrdenCompra => ({
  id: '', nro_orden: nro, consecutivo: `OC-${String(nro).padStart(5, '0')}`,
  fecha_emision: today, fecha_vencimiento: '', tipo_inventario: tipoInv, proveedor: '', fecha_llegada: '',
  comprador: '', condicion_pago: '', tipo_moneda: '',
  fecha_aprobacion: '', observaciones: '', detalles: [emptyDetalle()], pct_impuesto: 19, bodega_llegada: '', centro_costo: '', situacion: 'Pendiente'
})


const calcTotals = (detalles: DetalleOrden[], pct: number) => {
  const subtotal = detalles.reduce((s, d) => s + d.subtotal, 0)
  const monto_impuesto = subtotal * (pct / 100)
  return { subtotal, monto_impuesto, total: subtotal + monto_impuesto }
}

function generateOrdenPDF(o: OrdenCompra, provInfo?: { tipo_id: string; nro_documento: string; direccion: string; ciudad: string }, empresaInfo?: { nombre?: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string }, empresaLogo: string = LOGO_BASE64) {
  const { subtotal, monto_impuesto, total } = calcTotals(o.detalles, o.pct_impuesto)
  const rows = o.detalles.map((d, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${d.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${d.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${d.cantidad}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${d.unidad_medida}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtMoney(d.costo_unitario)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${fmtMoney(d.subtotal)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Orden de Compra ${o.consecutivo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#111; background:#fff; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #1e3a8a; }
    .company { font-size:22px; font-weight:800; color:#000; line-height:1.15; white-space:nowrap; }
    .doc-title { text-align:right; }
    .doc-title h2 { font-size:20px; font-weight:700; color:#000; margin-bottom:2px; }
    .doc-title .prov-detail { font-size:11px; color:#374151; line-height:1.5; }
    .doc-title .consecutivo { font-size:18px; font-family:monospace; font-weight:900; color:#000; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; background:#000; color:#fff; border:1px solid #000; margin-top:6px; }
    .prov-box { margin-bottom:24px; padding:16px 20px; background:#f0f4ff; border:1px solid #c7d2fe; border-radius:8px; }
    .prov-box h3 { font-size:13px; font-weight:700; color:#1e3a8a; margin-bottom:8px; text-transform:uppercase; letter-spacing:.06em; }
    .prov-box .prov-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px 16px; }
    .prov-box .prov-field label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#1e3a8a; font-weight:700; display:block; margin-bottom:2px; }
    .prov-box .prov-field span { font-weight:600; color:#111; font-size:13px; }
    .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:28px; padding:20px; background:#eef2ff; border-radius:8px; border:1px solid #c7d2fe; }
    .field label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#1e3a8a; font-weight:700; display:block; margin-bottom:3px; }
    .field span { font-weight:600; color:#111; font-size:13px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#1e3a8a; }
    thead th { padding:10px 12px; color:#fff; font-size:11px; text-transform:uppercase; letter-spacing:.06em; text-align:left; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(4), thead th:nth-child(5) { text-align:right; }
    thead th:nth-child(3) { text-align:center; }
    thead th:nth-child(4) { text-align:center; }
    tbody td { padding:8px 12px; font-size:13px; color:#000; font-weight:600; border-bottom:1px solid #e5e7eb; }
    .totals { display:flex; flex-direction:column; align-items:flex-end; gap:6px; margin-bottom:24px; }
    .totals-row { display:flex; justify-content:space-between; width:280px; font-size:13px; color:#000; font-weight:600; }
    .totals-row.grand { border-top:2px solid #000; padding-top:8px; margin-top:4px; font-size:15px; font-weight:700; color:#000; }
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
      <h2>ORDEN DE COMPRA</h2>
      <div class="consecutivo">${o.consecutivo}</div>
      <div class="badge">${o.situacion}</div>
    </div>
  </div>

  <div class="grid">
    <div class="field"><label>Nro. Orden</label><span>${o.consecutivo}</span></div>
    <div class="field"><label>Fecha Emisión</label><span>${fDate(o.fecha_emision)}</span></div>
    <div class="field"><label>Fecha Vencimiento</label><span>${fDate(o.fecha_vencimiento) || '—'}</span></div>
    <div class="field"><label>Tipo de Moneda</label><span>${o.tipo_moneda || '—'}</span></div>
    <div class="field"><label>Condición de Pago</label><span>${o.condicion_pago || '—'}</span></div>
    <div class="field"><label>Fecha Aprobación</label><span>${fDate(o.fecha_aprobacion) || '—'}</span></div>
    <div class="field"><label>Bodega Llegada</label><span>${o.bodega_llegada || '—'}</span></div>
    <div class="field"><label>Centro de Costo</label><span>${o.centro_costo || '—'}</span></div>
    <div class="field"><label>Comprador</label><span>${o.comprador || '—'}</span></div>
  </div>

  <div class="prov-box">
    <h3>Datos del Proveedor</h3>
    <div class="prov-grid">
      <div class="prov-field"><label>Proveedor</label><span>${o.proveedor || '—'}</span></div>
      <div class="prov-field"><label>Tipo ID</label><span>${provInfo?.tipo_id || '—'}</span></div>
      <div class="prov-field"><label>Nro. Documento</label><span>${provInfo?.nro_documento || '—'}</span></div>
      <div class="prov-field"><label>Dirección</label><span>${provInfo?.direccion || '—'}</span></div>
      <div class="prov-field"><label>Ciudad</label><span>${provInfo?.ciudad || '—'}</span></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th><th style="text-align:center">Cant.</th>
      <th style="text-align:center">Unidad</th><th style="text-align:right">Costo Unit.</th>
      <th style="text-align:right">Subtotal</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span style="color:#6b7280">Subtotal antes de Impuesto</span><span>${fmtMoney(subtotal)}</span></div>
    <div class="totals-row"><span style="color:#6b7280">Impuesto (${o.pct_impuesto}%)</span><span>${fmtMoney(monto_impuesto)}</span></div>
    <div class="totals-row grand"><span>TOTAL ORDEN</span><span>${fmtMoney(total)}</span></div>
  </div>

  ${o.observaciones ? `<div class="obs"><div class="obs-label">Observaciones</div><div class="obs-content">${o.observaciones}</div></div>` : ''}

  <div class="footer">
    <div class="sign-box"><div class="sign-line">Elaborado por</div><div style="font-size:11px;font-weight:700;color:#000">${o.comprador || '_______________'}</div></div>
    <div class="sign-box"><div class="sign-line">Aprobado por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
    <div class="sign-box"><div class="sign-line">Recibido por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
  </div>

  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
}

export default function OrdenesCompraPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tRpt = useTranslations('reportTitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('ordenes-compra')
  const refData = useReferenceStore(s => s.data)
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const proveedores = useProveedoresStore(s => s.proveedores)
  const empresas = useEmpresaStore(s => s.empresas)
  const addCorreo = useCorreosStore(s => s.addCorreo)
  const productos = useProductosStore(s => s.productos)
  const bodegas = useBodegasStore(s => s.bodegas).filter(b => b.situacion === 'Activa')
  const centrosCosto = useCentrosCostoStore(s => s.centros).filter(c => c.situacion === 'Activo')

  const todasOrdenes = useOrdenesStore(s => s.ordenes)
  const ordenes = tipoActivo ? todasOrdenes.filter(o => o.tipo_inventario === tipoActivo) : todasOrdenes


  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [viewDetail, setViewDetail] = useState<OrdenCompra | null>(null)
  const [emailOrden, setEmailOrden] = useState<OrdenCompra | null>(null)

  const handleEmailSent = useCallback((data: { to: string; asunto: string; mensaje: string; estado: 'Enviado' | 'Abierto en cliente' }) => {
    if (!emailOrden) return
    const { total } = calcTotals(emailOrden.detalles, emailOrden.pct_impuesto)
    const now = new Date()
    addCorreo({
      id: crypto.randomUUID(),
      fecha: now.toISOString().split('T')[0],
      hora: now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
      destinatario: data.to,
      proveedor: emailOrden.proveedor,
      asunto: data.asunto,
      mensaje: data.mensaje,
      consecutivo: emailOrden.consecutivo,
      total: fmtMoney(total),
      tipo_moneda: emailOrden.tipo_moneda,
      estado: data.estado,
    })
  }, [emailOrden, addCorreo])

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'registros' | 'reportes' | 'especificos'>('registros')

  const selectStyle: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

  // ── Datos para ReportPanel ──────────────────────────────────────────────
  const reportColumns = [
    { header: 'Nro. Orden',   key: 'consecutivo',   width: 14 },
    { header: 'Fecha',        key: 'fecha_emision',  width: 14 },
    { header: 'Proveedor',    key: 'proveedor',      width: 24 },
    { header: 'Comprador',    key: 'comprador',      width: 20 },
    { header: 'Moneda',       key: 'tipo_moneda',    width: 10 },
    { header: 'Cond. Pago',  key: 'condicion_pago', width: 14 },
    { header: tH('items'),        key: 'items',          width: 8  },
    { header: tH('total'),        key: 'total',          width: 12 },
    { header: 'Situacion',   key: 'situacion',      width: 12 },
  ]

  const reportRows = ordenes.map(o => {
    const { total } = calcTotals(o.detalles, o.pct_impuesto)
    return {
      consecutivo: o.consecutivo,
      fecha_emision: o.fecha_emision,
      proveedor: o.proveedor,
      comprador: o.comprador,
      tipo_moneda: o.tipo_moneda,
      condicion_pago: o.condicion_pago,
      items: o.detalles.length,
      total: `$${fmtMoney(total)}`,
      situacion: o.situacion,
    }
  })

  const reportFilters = [
    { label: tF('situacionNoAccent'), key: 'situacion', options: Array.from(new Set(ordenes.map(o => o.situacion).filter(Boolean))) },
    { label: 'Proveedor', key: 'proveedor', options: Array.from(new Set(ordenes.map(o => o.proveedor).filter(Boolean))) },
    { label: 'Moneda', key: 'tipo_moneda', options: Array.from(new Set(ordenes.map(o => o.tipo_moneda).filter(Boolean))) },
    { label: tF('condPago'), key: 'condicion_pago', options: Array.from(new Set(ordenes.map(o => o.condicion_pago).filter(Boolean))) },
  ]

  const createNew = () => {
    setSelectedOrden(emptyOrden(todasOrdenes.length + 1, tipoActivo || ''))
    setIsFormOpen(true)
    setViewDetail(null)
  }

  const updateDetalle = (idx: number, field: keyof DetalleOrden, value: string | number | boolean) => {
    if (!selectedOrden) return
    const detalles = [...selectedOrden.detalles]
    detalles[idx] = { ...detalles[idx], [field]: value }
    if (field === 'cantidad' || field === 'costo_unitario') {
      detalles[idx].subtotal = detalles[idx].cantidad * detalles[idx].costo_unitario
    }
    setSelectedOrden({ ...selectedOrden, detalles })
  }

  const addDetalle = () => {
    if (!selectedOrden) return
    setSelectedOrden({ ...selectedOrden, detalles: [...selectedOrden.detalles, emptyDetalle()] })
  }

  const removeDetalle = (idx: number) => {
    if (!selectedOrden) return
    const detalles = selectedOrden.detalles.filter((_, i) => i !== idx)
    setSelectedOrden({ ...selectedOrden, detalles })
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrden) return
    // Proteccion: si la orden ya existe y esta en estado bloqueado, no permitir guardar
    if (selectedOrden.id) {
      const original = ordenes.find(o => o.id === selectedOrden.id)
      if (original && ['Recibida', 'Anulada', 'Pendiente por Recibir', 'Recibida Parcial'].includes(original.situacion)) {
        alert(`No se puede editar una orden en estado "${original.situacion}".`)
        setIsFormOpen(false)
        setSelectedOrden(null)
        return
      }
    }
    // Lógica de situación de la orden completa segun renglones y fecha de aprobacion
    let situacion = selectedOrden.situacion
    const detalles = selectedOrden.detalles
    const renglonesActivos = detalles.filter(d => d.estado_renglon !== 'Anulado')
    const todosCompletos = renglonesActivos.length > 0 && renglonesActivos.every(d => (d.cantidad_recibida || 0) >= d.cantidad)
    const algunaRecepcion = renglonesActivos.some(d => (d.cantidad_recibida || 0) > 0)
    const todosAnulados = detalles.length > 0 && detalles.every(d => d.estado_renglon === 'Anulado')
    const tieneAprobacion = !!selectedOrden.fecha_aprobacion

    if (todosAnulados) {
      situacion = 'Anulada'
    } else if (!tieneAprobacion) {
      // Sin Fecha de Aprobacion → siempre Pendiente Aprobacion
      situacion = 'Pendiente Aprobacion'
    } else if (todosCompletos) {
      // Todos los renglones activos completos → Recibida
      situacion = 'Recibida Completa'
    } else if (algunaRecepcion) {
      // Tiene Fecha de Aprobacion + algun producto con recepcion (pero no todos completos) → Recibida Parcial
      situacion = 'Recibida Parcial'
    } else {
      // Tiene Fecha de Aprobacion pero ningun producto recibido → Pendiente por Recibir
      situacion = 'Pendiente por Recibir'
    }
    const ordenToSave = { ...selectedOrden, situacion }
    if (ordenToSave.id) {
      useOrdenesStore.setState({ ordenes: todasOrdenes.map(o => o.id === ordenToSave.id ? ordenToSave : o) })
    } else {
      useOrdenesStore.setState({ ordenes: [...todasOrdenes, { ...ordenToSave, id: crypto.randomUUID() }] })
    }
    setIsFormOpen(false)
    setSelectedOrden(null)
  }

  const handleDeleteOrden = (o: { id: string; situacion: string }) => {
    if (confirm(`¿Eliminar esta orden de compra? (Estado: ${o.situacion})`)) useOrdenesStore.setState({ ordenes: todasOrdenes.filter(r => r.id !== o.id) })
  }

  const statusStyle = (s: string) => {
    const map: Record<string, React.CSSProperties> = {
      'Pendiente': { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' },
      'Pendiente Aprobacion': { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' },
      'Aprobada': { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' },
      'Pendiente por Recibir': { background: 'rgba(59,130,246,0.2)', color: '#fff', border: '1px solid rgba(59,130,246,0.3)' },
      'Recibida Parcial': { background: 'rgba(255,255,255,0.95)', color: '#0c1a3d', border: '1px solid rgba(255,255,255,1)' },
      'Anulada': { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' },
      'Recibida': { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' },
      'Recibida Completa': { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' },
    }
    return map[s] || {}
  }

  if (viewDetail) {
    const { subtotal, monto_impuesto, total } = calcTotals(viewDetail.detalles, viewDetail.pct_impuesto)
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setViewDetail(null)} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            ← Volver a Órdenes
          </button>
          <div className="flex gap-3">
            <button onClick={() => setEmailOrden(viewDetail)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-colors"
              style={{ background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(37,99,235,1)' }}>
              📧 Enviar por Email
            </button>
            <button onClick={() => {
              const cc = viewDetail.centro_costo || ''
              const ccFixed = cc.includes(' - ') ? cc : (() => { const f = centrosCosto.find(c => c.descripcion === cc); return f ? `${f.codigo} - ${f.descripcion}` : cc })()
              const prov = proveedores.find(p => p.nombre === viewDetail.proveedor)
              const provData = prov ? { tipo_id: prov.tipo_id, nro_documento: prov.nro_documento, direccion: prov.direccion, ciudad: prov.ciudad } : undefined
              const emp = empresas[0]
              const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined
              generateOrdenPDF({ ...viewDetail, centro_costo: ccFixed }, provData, empData, emp?.logo || LOGO_BASE64)
            }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-colors"
              style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
              🖨 Generar PDF
            </button>
          </div>
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Orden de Compra</h1>
              <p className="text-2xl font-mono mt-1" style={{ color: '#fff' }}>{viewDetail.consecutivo}</p>
            </div>
            <span className="px-4 py-2 rounded-full font-medium text-sm" style={statusStyle(viewDetail.situacion)}>{viewDetail.situacion}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Correlativo', value: viewDetail.consecutivo },
              { label: 'Tipo de Inventario', value: viewDetail.tipo_inventario },
              { label: 'Fecha Emisión', value: fDate(viewDetail.fecha_emision) },
              { label: 'Fecha Vencimiento', value: fDate(viewDetail.fecha_vencimiento) },
              { label: 'Proveedor', value: viewDetail.proveedor },
              { label: tF('fechaEstLlegada'), value: fDate(viewDetail.fecha_llegada) },
              { label: 'Tipo de Moneda', value: viewDetail.tipo_moneda },
              { label: 'Comprador', value: viewDetail.comprador },
              { label: 'Fecha Aprobación', value: fDate(viewDetail.fecha_aprobacion) },
              { label: 'Bodega Llegada', value: viewDetail.bodega_llegada },
              { label: 'Centro de Costo', value: viewDetail.centro_costo?.includes(' - ') ? viewDetail.centro_costo : (centrosCosto.find(c => c.descripcion === viewDetail.centro_costo)?.codigo ? centrosCosto.find(c => c.descripcion === viewDetail.centro_costo)!.codigo + ' - ' + viewDetail.centro_costo : viewDetail.centro_costo) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wider" style={{ color: '#f97316' }}>{label}</p>
                <p className="text-white font-medium mt-1">{value || '-'}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.08)' }}>
                <tr>
                  {[tF('codigo'), tF('descripcion'), tH('cantShort'), tH('unidShort'), tH('costoUnit'), tF('subtotal'), tH('recibido')].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewDetail.detalles.map(d => {
                  const recibida = d.cantidad_recibida || 0
                  const completo = recibida >= d.cantidad
                  const parcial = recibida > 0 && !completo
                  return (
                    <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-4 py-3 font-mono text-xs text-white">{d.codigo_producto}</td>
                      <td className="px-4 py-3 text-white/80">{d.descripcion}</td>
                      <td className="px-4 py-3 text-white/70 text-right">{d.cantidad}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{d.unidad_medida}</td>
                      <td className="px-4 py-3 text-white/70 text-right">{fmtMoney(d.costo_unitario)}</td>
                      <td className="px-4 py-3 text-white font-medium text-right">{fmtMoney(d.subtotal)}</td>
                      <td className="px-4 py-3 text-center">
                        {recibida === 0 ? (
                          <span style={{ color: 'rgba(255,255,255,0.3)' }}>0 / {d.cantidad}</span>
                        ) : (
                          <span className="px-2 py-1 rounded-md text-xs font-bold" style={completo
                            ? { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.4)' }
                            : { background: 'rgba(251,191,36,0.95)', color: '#fff', border: '1px solid rgba(251,191,36,0.4)' }
                          }>
                            {recibida} / {d.cantidad}{completo ? ' ✓' : parcial ? ' parcial' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-end gap-2 mb-6">
            {[
              { label: 'Subtotal antes de Impuesto', value: subtotal },
              { label: `Impuesto (${viewDetail.pct_impuesto}%)`, value: monto_impuesto },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-8 justify-between w-64">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                <span className="text-white">{fmtMoney(value)}</span>
              </div>
            ))}
            <div className="flex gap-8 justify-between w-64 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <span className="font-bold text-white">TOTAL ORDEN</span>
              <span className="font-bold text-lg" style={{ color: '#fff' }}>{fmtMoney(total)}</span>
            </div>
          </div>

          {viewDetail.observaciones && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>Observaciones</p>
              <p className="text-white/70">{viewDetail.observaciones}</p>
            </div>
          )}
        </div>

        {/* ── Modal Enviar Email (vista detalle) ───────────────────────────── */}
        {emailOrden && (
          <EmailModal
            orden={emailOrden}
            proveedorEmail={proveedores.find(p => p.nombre === emailOrden.proveedor)?.correo || ''}
            onClose={() => setEmailOrden(null)}
            onEmailSent={handleEmailSent}
            onSuccess={() => setViewDetail(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('ordenesCompra')}</h1>
          <p className="text-white/50 mt-1">{tSub('ordenesCompra')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button onClick={createNew} className="px-5 py-2.5 rounded-xl font-medium text-white mr-24" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newOrder')}
          </button>
        )}
      </div>

      {/* ── Selector de Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {(['registros', 'reportes', 'especificos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t
              ? { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
              : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}
          >
            {t === 'registros' ? tTab('registrosEmoji') : t === 'reportes' ? tTab('reportesEmoji') : tTab('especificosEmoji')}
          </button>
        ))}
      </div>

      {/* ── Tab: Registros ─────────────────────────────────────────────────── */}
      {tab === 'registros' && (
        <>
          {isFormOpen && selectedOrden && (() => {
            const { subtotal, monto_impuesto, total } = calcTotals(selectedOrden.detalles, selectedOrden.pct_impuesto)
            return (
              <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <h2 className="text-lg font-semibold text-white mb-4">Nueva Orden de Compra — {selectedOrden.consecutivo}</h2>
                <form onSubmit={handleSave}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                    {/* Correlativo - solo lectura */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Correlativo</label>
                      <input readOnly value={selectedOrden.consecutivo}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold font-mono"
                        style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', cursor: 'not-allowed' }} />
                    </div>
                    {/* Fecha Emisión */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Fecha Emisión *</label>
                      <input type="date" required value={selectedOrden.fecha_emision}
                        onChange={e => setSelectedOrden({ ...selectedOrden, fecha_emision: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
                    </div>
                    {/* Tipo de Inventario (heredado de la sesión, no editable aquí) */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Tipo de Inventario</label>
                      <input readOnly value={selectedOrden.tipo_inventario || '—'}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold font-semibold"
                        style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }}
                        title="Definido por el Tipo de Inventario activo de la sesión. Cámbialo desde la barra superior." />
                    </div>
                    {/* Campos de fecha y texto libre */}
                    {[
                      { label: tF('fechaVencimientoRequired'), key: 'fecha_vencimiento', type: 'date' },
                      { label: tF('fechaEstLlegada'), key: 'fecha_llegada', type: 'date' },
                      { label: 'Comprador *', key: 'comprador', placeholder: 'Responsable' },
                      { label: 'Fecha Aprobación', key: 'fecha_aprobacion', type: 'date' },
                    ].map(({ label, key, type = 'text', placeholder }) => (
                      <div key={key}>
                        <label className="block text-xl text-white font-extrabold mb-1">{label}</label>
                        <input
                          type={type} required={label.includes('*')}
                          value={String((selectedOrden as Record<string, unknown>)[key])}
                          onChange={e => setSelectedOrden({ ...selectedOrden, [key]: type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                          className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                    {/* % Impuesto — tabla referencia */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">% Impuesto</label>
                      <select value={selectedOrden.pct_impuesto} onChange={e => setSelectedOrden({ ...selectedOrden, pct_impuesto: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        {(refData.impuesto ?? []).filter(i => i.situacion).sort((a, b) => parseFloat(a.descripcion) - parseFloat(b.descripcion)).map(i => (
                          <option key={i.id} value={parseFloat(i.descripcion)}>{i.descripcion}</option>
                        ))}
                      </select>
                    </div>
                    {/* Proveedor — tabla referencia */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Proveedor *</label>
                      <select required value={selectedOrden.proveedor} onChange={e => setSelectedOrden({ ...selectedOrden, proveedor: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                      </select>
                    </div>
                    {/* Tipo de Moneda — tabla referencia */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Tipo de Moneda *</label>
                      <select required value={selectedOrden.tipo_moneda} onChange={e => setSelectedOrden({ ...selectedOrden, tipo_moneda: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {refData.tipo_moneda.map(m => <option key={m.id} value={m.descripcion}>{m.descripcion}</option>)}
                      </select>
                    </div>
                    {/* Condición de Pago — tabla referencia */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Condición de Pago *</label>
                      <select required value={selectedOrden.condicion_pago} onChange={e => setSelectedOrden({ ...selectedOrden, condicion_pago: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {refData.condiciones_pago.map(c => <option key={c.id} value={c.descripcion}>{c.descripcion}</option>)}
                      </select>
                    </div>
                    {/* Bodega Llegada (filtrada por tipo de inventario) */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Bodega Llegada *</label>
                      <select required value={selectedOrden.bodega_llegada} onChange={e => setSelectedOrden({ ...selectedOrden, bodega_llegada: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{selectedOrden.tipo_inventario ? tOp('seleccione') : 'Seleccione primero el Tipo de Inventario'}</option>
                        {bodegas
                          .filter(b => !selectedOrden.tipo_inventario || b.tipo_inventario === selectedOrden.tipo_inventario)
                          .map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
                      </select>
                    </div>
                    {/* Centro de Costo */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Centro de Costo</label>
                      <select value={selectedOrden.centro_costo} onChange={e => setSelectedOrden({ ...selectedOrden, centro_costo: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {centrosCosto.map(c => <option key={c.id} value={`${c.codigo} - ${c.descripcion}`}>{c.codigo} - {c.descripcion}</option>)}
                      </select>
                    </div>
                    {/* Situación — tabla referencia */}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Situación</label>
                      <select value={selectedOrden.situacion} onChange={e => setSelectedOrden({ ...selectedOrden, situacion: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        {refData.situacion_orden_compra.map(s => <option key={s.id} value={s.descripcion}>{s.descripcion}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Detalles */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-white font-medium">Renglones / Detalle</h3>
                      <button type="button" onClick={addDetalle} className="px-3 py-1.5 rounded-lg text-xs text-white font-medium" style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}>
                        {tBtn('addLine')}
                      </button>
                    </div>
                    {/* Buscador de producto para agregar */}
                    <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
                      <label className="block text-xl text-white font-extrabold mb-2">
                        Buscar producto por código o descripción
                        {selectedOrden.tipo_inventario && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(251,191,36,0.95)', color: '#fff', border: '1px solid rgba(251,191,36,0.4)' }}>
                            Solo productos {selectedOrden.tipo_inventario} · Código debe iniciar con {prefixForTipo(selectedOrden.tipo_inventario)}-
                          </span>
                        )}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          value={searchText}
                          onChange={e => setSearchText(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-white outline-none text-base text-white font-bold"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                          placeholder={selectedOrden.tipo_inventario
                            ? `Escriba código (ej: ${prefixForTipo(selectedOrden.tipo_inventario)}-00001) o nombre del producto...`
                            : 'Escriba código o nombre del producto...'}
                          autoComplete="off"
                        />
                        {searchText.length >= 2 && (() => {
                          const q = searchText.toLowerCase()
                          const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
                          const ocTipo = norm(selectedOrden.tipo_inventario)
                          const matches = productos.filter(p => {
                            if (p.situacion !== 'Activo' || !p.descripcion || !p.codigo) return false
                            // Filtro por tipo: comparar tipo_inventario normalizado, o fallback por prefijo de código
                            if (ocTipo) {
                              const prodTipo = norm(p.tipo_inventario)
                              const tipoOk = prodTipo
                                ? prodTipo === ocTipo
                                : codigoMatchesTipo(p.codigo, selectedOrden.tipo_inventario)
                              if (!tipoOk) return false
                            }
                            return p.descripcion.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
                          })
                          return (
                          <div style={{ position: 'absolute', zIndex: 9999, left: 0, right: 0, top: '100%', marginTop: 4, background: 'rgb(15,23,42)', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 12, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                            {matches.slice(0, 10).map(p => (
                              <div key={p.id}
                                onMouseDown={e => {
                                  e.preventDefault()
                                  const newDet: DetalleOrden = {
                                    id: crypto.randomUUID(),
                                    codigo_producto: p.codigo,
                                    descripcion: p.descripcion,
                                    cantidad: 1,
                                    costo_unitario: p.ult_costo,
                                    unidad_medida: p.unidad_medida,
                                    subtotal: p.ult_costo,
                                    recibido: false,
                                    estado_renglon: 'Pendiente',
                                    cantidad_recibida: 0,
                                  }
                                  // Si hay un renglón vacío (sin código), reemplazarlo; si no, agregar nuevo
                                  const emptyIdx = selectedOrden.detalles.findIndex(d => !d.codigo_producto)
                                  let detalles: DetalleOrden[]
                                  if (emptyIdx >= 0) {
                                    detalles = selectedOrden.detalles.map((d, i) => i === emptyIdx ? newDet : d)
                                  } else {
                                    detalles = [...selectedOrden.detalles, newDet]
                                  }
                                  setSelectedOrden({ ...selectedOrden, detalles })
                                  setSearchText('')
                                }}
                                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                className="hover:bg-blue-400/20"
                              >
                                <span style={{ color: '#fff', fontSize: 13 }}>{p.descripcion}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace', marginLeft: 12 }}>{p.codigo} · {p.unidad_medida} · ${fmtMoney(p.ult_costo)}</span>
                              </div>
                            ))}
                            {matches.length === 0 && (
                              <div style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center' }}>No se encontraron productos</div>
                            )}
                          </div>
                          )
                        })()}
                      </div>
                    </div>

                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      <table className="w-full text-base text-left">
                        <thead style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <tr>
                            {[tF('codigo'), tF('descripcion'), tH('cantidadRequired'), tF('unidad'), tH('costoUnitRequired'), tF('subtotal'), tF('estado'), ''].map(h => (
                              <th key={h} className="px-3 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrden.detalles.map((d, idx) => {
                            const estadoVisual = calcEstadoRenglon(d)
                            const sinAprobacion = !selectedOrden.fecha_aprobacion
                            const labelEstado: string = (estadoVisual === 'Pendiente' && sinAprobacion)
                              ? 'Pendiente Aprobacion'
                              : estadoVisual
                            const estadoConfig: { bg: string; dark: string; color: string } =
                              labelEstado === 'Pendiente Aprobacion' ? { bg: '#fbbf24', dark: '#d97706', color: '#000' } :
                              labelEstado === 'Pendiente'             ? { bg: '#fbbf24', dark: '#d97706', color: '#000' } :
                              labelEstado === 'Recibido Parcial'      ? { bg: '#3b82f6', dark: '#1e40af', color: '#fff' } :
                              labelEstado === 'Recepcion Completa'    ? { bg: '#22c55e', dark: '#15803d', color: '#fff' } :
                              /* Anulado */                             { bg: '#dc2626', dark: '#7f1d1d', color: '#fff' }
                            const toggleAnulado = () => {
                              if (!selectedOrden) return
                              const detalles = [...selectedOrden.detalles]
                              const isAnulado = detalles[idx].estado_renglon === 'Anulado'
                              detalles[idx] = { ...detalles[idx], estado_renglon: isAnulado ? 'Pendiente' : 'Anulado' }
                              setSelectedOrden({ ...selectedOrden, detalles })
                            }
                            const cantInvalida = !d.cantidad || d.cantidad <= 0
                            const costoInvalido = !d.costo_unitario || d.costo_unitario <= 0
                            return (
                              <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td className="px-2 py-2">
                                  <input value={d.codigo_producto} readOnly className="w-28 rounded-lg px-2 py-1.5 text-white outline-none cursor-not-allowed font-mono text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} />
                                </td>
                                <td className="px-2 py-2">
                                  <input value={d.descripcion} readOnly className="w-full rounded-lg px-2 py-1.5 text-white outline-none cursor-not-allowed text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    required
                                    value={d.cantidad || ''}
                                    onChange={e => updateDetalle(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                                    className="w-20 rounded-lg px-2 py-1.5 text-white outline-none"
                                    style={{
                                      background: cantInvalida ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                                      border: cantInvalida ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-2"><input value={d.unidad_medida} readOnly className="w-28 rounded-lg px-2 py-1.5 text-white outline-none text-xs cursor-not-allowed" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} /></td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    value={d.costo_unitario || ''}
                                    onChange={e => updateDetalle(idx, 'costo_unitario', parseFloat(e.target.value) || 0)}
                                    className="w-24 rounded-lg px-2 py-1.5 text-white outline-none"
                                    style={{
                                      background: costoInvalido ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                                      border: costoInvalido ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-2 text-white font-bold">{fmtMoney(d.subtotal)}</td>
                                <td className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={toggleAnulado}
                                    title="Click para Anular/Restaurar el renglon. El estado de recepcion se actualiza desde Recepcion de Facturas."
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 whitespace-nowrap"
                                    style={{
                                      background: `linear-gradient(135deg, ${estadoConfig.bg}, ${estadoConfig.dark})`,
                                      color: estadoConfig.color,
                                      border: `1px solid ${estadoConfig.bg}`,
                                      boxShadow: `0 0 10px ${estadoConfig.bg}66`,
                                    }}
                                  >
                                    {labelEstado}
                                  </button>
                                  {(d.cantidad_recibida || 0) > 0 && (
                                    <p className="text-[10px] text-white/50 mt-1 text-center">
                                      Recib: {d.cantidad_recibida}/{d.cantidad}
                                    </p>
                                  )}
                                </td>
                                <td className="px-2 py-2"><button type="button" onClick={() => removeDetalle(idx)} className="text-red-400 hover:text-red-300 px-2 py-1">✕</button></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totales */}
                  <div className="flex flex-col items-end gap-2 mb-6 text-sm">
                    <div className="flex gap-8 w-80 justify-between px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <span className="text-white/70 font-medium">Subtotal antes de Impuesto</span>
                      <span className="text-white font-semibold">{fmtMoney(subtotal)}</span>
                    </div>
                    <div className="flex gap-8 w-80 justify-between px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <span className="text-white/70 font-medium">% IVA ({selectedOrden.pct_impuesto}%)</span>
                      <span className="text-white font-semibold">{fmtMoney(monto_impuesto)}</span>
                    </div>
                    <div className="flex gap-8 w-80 justify-between px-4 py-3 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(96,165,250,0.1))', border: '1px solid rgba(96,165,250,0.4)' }}>
                      <span className="text-white font-bold text-base">TOTAL GENERAL ORDEN</span>
                      <span className="font-black text-lg" style={{ color: '#fff' }}>{fmtMoney(total)}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
                    <textarea rows={2} value={selectedOrden.observaciones} onChange={e => setSelectedOrden({ ...selectedOrden, observaciones: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 text-white outline-none resize-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                      placeholder="Notas u observaciones..." />
                  </div>

                  <div className="flex gap-3">
                    <button type="submit" className="px-6 py-2 rounded-xl text-white font-medium" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{tBtn('saveOrder')}</button>
                    <button type="button" onClick={() => { setIsFormOpen(false); setSelectedOrden(null) }} className="px-6 py-2 rounded-xl text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>{tBtn('cancel')}</button>
                  </div>
                </form>
              </div>
            )
          })()}

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left" style={{ minWidth: '900px' }}>
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {[tH('nro'), tF('proveedor'), tH('emision'), tH('vence'), tF('comprador'), tH('total'), tF('estado'), tTbl('actions')].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenes.map(o => {
                  const totals = calcTotals(o.detalles, o.pct_impuesto)
                  return (
                    <tr key={o.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-3 py-3 font-mono font-bold whitespace-nowrap" style={{ color: '#fff' }}>{o.consecutivo}</td>
                      <td className="px-3 py-3 text-white font-bold max-w-[180px] truncate">{o.proveedor}</td>
                      <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(o.fecha_emision)}</td>
                      <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(o.fecha_vencimiento)}</td>
                      <td className="px-3 py-3 text-white font-bold max-w-[120px] truncate">{o.comprador}</td>
                      <td className="px-3 py-3 text-white font-medium whitespace-nowrap">{fmtMoney(totals.total)}</td>
                      <td className="px-3 py-3"><span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={statusStyle(o.situacion)}>{o.situacion}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5 whitespace-nowrap">
                          <button onClick={() => setViewDetail(o)} className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>Ver</button>
                          {permisos.editar && !['Recibida', 'Recibida Completa', 'Anulada', 'Pendiente por Recibir', 'Recibida Parcial'].includes(o.situacion) && <button onClick={() => {
                            const cc = o.centro_costo || ''
                            const ccFixed = cc.includes(' - ') ? cc : (() => {
                              const found = centrosCosto.find(c => c.descripcion === cc)
                              return found ? `${found.codigo} - ${found.descripcion}` : cc
                            })()
                            setSelectedOrden({ ...o, centro_costo: ccFixed }); setIsFormOpen(true); setViewDetail(null)
                          }} className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>{tBtn('edit')}</button>}
                          {permisos.esAdmin && !['Recibida', 'Recibida Completa', 'Anulada', 'Pendiente por Recibir', 'Recibida Parcial'].includes(o.situacion) && <button onClick={() => handleDeleteOrden(o)} className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Tab: Reportes ──────────────────────────────────────────────────── */}
      {tab === 'reportes' && (
        <ReportPanel
          title={tRpt('ordenesCompra')}
          columns={reportColumns}
          rows={reportRows}
          filters={reportFilters}
          filename="ordenes-compra"
          summableKeys={['total', 'items']}
        />
      )}

      {/* ── Tab: Reportes Específicos ────────────────────────────────────── */}
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

      {/* ── Modal Enviar Email ─────────────────────────────────────────────── */}
      {emailOrden && (
        <EmailModal
          orden={emailOrden}
          proveedorEmail={proveedores.find(p => p.nombre === emailOrden.proveedor)?.correo || ''}
          onClose={() => setEmailOrden(null)}
          onEmailSent={handleEmailSent}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}
