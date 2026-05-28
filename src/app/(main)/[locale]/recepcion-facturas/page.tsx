'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { fDate, todayColombia } from '@/shared/lib/format-date'
import { fmtMoney } from '@/shared/lib/format-number'
import ReportPanel from '@/shared/components/report-panel'
import { useRecepcionesStore } from '@/features/recepcion-facturas/store/recepciones-store'
import { useOrdenesStore } from '@/features/ordenes-compra/store/ordenes-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useBodegasStore, type SaldoBodega, type MovimientoBodega } from '@/features/bodegas/store/bodegas-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { useCurrentUserStore } from '@/features/usuarios/store/current-user-store'

// ─── PDF ─────────────────────────────────────────────────────────────────────

function generateRecepcionPDF(
  r: Recepcion,
  empresaInfo?: { nombre?: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string },
  provInfo?: { tipo_id: string; nro_documento: string; direccion: string; ciudad: string },
  empresaLogo: string = LOGO_BASE64
) {
  const rows = r.renglones.map((rn, i) => {
    const totalRec = rn.ya_recibido + rn.cantidad_a_recibir
    const isComplete = totalRec >= rn.cantidad_pedida
    return `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${rn.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#000;font-weight:600">${rn.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${rn.unidad_medida}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${rn.cantidad_pedida}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${fmtMoney(rn.costo_unitario)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${rn.ya_recibido}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:#1e3a8a">${rn.cantidad_a_recibir}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">
        <span style="padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;${isComplete ? 'background:#dbeafe;color:#1e3a8a' : 'background:#fef3c7;color:#92400e'}">${isComplete ? 'Completo' : 'Pendiente'}</span>
      </td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Recepción ${r.consecutivo}</title>
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
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:28px; padding:20px; background:#eef2ff; border-radius:8px; border:1px solid #c7d2fe; }
    .field label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#1e3a8a; font-weight:700; display:block; margin-bottom:3px; }
    .field span { font-weight:600; color:#111; font-size:13px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#1e3a8a; }
    thead th { padding:10px 12px; color:#fff; font-size:10px; text-transform:uppercase; letter-spacing:.06em; text-align:left; }
    tbody td { padding:8px 12px; font-size:12px; color:#000; font-weight:600; border-bottom:1px solid #e5e7eb; }
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
      <h2>RECEPCIÓN DE FACTURA</h2>
      <div class="consecutivo">${r.consecutivo}</div>
      <div class="badge">${r.estado}</div>
    </div>
  </div>

  ${r.pasada_a_pagos ? `
  <div style="margin:18px 0 24px;padding:14px 18px;border-radius:10px;background:#dbeafe;border:2px solid #1e3a8a;color:#0b1d4a;display:flex;align-items:center;gap:12px;">
    <span style="font-size:22px;">✅</span>
    <div>
      <div style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">Esta factura ya está en Pagos a Proveedores</div>
      <div style="font-size:12px;font-weight:600;margin-top:2px;color:#1e3a8a;">
        ${r.pasada_a_pagos_factura_id ? `Referencia: ${r.pasada_a_pagos_factura_id}` : ''}${r.pasada_a_pagos_fecha ? ` · Fecha de paso: ${fDate(r.pasada_a_pagos_fecha)}` : ''}
      </div>
    </div>
  </div>
  ` : ''}

  <div class="grid">
    <div class="field"><label>Nro. Recepción</label><span>${r.consecutivo}</span></div>
    <div class="field"><label>Nro. Factura</label><span>${r.nro_factura}</span></div>
    <div class="field"><label>Fecha Emisión</label><span>${fDate(r.fecha_emision)}</span></div>
    <div class="field"><label>Fecha Recibida</label><span>${fDate(r.fecha_recibida)}</span></div>
    <div class="field"><label>Orden de Compra</label><span>${r.orden_compra_consecutivo}</span></div>
    <div class="field"><label>Persona que Recibe</label><span>${r.persona_recibe || '—'}</span></div>
    <div class="field"><label>Fecha Aprobación</label><span>${fDate(r.fecha_aprobacion)}</span></div>
  </div>

  <div class="prov-box">
    <h3>Datos del Proveedor</h3>
    <div class="prov-grid">
      <div class="prov-field"><label>Proveedor</label><span>${r.proveedor || '—'}</span></div>
      <div class="prov-field"><label>Tipo ID</label><span>${provInfo?.tipo_id || '—'}</span></div>
      <div class="prov-field"><label>Nro. Documento</label><span>${provInfo?.nro_documento || '—'}</span></div>
      <div class="prov-field"><label>Dirección</label><span>${provInfo?.direccion || '—'}</span></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th><th style="text-align:center">Unidad</th>
      <th style="text-align:center">Pedida</th><th style="text-align:center">Costo Unit.</th>
      <th style="text-align:center">Ya Recibido</th><th style="text-align:center">Recibido</th>
      <th style="text-align:center">Estado</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${r.observaciones ? `<div class="obs"><div class="obs-label">Observaciones</div><div class="obs-content">${r.observaciones}</div></div>` : ''}

  <div class="footer">
    <div class="sign-box"><div class="sign-line">Recibido por</div><div style="font-size:11px;font-weight:700;color:#000">${r.persona_recibe || '_______________'}</div></div>
    <div class="sign-box"><div class="sign-line">Aprobado por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
    <div class="sign-box"><div class="sign-line">Almacenado por</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
  </div>

  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

type RenglonRecepcion = {
  detalle_id: string
  codigo_producto: string
  descripcion: string
  unidad_medida: string
  cantidad_pedida: number
  costo_unitario: number
  ya_recibido: number
  cantidad_a_recibir: number
  completo: boolean
}

type Recepcion = {
  id: string
  nro_recepcion: number
  consecutivo: string
  nro_factura: string
  tipo_inventario: string
  fecha_emision: string
  fecha_recibida: string
  orden_compra_id: string
  orden_compra_consecutivo: string
  proveedor: string
  bodega_llegada: string
  comprador: string
  persona_recibe: string
  fecha_aprobacion: string
  renglones: RenglonRecepcion[]
  observaciones: string
  estado: string
  pasada_a_pagos?: boolean
  pasada_a_pagos_fecha?: string
  pasada_a_pagos_factura_id?: string
}

// ─── Helper: convertir OC real a renglones ──────────────────────────────────

const today = todayColombia()


const emptyForm = (nro: number, tipoInv = ''): Recepcion => ({
  id: '', nro_recepcion: nro,
  consecutivo: `RF-${String(nro).padStart(5, '0')}`,
  nro_factura: '',
  tipo_inventario: tipoInv,
  fecha_emision: today,
  fecha_recibida: today,
  orden_compra_id: '',
  orden_compra_consecutivo: '',
  proveedor: '',
  bodega_llegada: '',
  comprador: '',
  persona_recibe: '',
  fecha_aprobacion: '',
  renglones: [] as RenglonRecepcion[],
  observaciones: '',
  estado: 'Pendiente',
})

// ─── Estilos helpers ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff',
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(12,26,61,0.95)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff',
}

const estadoStyle = (s: string): React.CSSProperties => {
  if (s === 'Aprobada y Recibida') return { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' }
  if (s === 'Aprobada') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Anulada') return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
  return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function RecepcionFacturasPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tRpt = useTranslations('reportTitles')
  const tOp = useTranslations('options')
  const tHelp = useTranslations('help')
  const permisos = usePermisos('recepcion-facturas')
  const empresas = useEmpresaStore(s => s.empresas)
  const proveedores = useProveedoresStore(s => s.proveedores)
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const esAdmin = useCurrentUserStore(s => s.esAdmin)()
  const { recepciones: todasRecepciones } = useRecepcionesStore()
  const recepciones = (tipoActivo ? todasRecepciones.filter(r => r.tipo_inventario === tipoActivo) : todasRecepciones) as Recepcion[]
  const setRecepciones = (fn: (prev: Recepcion[]) => Recepcion[]) => useRecepcionesStore.setState(s => ({ recepciones: fn(s.recepciones as Recepcion[]) }))
  const ordenesReales = useOrdenesStore(s => s.ordenes)
  const { productos, updateProducto } = useProductosStore()
  const { bodegas, updateBodega } = useBodegasStore()
  const [form, setForm] = useState<Recepcion>(emptyForm(1, tipoActivo || ''))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewRec, setViewRec] = useState<Recepcion | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [ocPendienteMsg, setOcPendienteMsg] = useState('')

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'registros' | 'reportes' | 'especificos'>('registros')

  // ── Reporte Específico: Facturas Recibidas (rango de fechas) ──────────────
  const today = todayColombia()
  const firstOfMonth = today.slice(0, 8) + '01'
  const [rfFechaIni, setRfFechaIni] = useState<string>(firstOfMonth)
  const [rfFechaFin, setRfFechaFin] = useState<string>(today)

  const generateReporteFacturasRecibidas = () => {
    if (!rfFechaIni || !rfFechaFin || rfFechaIni > rfFechaFin) {
      alert('Seleccione un rango de fechas válido (Fecha Inicio ≤ Fecha Fin).')
      return
    }
    const empresaLogo = empresas[0]?.logo || LOGO_BASE64
    const filtradas = recepciones
      .filter(r => r.estado !== 'Anulada')
      .filter(r => {
        const f = r.fecha_recibida
        return f >= rfFechaIni && f <= rfFechaFin
      })
      .sort((a, b) => a.fecha_recibida.localeCompare(b.fecha_recibida))

    const filas = filtradas.map(r => {
      const oc = ordenesReales.find(o =>
        (r.orden_compra_id && o.id === r.orden_compra_id) ||
        (r.orden_compra_consecutivo && o.consecutivo === r.orden_compra_consecutivo)
      )
      const subtotal = r.renglones.reduce((s, rn) => {
        const cant = rn.cantidad_a_recibir > 0 ? rn.cantidad_a_recibir : rn.cantidad_pedida
        return s + cant * rn.costo_unitario
      }, 0)
      const pct = oc?.pct_impuesto ?? 0
      const iva = subtotal * (pct / 100)
      const total = subtotal + iva
      return {
        fecha_recibida: r.fecha_recibida,
        nro_recepcion: r.consecutivo || '—',
        nro_factura: r.nro_factura || '—',
        orden_compra: r.orden_compra_consecutivo || '—',
        proveedor: r.proveedor || '—',
        fecha_emision: r.fecha_emision,
        fecha_vencimiento: oc?.fecha_vencimiento || '',
        subtotal,
        pct,
        iva,
        total,
      }
    })

    const totSubtotal = filas.reduce((s, f) => s + f.subtotal, 0)
    const totIva = filas.reduce((s, f) => s + f.iva, 0)
    const totGeneral = filas.reduce((s, f) => s + f.total, 0)

    const emp = empresas[0]
    const empRow = emp
      ? `<div style="font-size:15px;color:#000;font-weight:600;margin-top:6px;line-height:1.5">${emp.tipo_identificacion}: ${emp.nro_documento}<br/>${emp.direccion || ''}${emp.ciudad ? `, ${emp.ciudad}` : ''}</div>`
      : ''

    const rowsHtml = filas.map((f, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:11px">${fDate(f.fecha_recibida)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px;font-weight:700">${f.nro_recepcion}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px">${f.orden_compra}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px;font-weight:700">${f.nro_factura}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#000;font-weight:600">${f.proveedor}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:11px">${fDate(f.fecha_emision)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:11px">${f.fecha_vencimiento ? fDate(f.fecha_vencimiento) : '—'}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right">${fmtMoney(f.subtotal)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right"><span style="color:#6b7280;font-size:10px">(${f.pct}%)</span> ${fmtMoney(f.iva)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;font-weight:700;color:#1e3a8a">${fmtMoney(f.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Detalle de Facturas Recibidas</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#111; background:#fff; padding:24px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; padding-bottom:14px; border-bottom:3px solid #1e3a8a; }
      .company { font-size:20px; font-weight:700; color:#000; }
      .doc-title { text-align:right; }
      .doc-title h2 { font-size:18px; font-weight:700; color:#000; margin-bottom:2px; }
      .doc-title .meta { font-size:11px; color:#374151; }
      .filter-box { margin-bottom:14px; padding:10px 14px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:6px; font-size:12px; color:#1e3a8a; font-weight:600; }
      table { width:100%; border-collapse:collapse; }
      thead tr { background:#1e3a8a; }
      thead th { padding:9px 10px; color:#fff; font-size:10px; text-transform:uppercase; letter-spacing:.05em; text-align:left; }
      thead th.num { text-align:right; }
      tfoot td { padding:10px; font-weight:800; border-top:2px solid #1e3a8a; background:#eef2ff; color:#0b1d4a; font-size:12px; }
      tfoot td.num { text-align:right; }
      tfoot tr.grand td { background:#1e3a8a; color:#fff; font-size:13px; }
      .empty { padding:40px; text-align:center; color:#6b7280; font-size:13px; }
      @media print { body { padding:14px; } }
    </style></head><body>
    <div class="header">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="${empresaLogo}" style="width:160px;height:160px;border-radius:12px;object-fit:contain;background:#fff;padding:6px;" />
        <div>
          <div class="company">${emp?.nombre || 'EMPRESA'}</div>
          ${empRow}
        </div>
      </div>
      <div class="doc-title">
        <h2>DETALLE DE FACTURAS RECIBIDAS</h2>
        <div class="meta">Generado: ${fDate(today)}</div>
      </div>
    </div>

    <div class="filter-box">Período: ${fDate(rfFechaIni)} — ${fDate(rfFechaFin)}  ·  Total facturas: ${filas.length}</div>

    ${filas.length === 0 ? `<div class="empty">No hay facturas recibidas en el rango seleccionado.</div>` : `
    <table>
      <thead><tr>
        <th>Fecha</th>
        <th>Nro Recepción</th>
        <th>Orden Compra</th>
        <th>Nro Factura</th>
        <th>Proveedor</th>
        <th>Fecha Emisión</th>
        <th>Fecha Vencimiento</th>
        <th class="num">Monto Sin IVA</th>
        <th class="num">Monto IVA y %</th>
        <th class="num">Total de Factura</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="7" style="text-align:right">Subtotales</td>
          <td class="num">${fmtMoney(totSubtotal)}</td>
          <td class="num">${fmtMoney(totIva)}</td>
          <td class="num">${fmtMoney(totGeneral)}</td>
        </tr>
        <tr class="grand">
          <td colspan="9" style="text-align:right">TOTAL RECIBIDO</td>
          <td class="num">${fmtMoney(totGeneral)}</td>
        </tr>
      </tfoot>
    </table>`}

    <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`

    const win = window.open('', '_blank', 'width=1100,height=800')
    if (win) { win.document.write(html); win.document.close() }
  }

  // ── Datos para ReportPanel ─────────────────────────────────────────────────
  const reportColumns = [
    { header: tH('nro'),         key: 'consecutivo',              width: 14 },
    { header: 'Fecha',        key: 'fecha_recibida',           width: 14 },
    { header: 'Orden Compra', key: 'orden_compra_consecutivo', width: 14 },
    { header: 'Proveedor',    key: 'proveedor',                width: 24 },
    { header: tH('itemsAccent'),        key: 'items',                    width: 8  },
    { header: 'Estado',       key: 'estado',                   width: 14 },
  ]

  const reportRows = recepciones.map(r => ({
    consecutivo: r.consecutivo,
    fecha_recibida: r.fecha_recibida,
    orden_compra_consecutivo: r.orden_compra_consecutivo,
    proveedor: r.proveedor,
    items: r.renglones.length,
    estado: r.estado,
  }))

  const reportFilters = [
    {
      label: 'Estado',
      key: 'estado',
      options: Array.from(new Set(recepciones.map(r => r.estado).filter(Boolean))),
    },
    {
      label: 'Proveedor',
      key: 'proveedor',
      options: Array.from(new Set(recepciones.map(r => r.proveedor).filter(Boolean))),
    },
  ]


  // ── Seleccionar OC ──────────────────────────────────────────────────────────
  const handleSelectOC = (ocId: string) => {
    setOcPendienteMsg('')
    const oc = ordenesReales.find(o => o.id === ocId)
    if (!oc) {
      setForm({ ...form, orden_compra_id: '', orden_compra_consecutivo: '', proveedor: '', bodega_llegada: '', comprador: '', renglones: [] })
      return
    }
    if (['Pendiente Aprobacion', tF('pendiente')].includes(oc.situacion)) {
      setOcPendienteMsg(`Orden de Compra ${oc.consecutivo} está en estado "${oc.situacion}". Debe estar Aprobada para recibir factura.`)
      setForm(emptyForm(todasRecepciones.length + 1, tipoActivo || ''))
      setIsFormOpen(false)
      return
    }
    if (['Recibida', 'Recibida Completa', 'Anulada'].includes(oc.situacion)) {
      setOcPendienteMsg(`Orden de Compra ${oc.consecutivo} ya está "${oc.situacion}". No se puede recibir más mercancía.`)
      setForm(emptyForm(todasRecepciones.length + 1, tipoActivo || ''))
      setIsFormOpen(false)
      return
    }
    setOcPendienteMsg('')
    // Solo renglones activos (no anulados) que aún tienen pendiente
    type DetExtra = { cantidad_recibida?: number; estado_renglon?: string }
    const renglones = oc.detalles
      .filter(d => {
        const dx = d as typeof d & DetExtra
        if (dx.estado_renglon === 'Anulado') return false
        const yaRec = dx.cantidad_recibida || 0
        return yaRec < d.cantidad
      })
      .map(d => {
        const dx = d as typeof d & DetExtra
        const yaRecibido = dx.cantidad_recibida || 0
        return {
          detalle_id: d.id,
          codigo_producto: d.codigo_producto,
          descripcion: d.descripcion,
          unidad_medida: d.unidad_medida,
          cantidad_pedida: d.cantidad,
          costo_unitario: d.costo_unitario,
          ya_recibido: yaRecibido,
          cantidad_a_recibir: 0,
          completo: false,
        }
      })
    setForm({
      ...form,
      orden_compra_id: oc.id,
      orden_compra_consecutivo: oc.consecutivo,
      proveedor: oc.proveedor,
      bodega_llegada: oc.bodega_llegada,
      comprador: oc.comprador,
      fecha_aprobacion: oc.fecha_aprobacion,
      renglones,
    })
  }

  // ── Actualizar cantidad a recibir ───────────────────────────────────────────
  const handleCantidad = (idx: number, val: string) => {
    const renglones = [...form.renglones]
    const r = renglones[idx]
    if (r.completo) return
    const pendiente = r.cantidad_pedida - r.ya_recibido
    let num = parseFloat(val) || 0
    if (num > pendiente) num = pendiente
    if (num < 0) num = 0
    renglones[idx] = { ...r, cantidad_a_recibir: num }
    setForm({ ...form, renglones })
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.nro_factura.trim()) { setErrorMsg('Debe indicar el número de factura.'); return }
    if (!form.fecha_emision) { setErrorMsg('Debe indicar la fecha de emisión.'); return }
    if (!form.fecha_recibida) { setErrorMsg('Debe indicar la fecha de recibida.'); return }
    if (!form.orden_compra_id) { setErrorMsg('Debe seleccionar una Orden de Compra.'); return }
    if (!form.persona_recibe.trim()) { setErrorMsg('Debe indicar la persona que recibe.'); return }

    const renglonesConCantidad = form.renglones.filter(r => r.cantidad_a_recibir > 0)
    if (renglonesConCantidad.length === 0) {
      setErrorMsg('Debe ingresar la cantidad recibida en al menos un renglón.')
      return
    }

    // Validar que ninguna cantidad supere lo pendiente
    for (const rn of renglonesConCantidad) {
      const pendiente = rn.cantidad_pedida - rn.ya_recibido
      if (rn.cantidad_a_recibir > pendiente) {
        setErrorMsg(`La cantidad a recibir de "${rn.descripcion}" supera la pendiente (${pendiente}).`)
        return
      }
    }

    const oc = ordenesReales.find(o => o.id === form.orden_compra_id)
    if (!oc) { setErrorMsg('Orden de compra no encontrada.'); return }

    // Capturar datos de la OC en el momento de guardar
    const nuevaRec: Recepcion = {
      ...form,
      id: crypto.randomUUID(),
      bodega_llegada: oc.bodega_llegada,
      comprador: oc.comprador,
      fecha_aprobacion: form.fecha_aprobacion || oc.fecha_aprobacion,
      estado: 'Aprobada y Recibida',
    }
    setRecepciones(prev => [...prev, nuevaRec])

    // ── 1. ACTUALIZAR MAESTRO DE PRODUCTOS ──────────────────────────────────
    for (const rn of nuevaRec.renglones) {
      if (rn.cantidad_a_recibir <= 0) continue
      const prod = productos.find(p => p.codigo === rn.codigo_producto)
      if (!prod) continue

      const existenciaActual = prod.existencia || 0
      const cpActual = prod.costo_promedio || prod.ult_costo || 0
      const cantRecibida = rn.cantidad_a_recibir
      const costoOrden = rn.costo_unitario

      // Calculo de Costo Promedio Ponderado:
      // Nuevo CP = (Existencia × CP Anterior + Cantidad Recibida × Costo Recibido) / (Existencia + Cantidad Recibida)
      const valorAnterior = existenciaActual * cpActual
      const valorRecibido = cantRecibida * costoOrden
      const nuevaExistencia = existenciaActual + cantRecibida
      const nuevoCP = nuevaExistencia > 0
        ? Math.round(((valorAnterior + valorRecibido) / nuevaExistencia) * 100) / 100
        : costoOrden

      updateProducto(prod.id, {
        existencia: nuevaExistencia,
        ult_costo: costoOrden,
        ult_proveedor: nuevaRec.proveedor,
        costo_promedio: nuevoCP,
        fecha_ult_compra: nuevaRec.fecha_recibida,
        fecha_ult_movimiento: nuevaRec.fecha_recibida,
        nro_ult_documento: nuevaRec.consecutivo,
        tipo_ult_movimiento: 'Recepción Factura',
      })
    }

    // ── 2. ACTUALIZAR BODEGA DE LLEGADA: saldos + movimientos ──────────────
    const bodegaDestino = bodegas.find(b => b.nombre === oc.bodega_llegada)
    if (bodegaDestino) {
      const saldosActuales: SaldoBodega[] = bodegaDestino.saldos ? [...bodegaDestino.saldos] : []
      const movimientosActuales: MovimientoBodega[] = bodegaDestino.movimientos ? [...bodegaDestino.movimientos] : []

      for (const rn of nuevaRec.renglones) {
        if (rn.cantidad_a_recibir <= 0) continue
        const prod = productos.find(p => p.codigo === rn.codigo_producto)
        if (!prod) continue

        const cantRecibida = rn.cantidad_a_recibir
        const costoOrden = rn.costo_unitario

        // Capturar estado ANTES del movimiento
        const idxSaldo = saldosActuales.findIndex(s => s.producto_id === prod.id)
        const existAntBodega = idxSaldo >= 0 ? saldosActuales[idxSaldo].existencia : 0
        const cpAntBodega = idxSaldo >= 0 ? saldosActuales[idxSaldo].costo_promedio : 0

        // Actualizar / crear saldo en la bodega
        let nuevoCpBodega: number
        let nuevaExistBodega: number
        if (idxSaldo >= 0) {
          const saldoExist = saldosActuales[idxSaldo]
          const valorAntBodega = saldoExist.existencia * saldoExist.costo_promedio
          const valorRecBodega = cantRecibida * costoOrden
          nuevaExistBodega = saldoExist.existencia + cantRecibida
          nuevoCpBodega = nuevaExistBodega > 0
            ? Math.round(((valorAntBodega + valorRecBodega) / nuevaExistBodega) * 100) / 100
            : costoOrden
          saldosActuales[idxSaldo] = {
            ...saldoExist,
            existencia: nuevaExistBodega,
            costo_promedio: nuevoCpBodega,
            valor_existencia: Math.round(nuevaExistBodega * nuevoCpBodega * 100) / 100,
          }
        } else {
          nuevaExistBodega = cantRecibida
          nuevoCpBodega = costoOrden
          saldosActuales.push({
            producto_id: prod.id,
            codigo: prod.codigo,
            descripcion: prod.descripcion,
            unidad_medida: prod.unidad_medida,
            existencia: nuevaExistBodega,
            costo_promedio: nuevoCpBodega,
            valor_existencia: Math.round(nuevaExistBodega * nuevoCpBodega * 100) / 100,
          })
        }

        // Crear movimiento de entrada con trazabilidad completa
        movimientosActuales.push({
          id: crypto.randomUUID(),
          fecha: nuevaRec.fecha_recibida,
          tipo: 'Recepción Factura',
          documento_origen: nuevaRec.consecutivo,
          producto_id: prod.id,
          producto_codigo: prod.codigo,
          producto_descripcion: prod.descripcion,
          unidad_medida: prod.unidad_medida,
          cantidad: cantRecibida,
          costo_promedio: nuevoCpBodega,
          valor: Math.round(cantRecibida * nuevoCpBodega * 100) / 100,
          existencia_anterior: existAntBodega,
          existencia_despues: nuevaExistBodega,
          cp_anterior: cpAntBodega,
          proveedor: nuevaRec.proveedor,
          nro_factura: nuevaRec.nro_factura,
          nro_orden_compra: nuevaRec.orden_compra_consecutivo,
          persona_recibe: nuevaRec.persona_recibe,
          observaciones: `Factura ${nuevaRec.nro_factura} — OC ${nuevaRec.orden_compra_consecutivo}`,
        })
      }

      updateBodega(bodegaDestino.id, {
        saldos: saldosActuales,
        movimientos: movimientosActuales,
      })
    }

    // ── 3. ACTUALIZAR LA ORDEN DE COMPRA: cantidad_recibida en cada renglón ──
    type DetExtra = { cantidad_recibida?: number; estado_renglon?: string }
    const detallesActualizados = oc.detalles.map(det => {
      const detExt = det as typeof det & DetExtra
      const rn = nuevaRec.renglones.find(r => r.detalle_id === det.id)
      if (rn && rn.cantidad_a_recibir > 0) {
        return {
          ...det,
          cantidad_recibida: (detExt.cantidad_recibida || 0) + rn.cantidad_a_recibir,
        }
      }
      return det
    })

    // Recalcular situación de la orden
    const renglonesActivos = detallesActualizados.filter(d => (d as typeof d & DetExtra).estado_renglon !== 'Anulado')
    const todosCompletos = renglonesActivos.length > 0 && renglonesActivos.every(d => ((d as typeof d & DetExtra).cantidad_recibida || 0) >= d.cantidad)
    const algunaRecepcion = renglonesActivos.some(d => ((d as typeof d & DetExtra).cantidad_recibida || 0) > 0)
    const tieneAprobacion = !!oc.fecha_aprobacion
    const todosAnulados = detallesActualizados.length > 0 && detallesActualizados.every(d => (d as typeof d & DetExtra).estado_renglon === 'Anulado')
    let nuevaSituacion = oc.situacion
    if (todosAnulados) nuevaSituacion = 'Anulada'
    else if (!tieneAprobacion) nuevaSituacion = 'Pendiente Aprobacion'
    else if (todosCompletos) nuevaSituacion = 'Recibida Completa'
    else if (algunaRecepcion) nuevaSituacion = 'Recibida Parcial'
    else nuevaSituacion = 'Pendiente por Recibir'

    useOrdenesStore.setState(s => ({
      ordenes: s.ordenes.map(o =>
        o.id === oc.id
          ? { ...o, detalles: detallesActualizados, situacion: nuevaSituacion }
          : o
      ),
    }))

    setIsFormOpen(false)
    setForm(emptyForm(todasRecepciones.length + 2, tipoActivo || ''))
  }

  const handleDelete = (id: string) => {
    if (confirm(tCf('delRecepcion'))) setRecepciones(prev => prev.filter(r => r.id !== id))
  }

  // ─── Vista Detalle ──────────────────────────────────────────────────────────
  if (viewRec) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setViewRec(null)} className="flex items-center gap-2 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
            ← Volver a Recepciones
          </button>
          <button onClick={() => {
            const emp = empresas[0]
            const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined
            const prov = proveedores.find(p => p.nombre === viewRec.proveedor)
            const provData = prov ? { tipo_id: prov.tipo_id, nro_documento: prov.nro_documento, direccion: prov.direccion, ciudad: prov.ciudad } : undefined
            generateRecepcionPDF(viewRec, empData, provData, emp?.logo || LOGO_BASE64)
          }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-colors"
            style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
            🖨 Generar PDF
          </button>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">{t('recepcionFacturaDetail')}</h1>
              <p className="text-2xl font-mono mt-1" style={{ color: '#fff' }}>{viewRec.consecutivo}</p>
            </div>
            <span className="px-4 py-2 rounded-full text-sm font-medium" style={estadoStyle(viewRec.estado)}>{viewRec.estado}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: 'Nro de Recepción', value: viewRec.consecutivo },
              { label: 'Nro de Factura', value: viewRec.nro_factura },
              { label: 'Fecha Emisión', value: fDate(viewRec.fecha_emision) },
              { label: tH('fechaRecibida'), value: fDate(viewRec.fecha_recibida) },
              { label: 'Orden de Compra', value: viewRec.orden_compra_consecutivo },
              { label: 'Proveedor', value: viewRec.proveedor },
              { label: 'Persona que Recibe', value: viewRec.persona_recibe },
              { label: 'Fecha Aprobación', value: fDate(viewRec.fecha_aprobacion) || '—' },
              { label: 'Estado', value: viewRec.estado },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#f97316' }}>{label}</p>
                <p className="text-white font-medium">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.07)' }}>
                <tr>
                  {[tF('codigo'), tF('descripcion'), tF('unidad'), tH('cantPedida'), tF('yaRecibido'), tH('recibidoEnEsta'), tF('estado')].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewRec.renglones.map(r => {
                  const totalRec = r.ya_recibido + r.cantidad_a_recibir
                  const isComplete = totalRec >= r.cantidad_pedida
                  return (
                    <tr key={r.detalle_id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-4 py-3 font-mono text-xs text-white">{r.codigo_producto}</td>
                      <td className="px-4 py-3 text-white/80">{r.descripcion}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{r.unidad_medida}</td>
                      <td className="px-4 py-3 text-white text-center">{r.cantidad_pedida}</td>
                      <td className="px-4 py-3 text-white/60 text-center">{r.ya_recibido}</td>
                      <td className="px-4 py-3 text-center font-bold" style={{ color: '#fff' }}>{r.cantidad_a_recibir}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium" style={isComplete ? { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' } : { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }}>
                          {isComplete ? 'Completo' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {viewRec.observaciones && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>Observaciones</p>
              <p style={{ color: 'rgba(255,255,255,0.7)' }}>{viewRec.observaciones}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Vista Principal ────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-start mb-8 gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('recepcionFacturas')}</h1>
          <p className="text-white/50 mt-1">{tSub('recepcionFacturas')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button
            onClick={() => { setForm(emptyForm(todasRecepciones.length + 1, tipoActivo || '')); setIsFormOpen(true); setErrorMsg(''); setOcPendienteMsg('') }}
            className="px-5 py-2.5 rounded-xl font-medium text-white whitespace-nowrap shrink-0 ml-auto mr-56"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}
          >
            {tBtn('newReception')}
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

      {/* Mensaje Orden Pendiente */}
      {ocPendienteMsg && (
        <div className="mb-6 px-5 py-4 rounded-xl text-sm font-semibold flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#fff' }}>
          ⚠ {ocPendienteMsg}
          <button onClick={() => setOcPendienteMsg('')} className="ml-auto text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.3)', border: '1px solid rgba(245,158,11,0.4)' }}>
            {tBtn('close')}
          </button>
        </div>
      )}

      {/* ── Tab: Registros ─────────────────────────────────────────────────── */}
      {tab === 'registros' && (
        <>
          {/* ── Formulario ─────────────────────────────────────────────────────── */}
          {isFormOpen && (
            <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-lg font-semibold text-white mb-6">
                Nueva Recepción — <span style={{ color: '#fff' }}>{form.consecutivo}</span>
              </h2>

              <form onSubmit={handleSave}>
                {/* Cabecera */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {/* Nro de Recepción — correlativo solo lectura */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Nro de Recepción</label>
                    <input readOnly value={form.consecutivo}
                      className="w-full rounded-xl px-4 py-2.5 outline-none font-mono"
                      style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }} />
                  </div>

                  {/* Nro de Factura */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Nro de Factura *</label>
                    <input required value={form.nro_factura}
                      onChange={e => setForm({ ...form, nro_factura: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none text-white" style={inputStyle}
                      placeholder="Ej: FAC-2026-001" />
                  </div>

                  {/* Fecha Emisión */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Emisión *</label>
                    <input type="date" required value={form.fecha_emision}
                      onChange={e => setForm({ ...form, fecha_emision: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputStyle} />
                  </div>

                  {/* Fecha Recibida */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Recibida *</label>
                    <input type="date" required value={form.fecha_recibida}
                      onChange={e => setForm({ ...form, fecha_recibida: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputStyle} />
                  </div>

                  {/* Tipo de Inventario (heredado de la sesión) */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Tipo de Inventario</label>
                    <input readOnly value={form.tipo_inventario || '—'}
                      className="w-full rounded-xl px-4 py-2.5 outline-none font-semibold"
                      style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }}
                      title="Definido por el Tipo de Inventario activo de la sesión." />
                  </div>

                  {/* Orden de Compra */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Orden de Compra *</label>
                    <select required value={form.orden_compra_id} onChange={e => handleSelectOC(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectStyle}>
                      <option value="">{tOp('seleccionarOC')}</option>
                      {ordenesReales
                        .filter(oc => ['Aprobada', 'Pendiente por Recibir', 'Recibida Parcial'].includes(oc.situacion))
                        .map(oc => (
                          <option key={oc.id} value={oc.id}>{oc.consecutivo} — {oc.proveedor} ({oc.situacion})</option>
                        ))}
                    </select>
                  </div>

                  {/* Proveedor (solo lectura) */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Proveedor</label>
                    <input readOnly value={form.proveedor} className="w-full rounded-xl px-4 py-2.5 outline-none cursor-not-allowed"
                      style={{ ...inputStyle, opacity: 0.7 }} placeholder="Se carga al seleccionar OC" />
                  </div>

                  {/* Bodega de Recepción (solo lectura desde OC) */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Bodega de Recepción</label>
                    <input readOnly value={form.orden_compra_id ? (ordenesReales.find(o => o.id === form.orden_compra_id)?.bodega_llegada || '—') : ''}
                      className="w-full rounded-xl px-4 py-2.5 outline-none cursor-not-allowed"
                      style={{ ...inputStyle, opacity: 0.7 }} placeholder="Se carga al seleccionar OC" />
                  </div>

                  {/* Aprobado por (solo lectura desde OC) */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Aprobado por</label>
                    <input readOnly value={form.orden_compra_id ? (ordenesReales.find(o => o.id === form.orden_compra_id)?.comprador || '—') : ''}
                      className="w-full rounded-xl px-4 py-2.5 outline-none cursor-not-allowed"
                      style={{ ...inputStyle, opacity: 0.7 }} placeholder="Se carga al seleccionar OC" />
                  </div>

                  {/* Fecha Aprobación OC (solo lectura desde OC) */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Aprobación OC</label>
                    <input readOnly value={form.orden_compra_id ? (fDate(ordenesReales.find(o => o.id === form.orden_compra_id)?.fecha_aprobacion || '') || '—') : ''}
                      className="w-full rounded-xl px-4 py-2.5 outline-none cursor-not-allowed"
                      style={{ ...inputStyle, opacity: 0.7 }} placeholder="Se carga al seleccionar OC" />
                  </div>

                  {/* Persona que recibe */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Persona que Recibe *</label>
                    <input required value={form.persona_recibe}
                      onChange={e => setForm({ ...form, persona_recibe: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none text-white" style={inputStyle}
                      placeholder="Nombre completo" />
                  </div>

                  {/* Fecha Aprobación */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha Aprobación de Ingreso</label>
                    <input type="date" value={form.fecha_aprobacion}
                      onChange={e => setForm({ ...form, fecha_aprobacion: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputStyle} />
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Estado</label>
                    <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectStyle}>
                      {[tF('pendiente'), 'Aprobada', 'Anulada'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Renglones ───────────────────────────────────────────────────── */}
                {form.renglones.length > 0 && (
                  <div className="mb-6">
                    <p className="text-white font-medium mb-3">Renglones de la Orden de Compra</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      <table className="w-full text-base text-left">
                        <thead style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <tr>
                            {[tF('codigo'), tF('descripcion'), tF('unidad'), tH('cantPedida'), tH('costoUnit'), tF('yaRecibido'), tF('pendiente'), tH('cantARecibir'), tF('subtotal')].map(h => (
                              <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {form.renglones.map((r, idx) => {
                            const pendiente = r.cantidad_pedida - r.ya_recibido
                            return (
                              <tr key={r.detalle_id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: r.completo ? 'rgba(96,165,250,0.05)' : undefined }}>
                                <td className="px-4 py-3 font-mono text-xs text-white">{r.codigo_producto}</td>
                                <td className="px-4 py-3 text-white/80 max-w-xs">{r.descripcion}</td>
                                <td className="px-4 py-3 text-white/50 text-xs">{r.unidad_medida}</td>
                                <td className="px-4 py-3 text-white text-center font-medium">{r.cantidad_pedida}</td>
                                <td className="px-4 py-3 text-white/70 text-right">${fmtMoney(r.costo_unitario)}</td>
                                <td className="px-4 py-3 text-center" style={{ color: '#fff' }}>{r.ya_recibido}</td>
                                <td className="px-4 py-3 text-center font-bold" style={{ color: pendiente > 0 ? '#f87171' : '#93c5fd' }}>{pendiente}</td>
                                <td className="px-4 py-3">
                                  {r.completo ? (
                                    <div className="flex items-center gap-2">
                                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(96,165,250,0.15)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                                        ✓ Ítem ya completo
                                      </span>
                                    </div>
                                  ) : (
                                    <input
                                      type="number" min="0" max={pendiente} step="1"
                                      value={r.cantidad_a_recibir || ''}
                                      onChange={e => handleCantidad(idx, e.target.value)}
                                      className="w-24 rounded-lg px-3 py-1.5 text-white outline-none text-center font-bold"
                                      style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)' }}
                                      placeholder="0"
                                    />
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-white font-bold whitespace-nowrap">
                                  ${fmtMoney(r.cantidad_a_recibir * r.costo_unitario)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Totales */}
                    {(() => {
                      const oc = ordenesReales.find(o => o.id === form.orden_compra_id)
                      const pctIva = oc?.pct_impuesto ?? 19
                      const subtotal = form.renglones.reduce((sum, r) => sum + (r.cantidad_a_recibir * r.costo_unitario), 0)
                      const iva = subtotal * (pctIva / 100)
                      const total = subtotal + iva
                      return (
                        <div className="flex flex-col items-end gap-2 mt-4 text-sm">
                          <div className="flex gap-8 w-80 justify-between px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <span className="text-white/70 font-medium">Subtotal</span>
                            <span className="text-white font-semibold">${fmtMoney(subtotal)}</span>
                          </div>
                          <div className="flex gap-8 w-80 justify-between px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <span className="text-white/70 font-medium">% IVA ({pctIva}%)</span>
                            <span className="text-white font-semibold">${fmtMoney(iva)}</span>
                          </div>
                          <div className="flex gap-8 w-80 justify-between px-4 py-3 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(96,165,250,0.1))', border: '1px solid rgba(96,165,250,0.4)' }}>
                            <span className="text-white font-bold text-base">TOTAL GENERAL FACTURA</span>
                            <span className="font-black text-lg" style={{ color: '#fff' }}>${fmtMoney(total)}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {form.orden_compra_id === '' && (
                  <div className="mb-6 rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.35)' }}>{tHelp('seleccioneOCRenglones')}</p>
                  </div>
                )}

                {/* Observaciones */}
                <div className="mb-6">
                  <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
                  <textarea rows={2} value={form.observaciones}
                    onChange={e => setForm({ ...form, observaciones: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none resize-none"
                    style={inputStyle} placeholder="Notas adicionales sobre la recepción..." />
                </div>

                {errorMsg && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                    ⚠ {errorMsg}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2.5 rounded-xl text-white font-medium" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                    {tBtn('saveReception')}
                  </button>
                  <button type="button" onClick={() => {
                    const tieneCambios = form.renglones.some(r => r.cantidad_a_recibir > 0)
                      || !!form.nro_factura.trim()
                      || !!form.persona_recibe.trim()
                      || !!form.orden_compra_id
                    if (tieneCambios) {
                      const ok = confirm('Tienes datos sin guardar en esta recepcion.\n\n¿Seguro que quieres cancelar y perder los cambios?\n\nNo se afectaran existencias, costos ni la orden de compra.')
                      if (!ok) return
                    }
                    setIsFormOpen(false)
                    setErrorMsg('')
                    setForm(emptyForm(todasRecepciones.length + 1, tipoActivo || ''))
                  }} className="px-6 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                    {tBtn('cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Tabla de Recepciones ─────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>Nro Rec.</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>Nro Factura</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>F. Emisión</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>F. Recibida</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>OC</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>Proveedor</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>Estado</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>Pasada a Pagos</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-center" style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(34,197,94,0.15)', position: 'sticky', right: 0, zIndex: 2 }}>⚙ Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recepciones.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-3 py-3 font-mono font-bold whitespace-nowrap" style={{ color: '#fff' }}>{r.consecutivo}</td>
                    <td className="px-3 py-3 text-white font-bold font-mono whitespace-nowrap">{r.nro_factura}</td>
                    <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(r.fecha_emision)}</td>
                    <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(r.fecha_recibida)}</td>
                    <td className="px-3 py-3 text-white font-bold font-mono whitespace-nowrap">{r.orden_compra_consecutivo}</td>
                    <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{r.proveedor}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 rounded-full text-xs font-medium" style={estadoStyle(r.estado)}>{r.estado}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {r.pasada_a_pagos ? (
                        <span className="px-2 py-1 rounded-md text-xs font-extrabold whitespace-nowrap" style={{ background: '#ffffff', color: '#0b1d4a', border: '1px solid #ffffff' }} title={r.pasada_a_pagos_fecha ? `${fDate(r.pasada_a_pagos_fecha)} · ${r.pasada_a_pagos_factura_id || ''}` : ''}>✓ PASADA</span>
                      ) : (
                        <span className="px-2 py-1 rounded-md text-xs font-extrabold whitespace-nowrap" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>⏳ PENDIENTE</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap" style={{ background: 'rgba(15,23,42,0.95)', position: 'sticky', right: 0, zIndex: 1, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setViewRec(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap" style={{ background: 'rgba(96,165,250,0.3)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }}>
                          👁 Ver
                        </button>
                        <button
                          onClick={() => {
                            const emp = empresas[0]
                            const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined
                            const prov = proveedores.find(p => p.nombre === r.proveedor)
                            const provData = prov ? { tipo_id: prov.tipo_id, nro_documento: prov.nro_documento, direccion: prov.direccion, ciudad: prov.ciudad } : undefined
                            generateRecepcionPDF(r, empData, provData, emp?.logo || LOGO_BASE64)
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
                          style={{ background: 'rgba(34,197,94,0.4)', color: '#fff', border: '1px solid rgba(21,128,61,1)' }}
                          title="Regenerar PDF (incluso si ya pasó a Pagos)">
                          🖨 PDF
                        </button>
                        {esAdmin && <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap" style={{ background: 'rgba(239,68,68,0.3)', color: '#fff', border: '1px solid rgba(185,28,28,1)' }} title="Solo Admin puede eliminar (afecta inventario si está aprobada)">
                          🗑 Borrar
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {recepciones.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      <div className="text-4xl mb-3">📋</div>
                      <p>No hay recepciones registradas. Crea la primera haciendo clic en <strong>{tBtn('newReception')}</strong>.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Tab: Reportes ──────────────────────────────────────────────────── */}
      {tab === 'reportes' && (
        <ReportPanel
          title={tRpt('recepcionFacturas')}
          columns={reportColumns}
          rows={reportRows}
          filters={reportFilters}
          filename="recepciones"
          summableKeys={['items']}
        />
      )}

      {/* ── Tab: Reportes Específicos ────────────────────────────────────── */}
      {tab === 'especificos' && (
        <div className="glass-card p-6 md:p-8">
          <h2 className="text-xl font-bold text-white mb-4">{tTab('especificos')}</h2>
          <p className="text-white/50 text-sm mb-6">{tSub('seleccioneReporte')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-white font-bold mb-1">📄 Detalle de Facturas Recibidas</h3>
              <p className="text-white/50 text-xs mb-4">Listado de facturas recibidas en el rango de fechas con monto sin IVA, IVA con % y total de factura.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <label className="block text-xl text-white font-extrabold mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={rfFechaIni}
                    onChange={e => setRfFechaIni(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-white outline-none text-base text-white font-bold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                </div>
                <div>
                  <label className="block text-xl text-white font-extrabold mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={rfFechaFin}
                    onChange={e => setRfFechaFin(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-white outline-none text-base text-white font-bold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                </div>
              </div>
              <button
                onClick={generateReporteFacturasRecibidas}
                className="w-full px-4 py-2.5 rounded-xl font-semibold text-white text-sm"
                style={{ background: '#1e3a8a', border: '1px solid #3b5fd4' }}
              >
                🖨 Generar Reporte PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
