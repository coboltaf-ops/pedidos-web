'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { useOrdenesProduccionStore } from '@/features/produccion/store/ordenes-produccion-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useClientesStore } from '@/features/clientes/store/clientes-store'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { usePersonalEmpresaStore } from '@/features/personal-empresa/store/personal-empresa-store'
import { type OrdenProduccion } from '@/features/produccion/types'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { fDate, todayColombia } from '@/shared/lib/format-date'
import ViewRecordModal from '@/shared/components/view-record-modal'

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const nextConsecutivo = (nro: number) => `OPR-${String(nro).padStart(5, '0')}`

const sitStyle = (s: string): React.CSSProperties => {
  if (s === 'Completada') return { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' }
  if (s === 'En Proceso') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Pendiente') return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
  if (s === 'Cancelada') return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
  return { background: 'rgba(107,114,128,0.2)', color: '#d1d5db', border: '1px solid rgba(107,114,128,0.3)' }
}

export default function OrdenesProduccionPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tPh = useTranslations('placeholders')
  const tCf = useTranslations('confirm')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('ordenes-produccion')
  const { ordenes, addOrden, updateOrden, deleteOrden } = useOrdenesProduccionStore()
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const productos = useProductosStore(s => s.productos)
  const clientes = useClientesStore(s => s.clientes)
  const empresa = useEmpresaStore(s => s.empresas[0])
  const personalList = usePersonalEmpresaStore(s => s.personal).filter(p => p.situacion === 'Activo')

  const maxNum = ordenes.reduce((max, r) => Math.max(max, r.nro_orden || 0), 0)

  const initForm = (): OrdenProduccion => ({
    id: '', nro_orden: maxNum + 1, consecutivo: nextConsecutivo(maxNum + 1),
    fecha_emision: todayColombia(), fecha_programada: '', fecha_ejecucion: '',
    cliente: '', cliente_id: '',
    producto_terminado_id: '', producto_terminado_codigo: '', producto_terminado_codigo_spin: '', producto_terminado_nombre: '',
    cantidad_a_producir: 1, cantidad_producida: 0, unidad_medida: 'Unidad',
    lineas: [], responsable: '', observaciones: '', situacion: 'Pendiente',
  })

  const [form, setForm] = useState<OrdenProduccion>(initForm())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [viewRecord, setViewRecord] = useState<OrdenProduccion | null>(null)

  const filtered = ordenes.filter(r =>
    `${r.consecutivo} ${r.producto_terminado_nombre} ${r.cliente || ''} ${r.situacion}`.toLowerCase().includes(search.toLowerCase())
  )

  // Productos del cliente seleccionado (solo PT activos)
  const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const productosCliente = (() => {
    if (!form.cliente_id && !form.cliente) return []
    const cli = norm(form.cliente || '')
    return productos.filter(p => {
      if (p.situacion !== 'Activo') return false
      if ((p.tipo_inventario || '') !== 'Producto Terminado') return false
      const matchId = form.cliente_id && p.cliente_id === form.cliente_id
      const matchNombre = cli && norm(p.cliente || '') === cli
      return matchId || matchNombre
    })
  })()

  const handleClienteChange = (clienteId: string) => {
    const c = clientes.find(x => x.id === clienteId)
    setForm({
      ...form,
      cliente_id: clienteId,
      cliente: c?.razon_social || '',
      // Limpiar producto al cambiar cliente
      producto_terminado_id: '',
      producto_terminado_codigo: '',
      producto_terminado_codigo_spin: '',
      producto_terminado_nombre: '',
    })
  }

  const handleProductoChange = (productoId: string) => {
    const p = productos.find(x => x.id === productoId)
    if (!p) {
      setForm({ ...form, producto_terminado_id: '', producto_terminado_codigo: '', producto_terminado_codigo_spin: '', producto_terminado_nombre: '' })
      return
    }
    setForm({
      ...form,
      producto_terminado_id: p.id,
      producto_terminado_codigo: p.codigo,
      producto_terminado_codigo_spin: p.codigo_spin || '',
      producto_terminado_nombre: p.descripcion,
      unidad_medida: p.unidad_medida || form.unidad_medida || 'Unidad',
    })
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.cliente_id && !form.cliente) { setFormError('Seleccione el Cliente.'); return }
    if (!form.producto_terminado_id) { setFormError('Seleccione el Producto Terminado a producir.'); return }
    if (form.cantidad_a_producir <= 0) { setFormError('La cantidad a producir debe ser mayor a 0.'); return }

    // Heredar tipo_inventario del contexto activo (grupo del menú)
    const tipoActual = form.tipo_inventario || tipoActivo || 'Producto Terminado'
    const formConTipo = { ...form, tipo_inventario: tipoActual }
    if (formConTipo.id) { updateOrden(formConTipo.id, formConTipo) }
    else { addOrden({ ...formConTipo, id: crypto.randomUUID() }) }
    setIsFormOpen(false)
    setForm(initForm())
  }

  const handleDelete = (id: string) => { if (confirm(tCf('delOrdenProd'))) deleteOrden(id) }
  const openEdit = (r: OrdenProduccion) => { setForm({ ...r }); setIsFormOpen(true) }

  const imprimirOrden = (r: OrdenProduccion) => {
    const cliObj = clientes.find(c => c.id === r.cliente_id || c.razon_social === r.cliente)
    const cantPlan = Math.floor(r.cantidad_a_producir || 0)
    const cantProd = Math.floor(r.cantidad_producida || 0)
    const dif = cantPlan - cantProd
    const fmt = (n: number) => n.toLocaleString('es-CO')

    const filasMP = r.lineas.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:14px">— Sin materias primas asignadas —</td></tr>`
      : r.lineas.map((l, i) => {
          const reqL = l.cantidad_requerida || 0
          const usaL = l.cantidad_usada || 0
          const difL = reqL - usaL
          const colorDifL = difL === 0 ? '#065f46' : difL > 0 ? '#92400e' : '#991b1b'
          const bgDifL = difL === 0 ? '#d1fae5' : difL > 0 ? '#fef3c7' : '#fee2e2'
          return `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="mono">${l.codigo}</td>
          <td>${l.descripcion}</td>
          <td class="num">${reqL.toLocaleString('es-CO')} ${l.unidad_medida || ''}</td>
          <td class="num">${usaL.toLocaleString('es-CO')} ${l.unidad_medida || ''}</td>
          <td class="num" style="background:${bgDifL};color:${colorDifL};font-weight:800">${difL.toLocaleString('es-CO')} ${l.unidad_medida || ''}</td>
        </tr>`
        }).join('')

    const empresaInfo = empresa || { nombre: 'Silicatos para la Industria SAS', tipo_identificacion: 'NIT', nro_documento: '', direccion: '', ciudad: '', telefono_oficina: '', correo: '', logo: '' }
    const logoHtml = empresaInfo.logo
      ? `<img src="${empresaInfo.logo}" alt="logo" style="max-height:70px;max-width:200px;object-fit:contain"/>`
      : `<div style="font-size:22px;font-weight:800;color:#0A5A5A;letter-spacing:2px">${empresaInfo.nombre}</div>`

    const colorDifBg = dif === 0 ? '#d1fae5' : dif > 0 ? '#fef3c7' : '#fee2e2'
    const colorDifTx = dif === 0 ? '#065f46' : dif > 0 ? '#92400e' : '#991b1b'

    const colorSitBg = r.situacion === 'Completada' ? '#22c55e'
      : r.situacion === 'En Proceso' ? '#3b82f6'
      : r.situacion === 'Cancelada' ? '#dc2626'
      : '#f59e0b'

    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<title>Orden de Producción ${r.consecutivo} — ${r.cliente || ''}</title>
<style>
  @page { size: Letter; margin: 14mm 12mm; }
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#000;font-size:10.5pt;margin:0;line-height:1.5}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0A5A5A;padding-bottom:10px;margin-bottom:14px}
  .head .empresa-info{font-size:9pt;color:#374151;line-height:1.4;margin-top:6px}
  .head .empresa-info strong{color:#0A5A5A;font-size:11pt}
  .head .doc-info{text-align:right}
  .head .doc-info .titulo{background:#0A5A5A;color:#facc15;padding:6px 16px;font-weight:800;letter-spacing:0.1em;border-radius:4px;font-size:11pt;margin-bottom:6px}
  .head .doc-info .consec{font-size:18pt;font-weight:800;color:#0A5A5A;font-family:'SF Mono',Menlo,Consolas,monospace}
  .head .doc-info .estado{display:inline-block;padding:3px 10px;border-radius:4px;font-size:9pt;font-weight:700;margin-top:4px;color:#fff;background:${colorSitBg}}
  .seccion{border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;margin-bottom:10px;background:#f9fafb;page-break-inside:avoid}
  .seccion h3{margin:0 0 8px;color:#0A5A5A;font-size:10pt;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #0A5A5A;padding-bottom:3px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;font-size:10pt}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 18px;font-size:10pt}
  .grid2 .lbl,.grid3 .lbl{color:#6b7280;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.05em;font-weight:700}
  .grid2 .val,.grid3 .val{color:#000;font-weight:600;font-size:10.5pt;margin-bottom:4px}
  .cantidad-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:8px 0}
  .cantidad-box{padding:14px;border-radius:8px;text-align:center}
  .cantidad-box .lbl{font-size:8.5pt;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:4px}
  .cantidad-box .val{font-size:18pt;font-weight:800;font-family:'SF Mono',Menlo,Consolas,monospace}
  .cantidad-box.plan{background:#cffafe;color:#0e7490;border:2px solid #0A5A5A}
  .cantidad-box.prod{background:#e0e7ff;color:#1e3a8a;border:2px solid #3b82f6}
  .cantidad-box.dif{background:${colorDifBg};color:${colorDifTx};border:2px solid ${colorDifTx}}
  table.prods{width:100%;border-collapse:collapse;margin:8px 0;font-size:9.5pt}
  table.prods thead{background:#0A5A5A;color:#fff}
  table.prods th{padding:7px 8px;text-align:left;font-size:9pt;letter-spacing:0.04em}
  table.prods th.num{text-align:right}
  table.prods td{padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  table.prods td.num{text-align:right;font-family:'SF Mono',Menlo,Consolas,monospace}
  table.prods td.mono{font-family:'SF Mono',Menlo,Consolas,monospace}
  table.prods tr:nth-child(even){background:#f9fafb}
  .obs{margin-top:8px;padding:10px 14px;border:1px dashed #9ca3af;border-radius:6px;background:#fffbeb;font-size:10pt}
  .obs .lbl{font-weight:700;color:#92400e;margin-bottom:3px}
  .firmas{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:30px}
  .firma{text-align:center;border-top:1px solid #000;padding-top:5px;font-size:9pt;color:#374151}
  .firma .rol{font-weight:700;color:#0A5A5A;text-transform:uppercase;letter-spacing:0.05em;font-size:8.5pt;margin-bottom:1px}
  .footer{margin-top:18px;padding-top:8px;border-top:1px solid #d1d5db;text-align:center;font-size:8pt;color:#6b7280}
  .spin-badge{background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-family:'SF Mono',Menlo,Consolas,monospace;font-weight:800;font-size:10pt}
  @media print { .no-print{display:none} }
  .no-print{position:fixed;top:10px;right:10px;background:#0A5A5A;color:#fff;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:700;z-index:9999}
</style></head>
<body>
<button class="no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>

<div class="head">
  <div>
    ${logoHtml}
    <div class="empresa-info">
      <strong>${empresaInfo.nombre}</strong><br/>
      ${empresaInfo.tipo_identificacion || 'NIT'}: ${empresaInfo.nro_documento || ''}<br/>
      ${empresaInfo.direccion || ''}${empresaInfo.ciudad ? ' · ' + empresaInfo.ciudad : ''}<br/>
      ${empresaInfo.telefono_oficina ? 'Tel: ' + empresaInfo.telefono_oficina + ' · ' : ''}${empresaInfo.correo || ''}
    </div>
  </div>
  <div class="doc-info">
    <div class="titulo">ORDEN DE PRODUCCIÓN</div>
    <div class="consec">${r.consecutivo}</div>
    <div class="estado">${(r.situacion || '').toUpperCase()}</div>
  </div>
</div>

<div class="seccion">
  <h3>Información de la Orden</h3>
  <div class="grid3">
    <div><div class="lbl">Fecha Emisión</div><div class="val">${fDate(r.fecha_emision)}</div></div>
    <div><div class="lbl">Fecha Programada Inicio</div><div class="val">${fDate(r.fecha_programada_inicio || r.fecha_programada)}</div></div>
    <div><div class="lbl">Fecha Real Inicio</div><div class="val">${fDate(r.fecha_real_inicio)}</div></div>
    <div><div class="lbl">Fecha Real Finalizada</div><div class="val">${fDate(r.fecha_real_finalizada || r.fecha_ejecucion)}</div></div>
    <div><div class="lbl">Responsable</div><div class="val">${r.responsable || '—'}</div></div>
    <div><div class="lbl">Tipo Inventario</div><div class="val">${r.tipo_inventario || 'Producto Terminado'}</div></div>
  </div>
</div>

<div class="seccion">
  <h3>Cliente</h3>
  <div class="grid2">
    <div><div class="lbl">Razón Social</div><div class="val">${r.cliente || '—'}</div></div>
    ${cliObj ? `<div><div class="lbl">${cliObj.tipo_identificacion || 'Identificación'}</div><div class="val">${cliObj.nro_documento}${cliObj.digito_verificacion ? '-' + cliObj.digito_verificacion : ''}</div></div>` : ''}
    ${cliObj?.direccion ? `<div><div class="lbl">Dirección</div><div class="val">${cliObj.direccion}</div></div>` : ''}
    ${cliObj && (cliObj as { ciudad?: string }).ciudad ? `<div><div class="lbl">Ciudad</div><div class="val">${(cliObj as { ciudad?: string }).ciudad}</div></div>` : ''}
  </div>
</div>

<div class="seccion">
  <h3>Producto a Producir</h3>
  <div class="grid2">
    <div><div class="lbl">Código Interno</div><div class="val" style="font-family:'SF Mono',Menlo,Consolas,monospace">${r.producto_terminado_codigo || '—'}</div></div>
    <div><div class="lbl">Cód. SPIN</div><div class="val">${r.producto_terminado_codigo_spin ? `<span class="spin-badge">${r.producto_terminado_codigo_spin}</span>` : '—'}</div></div>
    <div style="grid-column:1 / -1"><div class="lbl">Descripción</div><div class="val" style="font-size:12pt;font-weight:700">${r.producto_terminado_nombre || '—'}</div></div>
  </div>

  <div class="cantidad-grid">
    <div class="cantidad-box plan">
      <div class="lbl">Cantidad Planeada</div>
      <div class="val">${fmt(cantPlan)} kg</div>
    </div>
    <div class="cantidad-box prod">
      <div class="lbl">Cantidad Producida</div>
      <div class="val">${fmt(cantProd)} kg</div>
    </div>
    <div class="cantidad-box dif">
      <div class="lbl">Diferencia</div>
      <div class="val">${fmt(dif)} kg</div>
    </div>
  </div>
</div>

<div class="seccion">
  <h3>Materia Prima Requerida</h3>
  <table class="prods">
    <thead><tr>
      <th>#</th><th>Código</th><th>Descripción</th>
      <th class="num">Cantidad Requerida</th><th class="num">Cantidad Usada</th><th class="num">Diferencia</th>
    </tr></thead>
    <tbody>${filasMP}</tbody>
  </table>
</div>

${r.observaciones ? `<div class="obs"><div class="lbl">Observaciones:</div>${r.observaciones}</div>` : ''}

<div class="firmas">
  <div class="firma"><div class="rol">PREPARADO POR</div>${r.responsable || 'Firma y Sello'}</div>
  <div class="firma"><div class="rol">PRODUCCIÓN</div>Firma y C.C.</div>
  <div class="firma"><div class="rol">CONTROL DE CALIDAD</div>Firma y Sello</div>
</div>

<div class="footer">
  Documento generado el ${new Date().toLocaleString('es-CO')} · ${empresaInfo.nombre}
</div>

<script>setTimeout(function(){window.print()},400)</script>
</body></html>`

    const w = window.open('', '_blank', 'width=900,height=1100')
    if (!w) { alert('Permite ventanas emergentes para generar el PDF.'); return }
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('ordenesProduccion')}</h1>
          <p className="text-white/50 text-sm mt-1">{tSub('produccion')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {permisos.registrar && (
            <button onClick={() => { setForm(initForm()); setFormError(''); setIsFormOpen(!isFormOpen) }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
              {isFormOpen ? 'Cerrar' : '+ Nueva Orden'}
            </button>
          )}
          <div className="flex gap-2 text-sm">
            <span className="px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fff' }}>{ordenes.filter(o => o.situacion === 'Pendiente').length} pendientes</span>
            <span className="px-3 py-1 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#fff' }}>{ordenes.length} total</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <input type="text" placeholder={tPh('buscar')} value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none" style={inputSt} />
      </div>

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-black/20 p-6 rounded-2xl border border-white/10 space-y-4">
          {formError && <div className="text-sm font-semibold px-4 py-2 rounded-lg whitespace-pre-line" style={{ background: 'rgba(239,68,68,0.15)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Nro. Orden</label>
              <input readOnly value={form.consecutivo} className="w-full px-4 py-3 rounded-lg text-lg text-white/50 outline-none cursor-not-allowed font-mono font-bold" style={{ ...inputSt, opacity: 0.6 }} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Fecha Emisión</label>
              <input type="date" value={form.fecha_emision} onChange={e => setForm({ ...form, fecha_emision: e.target.value })} className="w-full px-4 py-3 rounded-lg text-lg text-white outline-none" style={inputSt} />
              {form.fecha_emision && (
                <p className="text-xs text-white/50 mt-1 font-mono">{fDate(form.fecha_emision)}</p>
              )}
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Cliente *</label>
              <select required value={form.cliente_id || ''} onChange={e => handleClienteChange(e.target.value)} className="w-full px-4 py-3 rounded-lg text-lg outline-none" style={selSt}>
                <option value="">{tOp('seleccionarGuion')}</option>
                {clientes
                  .filter(c => (c.situacion || 'Activo').toLowerCase() === 'activo')
                  .sort((a, b) => a.razon_social.localeCompare(b.razon_social))
                  .map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Producto Terminado *</label>
              <select required value={form.producto_terminado_id}
                onChange={e => handleProductoChange(e.target.value)}
                disabled={!form.cliente_id && !form.cliente}
                className="w-full px-4 py-3 rounded-lg text-lg outline-none disabled:opacity-50" style={selSt}>
                <option value="">
                  {!form.cliente_id && !form.cliente
                    ? 'Seleccione primero un cliente'
                    : productosCliente.length === 0
                      ? 'Este cliente no tiene productos terminados'
                      : tOp('seleccionarGuion')}
                </option>
                {productosCliente.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codigo_spin ? `SPIN ${p.codigo_spin} · ` : ''}{p.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Cód. SPIN</label>
              <input readOnly value={form.producto_terminado_codigo_spin || '—'}
                className="w-full px-4 py-3 rounded-lg text-lg text-white font-mono font-bold outline-none"
                style={{ ...inputSt, background: 'rgba(180,83,9,0.18)', borderColor: 'rgba(245,158,11,0.4)' }} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Descripción</label>
              <input readOnly value={form.producto_terminado_nombre || '—'}
                className="w-full px-4 py-3 rounded-lg text-lg text-white/80 outline-none"
                style={{ ...inputSt, opacity: 0.85 }} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Cantidad Kg *</label>
              <input type="text" inputMode="numeric"
                value={form.cantidad_a_producir ? form.cantidad_a_producir.toLocaleString('es-CO') : ''}
                onChange={e => {
                  const soloDigitos = e.target.value.replace(/\D/g, '')
                  const num = soloDigitos ? parseInt(soloDigitos, 10) : 0
                  setForm({ ...form, cantidad_a_producir: num, unidad_medida: 'kg' })
                }}
                className="w-full px-4 py-3 rounded-lg text-lg text-white font-bold outline-none font-mono text-right" style={inputSt} placeholder="0 kg" />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Cantidad Producida</label>
              <input type="text" inputMode="numeric"
                value={form.cantidad_producida ? form.cantidad_producida.toLocaleString('es-CO') : ''}
                onChange={e => {
                  const soloDigitos = e.target.value.replace(/\D/g, '')
                  const num = soloDigitos ? parseInt(soloDigitos, 10) : 0
                  setForm({ ...form, cantidad_producida: num })
                }}
                className="w-full px-4 py-3 rounded-lg text-lg text-white font-bold outline-none font-mono text-right" style={inputSt} placeholder="0 kg" />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Diferencia</label>
              {(() => {
                const dif = (form.cantidad_a_producir || 0) - (form.cantidad_producida || 0)
                const colorBg = dif === 0
                  ? 'rgba(34,197,94,0.18)'
                  : dif > 0
                    ? 'rgba(245,158,11,0.18)'
                    : 'rgba(239,68,68,0.18)'
                const colorTx = dif === 0 ? '#86efac' : dif > 0 ? '#fbbf24' : '#fca5a5'
                const colorBd = dif === 0
                  ? 'rgba(34,197,94,0.4)'
                  : dif > 0
                    ? 'rgba(245,158,11,0.4)'
                    : 'rgba(239,68,68,0.4)'
                return (
                  <input readOnly
                    value={`${dif.toLocaleString('es-CO')} kg`}
                    className="w-full px-4 py-3 rounded-lg text-lg font-extrabold outline-none font-mono text-right"
                    style={{ background: colorBg, color: colorTx, border: `1px solid ${colorBd}` }} />
                )
              })()}
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Fecha Programada Inicio</label>
              <input type="date" value={form.fecha_programada_inicio || ''}
                onChange={e => setForm({ ...form, fecha_programada_inicio: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-lg text-white outline-none" style={inputSt} />
              {form.fecha_programada_inicio && (
                <p className="text-xs text-white/50 mt-1 font-mono">{fDate(form.fecha_programada_inicio)}</p>
              )}
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Fecha Real Inicio</label>
              <input type="date" value={form.fecha_real_inicio || ''}
                onChange={e => setForm({ ...form, fecha_real_inicio: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-lg text-white outline-none" style={inputSt} />
              {form.fecha_real_inicio && (
                <p className="text-xs text-white/50 mt-1 font-mono">{fDate(form.fecha_real_inicio)}</p>
              )}
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Fecha Real Finalizada</label>
              <input type="date" value={form.fecha_real_finalizada || ''}
                onChange={e => setForm({ ...form, fecha_real_finalizada: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-lg text-white outline-none" style={inputSt} />
              {form.fecha_real_finalizada && (
                <p className="text-xs text-white/50 mt-1 font-mono">{fDate(form.fecha_real_finalizada)}</p>
              )}
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Responsable</label>
              <select value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })} className="w-full px-4 py-3 rounded-lg text-lg outline-none" style={selSt}>
                <option value="">{tOp('seleccionarGuion')}</option>
                {personalList.map(p => <option key={p.id} value={`${p.nombre} ${p.apellido}`}>{p.nombre} {p.apellido}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
              <select value={form.situacion} onChange={e => setForm({ ...form, situacion: e.target.value })} className="w-full px-4 py-3 rounded-lg text-lg outline-none" style={selSt}>
                <option value="Pendiente">Pendiente</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Completada">Completada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          {/* Líneas de materia prima */}
          {form.lineas.length > 0 && (
            <div>
              <label className="block text-xl font-extrabold text-white mb-2 uppercase">Materia Prima Requerida</label>
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-base text-white">
                  <thead className="bg-white/5 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Código</th>
                      <th className="px-4 py-2 text-left">Descripción</th>
                      <th className="px-4 py-2 text-right">Cantidad Req.</th>
                      <th className="px-4 py-2 text-left">Unidad</th>
                      <th className="px-4 py-2 text-right">Stock Actual</th>
                      <th className="px-4 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lineas.map(l => {
                      const prod = productos.find(p => p.id === l.producto_id)
                      const stock = prod?.existencia || 0
                      const ok = stock >= l.cantidad_requerida
                      return (
                        <tr key={l.id} className="border-t border-white/5">
                          <td className="px-4 py-2 font-mono text-xs">{l.codigo}</td>
                          <td className="px-4 py-2">{l.descripcion}</td>
                          <td className="px-4 py-2 text-right font-bold">{l.cantidad_requerida}</td>
                          <td className="px-4 py-2">{l.unidad_medida}</td>
                          <td className="px-4 py-2 text-right">{stock}</td>
                          <td className="px-4 py-2 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={ok ? { background: 'rgba(34,197,94,0.95)', color: '#fff' } : { background: 'rgba(239,68,68,0.95)', color: '#fff' }}>
                              {ok ? '✓ OK' : '✗ Falta'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="w-full px-4 py-3 rounded-lg text-lg text-white outline-none resize-none" style={inputSt} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>{form.id ? 'Actualizar' : 'Guardar'}</button>
            <button type="button" onClick={() => { setIsFormOpen(false); setForm(initForm()) }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all">{tBtn('cancel')}</button>
          </div>
        </form>
      )}

      {/* Tabla */}
      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/80">
            <thead className="text-xs uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-4">Nro.</th>
                <th className="px-4 py-4">Fecha</th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Cód. SPIN</th>
                <th className="px-4 py-4">Producto</th>
                <th className="px-4 py-4 text-right">Cantidad Kg</th>
                <th className="px-4 py-4">Responsable</th>
                <th className="px-4 py-4">Situación</th>
                <th className="px-4 py-4 text-right">{tTbl('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="px-6 py-12 text-center text-white/30">{tE('noOrdenesProduccion')}</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono font-bold text-white">{r.consecutivo}</td>
                  <td className="px-4 py-3">{fDate(r.fecha_emision)}</td>
                  <td className="px-4 py-3 text-white/80">{r.cliente || '—'}</td>
                  <td className="px-4 py-3 font-mono text-amber-300 font-bold">{r.producto_terminado_codigo_spin || '—'}</td>
                  <td className="px-4 py-3">{r.producto_terminado_nombre}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">{Math.floor(r.cantidad_a_producir || 0).toLocaleString('es-CO')} kg</td>
                  <td className="px-4 py-3">{r.responsable || '—'}</td>
                  <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-full text-xs font-bold" style={sitStyle(r.situacion)}>{r.situacion}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setViewRecord(r)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105"
                        style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)', boxShadow: '0 2px 6px rgba(59,130,246,0.35)' }}>
                        Ver
                      </button>
                      <button onClick={() => imprimirOrden(r)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105"
                        style={{ background: 'rgba(220,38,38,1)', border: '1px solid rgba(185,28,28,1)', boxShadow: '0 2px 6px rgba(220,38,38,0.35)' }}
                        title="Generar PDF e imprimir">
                        📄 PDF
                      </button>
                      {permisos.editar && (
                        <button onClick={() => openEdit(r)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105"
                          style={{ background: 'rgba(245,158,11,1)', border: '1px solid rgba(217,119,6,1)', boxShadow: '0 2px 6px rgba(245,158,11,0.35)' }}>
                          {tBtn('edit')}
                        </button>
                      )}
                      {permisos.eliminar && (
                        <button onClick={() => handleDelete(r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105"
                          style={{ background: 'rgba(220,38,38,1)', border: '1px solid rgba(185,28,28,1)', boxShadow: '0 2px 6px rgba(220,38,38,0.35)' }}>
                          {tBtn('delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewRecord && (() => {
        const cantPlan = Math.floor(viewRecord.cantidad_a_producir || 0)
        const cantProd = Math.floor(viewRecord.cantidad_producida || 0)
        const dif = cantPlan - cantProd
        const colorDif = dif === 0
          ? { bg: 'rgba(34,197,94,0.18)', tx: '#86efac', bd: 'rgba(34,197,94,0.5)' }
          : dif > 0
            ? { bg: 'rgba(245,158,11,0.18)', tx: '#fbbf24', bd: 'rgba(245,158,11,0.5)' }
            : { bg: 'rgba(239,68,68,0.18)', tx: '#fca5a5', bd: 'rgba(239,68,68,0.5)' }
        const fld = (lbl: string, val: React.ReactNode) => (
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs uppercase tracking-wider mb-1 font-bold" style={{ color: '#f97316' }}>{lbl}</p>
            <div className="text-white font-bold text-sm">{val ?? '—'}</div>
          </div>
        )
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
              style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-extrabold text-white">📋 Orden de Producción · <span className="font-mono text-blue-300">{viewRecord.consecutivo}</span></h2>
                <button onClick={() => setViewRecord(null)} className="text-white/40 hover:text-white text-3xl transition-colors leading-none">&times;</button>
              </div>

              {/* Información general */}
              <h3 className="text-sm font-extrabold uppercase mb-2" style={{ color: '#fbbf24' }}>📅 Fechas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {fld('Fecha Emisión', fDate(viewRecord.fecha_emision))}
                {fld('Programada Inicio', fDate(viewRecord.fecha_programada_inicio || viewRecord.fecha_programada))}
                {fld('Real Inicio', fDate(viewRecord.fecha_real_inicio))}
                {fld('Real Finalizada', fDate(viewRecord.fecha_real_finalizada || viewRecord.fecha_ejecucion))}
              </div>

              <h3 className="text-sm font-extrabold uppercase mb-2" style={{ color: '#fbbf24' }}>🏢 Cliente y Producto</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {fld('Cliente', viewRecord.cliente)}
                {fld('Cód. SPIN', <span className="font-mono text-amber-300">{viewRecord.producto_terminado_codigo_spin || '—'}</span>)}
                {fld('Producto Terminado', viewRecord.producto_terminado_nombre)}
              </div>

              <h3 className="text-sm font-extrabold uppercase mb-2" style={{ color: '#fbbf24' }}>⚖️ Cantidades</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(6,182,212,0.15)', border: '2px solid rgba(6,182,212,0.4)' }}>
                  <p className="text-xs uppercase font-bold mb-1" style={{ color: '#22d3ee' }}>Cantidad Planeada</p>
                  <p className="text-2xl font-extrabold font-mono text-cyan-200">{cantPlan.toLocaleString('es-CO')} kg</p>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.4)' }}>
                  <p className="text-xs uppercase font-bold mb-1" style={{ color: '#a5b4fc' }}>Cantidad Producida</p>
                  <p className="text-2xl font-extrabold font-mono text-indigo-200">{cantProd.toLocaleString('es-CO')} kg</p>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: colorDif.bg, border: `2px solid ${colorDif.bd}` }}>
                  <p className="text-xs uppercase font-bold mb-1" style={{ color: colorDif.tx }}>Diferencia</p>
                  <p className="text-2xl font-extrabold font-mono" style={{ color: colorDif.tx }}>{dif.toLocaleString('es-CO')} kg</p>
                </div>
              </div>

              <h3 className="text-sm font-extrabold uppercase mb-2" style={{ color: '#fbbf24' }}>👤 Responsable y Estado</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                {fld('Responsable', viewRecord.responsable)}
                {fld('Tipo Inventario', viewRecord.tipo_inventario || 'Producto Terminado')}
                {fld('Situación',
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold inline-block" style={sitStyle(viewRecord.situacion)}>{viewRecord.situacion}</span>
                )}
              </div>

              {/* ── Tabla de Materia Prima Requerida ── */}
              <h3 className="text-sm font-extrabold uppercase mb-2" style={{ color: '#86efac' }}>🧪 Materia Prima Requerida</h3>
              <div className="rounded-xl overflow-hidden mb-4" style={{ background: 'rgba(34,197,94,0.05)', border: '2px solid rgba(34,197,94,0.25)' }}>
                {viewRecord.lineas.length === 0 ? (
                  <div className="px-4 py-8 text-center text-white/40">— Sin materias primas asignadas —</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead style={{ background: 'rgba(34,197,94,0.18)' }}>
                      <tr className="text-left text-white">
                        <th className="px-3 py-2 font-extrabold uppercase text-xs">#</th>
                        <th className="px-3 py-2 font-extrabold uppercase text-xs">Código</th>
                        <th className="px-3 py-2 font-extrabold uppercase text-xs">Descripción</th>
                        <th className="px-3 py-2 font-extrabold uppercase text-xs text-center">Unidad</th>
                        <th className="px-3 py-2 font-extrabold uppercase text-xs text-right">Cant. Requerida</th>
                        <th className="px-3 py-2 font-extrabold uppercase text-xs text-right">Cant. Usada</th>
                        <th className="px-3 py-2 font-extrabold uppercase text-xs text-right">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewRecord.lineas.map((l, i) => {
                        const reqL = l.cantidad_requerida || 0
                        const usaL = l.cantidad_usada || 0
                        const difL = reqL - usaL
                        const colDif = difL === 0
                          ? { bg: 'rgba(34,197,94,0.18)', tx: '#86efac' }
                          : difL > 0
                            ? { bg: 'rgba(245,158,11,0.18)', tx: '#fbbf24' }
                            : { bg: 'rgba(239,68,68,0.18)', tx: '#fca5a5' }
                        return (
                          <tr key={l.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <td className="px-3 py-2 text-white/60 font-mono">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-white font-bold">{l.codigo}</td>
                            <td className="px-3 py-2 text-white/85">{l.descripcion}</td>
                            <td className="px-3 py-2 text-center text-white/70 font-bold">{l.unidad_medida || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-white font-bold">{reqL.toLocaleString('es-CO', { maximumFractionDigits: 4 })}</td>
                            <td className="px-3 py-2 text-right font-mono text-white font-bold">{usaL.toLocaleString('es-CO', { maximumFractionDigits: 4 })}</td>
                            <td className="px-3 py-2 text-right font-mono font-extrabold" style={{ background: colDif.bg, color: colDif.tx }}>
                              {difL.toLocaleString('es-CO', { maximumFractionDigits: 4 })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Observaciones */}
              {viewRecord.observaciones && (
                <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px dashed rgba(245,158,11,0.4)' }}>
                  <p className="text-xs uppercase tracking-wider mb-1 font-bold" style={{ color: '#fbbf24' }}>Observaciones</p>
                  <p className="text-white text-sm whitespace-pre-wrap">{viewRecord.observaciones}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={() => imprimirOrden(viewRecord)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                  style={{ background: 'rgba(220,38,38,1)', border: '1px solid rgba(185,28,28,1)', boxShadow: '0 2px 6px rgba(220,38,38,0.35)' }}>
                  📄 Generar PDF
                </button>
                <button onClick={() => setViewRecord(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                  style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)', boxShadow: '0 2px 6px rgba(59,130,246,0.35)' }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
