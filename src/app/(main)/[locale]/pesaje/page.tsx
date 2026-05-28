'use client'

import { useState, useMemo } from 'react'
import { usePesajeStore, type Pesaje } from '@/features/pesaje/store/pesaje-store'
import { nextPesajeConsecutivo, calcularPesoNeto } from '@/features/pesaje/lib/helpers'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useOrdenesStore } from '@/features/ordenes-compra/store/ordenes-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { todayColombia, fDate } from '@/shared/lib/format-date'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'

function generatePesajePDF(p: Pesaje, empresaInfo?: { nombre?: string; tipo_identificacion: string; nro_documento: string; direccion: string; ciudad: string }, empresaLogo: string = LOGO_BASE64, autoPrint: boolean = true) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Pesaje ${p.consecutivo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:14px; color:#000; background:#fff; padding:32px; font-weight:700; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:4px solid #000; }
    .company { font-size:24px; font-weight:900; color:#000; line-height:1.15; white-space:nowrap; }
    .doc-title { text-align:right; }
    .doc-title h2 { font-size:22px; font-weight:900; color:#000; margin-bottom:2px; }
    .doc-title .consecutivo { font-size:18px; font-family:monospace; font-weight:900; color:#000; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:900; background:#000; color:#fff; margin-top:6px; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:18px; padding:16px; background:#eef2ff; border-radius:8px; border:2px solid #000; }
    .field label { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#000; font-weight:900; display:block; margin-bottom:3px; }
    .field span { font-weight:900; color:#000; font-size:14px; }
    .section-title { font-size:13px; text-transform:uppercase; font-weight:900; color:#000; margin:18px 0 8px; padding-bottom:4px; border-bottom:2px solid #000; letter-spacing:.06em; }
    .peso-grid { display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:16px; margin-bottom:18px; }
    .peso-box { padding:18px; border:3px solid #000; border-radius:10px; text-align:center; }
    .peso-box .peso-label { font-size:12px; text-transform:uppercase; font-weight:900; color:#000; letter-spacing:.08em; margin-bottom:6px; }
    .peso-box .peso-value { font-size:26px; font-weight:900; color:#000; font-family:monospace; }
    .peso-box .peso-unit { font-size:11px; color:#000; font-weight:700; margin-top:2px; }
    .peso-primera { background:#fecaca; border-color:#b91c1c; }
    .peso-primera .peso-label, .peso-primera .peso-value, .peso-primera .peso-unit { color:#000; }
    .peso-segunda { background:#fef08a; border-color:#a16207; }
    .peso-segunda .peso-label, .peso-segunda .peso-value, .peso-segunda .peso-unit { color:#000; }
    .peso-neto { background:#bbf7d0; border:4px solid #15803d; }
    .peso-neto .peso-label, .peso-neto .peso-value, .peso-neto .peso-unit { color:#000; }
    .peso-neto .peso-value { font-size:32px; }
    .obs { border:2.5px solid #000; border-radius:8px; overflow:hidden; margin-bottom:18px; }
    .obs-label { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:#fff; background:#000; padding:8px 14px; font-weight:900; }
    .obs-content { padding:12px 14px; font-size:14px; color:#000; font-weight:700; background:#f8fafc; min-height:40px; }
    .footer { margin-top:40px; display:flex; justify-content:space-between; }
    .sign-box { text-align:center; }
    .sign-line { width:180px; border-top:2.5px solid #000; margin:0 auto 6px; padding-top:6px; font-size:12px; font-weight:900; color:#000; }
    @media print { body { padding:16px; } }
  </style></head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="${empresaLogo}" style="width:200px;height:200px;border-radius:14px;object-fit:contain;background:#fff;padding:10px;" />
      <div>
        <div class="company">${empresaInfo?.nombre || 'EMPRESA'}</div>
        ${empresaInfo ? `<div style="font-size:14px;color:#000;font-weight:900;margin-top:6px;line-height:1.5">${empresaInfo.tipo_identificacion}: ${empresaInfo.nro_documento}<br/>${empresaInfo.direccion || ''}${empresaInfo.ciudad ? `, ${empresaInfo.ciudad}` : ''}</div>` : ''}
      </div>
    </div>
    <div class="doc-title">
      <h2>RECEPCIÓN MATERIA PRIMA</h2>
      <div class="consecutivo">${p.consecutivo}</div>
      <div class="badge">${p.estado}</div>
    </div>
  </div>

  <div class="grid">
    <div class="field"><label>Fecha Registro</label><span>${fDate(p.fecha_registro)}</span></div>
    <div class="field"><label>N° Documento</label><span>${p.nro_documento}</span></div>
    <div class="field"><label>Fecha Emisión</label><span>${fDate(p.fecha_emision)}</span></div>
    <div class="field"><label>Proveedor</label><span>${p.proveedor}</span></div>
    <div class="field"><label>Orden de Compra</label><span>${p.orden_compra_consecutivo || '—'}</span></div>
    <div class="field"><label>Producto / Materia Prima</label><span>${p.producto_materia_prima}</span></div>
  </div>

  <div class="section-title">🚛 Datos del Vehículo</div>
  <div class="grid">
    <div class="field"><label>Placas</label><span>${p.placas}</span></div>
    <div class="field"><label>Modelo</label><span>${p.modelo || '—'}</span></div>
    <div class="field"><label>Descripción</label><span>${p.descripcion || '—'}</span></div>
  </div>

  <div class="section-title">👤 Datos del Conductor</div>
  <div class="grid">
    <div class="field"><label>Cédula</label><span>${p.cedula_conductor}</span></div>
    <div class="field" style="grid-column:span 2"><label>Nombre Completo</label><span>${p.nombre_conductor}</span></div>
  </div>

  <div class="section-title">⚖️ Pesaje</div>
  <div class="peso-grid">
    <div class="peso-box peso-primera">
      <div class="peso-label">Primera Pesada</div>
      <div class="peso-value">${p.primera_pesada.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="peso-unit">Kilogramos</div>
    </div>
    <div class="peso-box peso-segunda">
      <div class="peso-label">Segunda Pesada</div>
      <div class="peso-value">${p.segunda_pesada.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="peso-unit">Kilogramos</div>
    </div>
    <div class="peso-box peso-neto">
      <div class="peso-label">Peso Neto</div>
      <div class="peso-value">${p.peso_neto.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="peso-unit">Kilogramos</div>
    </div>
  </div>

  ${p.nro_lote ? `<div class="obs" style="background:#fef3c7;border-left:5px solid #f59e0b"><div class="obs-label" style="color:#92400e">Nro. Lote Proveedor</div><div class="obs-content" style="font-family:monospace;font-weight:800;color:#92400e">${p.nro_lote}</div></div>` : ''}

  ${p.observaciones ? `<div class="obs"><div class="obs-label">Observaciones</div><div class="obs-content">${p.observaciones}</div></div>` : ''}

  <div class="footer">
    <div class="sign-box"><div class="sign-line">Operador Báscula</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
    <div class="sign-box"><div class="sign-line">Conductor</div><div style="font-size:11px;font-weight:700;color:#000">${p.nombre_conductor}</div></div>
    <div class="sign-box"><div class="sign-line">Recibido / Autorizado</div><div style="font-size:11px;font-weight:700;color:#000">_______________</div></div>
  </div>

  ${autoPrint ? `<script>window.onload=()=>{window.print()}<\/script>` : ''}
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
}

export default function PesajePage() {
  const permisos = usePermisos('pesaje')
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const today = todayColombia()

  const { pesajes: todosPesajes, addPesaje, updatePesaje, deletePesaje } = usePesajeStore()
  // Filtra por tipo activo, pero también incluye registros legacy sin tipo asignado
  const pesajes = tipoActivo
    ? todosPesajes.filter(p => !p.tipo_inventario || p.tipo_inventario === tipoActivo)
    : todosPesajes
  const proveedores = useProveedoresStore(s => s.proveedores).filter(p => p.situacion === 'Activo')
  const ordenes = useOrdenesStore(s => s.ordenes)
  const productos = useProductosStore(s => s.productos)
  const empresas = useEmpresaStore(s => s.empresas)
  const emp = empresas[0]
  const empData = emp ? { nombre: emp.nombre, tipo_identificacion: emp.tipo_identificacion, nro_documento: emp.nro_documento, direccion: emp.direccion, ciudad: emp.ciudad } : undefined

  // ─── State Form ───────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewItem, setViewItem] = useState<Pesaje | null>(null)
  const [nroDoc, setNroDoc] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [ocId, setOcId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [placas, setPlacas] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [modelo, setModelo] = useState('')
  const [cedulaCond, setCedulaCond] = useState('')
  const [nombreCond, setNombreCond] = useState('')
  const [primeraPesada, setPrimeraPesada] = useState('')
  const [segundaPesada, setSegundaPesada] = useState('')
  const [nroLote, setNroLote] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }
  const selectSt: React.CSSProperties = { background: '#083d3d', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }
  const readOnlySt: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'not-allowed' }

  // Peso neto en vivo
  const pesoNetoLive = useMemo(() => calcularPesoNeto(Number(primeraPesada), Number(segundaPesada)), [primeraPesada, segundaPesada])

  // Filtrado de OCs por proveedor seleccionado (si aplica)
  const ocsFiltradas = useMemo(() => {
    return ordenes
      .filter(o => o.situacion !== 'Anulada')
      .filter(o => !proveedor || o.proveedor === proveedor)
      .filter(o => !tipoActivo || o.tipo_inventario === tipoActivo)
  }, [ordenes, proveedor, tipoActivo])

  // Filtrado de productos (materia prima → tipo activo)
  const productosFiltrados = useMemo(() => {
    return productos.filter(p => !tipoActivo || p.tipo_inventario === tipoActivo)
  }, [productos, tipoActivo])

  const abrirNuevo = () => {
    setEditId(null)
    setNroDoc('')
    setFechaEmision(today)
    setProveedor('')
    setOcId('')
    setProductoId('')
    setPlacas('')
    setDescripcion('')
    setModelo('')
    setCedulaCond('')
    setNombreCond('')
    setPrimeraPesada('')
    setSegundaPesada('')
    setNroLote('')
    setObservaciones('')
    setError('')
    setOpen(true)
  }

  const editar = (p: Pesaje) => {
    setEditId(p.id)
    setNroDoc(p.nro_documento)
    setFechaEmision(p.fecha_emision)
    setProveedor(p.proveedor)
    setOcId(p.orden_compra_id)
    setProductoId(p.producto_id)
    setPlacas(p.placas)
    setDescripcion(p.descripcion)
    setModelo(p.modelo)
    setCedulaCond(p.cedula_conductor)
    setNombreCond(p.nombre_conductor)
    setPrimeraPesada(String(p.primera_pesada))
    setSegundaPesada(String(p.segunda_pesada))
    setNroLote(p.nro_lote || '')
    setObservaciones(p.observaciones)
    setError('')
    setOpen(true)
  }

  const anular = (p: Pesaje) => {
    if (p.estado === 'Anulado') return
    if (!confirm(`¿Anular el pesaje ${p.consecutivo} (placas ${p.placas})?`)) return
    updatePesaje(p.id, { estado: 'Anulado' })
  }

  const eliminar = (p: Pesaje) => {
    if (!confirm(`¿Eliminar definitivamente el pesaje ${p.consecutivo}? Esta acción es irreversible.`)) return
    deletePesaje(p.id)
  }

  const guardar = () => {
    setError('')
    if (!fechaEmision) { setError('Indica la Fecha de Emisión.'); return }
    if (!nroDoc.trim()) { setError('Indica el N° de Documento.'); return }
    if (!proveedor) { setError('Selecciona un Proveedor.'); return }
    if (!productoId) { setError('Selecciona el Producto de Materia Prima.'); return }
    if (!placas.trim()) { setError('Indica las Placas del vehículo.'); return }
    if (!cedulaCond.trim()) { setError('Indica la Cédula del Conductor.'); return }
    if (!nombreCond.trim()) { setError('Indica el Nombre del Conductor.'); return }
    const p1 = Number(primeraPesada)
    const p2 = Number(segundaPesada)
    if (!primeraPesada || isNaN(p1) || p1 < 0) { setError('Indica una Primera Pesada válida (Kg).'); return }
    if (!segundaPesada || isNaN(p2) || p2 < 0) { setError('Indica una Segunda Pesada válida (Kg).'); return }
    if (p1 === p2) { setError('La Primera y Segunda Pesada no pueden ser iguales.'); return }

    const oc = ordenes.find(o => o.id === ocId)
    const prod = productos.find(p => p.id === productoId)
    if (!prod) { setError('El producto seleccionado no existe.'); return }

    const datos = {
      nro_documento: nroDoc.trim(),
      fecha_emision: fechaEmision,
      proveedor,
      orden_compra_id: ocId,
      orden_compra_consecutivo: oc?.consecutivo || '',
      producto_id: productoId,
      producto_materia_prima: prod.descripcion || prod.codigo || '',
      placas: placas.trim().toUpperCase(),
      descripcion: descripcion.trim(),
      modelo: modelo.trim(),
      cedula_conductor: cedulaCond.trim(),
      nombre_conductor: nombreCond.trim(),
      primera_pesada: p1,
      segunda_pesada: p2,
      peso_neto: calcularPesoNeto(p1, p2),
      nro_lote: nroLote.trim(),
      observaciones: observaciones.trim(),
    }

    if (editId) {
      updatePesaje(editId, datos)
    } else {
      const nro = todosPesajes.reduce((m, p) => Math.max(m, p.nro_correlativo || 0), 0) + 1
      const nuevo: Pesaje = {
        id: crypto.randomUUID(),
        nro_correlativo: nro,
        consecutivo: nextPesajeConsecutivo(todosPesajes),
        fecha_registro: today,
        ...datos,
        tipo_inventario: tipoActivo || '',
        estado: 'Registrado',
      }
      addPesaje(nuevo)
    }
    setOpen(false)
  }

  // Filtrado de tabla por búsqueda
  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pesajes
    return pesajes.filter(p =>
      p.consecutivo.toLowerCase().includes(q) ||
      p.placas.toLowerCase().includes(q) ||
      p.proveedor.toLowerCase().includes(q) ||
      p.nombre_conductor.toLowerCase().includes(q) ||
      p.cedula_conductor.toLowerCase().includes(q) ||
      p.nro_documento.toLowerCase().includes(q)
    )
  }, [pesajes, search])

  if (!permisos.leer) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/60 text-lg">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Recepción Materia Prima</h1>
          <p className="text-white/50 mt-1">Control de pesaje de materia prima entrante</p>
        </div>
        {permisos.editar && (
          <button onClick={abrirNuevo} className="px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            + Nuevo Pesaje
          </button>
        )}
      </div>

      {/* Búsqueda */}
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por consecutivo, placa, proveedor, conductor..."
          className="w-full max-w-md rounded-xl px-4 py-2 outline-none text-base text-white font-bold" style={inputSt} />
      </div>

      <p className="text-white/60 text-sm mb-3">{filtrados.length} pesaje(s) registrado(s)</p>

      {/* Tabla */}
      <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <table className="w-full text-base text-left">
          <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
            <tr>
              {['Consecutivo','Fecha Reg.','Nro Doc','Fecha Emisión','Proveedor','OC','Producto','Placas','Conductor','Estado','Acciones'].map(h => (
                <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={11} className="px-6 py-12 text-center text-white/30">No hay pesajes registrados. Crea el primero con <strong>+ Nuevo Pesaje</strong>.</td></tr>
            ) : filtrados.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3 font-mono font-bold text-blue-300 whitespace-nowrap">{p.consecutivo}</td>
                <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(p.fecha_registro)}</td>
                <td className="px-3 py-3 text-white font-bold">{p.nro_documento}</td>
                <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(p.fecha_emision)}</td>
                <td className="px-3 py-3 text-white font-bold">{p.proveedor}</td>
                <td className="px-3 py-3 font-mono text-white font-bold">{p.orden_compra_consecutivo || '—'}</td>
                <td className="px-3 py-3 text-white font-bold max-w-xs truncate" title={p.producto_materia_prima}>{p.producto_materia_prima}</td>
                <td className="px-3 py-3 font-mono text-white font-bold whitespace-nowrap">{p.placas}</td>
                <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{p.nombre_conductor}</td>
                <td className="px-3 py-3">
                  <span className="px-2 py-1 rounded-md text-xs font-bold" style={
                    p.estado === 'Registrado'
                      ? { background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' }
                      : { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }
                  }>{p.estado}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setViewItem(p)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Ver</button>
                    <button onClick={() => generatePesajePDF(p, empData, emp?.logo || undefined, false)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(168,85,247,0.95)', border: '1px solid rgba(147,51,234,1)' }} title="Generar PDF">📄 PDF</button>
                    <button onClick={() => generatePesajePDF(p, empData, emp?.logo || undefined, true)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(20,184,166,0.95)', border: '1px solid rgba(13,148,136,1)' }} title="Imprimir">🖨 Imprimir</button>
                    {permisos.editar && p.estado === 'Registrado' && <button onClick={() => editar(p)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(96,165,250,0.95)', border: '1px solid rgba(96,165,250,0.3)' }}>Editar</button>}
                    {permisos.editar && p.estado === 'Registrado' && <button onClick={() => anular(p)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(251,191,36,0.95)', border: '1px solid rgba(251,191,36,0.3)' }}>Anular</button>}
                    {permisos.eliminar && <button onClick={() => eliminar(p)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(239,68,68,0.95)', border: '1px solid rgba(239,68,68,0.3)' }}>Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL VER (read-only) */}
      {viewItem && (
        <div className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center p-4" style={{ left: '16rem', background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-3xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto" style={{ background: '#0A5A5A', border: '2px solid rgba(255,255,255,0.25)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">⚖️ Detalle del Pesaje <span className="font-mono text-blue-300 text-sm">— {viewItem.consecutivo}</span></h2>
              <button onClick={() => setViewItem(null)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Consecutivo</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.consecutivo}</div>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Fecha Registro</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{fDate(viewItem.fecha_registro)}</div>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">N° Documento</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.nro_documento}</div>
              </div>

              <div>
                <label className="block text-base font-extrabold text-white mb-1">Fecha Emisión</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{fDate(viewItem.fecha_emision)}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-base font-extrabold text-white mb-1">Proveedor</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.proveedor}</div>
              </div>

              <div>
                <label className="block text-base font-extrabold text-white mb-1">Orden de Compra</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.orden_compra_consecutivo || '—'}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-base font-extrabold text-white mb-1">Producto Materia Prima</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.producto_materia_prima}</div>
              </div>

              <div className="md:col-span-3 mt-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="text-sm font-bold tracking-wide text-amber-300 uppercase">🚛 Vehículo</h3>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Placas</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono uppercase" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.placas}</div>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Modelo</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.modelo || '—'}</div>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Descripción</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.descripcion || '—'}</div>
              </div>

              <div className="md:col-span-3 mt-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="text-sm font-bold tracking-wide text-amber-300 uppercase">👤 Conductor</h3>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Cédula</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.cedula_conductor}</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-base font-extrabold text-white mb-1">Nombre</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.nombre_conductor}</div>
              </div>

              <div className="md:col-span-3 mt-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="text-sm font-bold tracking-wide text-emerald-300 uppercase">⚖️ Pesaje (Kg)</h3>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Primera Pesada</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono text-right" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.primera_pesada.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Segunda Pesada</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono text-right" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.segunda_pesada.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Peso Neto</label>
                <div className="rounded-xl px-3 py-2 text-base font-mono text-right font-extrabold" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#86efac' }}>{viewItem.peso_neto.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Nro. Lote Proveedor</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.nro_lote || '—'}</div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-base font-extrabold text-white mb-1">Observaciones</label>
                <div className="rounded-xl px-3 py-2 text-base text-white font-bold whitespace-pre-wrap" style={{ background: 'rgba(255,255,255,0.06)', minHeight: '50px' }}>{viewItem.observaciones || '—'}</div>
              </div>

              <div>
                <label className="block text-base font-extrabold text-white mb-1">Estado</label>
                <span className="px-3 py-1 rounded-md text-sm font-bold" style={
                  viewItem.estado === 'Registrado'
                    ? { background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' }
                    : { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }
                }>{viewItem.estado}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => generatePesajePDF(viewItem, empData, emp?.logo || undefined, false)} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(168,85,247,0.95)', border: '1px solid rgba(147,51,234,1)' }}>📄 Generar PDF</button>
              <button onClick={() => generatePesajePDF(viewItem, empData, emp?.logo || undefined, true)} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(20,184,166,0.95)', border: '1px solid rgba(13,148,136,1)' }}>🖨 Imprimir PDF</button>
              <button onClick={() => setViewItem(null)} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {open && (
        <div className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center p-4" style={{ left: '16rem', background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-4xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto" style={{ background: '#0A5A5A', border: '2px solid rgba(255,255,255,0.25)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">⚖️ {editId ? 'Editar Pesaje' : 'Nuevo Pesaje'} {!editId && <span className="font-mono text-blue-300 text-sm">— {nextPesajeConsecutivo(todosPesajes)}</span>}</h2>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Encabezado del documento */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Consecutivo (auto)</label>
                <input readOnly value={editId ? pesajes.find(p => p.id === editId)?.consecutivo || '' : nextPesajeConsecutivo(todosPesajes)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Fecha Registro (auto)</label>
                <input readOnly value={fDate(today)} className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">N° Documento *</label>
                <input value={nroDoc} onChange={e => setNroDoc(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Remisión / Vale" />
              </div>

              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Fecha Emisión *</label>
                <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl font-extrabold text-white mb-1">Proveedor *</label>
                <select value={proveedor} onChange={e => { setProveedor(e.target.value); setOcId('') }}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xl font-extrabold text-white mb-1">Orden de Compra</label>
                <select value={ocId} onChange={e => setOcId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">— Ninguna —</option>
                  {ocsFiltradas.map(o => <option key={o.id} value={o.id}>{o.consecutivo} · {o.proveedor}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Producto Materia Prima *</label>
                <select value={productoId} onChange={e => setProductoId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  {productosFiltrados.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.descripcion}</option>)}
                </select>
              </div>

              {/* Vehículo */}
              <div className="md:col-span-3 mt-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="text-sm font-bold tracking-wide text-amber-300 uppercase">🚛 Vehículo</h3>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Placas *</label>
                <input value={placas} onChange={e => setPlacas(e.target.value.toUpperCase())}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono uppercase" style={inputSt} placeholder="ABC123" />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Modelo</label>
                <input value={modelo} onChange={e => setModelo(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Ej. 2018" />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Descripción</label>
                <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Tipo de vehículo / carga" />
              </div>

              {/* Conductor */}
              <div className="md:col-span-3 mt-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="text-sm font-bold tracking-wide text-amber-300 uppercase">👤 Conductor</h3>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Cédula Conductor *</label>
                <input value={cedulaCond} onChange={e => setCedulaCond(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={inputSt} placeholder="1.234.567.890" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl font-extrabold text-white mb-1">Nombre Conductor *</label>
                <input value={nombreCond} onChange={e => setNombreCond(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Nombre completo" />
              </div>

              {/* Pesaje */}
              <div className="md:col-span-3 mt-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="text-sm font-bold tracking-wide text-emerald-300 uppercase">⚖️ Pesaje (Kg)</h3>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Primera Pesada (Kg) *</label>
                <input type="number" step="0.01" min="0" value={primeraPesada} onChange={e => setPrimeraPesada(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Segunda Pesada (Kg) *</label>
                <input type="number" step="0.01" min="0" value={segundaPesada} onChange={e => setSegundaPesada(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Peso Neto (Kg) — auto</label>
                <input readOnly value={pesoNetoLive.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base font-mono text-right font-extrabold" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#86efac' }} />
              </div>

              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Nro. Lote Proveedor</label>
                <input value={nroLote} onChange={e => setNroLote(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={inputSt} placeholder="LOTE-2026-0001" />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Notas del pesaje..." />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 mt-3">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button onClick={guardar} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{editId ? 'Guardar Cambios' : 'Registrar Pesaje'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
