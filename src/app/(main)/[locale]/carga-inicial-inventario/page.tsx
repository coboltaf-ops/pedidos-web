'use client'

import { useTranslations } from 'next-intl'

import { useState, useRef } from 'react'
import { todayColombia, fDate } from '@/shared/lib/format-date'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useCargaInicialStore, type CargaInicial, type RenglonCarga } from '@/features/carga-inicial/store/carga-inicial-store'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { useCurrentUserStore } from '@/features/usuarios/store/current-user-store'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'
import { fmtMoney } from '@/shared/lib/format-number'
import VoiceSearchButton from '@/shared/components/voice-search-button'
import { exportToExcel, exportToPDF, printReport } from '@/shared/lib/export-report'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = todayColombia()

const emptyRenglon = (): RenglonCarga => ({
  id: crypto.randomUUID(), codigo_producto: '', descripcion: '', unidad_medida: 'Unidad', cantidad: 0, costo_unitario: 0,
})

const nextNroCarga = (cargas: CargaInicial[]) => {
  const maxNum = cargas.reduce((max, c) => {
    const num = parseInt(c.nro_carga.replace('CII-', ''), 10)
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)
  return `CII-${String(maxNum + 1).padStart(5, '0')}`
}

const emptyForm = (nro_carga: string, bodegas: { id: string; nombre: string }[]): CargaInicial => ({
  id: '', nro_carga,
  fecha: today,
  bodega_id: bodegas[0]?.id ?? '',
  bodega_nombre: bodegas[0]?.nombre ?? '',
  observaciones: '',
  renglones: [emptyRenglon()],
  estado: 'Aplicada',
})

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selectSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

// ─── PDF ──────────────────────────────────────────────────────────────────────

function generateCargaPDF(c: CargaInicial, empresaInfo?: { nombre: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string }, empresaLogo: string = LOGO_BASE64) {
  const fmtNum = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const totalCosto = c.renglones.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0)
  const rows = c.renglones.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${r.codigo_producto}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${r.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px">${r.unidad_medida || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">${fmtNum(r.cantidad)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtMoney(r.costo_unitario)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${fmtMoney(r.cantidad * r.costo_unitario)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Carga Inicial ${c.nro_carga}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#111; background:#fff; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #1e3a8a; }
    .company { font-size:22px; font-weight:800; color:#000; line-height:1.15; white-space:nowrap; }
    .doc-title { text-align:right; }
    .doc-title h2 { font-size:20px; font-weight:700; color:#000; margin-bottom:2px; }
    .doc-title .consecutivo { font-size:18px; font-family:monospace; font-weight:900; color:#000; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; background:#1e3a8a; color:#fff; margin-top:6px; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:28px; padding:20px; background:#eef2ff; border-radius:8px; border:1px solid #c7d2fe; }
    .field label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#1e3a8a; font-weight:700; display:block; margin-bottom:3px; }
    .field span { font-weight:600; color:#111; font-size:13px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#1e3a8a; }
    thead th { padding:10px 12px; color:#fff; font-size:11px; text-transform:uppercase; letter-spacing:.06em; text-align:left; }
    thead th:nth-child(3),thead th:nth-child(4) { text-align:center; }
    thead th:nth-child(5),thead th:nth-child(6) { text-align:right; }
    .total-row { background:#eef2ff; font-weight:700; }
    .footer { margin-top:40px; display:flex; justify-content:space-between; }
    .sign-box { text-align:center; }
    .sign-line { width:180px; border-top:2px solid #000; margin:0 auto 6px; padding-top:6px; font-size:11px; font-weight:700; color:#000; }
    @media print { body { padding:16px; } }
  </style></head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="${empresaLogo}" style="width:180px;height:180px;border-radius:12px;object-fit:contain;background:#fff;padding:8px;" />
      <div>
        <div class="company">${empresaInfo?.nombre || 'Empresa'}</div>
        ${empresaInfo ? `<div style="font-size:15px;color:#000;font-weight:600;margin-top:6px;line-height:1.5">${empresaInfo.tipo_identificacion}: ${empresaInfo.nro_documento}<br/>${empresaInfo.direccion || ''}${empresaInfo.ciudad ? `, ${empresaInfo.ciudad}` : ''}</div>` : ''}
      </div>
    </div>
    <div class="doc-title">
      <h2>CARGA INICIAL DE INVENTARIO</h2>
      <div class="consecutivo">${c.nro_carga}</div>
      <div class="badge">${c.estado}</div>
    </div>
  </div>
  <div class="grid">
    <div class="field"><label>Nro. Carga</label><span>${c.nro_carga}</span></div>
    <div class="field"><label>Fecha</label><span>${fDate(c.fecha)}</span></div>
    <div class="field"><label>Bodega</label><span>${c.bodega_nombre || '—'}</span></div>
    <div class="field"><label>Total Ítems</label><span>${c.renglones.length}</span></div>
    <div class="field"><label>Valor Total</label><span>$${fmtNum(totalCosto)}</span></div>
    <div class="field"><label>Estado</label><span>${c.estado}</span></div>
  </div>
  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th>
      <th style="text-align:center">Unidad</th>
      <th style="text-align:center">Cantidad</th>
      <th style="text-align:right">Costo Unit.</th>
      <th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="5" style="padding:10px 12px;text-align:right;font-size:13px">TOTAL CARGA INICIAL</td>
        <td style="padding:10px 12px;text-align:right;font-size:14px">$${fmtNum(totalCosto)}</td>
      </tr>
    </tbody>
  </table>
  ${c.observaciones ? `<div style="border:1.5px solid #1e3a8a;border-radius:8px;overflow:hidden;margin-bottom:20px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#fff;background:#1e3a8a;padding:8px 14px;font-weight:600">Observaciones</div><div style="padding:12px 14px;font-size:13px;color:#1f2937;background:#f8fafc">${c.observaciones}</div></div>` : ''}
  <div class="footer">
    <div class="sign-box"><div class="sign-line">Preparado por</div></div>
    <div class="sign-box"><div class="sign-line">Revisado por</div></div>
    <div class="sign-box"><div class="sign-line">Aprobado por</div></div>
  </div>
  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=950,height=750')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── PDF Reporte Específico ───────────────────────────────────────────────────

type ProductoRpt = {
  codigo: string; descripcion: string; categoria: string
  grupo: string; sub_grupo: string; existencia: number; ult_costo: number; codigo_barra?: string
}

function generateReporteEspecificoPDF(
  rows: ProductoRpt[],
  meta: { fecha: string; solicitante: string; descripcion: string; filtros: string; bodega?: string },
  empresaInfo?: { nombre: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string },
  empresaLogo: string = LOGO_BASE64
) {
  const tableRows = rows.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px;color:#000;font-weight:700">
        <div>${r.codigo}</div>
        ${r.codigo_barra ? `<svg class="bc" data-val="${r.codigo_barra}" style="display:block;width:120px;height:40px;margin-top:4px"></svg>` : ''}
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#000;font-weight:700">${r.descripcion}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#000;font-weight:700">${r.categoria || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#000;font-weight:700">${r.grupo || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#000;font-weight:700">${r.sub_grupo || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right"></td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right"></td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Reporte Específico de Inventario</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;background:#fff;padding:28px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #1a56db}
    .company{font-size:20px;font-weight:700;color:#000}
    .doc-title h2{font-size:18px;font-weight:700;color:#1a56db;margin-bottom:4px;text-align:right}
    .doc-title .desc{font-size:13px;font-weight:800;color:#000;text-align:right}
    .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;padding:16px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe}
    .meta-grid .full{grid-column:1/-1}
    .field label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#1a56db;font-weight:700;display:block;margin-bottom:2px}
    .field span{font-weight:600;color:#111;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
    thead tr{background:#1a56db}
    thead th{padding:9px 10px;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;text-align:left}
    thead th:nth-child(6),thead th:nth-child(7){text-align:right}
    .total-row{background:#eff6ff;font-weight:700}
    @media print{body{padding:12px}}
  </style></head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="${empresaLogo}" style="width:160px;height:160px;border-radius:12px;object-fit:contain;background:#fff;padding:6px;" />
      <div>
        <div class="company">${empresaInfo?.nombre || 'Empresa'}</div>
        ${empresaInfo ? `<div style="font-size:10px;color:#000;font-weight:700;margin-top:2px;line-height:1.4">${empresaInfo.tipo_identificacion}: ${empresaInfo.nro_documento}<br/>${empresaInfo.direccion || ''}${empresaInfo.ciudad ? `, ${empresaInfo.ciudad}` : ''}</div>` : ''}
      </div>
    </div>
    <div class="doc-title">
      <h2>REPORTE ESPECÍFICO DE INVENTARIO</h2>
      ${meta.descripcion ? `<div class="desc">${meta.descripcion}</div>` : ''}
    </div>
  </div>
  <div class="meta-grid">
    <div class="field"><label>Fecha de Solicitud</label><span>${fDate(meta.fecha)}</span></div>
    <div class="field"><label>Solicitado por</label><span>${meta.solicitante}</span></div>
    <div class="field"><label>Total Productos</label><span>${rows.length}</span></div>
    ${meta.bodega ? `<div class="field"><label>Bodega</label><span>${meta.bodega}</span></div>` : ''}
    <div class="field full"><label>Descripción del Reporte</label><span>${meta.descripcion || '—'}</span></div>
    ${meta.filtros ? `<div class="field full"><label>Filtros Aplicados</label><span>${meta.filtros}</span></div>` : ''}
  </div>
  <table>
    <thead><tr>
      <th>Código</th><th>Descripción</th><th>Categoría</th><th>Grupo</th><th>Sub Grupo</th>
      <th style="text-align:right">Existencia</th><th style="text-align:right">Costo</th>
    </tr></thead>
    <tbody>
      ${tableRows}
      <tr class="total-row">
        <td colspan="5" style="padding:9px 10px;text-align:right;font-size:11px">TOTAL PRODUCTOS</td>
        <td style="padding:9px 10px;text-align:right">${rows.reduce((s, r) => s + r.existencia, 0).toLocaleString('en-US')}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <script>
    window.onload=()=>{
      document.querySelectorAll('.bc').forEach(function(el){
        try{ JsBarcode(el,el.getAttribute('data-val'),{format:'CODE128',width:1.5,height:35,displayValue:false,margin:2}) }catch(e){}
      })
      setTimeout(()=>window.print(),500)
    }
  <\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=1000,height=750')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function CargaInicialInventarioPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tSec = useTranslations('sections')
  const tOp = useTranslations('options')
  const tEs = useTranslations('emptyState')
  const permisos = usePermisos('toma-inventario-fisico')
  const user = useCurrentUserStore(s => s.user)
  const bodegas = useBodegasStore(s => s.bodegas).filter(b => b.situacion === 'Activa')
  const { productos, updateProducto } = useProductosStore()
  const productosActivos = productos.filter(p => p.situacion === 'Activo' && !!p.descripcion && !!p.codigo)
  const empresas = useEmpresaStore(s => s.empresas)
  const { cargas, addCarga, deleteCarga } = useCargaInicialStore()

  const [tab, setTab] = useState<'registros' | 'reportes' | 'reporte-especifico'>('registros')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewItem, setViewItem] = useState<CargaInicial | null>(null)
  const [form, setForm] = useState<CargaInicial>(() => emptyForm('CII-00001', bodegas))
  const [errorMsg, setErrorMsg] = useState('')

  // Búsqueda de productos
  const [searchProd, setSearchProd] = useState('')
  const searchProdRef = useRef<HTMLInputElement>(null)

  // Reportes
  const [rptDesde, setRptDesde] = useState('')
  const [rptHasta, setRptHasta] = useState('')
  const [rptBodega, setRptBodega] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Reporte Específico
  const [espBodega, setEspBodega] = useState('')
  const [espFamilia, setEspFamilia] = useState('')
  const [espGrupo, setEspGrupo] = useState('')
  const [espSubGrupo, setEspSubGrupo] = useState('')
  const [espDescripcion, setEspDescripcion] = useState('')
  const [isExportingEsp, setIsExportingEsp] = useState(false)

  const espFamilias = [...new Set(productosActivos.map(p => p.tipo_inventario).filter(Boolean))].sort()
  const espGrupos = [...new Set(productosActivos.filter(p => !espFamilia || p.tipo_inventario === espFamilia).map(p => p.grupo).filter(Boolean))].sort()
  const espSubGrupos = [...new Set(productosActivos.filter(p => (!espFamilia || p.tipo_inventario === espFamilia) && (!espGrupo || p.grupo === espGrupo)).map(p => p.sub_grupo).filter(Boolean))].sort()

  const espRows = productosActivos.filter(p =>
    (!espFamilia || p.tipo_inventario === espFamilia) &&
    (!espGrupo || p.grupo === espGrupo) &&
    (!espSubGrupo || p.sub_grupo === espSubGrupo)
  ).sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '', 'es'))

  const doExportEsp = async (format: 'pdf' | 'excel' | 'print') => {
    setIsExportingEsp(true)
    const solicitante = `${user.nombre} ${user.apellido}`.trim()
    const bodegaNombre = bodegas.find(b => b.id === espBodega)?.nombre || ''
    const filtros = [espBodega ? `Bodega: ${bodegaNombre}` : '', espFamilia ? `Familia: ${espFamilia}` : '', espGrupo ? `Grupo: ${espGrupo}` : '', espSubGrupo ? `Sub Grupo: ${espSubGrupo}` : ''].filter(Boolean).join(' | ')
    const emp = empresas[0]
    const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined
    const cols = [
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Descripción', key: 'descripcion', width: 30 },
      { header: 'Categoría', key: 'categoria', width: 16 },
      { header: 'Grupo', key: 'grupo', width: 16 },
      { header: 'Sub Grupo', key: 'sub_grupo', width: 16 },
      { header: 'Existencia', key: 'existencia', width: 12 },
      { header: 'Costo', key: 'ult_costo', width: 14 },
    ]
    const rows = espRows.map(p => ({ codigo: p.codigo, descripcion: p.descripcion, categoria: p.categoria || '—', grupo: p.grupo || '—', sub_grupo: p.sub_grupo || '—', existencia: '', ult_costo: '' }))
    try {
      const subtitle = filtros || 'Todos los productos'
      if (format === 'pdf') {
        generateReporteEspecificoPDF(espRows.map(p => ({ codigo: p.codigo, descripcion: p.descripcion, categoria: p.categoria || '—', grupo: p.grupo || '—', sub_grupo: p.sub_grupo || '—', existencia: p.existencia, ult_costo: p.ult_costo, codigo_barra: p.codigo_barra || '' })), { fecha: today, solicitante, descripcion: espDescripcion, filtros, bodega: bodegaNombre || undefined }, empData, emp?.logo || LOGO_BASE64)
      } else if (format === 'excel') {
        await exportToExcel({ title: 'Reporte Específico de Inventario', subtitle, columns: cols, rows, filename: `reporte-especifico-${today}` })
      } else {
        const printRows = espRows.map((p, i) => `
          <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
            <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px;color:#000;font-weight:700">
              <div>${p.codigo}</div>
              ${p.codigo_barra ? `<svg class="bc" data-val="${p.codigo_barra}" style="display:block;width:120px;height:38px;margin-top:3px"></svg>` : ''}
            </td>
            <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#000;font-weight:700">${p.descripcion}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#000;font-weight:700">${p.categoria || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#000;font-weight:700">${p.grupo || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#000;font-weight:700">${p.sub_grupo || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right"></td>
            <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right"></td>
          </tr>`).join('')
        const printHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
          <title>Reporte Específico de Inventario</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
          <style>
            *{margin:0;padding:0;box-sizing:border-box}
            body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;padding:20px}
            .hdr{background:#1a56db;color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
            .hdr h1{font-size:15px;font-weight:700}
            .hdr p{font-size:10px;opacity:.8;margin-top:2px}
            .btn{background:#fff;color:#1a56db;border:none;border-radius:6px;padding:6px 16px;font-size:12px;font-weight:700;cursor:pointer}
            table{width:100%;border-collapse:collapse;font-size:11px}
            thead tr{background:#1a56db}
            thead th{padding:8px 10px;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;text-align:left}
            .footer{margin-top:12px;font-size:10px;color:#6b7280}
            @media print{.btn{display:none} body{padding:10px}}
          </style></head><body>
          <div class="hdr">
            <div><h1>Reporte Específico de Inventario</h1><p>${subtitle}${espDescripcion ? ' — ' + espDescripcion : ''}</p></div>
            <div style="text-align:center">
              ${bodegaNombre ? `<div style="font-size:11px;color:#fff;text-transform:uppercase;letter-spacing:.08em">Bodega</div><div style="font-size:16px;font-weight:900;color:#fff">${bodegaNombre}</div>` : '<div style="font-size:13px;font-weight:700;color:#fff">Todas las Bodegas</div>'}
            </div>
            <button class="btn" onclick="window.print()">🖨 Imprimir</button>
          </div>
          <table>
            <thead><tr><th>Código</th><th>Descripción</th><th>Categoría</th><th>Grupo</th><th>Sub Grupo</th><th style="text-align:right">Existencia</th><th style="text-align:right">Costo</th></tr></thead>
            <tbody>${printRows}</tbody>
          </table>
          <div class="footer">Total productos: ${espRows.length}</div>
          <script>
            window.onload=function(){
              document.querySelectorAll('.bc').forEach(function(el){
                try{JsBarcode(el,el.getAttribute('data-val'),{format:'CODE128',width:1.5,height:32,displayValue:false,margin:2})}catch(e){}
              })
            }
          <\/script>
          </body></html>`
        const win = window.open('', '_blank', 'width=1000,height=750')
        if (win) { win.document.write(printHtml); win.document.close() }
      }
    } finally { setIsExportingEsp(false) }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateRenglon = (idx: number, field: keyof RenglonCarga, value: string | number) => {
    const renglones = [...form.renglones]
    renglones[idx] = { ...renglones[idx], [field]: value }
    setForm({ ...form, renglones })
  }

  const removeRenglon = (idx: number) =>
    setForm({ ...form, renglones: form.renglones.filter((_, i) => i !== idx) })

  const handleBodega = (id: string) => {
    const b = bodegas.find(b => b.id === id)
    setForm({ ...form, bodega_id: id, bodega_nombre: b?.nombre ?? '' })
  }

  // ── Guardar ──────────────────────────────────────────────────────────────────
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.bodega_id) { setErrorMsg('Debe seleccionar una Bodega.'); return }
    if (!form.renglones.length || form.renglones[0].codigo_producto === '') {
      setErrorMsg('Debe agregar al menos un producto.'); return
    }
    const sinCantidad = form.renglones.find(r => r.cantidad <= 0)
    if (sinCantidad) { setErrorMsg(`El producto "${sinCantidad.descripcion}" tiene cantidad 0 o inválida.`); return }

    // Aplicar al inventario: sumar cantidad y actualizar costo
    for (const r of form.renglones) {
      const prod = productos.find(p => p.codigo === r.codigo_producto)
      if (prod) {
        updateProducto(prod.id, {
          existencia: (prod.existencia || 0) + r.cantidad,
          ...(r.costo_unitario > 0 ? { ult_costo: r.costo_unitario } : {}),
        })
      }
    }

    addCarga({ ...form, id: crypto.randomUUID() })
    setIsFormOpen(false)
    setSearchProd('')
    setErrorMsg('')
    setForm(emptyForm(nextNroCarga([...cargas, form]), bodegas))
  }

  const handleDelete = (id: string) => {
    if (confirm(tCf('delCargaInicial'))) deleteCarga(id)
  }

  // ── Reportes ─────────────────────────────────────────────────────────────────
  const filteredReport = cargas.filter(c => {
    if (rptDesde && c.fecha < rptDesde) return false
    if (rptHasta && c.fecha > rptHasta) return false
    if (rptBodega && c.bodega_id !== rptBodega) return false
    return true
  })

  const rptCols = [
    { header: tH('nroCarga'), key: 'nro_carga', width: 14 },
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Bodega', key: 'bodega_nombre', width: 22 },
    { header: tH('itemsAccent'), key: 'items', width: 8 },
    { header: tH('valorTotal'), key: 'valor_total', width: 16 },
    { header: 'Estado', key: 'estado', width: 12 },
  ]

  const buildRptRows = (rows: CargaInicial[]) => rows.map(c => ({
    nro_carga: c.nro_carga,
    fecha: c.fecha,
    bodega_nombre: c.bodega_nombre,
    items: c.renglones.length,
    valor_total: 'Pesos ' + fmtMoney(c.renglones.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0)),
    estado: c.estado,
  }))

  const doExport = async (format: 'pdf' | 'excel' | 'print') => {
    setIsExporting(true)
    const subtitle = [rptDesde ? `Desde: ${rptDesde}` : '', rptHasta ? `Hasta: ${rptHasta}` : '', rptBodega ? `Bodega: ${bodegas.find(b => b.id === rptBodega)?.nombre}` : ''].filter(Boolean).join(' | ')
    const opts = { title: 'Reporte Carga Inicial de Inventario', subtitle: subtitle || undefined, columns: rptCols, rows: buildRptRows(filteredReport), filename: `carga-inicial-${today}` }
    try {
      if (format === 'pdf') await exportToPDF(opts)
      else if (format === 'excel') await exportToExcel(opts)
      else printReport(opts)
    } finally { setIsExporting(false) }
  }

  // ── Vista Detalle ─────────────────────────────────────────────────────────────
  if (viewItem) return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setViewItem(null)} className="flex items-center gap-2 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>
          ← Volver a Carga Inicial
        </button>
        <button onClick={() => {
          const emp = empresas[0]
          const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined
          generateCargaPDF(viewItem, empData, emp?.logo || LOGO_BASE64)
        }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white"
          style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
          🖨 Generar PDF
        </button>
      </div>

      <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('cargaInicialInventario')}</h1>
            <p className="text-2xl font-mono mt-1" style={{ color: '#fff' }}>{viewItem.nro_carga}</p>
          </div>
          <span className="px-4 py-2 rounded-full text-sm font-bold" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
            {viewItem.estado}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: tH('nroCarga'), value: viewItem.nro_carga },
            { label: 'Fecha', value: fDate(viewItem.fecha) },
            { label: 'Bodega', value: viewItem.bodega_nombre },
            { label: 'Total Ítems', value: `${viewItem.renglones.length} producto${viewItem.renglones.length !== 1 ? 's' : ''}` },
            { label: tH('valorTotal'), value: 'Pesos ' + fmtMoney(viewItem.renglones.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0)) },
            { label: 'Estado', value: viewItem.estado },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#f97316' }}>{label}</p>
              <p className="text-white font-medium">{value}</p>
            </div>
          ))}
        </div>

        {viewItem.observaciones && (
          <div className="mb-6 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>Observaciones</p>
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>{viewItem.observaciones}</p>
          </div>
        )}

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <table className="w-full text-base text-left">
            <thead style={{ background: 'rgba(255,255,255,0.07)' }}>
              <tr>{['#', tF('codigo'), tF('descripcion'), tH('unidMedida'), tF('cantidad'), tH('costoUnit'), tH('total')].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {viewItem.renglones.map((r, idx) => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-4 py-3 text-white/40 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white">{r.codigo_producto}</td>
                  <td className="px-4 py-3 text-white/80">{r.descripcion}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{r.unidad_medida || '—'}</td>
                  <td className="px-4 py-3 text-white font-bold text-right">{r.cantidad.toLocaleString('en-US')}</td>
                  <td className="px-4 py-3 text-white/60 text-right">${fmtMoney(r.costo_unitario)}</td>
                  <td className="px-4 py-3 text-white font-medium text-right">${fmtMoney(r.cantidad * r.costo_unitario)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(96,165,250,0.08)' }}>
                <td colSpan={6} className="px-4 py-3 text-right font-bold text-white/70 text-sm">TOTAL CARGA INICIAL</td>
                <td className="px-4 py-3 text-right font-bold text-lg" style={{ color: '#fff' }}>
                  ${fmtMoney(viewItem.renglones.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // ── Vista Principal ────────────────────────────────────────────────────────────
  const tabActive: React.CSSProperties = { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
  const tabInactive: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }

  return (
    <div>
      {/* Título */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('cargaInicialInventario')}</h1>
          <p className="text-white/50 mt-1">{tSub('cargaInicialInventario')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button
            onClick={() => { setForm(emptyForm(nextNroCarga(cargas), bodegas)); setIsFormOpen(true) }}
            className="px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newLoad')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => setTab('registros')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'registros' ? tabActive : tabInactive}>{tTab('registrosEmoji')}</button>
        <button onClick={() => setTab('reportes')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'reportes' ? tabActive : tabInactive}>{tTab('reportesEmoji')}</button>
        <button onClick={() => setTab('reporte-especifico')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'reporte-especifico' ? tabActive : tabInactive}>📋 Reporte Específico</button>
      </div>

      {/* ══ TAB REGISTROS ══ */}
      {tab === 'registros' && (
        <>
          {/* Formulario */}
          {isFormOpen && (
            <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-lg font-semibold text-white">{tSec('nuevaCargaInicial')}</h2>
                <span className="font-mono text-sm px-3 py-1 rounded-lg" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>{form.nro_carga}</span>
              </div>

              {errorMsg && (
                <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                  ⚠ {errorMsg}
                </div>
              )}

              <form onSubmit={handleSave}>
                {/* Campos cabecera */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Nro. Carga</label>
                    <input readOnly value={form.nro_carga} className="w-full rounded-xl px-4 py-2.5 outline-none font-mono"
                      style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }} />
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha *</label>
                    <input type="date" required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt} />
                  </div>
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Bodega *</label>
                    <select required value={form.bodega_id} onChange={e => handleBodega(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                      <option value="">{tOp('seleccione')}</option>
                      {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
                    <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 outline-none" style={inputSt}
                      placeholder="Descripción de la carga inicial..." />
                  </div>
                </div>

                {/* Separador */}
                <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Productos a cargar</h3>
                </div>

                {/* Búsqueda de productos */}
                <div className="mb-4">
                  <label className="block text-xl text-white font-extrabold mb-2">Buscar producto para agregar</label>
                  <div className="flex items-center gap-2 max-w-lg">
                    <input ref={searchProdRef} value={searchProd}
                      onChange={e => setSearchProd(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setSearchProd('') }}
                      className="w-full rounded-xl px-4 py-2.5 text-white outline-none text-base text-white font-bold"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                      placeholder="Escriba nombre o código del producto..." />
                    <VoiceSearchButton onResult={setSearchProd} />
                  </div>
                  {searchProd.trim().length > 0 && (() => {
                    const matches = productosActivos.filter(p =>
                      p.codigo.toLowerCase().includes(searchProd.toLowerCase()) ||
                      p.descripcion.toLowerCase().includes(searchProd.toLowerCase())
                    ).slice(0, 8)
                    if (matches.length === 0) return <p className="text-white/30 text-xs mt-2">No se encontraron productos</p>
                    return (
                      <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        {matches.map(p => (
                          <button key={p.id} type="button"
                            onClick={() => {
                              const existe = form.renglones.some(r => r.codigo_producto === p.codigo)
                              if (existe) { setErrorMsg(`"${p.descripcion}" ya está en los renglones.`); setSearchProd(''); return }
                              const nuevo: RenglonCarga = {
                                id: crypto.randomUUID(),
                                codigo_producto: p.codigo,
                                descripcion: p.descripcion,
                                unidad_medida: p.unidad_medida,
                                cantidad: 0,
                                costo_unitario: 0,
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
                            <span className="text-white/40 text-xs">{p.unidad_medida || '—'}</span>
                            <span className="text-white/30 text-xs">Exist. actual: {p.existencia}</span>
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* Tabla de renglones */}
                {form.renglones.length > 0 && form.renglones[0].codigo_producto !== '' && (
                  <div className="mb-6">
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      <table className="w-full text-base text-left">
                        <thead style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <tr>
                            {[tF('codigo'), tF('descripcion'), tH('unidMedida'), tH('cantidadRequired'), tH('costoUnit'), tF('subtotal'), ''].map(h => (
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
                                  onChange={e => updateRenglon(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                                  className="w-24 rounded-lg px-2 py-1.5 text-white outline-none text-center font-bold"
                                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)' }}
                                  placeholder="0" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" min="0" step="0.01" value={r.costo_unitario || ''}
                                  onChange={e => updateRenglon(idx, 'costo_unitario', parseFloat(e.target.value) || 0)}
                                  className="w-28 rounded-lg px-2 py-1.5 text-white outline-none text-right"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                                  placeholder="0.00" />
                              </td>
                              <td className="px-3 py-2 text-white font-bold text-right font-medium">
                                ${fmtMoney(r.cantidad * r.costo_unitario)}
                              </td>
                              <td className="px-2 py-2">
                                <button type="button" onClick={() => removeRenglon(idx)}
                                  className="text-red-400 hover:text-red-300 px-2 py-1">✕</button>
                              </td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(96,165,250,0.05)' }}>
                            <td colSpan={5} className="px-3 py-2.5 text-right text-white/60 text-xs font-semibold uppercase tracking-wider">Total Carga</td>
                            <td className="px-3 py-2.5 text-right font-bold" style={{ color: '#fff' }}>
                              ${fmtMoney(form.renglones.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0))}
                            </td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="submit" className="px-6 py-2.5 rounded-xl text-white font-medium"
                    style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                    Aplicar Carga al Inventario
                  </button>
                  <button type="button" onClick={() => { setIsFormOpen(false); setSearchProd(''); setErrorMsg('') }}
                    className="px-6 py-2.5 rounded-xl text-white/70"
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
                <tr>{[tH('nroCarga'), tF('fecha'), tF('bodega'), tH('productos'), tH('valorTotal'), tF('estado'), tTbl('actions')].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {cargas.map(c => (
                  <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-5 py-4 font-mono font-bold" style={{ color: '#fff' }}>{c.nro_carga}</td>
                    <td className="px-5 py-4 text-white/60">{fDate(c.fecha)}</td>
                    <td className="px-5 py-4 text-white font-bold">{c.bodega_nombre}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.15)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                        {c.renglones.length} ítem{c.renglones.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-white font-medium text-right">
                      ${fmtMoney(c.renglones.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0))}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => setViewItem(c)} className="px-3 py-1 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>Ver</button>
                        {permisos.eliminar && (
                          <button onClick={() => handleDelete(c.id)} className="px-3 py-1 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {cargas.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-16 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <div className="text-4xl mb-3">📥</div>
                    <p>No hay cargas registradas. Crea la primera con <strong>{tBtn('newLoad')}</strong>.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══ TAB REPORTE ESPECÍFICO ══ */}
      {tab === 'reporte-especifico' && (
        <div className="space-y-6">
          {/* Cabecera del reporte */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h2 className="text-lg font-semibold text-white mb-5">Reporte Específico de Inventario</h2>

            {/* Info solicitud */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Fecha de Solicitud</label>
                <input readOnly value={today} className="w-full rounded-xl px-4 py-2.5 outline-none font-mono text-sm"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }} />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Solicitado por</label>
                <input readOnly value={`${user.nombre} ${user.apellido}`.trim()} className="w-full rounded-xl px-4 py-2.5 outline-none text-base text-white font-bold"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }} />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Descripción del Reporte</label>
                <input value={espDescripcion} onChange={e => setEspDescripcion(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none text-base text-white font-bold" style={inputSt}
                  placeholder="Ej: Inventario EPP bodega principal..." />
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Bodega</label>
                <select value={espBodega} onChange={e => setEspBodega(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Todas</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Familia</label>
                <select value={espFamilia} onChange={e => { setEspFamilia(e.target.value); setEspGrupo(''); setEspSubGrupo('') }}
                  className="w-full rounded-xl px-4 py-2.5 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Todas</option>
                  {espFamilias.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Grupo</label>
                <select value={espGrupo} onChange={e => { setEspGrupo(e.target.value); setEspSubGrupo('') }}
                  className="w-full rounded-xl px-4 py-2.5 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Todos</option>
                  {espGrupos.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Sub Grupo</label>
                <select value={espSubGrupo} onChange={e => setEspSubGrupo(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Todos</option>
                  {espSubGrupos.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => { setEspBodega(''); setEspFamilia(''); setEspGrupo(''); setEspSubGrupo('') }}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white/70"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Todos (Limpiar)
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-white/50 text-sm">{espRows.length} producto{espRows.length !== 1 ? 's' : ''} encontrado{espRows.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <button onClick={() => doExportEsp('excel')} disabled={isExportingEsp || espRows.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.4)' }}>
                  Excel
                </button>
                <button onClick={() => doExportEsp('pdf')} disabled={isExportingEsp || espRows.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.4)' }}>
                  PDF
                </button>
                <button onClick={() => doExportEsp('print')} disabled={isExportingEsp || espRows.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}>
                  {tBtn('print')}
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de productos */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>{[tF('codigo'), tF('descripcion'), tF('categoria'), tF('grupo'), tF('subGrupo'), tF('existencia'), tF('costo')].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {espRows.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#fff' }}>{p.codigo}</td>
                    <td className="px-4 py-3 text-white font-medium">{p.descripcion}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{p.categoria || '—'}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{p.grupo || '—'}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{p.sub_grupo || '—'}</td>
                    <td className="px-4 py-3 text-white font-bold text-right">{p.existencia > 0 ? p.existencia.toLocaleString('en-US') : ''}</td>
                    <td className="px-4 py-3 text-white/80 text-right">{p.ult_costo > 0 ? 'Pesos ' + fmtMoney(p.ult_costo) : ''}</td>
                  </tr>
                ))}
                {espRows.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tEs('sinProductosFiltros')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ TAB REPORTES ══ */}
      {tab === 'reportes' && (
        <div className="space-y-6">
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h2 className="text-lg font-semibold text-white mb-5">{tSec('filtrosReporte')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white/50 text-sm">{filteredReport.length} registro{filteredReport.length !== 1 ? 's' : ''} encontrado{filteredReport.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <button onClick={() => doExport('excel')} disabled={isExporting || filteredReport.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.4)' }}>
                  Excel
                </button>
                <button onClick={() => doExport('pdf')} disabled={isExporting || filteredReport.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.4)' }}>
                  PDF
                </button>
                <button onClick={() => doExport('print')} disabled={isExporting || filteredReport.length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}>
                  {tBtn('print')}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>{rptCols.map(c => (
                  <th key={c.key} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{c.header}</th>
                ))}</tr>
              </thead>
              <tbody>
                {buildRptRows(filteredReport).map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-5 py-3 font-mono font-bold" style={{ color: '#fff' }}>{row.nro_carga}</td>
                    <td className="px-5 py-3 text-white/60">{fDate(row.fecha)}</td>
                    <td className="px-5 py-3 text-white/80">{row.bodega_nombre}</td>
                    <td className="px-5 py-3 text-center text-white/70">{row.items}</td>
                    <td className="px-5 py-3 text-white font-medium text-right">{row.valor_total}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>{row.estado}</span>
                    </td>
                  </tr>
                ))}
                {filteredReport.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tEs('sinRegistrosFiltros')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
