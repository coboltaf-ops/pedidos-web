'use client'

import { useTranslations } from 'next-intl'

import { useState, useCallback } from 'react'
import { todayColombia } from '@/shared/lib/format-date'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useCorreosStore } from '@/features/correos-enviados/store/correos-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import { useCentrosCostoStore } from '@/features/centros-costo/store/centros-costo-store'
import { usePedidosStore } from '@/features/pedidos/store/pedidos-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { fDate } from '@/shared/lib/format-date'
import ReportPanel from '@/shared/components/report-panel'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'
import { usePermisos } from '@/shared/hooks/use-permisos'

/* ── Types ────────────────────────────────────────────────────────── */
type DetallePedido = {
  id: string; codigo_producto: string; descripcion: string; cantidad: number
  unidad_medida: string
}

type Pedido = {
  id: string; nro_pedido: number; consecutivo: string; fecha_emision: string; fecha_vencimiento: string
  proveedor: string; fecha_llegada: string; tipo_moneda: string; comprador: string
  condicion_pago: string; fecha_aprobacion: string; observaciones: string
  detalles: DetallePedido[]; bodega_llegada: string; centro_costo: string; situacion: string
  tipo_inventario?: string                  // Tipo de inventario heredado del grupo del menú
}

/* ── Modal Enviar Email ─────────────────────────────────────────────── */
function EmailModal({ pedido, proveedorEmail, onClose, onEmailSent, onSuccess }: {
  pedido: Pedido
  proveedorEmail: string
  onClose: () => void
  onEmailSent: (data: { to: string; asunto: string; mensaje: string; estado: 'Enviado' | 'Abierto en cliente' }) => void
  onSuccess: () => void
}) {
  const tBtn = useTranslations('buttons')
  const tF = useTranslations('fields')
  const [to, setTo] = useState(proveedorEmail)
  const [asunto, setAsunto] = useState(`Orden de Pedido ${pedido.consecutivo}`)
  const [mensaje, setMensaje] = useState(`Estimado proveedor,\n\nAdjuntamos la Orden de Pedido ${pedido.consecutivo} para su revision y procesamiento.\n\nQuedamos atentos a su confirmacion.\n\nSaludos cordiales.`)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleSend = useCallback(async () => {
    if (!to) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/send-pedido-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          proveedorNombre: pedido.proveedor,
          consecutivo: pedido.consecutivo,
          fecha_emision: fDate(pedido.fecha_emision),
          fecha_vencimiento: fDate(pedido.fecha_vencimiento),
          comprador: pedido.comprador,
          condicion_pago: pedido.condicion_pago,
          observaciones: pedido.observaciones,
          detalles: pedido.detalles,
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
      setResult({ ok: false, msg: 'Error de conexion al enviar el email' })
    } finally {
      setSending(false)
    }
  }, [to, asunto, mensaje, pedido, onEmailSent, onClose, onSuccess])

  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'rgba(12,26,61,0.98)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">📧 Enviar Orden de Pedido por Email</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl p-3" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <p className="text-xs text-white/50">Orden de Pedido</p>
            <p className="text-white font-mono font-bold">{pedido.consecutivo}</p>
            <p className="text-white/60 text-sm mt-1">{pedido.proveedor}</p>
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

/* ── Helpers ──────────────────────────────────────────────────────── */
const emptyDetalle = (): DetallePedido => ({ id: crypto.randomUUID(), codigo_producto: '', descripcion: '', cantidad: 1, unidad_medida: 'Unidad' })

const today = todayColombia()

const emptyPedido = (nro: number): Pedido => ({
  id: '', nro_pedido: nro, consecutivo: `PED-${String(nro).padStart(5, '0')}`,
  fecha_emision: today, fecha_vencimiento: '', proveedor: '', fecha_llegada: '',
  comprador: '', condicion_pago: '', tipo_moneda: '',
  fecha_aprobacion: '', observaciones: '', detalles: [emptyDetalle()], bodega_llegada: '', centro_costo: '', situacion: 'Pendiente'
})

function generatePedidoPDF(p: Pedido, provInfo?: { tipo_id: string; nro_documento: string; direccion: string; ciudad: string }, empresaInfo?: { nombre?: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string }, empresaLogo: string = LOGO_BASE64) {
  const totalItems = p.detalles.reduce((s, d) => s + d.cantidad, 0)
  const rows = p.detalles.map((d, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${d.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${d.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${d.cantidad}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${d.unidad_medida}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Orden de Pedido ${p.consecutivo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#111; background:#fff; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #1e3a8a; }
    .company { font-size:22px; font-weight:800; color:#000; line-height:1.15; white-space:nowrap; }
    .doc-title { text-align:right; }
    .doc-title h2 { font-size:20px; font-weight:700; color:#000; margin-bottom:2px; }
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
    thead th:nth-child(3), thead th:nth-child(4) { text-align:center; }
    tbody td { padding:8px 12px; font-size:13px; color:#000; font-weight:600; border-bottom:1px solid #e5e7eb; }
    .totals { display:flex; flex-direction:column; align-items:flex-end; gap:6px; margin-bottom:24px; }
    .totals-row.grand { font-size:15px; font-weight:700; color:#000; }
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
      <h2>ORDEN DE PEDIDO</h2>
      <div class="consecutivo">${p.consecutivo}</div>
      <div class="badge">${p.situacion}</div>
    </div>
  </div>

  <div class="grid">
    <div class="field"><label>Nro. Orden de Pedido</label><span>${p.consecutivo}</span></div>
    <div class="field"><label>Fecha Emision</label><span>${fDate(p.fecha_emision)}</span></div>
    <div class="field"><label>Fecha Vencimiento</label><span>${fDate(p.fecha_vencimiento) || '—'}</span></div>
    <div class="field"><label>Condición de Pago</label><span>${p.condicion_pago || '—'}</span></div>
    <div class="field"><label>Fecha Aprobacion</label><span>${fDate(p.fecha_aprobacion) || '—'}</span></div>
    <div class="field"><label>Bodega Llegada</label><span>${p.bodega_llegada || '—'}</span></div>
    <div class="field"><label>Centro de Costo</label><span>${p.centro_costo || '—'}</span></div>
    <div class="field"><label>Comprador</label><span>${p.comprador || '—'}</span></div>
  </div>

  <div class="prov-box">
    <h3>Datos del Proveedor</h3>
    <div class="prov-grid">
      <div class="prov-field"><label>Proveedor</label><span>${p.proveedor || '—'}</span></div>
      <div class="prov-field"><label>Tipo ID</label><span>${provInfo?.tipo_id || '—'}</span></div>
      <div class="prov-field"><label>Nro. Documento</label><span>${provInfo?.nro_documento || '—'}</span></div>
      <div class="prov-field"><label>Direccion</label><span>${provInfo?.direccion || '—'}</span></div>
      <div class="prov-field"><label>Ciudad</label><span>${provInfo?.ciudad || '—'}</span></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Codigo</th><th>Descripcion</th><th style="text-align:center">Cant.</th>
      <th style="text-align:center">Unidad</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row grand"><span>TOTAL ITEMS: ${totalItems}</span></div>
  </div>

  ${p.observaciones ? `<div class="obs"><div class="obs-label">Observaciones</div><div class="obs-content">${p.observaciones}</div></div>` : ''}

  <div class="footer">
    <div class="sign-box"><div class="sign-line">Elaborado por</div><div style="font-size:11px;font-weight:700;color:#000">${p.comprador || '_______________'}</div></div>
    <div class="sign-box"><div class="sign-line">Aprobado por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
    <div class="sign-box"><div class="sign-line">Recibido por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
  </div>

  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function PedidosPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tRpt = useTranslations('reportTitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('pedidos')
  const refData = useReferenceStore(s => s.data)
  const proveedores = useProveedoresStore(s => s.proveedores)
  const empresas = useEmpresaStore(s => s.empresas)
  const addCorreo = useCorreosStore(s => s.addCorreo)
  const productos = useProductosStore(s => s.productos)
  const bodegas = useBodegasStore(s => s.bodegas).filter(b => b.situacion === 'Activa')
  const centrosCosto = useCentrosCostoStore(s => s.centros).filter(c => c.situacion === 'Activo')

  const pedidos = usePedidosStore(s => s.pedidos)
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)

  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [viewDetail, setViewDetail] = useState<Pedido | null>(null)
  const [emailPedido, setEmailPedido] = useState<Pedido | null>(null)

  const handleEmailSent = useCallback((data: { to: string; asunto: string; mensaje: string; estado: 'Enviado' | 'Abierto en cliente' }) => {
    if (!emailPedido) return
    const totalItems = emailPedido.detalles.reduce((s, d) => s + d.cantidad, 0)
    const now = new Date()
    addCorreo({
      id: crypto.randomUUID(),
      fecha: now.toISOString().split('T')[0],
      hora: now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
      destinatario: data.to,
      proveedor: emailPedido.proveedor,
      asunto: data.asunto,
      mensaje: data.mensaje,
      consecutivo: emailPedido.consecutivo,
      total: `${totalItems} items`,
      tipo_moneda: '',
      estado: data.estado,
    })
  }, [emailPedido, addCorreo])

  const [tab, setTab] = useState<'registros' | 'reportes' | 'especificos'>('registros')
  const selectStyle: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

  const reportColumns = [
    { header: 'Nro. Orden Pedido', key: 'consecutivo', width: 14 },
    { header: 'Fecha', key: 'fecha_emision', width: 14 },
    { header: 'Proveedor', key: 'proveedor', width: 26 },
    { header: 'Comprador', key: 'comprador', width: 20 },
    { header: 'Cond. Pago', key: 'condicion_pago', width: 14 },
    { header: tH('items'), key: 'items', width: 10 },
    { header: 'Total Cant.', key: 'total_cantidad', width: 12 },
    { header: 'Situacion', key: 'situacion', width: 12 },
  ]

  const reportRows = pedidos.map(p => {
    const totalCant = p.detalles.reduce((s, d) => s + d.cantidad, 0)
    return {
      consecutivo: p.consecutivo,
      fecha_emision: p.fecha_emision,
      proveedor: p.proveedor,
      comprador: p.comprador,
      condicion_pago: p.condicion_pago,
      items: p.detalles.length,
      total_cantidad: totalCant,
      situacion: p.situacion,
    }
  })

  const reportFilters = [
    { label: tF('situacionNoAccent'), key: 'situacion', options: Array.from(new Set(pedidos.map(p => p.situacion).filter(Boolean))) },
    { label: 'Proveedor', key: 'proveedor', options: Array.from(new Set(pedidos.map(p => p.proveedor).filter(Boolean))) },
    { label: tF('condPago'), key: 'condicion_pago', options: Array.from(new Set(pedidos.map(p => p.condicion_pago).filter(Boolean))) },
  ]

  const createNew = () => {
    setSelectedPedido(emptyPedido(pedidos.length + 1))
    setIsFormOpen(true)
    setViewDetail(null)
  }

  const updateDetalle = (idx: number, field: keyof DetallePedido, value: string | number) => {
    if (!selectedPedido) return
    const detalles = [...selectedPedido.detalles]
    detalles[idx] = { ...detalles[idx], [field]: value }
    setSelectedPedido({ ...selectedPedido, detalles })
  }

  const addDetalle = () => {
    if (!selectedPedido) return
    setSelectedPedido({ ...selectedPedido, detalles: [...selectedPedido.detalles, emptyDetalle()] })
  }

  const removeDetalle = (idx: number) => {
    if (!selectedPedido) return
    const detalles = selectedPedido.detalles.filter((_, i) => i !== idx)
    setSelectedPedido({ ...selectedPedido, detalles })
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPedido) return
    const pedidoToSave = selectedPedido.fecha_aprobacion
      ? { ...selectedPedido, situacion: 'Aprobada' }
      : selectedPedido
    // Heredar tipo_inventario del contexto activo (grupo del menú)
    const tipoActual = pedidoToSave.tipo_inventario || tipoActivo || ''
    const pedidoConTipo = { ...pedidoToSave, tipo_inventario: tipoActual }
    if (pedidoConTipo.id) {
      usePedidosStore.setState({ pedidos: pedidos.map(p => p.id === pedidoConTipo.id ? pedidoConTipo : p) })
    } else {
      usePedidosStore.setState({ pedidos: [...pedidos, { ...pedidoConTipo, id: crypto.randomUUID() }] })
    }
    setIsFormOpen(false)
    setSelectedPedido(null)
  }

  const handleDelete = (p: { id: string; situacion: string }) => {
    if (confirm(`¿Eliminar esta orden de pedido? (Estado: ${p.situacion})`))usePedidosStore.setState({ pedidos: pedidos.filter(r => r.id !== p.id) })
  }

  const statusStyle = (s: string) => {
    const map: Record<string, React.CSSProperties> = {
      'Pendiente': { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' },
      'Aprobada': { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' },
      'Anulada': { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' },
      'Recibida': { background: 'rgba(59,130,246,0.2)', color: '#fff', border: '1px solid rgba(59,130,246,0.3)' },
    }
    return map[s] || {}
  }

  /* ── Vista detalle ─────────────────────────────────────────────────── */
  if (viewDetail) {
    const totalItems = viewDetail.detalles.reduce((s, d) => s + d.cantidad, 0)
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setViewDetail(null)} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            ← Volver a Ordenes de Pedido
          </button>
          <div className="flex gap-3">
            <button onClick={() => setEmailPedido(viewDetail)}
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
              generatePedidoPDF({ ...viewDetail, centro_costo: ccFixed }, provData, empData, emp?.logo || LOGO_BASE64)
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
              <h1 className="text-3xl font-bold text-white">Orden de Pedido</h1>
              <p className="text-2xl font-mono mt-1" style={{ color: '#fff' }}>{viewDetail.consecutivo}</p>
            </div>
            <span className="px-4 py-2 rounded-full font-medium text-sm" style={statusStyle(viewDetail.situacion)}>{viewDetail.situacion}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Correlativo', value: viewDetail.consecutivo },
              { label: 'Fecha Emision', value: fDate(viewDetail.fecha_emision) },
              { label: 'Fecha Vencimiento', value: fDate(viewDetail.fecha_vencimiento) },
              { label: 'Proveedor', value: viewDetail.proveedor },
              { label: tF('fechaEstLlegada'), value: fDate(viewDetail.fecha_llegada) },
              { label: 'Comprador', value: viewDetail.comprador },
              { label: 'Condicion de Pago', value: viewDetail.condicion_pago },
              { label: tF('fechaAprobacionNoAccent'), value: fDate(viewDetail.fecha_aprobacion) },
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
                  {[tH('codigoNoAccent'), tH('descripcionNoAccent'), tH('cantShort'), tF('unidad')].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewDetail.detalles.map(d => (
                  <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-4 py-3 font-mono text-xs text-white">{d.codigo_producto}</td>
                    <td className="px-4 py-3 text-white/80">{d.descripcion}</td>
                    <td className="px-4 py-3 text-white/70 text-right">{d.cantidad}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{d.unidad_medida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-end gap-2 mb-6">
            <div className="flex gap-8 justify-between w-64 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <span className="font-bold text-white">TOTAL ITEMS</span>
              <span className="font-bold text-lg" style={{ color: '#fff' }}>{totalItems}</span>
            </div>
          </div>

          {viewDetail.observaciones && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>Observaciones</p>
              <p className="text-white/70">{viewDetail.observaciones}</p>
            </div>
          )}
        </div>

        {emailPedido && (
          <EmailModal
            pedido={emailPedido}
            proveedorEmail={proveedores.find(p => p.nombre === emailPedido.proveedor)?.correo || ''}
            onClose={() => setEmailPedido(null)}
            onEmailSent={handleEmailSent}
            onSuccess={() => setViewDetail(null)}
          />
        )}
      </div>
    )
  }

  /* ── Vista principal ───────────────────────────────────────────────── */
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('pedidos')}</h1>
          <p className="text-white/50 mt-1">{tSub('pedidos')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button onClick={createNew} className="px-5 py-2.5 rounded-xl font-medium text-white mr-24" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newSalesOrder')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {(['registros', 'reportes', 'especificos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t
              ? { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
              : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}>
            {t === 'registros' ? tTab('registrosEmoji') : t === 'reportes' ? tTab('reportesEmoji') : tTab('especificosEmoji')}
          </button>
        ))}
      </div>

      {/* Tab: Registros */}
      {tab === 'registros' && (
        <>
          {isFormOpen && selectedPedido && (() => {
            const totalItems = selectedPedido.detalles.reduce((s, d) => s + d.cantidad, 0)
            return (
              <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <h2 className="text-lg font-semibold text-white mb-4">Nueva Orden de Pedido — {selectedPedido.consecutivo}</h2>
                <form onSubmit={handleSave}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Correlativo</label>
                      <input readOnly value={selectedPedido.consecutivo}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold font-mono"
                        style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', cursor: 'not-allowed' }} />
                    </div>
                    {[
                      { label: 'Fecha Emision *', key: 'fecha_emision', type: 'date' },
                      { label: tF('fechaVencimientoRequired'), key: 'fecha_vencimiento', type: 'date' },
                      { label: tF('fechaEstLlegada'), key: 'fecha_llegada', type: 'date' },
                      { label: 'Comprador', key: 'comprador', placeholder: 'Responsable' },
                      { label: tF('fechaAprobacionNoAccent'), key: 'fecha_aprobacion', type: 'date' },
                    ].map(({ label, key, type = 'text', placeholder }) => (
                      <div key={key}>
                        <label className="block text-xl text-white font-extrabold mb-1">{label}</label>
                        <input type={type} required={label.includes('*')}
                          value={String((selectedPedido as Record<string, unknown>)[key])}
                          onChange={e => setSelectedPedido({ ...selectedPedido, [key]: e.target.value })}
                          className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                          placeholder={placeholder} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Proveedor *</label>
                      <select required value={selectedPedido.proveedor} onChange={e => setSelectedPedido({ ...selectedPedido, proveedor: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Condición de Pago</label>
                      <select value={selectedPedido.condicion_pago} onChange={e => setSelectedPedido({ ...selectedPedido, condicion_pago: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {refData.condiciones_pago.map(c => <option key={c.id} value={c.descripcion}>{c.descripcion}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Bodega Llegada</label>
                      <select value={selectedPedido.bodega_llegada} onChange={e => setSelectedPedido({ ...selectedPedido, bodega_llegada: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {bodegas.map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Centro de Costo</label>
                      <select value={selectedPedido.centro_costo} onChange={e => setSelectedPedido({ ...selectedPedido, centro_costo: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {centrosCosto.map(c => <option key={c.id} value={`${c.codigo} - ${c.descripcion}`}>{c.codigo} - {c.descripcion}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xl text-white font-extrabold mb-1">Situacion</label>
                      <select value={selectedPedido.situacion} onChange={e => setSelectedPedido({ ...selectedPedido, situacion: e.target.value })}
                        className="w-full rounded-xl px-3 py-2 text-white outline-none text-base text-white font-bold" style={selectStyle}>
                        {(refData.situacion_orden_compra ?? []).map(s => <option key={s.id} value={s.descripcion}>{s.descripcion}</option>)}
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
                    {/* Buscador de producto */}
                    <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
                      <label className="block text-xl text-white font-extrabold mb-2">Buscar producto para agregar al detalle</label>
                      <div style={{ position: 'relative' }}>
                        <input value={searchText} onChange={e => setSearchText(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-white outline-none text-base text-white font-bold"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                          placeholder="Escriba el nombre del producto..." autoComplete="off" />
                        {searchText.length >= 2 && (
                          <div style={{ position: 'absolute', zIndex: 9999, left: 0, right: 0, top: '100%', marginTop: 4, background: 'rgb(15,23,42)', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 12, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                            {productos.filter(p => p.situacion === 'Activo' && !!p.descripcion && !!p.codigo && p.descripcion.toLowerCase().includes(searchText.toLowerCase())).slice(0, 10).map(p => (
                              <div key={p.id}
                                onMouseDown={e => {
                                  e.preventDefault()
                                  const newDet: DetallePedido = {
                                    id: crypto.randomUUID(),
                                    codigo_producto: p.codigo,
                                    descripcion: p.descripcion,
                                    cantidad: 1,
                                    unidad_medida: p.unidad_medida,
                                  }
                                  const emptyIdx = selectedPedido.detalles.findIndex(d => !d.codigo_producto)
                                  let detalles: DetallePedido[]
                                  if (emptyIdx >= 0) {
                                    detalles = selectedPedido.detalles.map((d, i) => i === emptyIdx ? newDet : d)
                                  } else {
                                    detalles = [...selectedPedido.detalles, newDet]
                                  }
                                  setSelectedPedido({ ...selectedPedido, detalles })
                                  setSearchText('')
                                }}
                                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                className="hover:bg-blue-400/20">
                                <span style={{ color: '#fff', fontSize: 13 }}>{p.descripcion}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace', marginLeft: 12 }}>{p.codigo} · {p.unidad_medida}</span>
                              </div>
                            ))}
                            {productos.filter(p => p.situacion === 'Activo' && !!p.descripcion && !!p.codigo && p.descripcion.toLowerCase().includes(searchText.toLowerCase())).length === 0 && (
                              <div style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center' }}>No se encontraron productos</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      <table className="w-full text-base text-left">
                        <thead style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <tr>
                            {[tH('codigoNoAccent'), tH('descripcionNoAccent'), tF('cantidad'), tF('unidad'), ''].map(h => (
                              <th key={h} className="px-3 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPedido.detalles.map((d, idx) => (
                            <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              <td className="px-2 py-2">
                                <input value={d.codigo_producto} readOnly className="w-28 rounded-lg px-2 py-1.5 text-white outline-none cursor-not-allowed font-mono text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} />
                              </td>
                              <td className="px-2 py-2">
                                <input value={d.descripcion} readOnly className="w-full rounded-lg px-2 py-1.5 text-white outline-none cursor-not-allowed text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} />
                              </td>
                              <td className="px-2 py-2"><input type="number" min="0" value={d.cantidad} onChange={e => updateDetalle(idx, 'cantidad', parseFloat(e.target.value) || 0)} className="w-20 rounded-lg px-2 py-1.5 text-white outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} /></td>
                              <td className="px-2 py-2"><input value={d.unidad_medida} readOnly className="w-28 rounded-lg px-2 py-1.5 text-white outline-none text-xs cursor-not-allowed" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} /></td>
                              <td className="px-2 py-2"><button type="button" onClick={() => removeDetalle(idx)} className="text-red-400 hover:text-red-300 px-2 py-1">✕</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Total items */}
                  <div className="flex flex-col items-end gap-1.5 mb-6 text-sm">
                    <div className="flex gap-8 w-72 justify-between pt-2 font-bold" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}><span className="text-white">TOTAL ITEMS</span><span style={{ color: '#fff' }}>{totalItems}</span></div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
                    <textarea rows={2} value={selectedPedido.observaciones} onChange={e => setSelectedPedido({ ...selectedPedido, observaciones: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 text-white outline-none resize-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                      placeholder="Notas u observaciones..." />
                  </div>

                  <div className="flex gap-3">
                    <button type="submit" className="px-6 py-2 rounded-xl text-white font-medium" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{tBtn('saveSalesOrder')}</button>
                    <button type="button" onClick={() => { setIsFormOpen(false); setSelectedPedido(null) }} className="px-6 py-2 rounded-xl text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>{tBtn('cancel')}</button>
                  </div>
                </form>
              </div>
            )
          })()}

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left" style={{ minWidth: '800px' }}>
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {[tH('nro'), tF('proveedor'), tH('emisionNoAccent'), tH('vence'), tF('comprador'), tH('items'), tF('estado'), tTbl('actions')].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => {
                  const totalItems = p.detalles.reduce((s, d) => s + d.cantidad, 0)
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-3 py-3 font-mono font-bold whitespace-nowrap" style={{ color: '#fff' }}>{p.consecutivo}</td>
                      <td className="px-3 py-3 text-white font-bold max-w-[180px] truncate">{p.proveedor}</td>
                      <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(p.fecha_emision)}</td>
                      <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(p.fecha_vencimiento)}</td>
                      <td className="px-3 py-3 text-white font-bold max-w-[120px] truncate">{p.comprador}</td>
                      <td className="px-3 py-3 text-white font-medium whitespace-nowrap">{totalItems}</td>
                      <td className="px-3 py-3"><span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={statusStyle(p.situacion)}>{p.situacion}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5 whitespace-nowrap">
                          <button onClick={() => setViewDetail(p)} className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>Ver</button>
                          {permisos.editar && !['Aprobada', 'Recibida', 'Anulada'].includes(p.situacion) && <button onClick={() => {
                            const cc = p.centro_costo || ''
                            const ccFixed = cc.includes(' - ') ? cc : (() => {
                              const found = centrosCosto.find(c => c.descripcion === cc)
                              return found ? `${found.codigo} - ${found.descripcion}` : cc
                            })()
                            setSelectedPedido({ ...p, centro_costo: ccFixed }); setIsFormOpen(true); setViewDetail(null)
                          }} className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>{tBtn('edit')}</button>}
                          {permisos.esAdmin && <button onClick={() => handleDelete(p)} className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>}
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

      {/* Tab: Reportes */}
      {tab === 'reportes' && (
        <ReportPanel
          title={tRpt('ordenesPedido')}
          columns={reportColumns}
          rows={reportRows}
          filters={reportFilters}
          filename="pedidos"
          summableKeys={['items', 'total_cantidad']}
        />
      )}

      {/* Tab: Reportes Específicos */}
      {tab === 'especificos' && (
        <div className="glass-card p-6 md:p-8">
          <h2 className="text-xl font-bold text-white mb-4">{tTab('especificos')}</h2>
          <p className="text-white/50 text-sm mb-6">{tSub('seleccioneReporte')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/40 text-sm">Los reportes especificos se iran agregando segun sus necesidades</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Email */}
      {emailPedido && (
        <EmailModal
          pedido={emailPedido}
          proveedorEmail={proveedores.find(p => p.nombre === emailPedido.proveedor)?.correo || ''}
          onClose={() => setEmailPedido(null)}
          onEmailSent={handleEmailSent}
          onSuccess={() => {}}
        />
      )}
    </div>
  )
}
