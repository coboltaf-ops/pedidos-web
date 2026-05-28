'use client'

import { useState, useMemo } from 'react'
import { useDespachosStore, type Despacho, type RenglonDespacho } from '@/features/despachos/store/despachos-store'
import { nextDespachoConsecutivo } from '@/features/despachos/lib/helpers'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useClientesStore } from '@/features/clientes/store/clientes-store'
import { useEmpresaStore } from '@/features/datos-empresa/store/empresa-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { todayColombia, fDate } from '@/shared/lib/format-date'

export default function DespachosPage() {
  const permisos = usePermisos('despachos')
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const today = todayColombia()

  const { despachos: todosDespachos, addDespacho, updateDespacho, deleteDespacho } = useDespachosStore()
  const despachos = tipoActivo
    ? todosDespachos.filter(d => !d.tipo_inventario || d.tipo_inventario === tipoActivo)
    : todosDespachos

  const productos = useProductosStore(s => s.productos)
  const clientes = useClientesStore(s => s.clientes)
  const empresa = useEmpresaStore(s => s.empresas[0])

  // ─── State Form ─────────────────────────────────────────────────────
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewItem, setViewItem] = useState<Despacho | null>(null)
  const [fechaEmision, setFechaEmision] = useState('')
  const [cliente, setCliente] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [ordenCompra, setOrdenCompra] = useState('')
  const [renglones, setRenglones] = useState<RenglonDespacho[]>([])
  const [productoSel, setProductoSel] = useState('')
  const [cantidadSel, setCantidadSel] = useState('')
  const [precioSel, setPrecioSel] = useState('')
  const [cedulaCond, setCedulaCond] = useState('')
  const [nombreCond, setNombreCond] = useState('')
  const [descrVehiculo, setDescrVehiculo] = useState('')
  const [anoModelo, setAnoModelo] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }
  const selectSt: React.CSSProperties = { background: '#083d3d', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }
  const readOnlySt: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'not-allowed' }

  // Productos disponibles: Producto Terminado + asociados al cliente seleccionado
  const productosFiltrados = useMemo(() => {
    if (!cliente && !clienteId) return []
    const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
    const cliNombre = norm(cliente)
    return productos.filter(p => {
      if (p.situacion !== 'Activo') return false
      if ((p.tipo_inventario || '') !== 'Producto Terminado') return false
      const matchPorId = clienteId && p.cliente_id === clienteId
      const matchPorNombre = cliNombre && norm(p.cliente || '') === cliNombre
      return matchPorId || matchPorNombre
    })
  }, [productos, cliente, clienteId])

  const totalDespacho = useMemo(() => renglones.reduce((s, r) => s + r.subtotal, 0), [renglones])

  const resetForm = () => {
    setEditId(null)
    setFechaEmision(today)
    setCliente('')
    setClienteId('')
    setOrdenCompra('')
    setRenglones([])
    setProductoSel('')
    setCantidadSel('')
    setPrecioSel('')
    setCedulaCond('')
    setNombreCond('')
    setDescrVehiculo('')
    setAnoModelo('')
    setHoraSalida('')
    setObservaciones('')
    setError('')
  }

  const abrirNuevo = () => { resetForm(); setOpen(true) }

  const editar = (d: Despacho) => {
    setEditId(d.id)
    setFechaEmision(d.fecha_emision)
    setCliente(d.cliente)
    const cliMatch = clientes.find(c => c.razon_social === d.cliente)
    setClienteId(cliMatch?.id || '')
    setOrdenCompra(d.orden_compra)
    setRenglones([...d.renglones])
    setProductoSel('')
    setCantidadSel('')
    setPrecioSel('')
    setCedulaCond(d.cedula_conductor)
    setNombreCond(d.nombre_conductor)
    setDescrVehiculo(d.descripcion_vehiculo)
    setAnoModelo(d.ano_modelo)
    setHoraSalida(d.hora_salida)
    setObservaciones(d.observaciones)
    setError('')
    setOpen(true)
  }

  const anular = (d: Despacho) => {
    if (d.estado === 'Anulado') return
    if (!confirm(`¿Anular el despacho ${d.consecutivo} (${d.cliente})?`)) return
    updateDespacho(d.id, { estado: 'Anulado' })
  }

  const eliminar = (d: Despacho) => {
    if (!confirm(`¿Eliminar definitivamente el despacho ${d.consecutivo}? Esta acción es irreversible.`)) return
    deleteDespacho(d.id)
  }

  const imprimirDespacho = (d: Despacho) => {
    const cliObj = clientes.find(c => c.razon_social === d.cliente)
    const fmt = (n: number) => (n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const totalUnidades = d.renglones.reduce((s, r) => s + (r.cantidad || 0), 0)
    const filas = d.renglones.map((r, i) => {
      const spin = r.codigo_spin || productos.find(p => p.id === r.producto_id)?.codigo_spin || ''
      return `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="mono">${r.codigo}</td>
        <td class="mono spin">${spin || '—'}</td>
        <td>${r.nombre}</td>
        <td class="num">${(r.cantidad || 0).toLocaleString('es-CO')}</td>
        <td class="num">$ ${fmt(r.precio_unitario)}</td>
        <td class="num bold">$ ${fmt(r.subtotal)}</td>
      </tr>`
    }).join('')

    const empresaInfo = empresa || { nombre: 'Silicatos para la Industria SAS', nro_documento: '', direccion: '', ciudad: '', telefono_oficina: '', correo: '', logo: '' }
    const logoHtml = empresaInfo.logo
      ? `<img src="${empresaInfo.logo}" alt="logo" style="max-height:70px;max-width:200px;object-fit:contain"/>`
      : `<div style="font-size:22px;font-weight:800;color:#0A5A5A;letter-spacing:2px">${empresaInfo.nombre}</div>`

    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<title>Despacho ${d.consecutivo} — ${d.cliente}</title>
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
  .head .doc-info .estado{display:inline-block;padding:3px 10px;border-radius:4px;font-size:9pt;font-weight:700;margin-top:4px;color:#fff;background:${d.estado === 'Registrado' ? '#22c55e' : '#dc2626'}}
  .seccion{border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;margin-bottom:10px;background:#f9fafb}
  .seccion h3{margin:0 0 8px;color:#0A5A5A;font-size:10pt;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #0A5A5A;padding-bottom:3px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;font-size:10pt}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 18px;font-size:10pt}
  .grid2 .lbl,.grid3 .lbl{color:#6b7280;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.05em;font-weight:700}
  .grid2 .val,.grid3 .val{color:#000;font-weight:600;font-size:10.5pt;margin-bottom:4px}
  table.prods{width:100%;border-collapse:collapse;margin:8px 0;font-size:9.5pt}
  table.prods thead{background:#0A5A5A;color:#fff}
  table.prods th{padding:7px 8px;text-align:left;font-size:9pt;letter-spacing:0.04em}
  table.prods th.num{text-align:right}
  table.prods td{padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  table.prods td.num{text-align:right;font-family:'SF Mono',Menlo,Consolas,monospace}
  table.prods td.mono{font-family:'SF Mono',Menlo,Consolas,monospace}
  table.prods td.spin{color:#b45309;font-weight:700}
  table.prods td.bold{font-weight:700;color:#0A5A5A}
  table.prods tr:nth-child(even){background:#f9fafb}
  .total-box{display:flex;justify-content:flex-end;margin-top:10px}
  .total-box .total{background:#0A5A5A;color:#facc15;padding:10px 24px;border-radius:6px;font-weight:800;font-size:13pt;letter-spacing:0.04em}
  .total-box .total .lbl{color:#cffafe;font-size:9pt;font-weight:600;letter-spacing:0.1em;display:block;margin-bottom:2px}
  .obs{margin-top:8px;padding:10px 14px;border:1px dashed #9ca3af;border-radius:6px;background:#fffbeb;font-size:10pt}
  .obs .lbl{font-weight:700;color:#92400e;margin-bottom:3px}
  .firmas{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:32px}
  .firma{text-align:center;border-top:1px solid #000;padding-top:5px;font-size:9pt;color:#374151}
  .firma .rol{font-weight:700;color:#0A5A5A;text-transform:uppercase;letter-spacing:0.05em;font-size:8.5pt;margin-bottom:1px}
  .footer{margin-top:18px;padding-top:8px;border-top:1px solid #d1d5db;text-align:center;font-size:8pt;color:#6b7280}
  @media print { .no-print{display:none} }
  .no-print{position:fixed;top:10px;right:10px;background:#0A5A5A;color:#fff;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:700}
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
    <div class="titulo">DESPACHO PRODUCTO TERMINADO</div>
    <div class="consec">${d.consecutivo}</div>
    <div class="estado">${d.estado.toUpperCase()}</div>
  </div>
</div>

<div class="seccion">
  <h3>Información del Despacho</h3>
  <div class="grid3">
    <div><div class="lbl">Fecha Emisión</div><div class="val">${d.fecha_emision || '—'}</div></div>
    <div><div class="lbl">Fecha Registro</div><div class="val">${d.fecha_registro || '—'}</div></div>
    <div><div class="lbl">Orden de Compra Cliente</div><div class="val">${d.orden_compra || '—'}</div></div>
  </div>
</div>

<div class="seccion">
  <h3>Cliente</h3>
  <div class="grid2">
    <div><div class="lbl">Razón Social</div><div class="val">${d.cliente}</div></div>
    ${cliObj ? `<div><div class="lbl">${cliObj.tipo_identificacion || 'Identificación'}</div><div class="val">${cliObj.nro_documento}${cliObj.digito_verificacion ? '-' + cliObj.digito_verificacion : ''}</div></div>` : ''}
    ${cliObj?.direccion ? `<div><div class="lbl">Dirección</div><div class="val">${cliObj.direccion}</div></div>` : ''}
    ${cliObj && (cliObj as { ciudad?: string }).ciudad ? `<div><div class="lbl">Ciudad</div><div class="val">${(cliObj as { ciudad?: string }).ciudad}</div></div>` : ''}
  </div>
</div>

<div class="seccion">
  <h3>Productos Despachados</h3>
  <table class="prods">
    <thead><tr>
      <th>#</th><th>Código</th><th>Cód. SPIN</th><th>Producto</th>
      <th class="num">Cantidad</th><th class="num">P. Unitario</th><th class="num">Subtotal</th>
    </tr></thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr style="background:#0A5A5A;color:#fff;font-weight:800">
        <td colspan="4" style="padding:8px;text-align:right">TOTAL UNIDADES</td>
        <td class="num" style="padding:8px;color:#facc15">${totalUnidades.toLocaleString('es-CO')}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
  <div class="total-box">
    <div class="total"><span class="lbl">MONTO TOTAL</span>$ ${fmt(d.monto_total)}</div>
  </div>
</div>

<div class="seccion">
  <h3>Datos del Transportista</h3>
  <div class="grid3">
    <div><div class="lbl">Cédula Conductor</div><div class="val">${d.cedula_conductor || '—'}</div></div>
    <div><div class="lbl">Nombre Conductor</div><div class="val">${d.nombre_conductor || '—'}</div></div>
    <div><div class="lbl">Hora Salida</div><div class="val">${d.hora_salida || '—'}</div></div>
    <div><div class="lbl">Descripción Vehículo</div><div class="val">${d.descripcion_vehiculo || '—'}</div></div>
    <div><div class="lbl">Año Modelo</div><div class="val">${d.ano_modelo || '—'}</div></div>
  </div>
</div>

${d.observaciones ? `<div class="obs"><div class="lbl">Observaciones:</div>${d.observaciones}</div>` : ''}

<div class="firmas">
  <div class="firma"><div class="rol">DESPACHADO POR</div>Firma y Sello</div>
  <div class="firma"><div class="rol">CONDUCTOR</div>${d.nombre_conductor || 'Firma y C.C.'}</div>
  <div class="firma"><div class="rol">RECIBIDO POR EL CLIENTE</div>Firma y Sello</div>
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

  // Cuando selecciona producto, autocompletar precio sugerido
  const handleSelectProducto = (id: string) => {
    setProductoSel(id)
    const prod = productos.find(p => p.id === id)
    if (prod) setPrecioSel(String(prod.precio_unitario || prod.costo_promedio || prod.ult_costo || 0))
  }

  const agregarRenglon = () => {
    setError('')
    if (!productoSel) { setError('Selecciona un producto.'); return }
    const cant = Number(cantidadSel)
    const precio = Number(precioSel)
    if (!cant || cant <= 0) { setError('Cantidad inválida.'); return }
    if (!precio || precio < 0) { setError('Precio unitario inválido.'); return }
    const prod = productos.find(p => p.id === productoSel)
    if (!prod) { setError('Producto no encontrado.'); return }
    if (renglones.some(r => r.producto_id === productoSel)) { setError('Ese producto ya está en el despacho.'); return }
    setRenglones([
      ...renglones,
      { producto_id: prod.id, codigo: prod.codigo, codigo_spin: prod.codigo_spin || '', nombre: prod.descripcion, precio_unitario: precio, cantidad: cant, subtotal: cant * precio },
    ])
    setProductoSel('')
    setCantidadSel('')
    setPrecioSel('')
  }

  const quitarRenglon = (productoId: string) => {
    setRenglones(renglones.filter(r => r.producto_id !== productoId))
  }

  const guardar = () => {
    setError('')
    if (!fechaEmision) { setError('Indica la Fecha de Emisión.'); return }
    if (!cliente.trim()) { setError('Indica el Cliente.'); return }
    if (renglones.length === 0) { setError('Agrega al menos un producto al despacho.'); return }
    if (!cedulaCond.trim()) { setError('Indica la Cédula del Conductor.'); return }
    if (!nombreCond.trim()) { setError('Indica el Nombre del Conductor.'); return }

    const datos = {
      fecha_emision: fechaEmision,
      cliente: cliente.trim(),
      orden_compra: ordenCompra.trim(),
      renglones,
      cedula_conductor: cedulaCond.trim(),
      nombre_conductor: nombreCond.trim(),
      descripcion_vehiculo: descrVehiculo.trim(),
      ano_modelo: anoModelo.trim(),
      hora_salida: horaSalida,
      observaciones: observaciones.trim(),
      monto_total: totalDespacho,
    }

    if (editId) {
      updateDespacho(editId, datos)
    } else {
      const nro = todosDespachos.reduce((m, d) => Math.max(m, d.nro_correlativo || 0), 0) + 1
      const nuevo: Despacho = {
        id: crypto.randomUUID(),
        nro_correlativo: nro,
        consecutivo: nextDespachoConsecutivo(todosDespachos),
        fecha_registro: today,
        ...datos,
        tipo_inventario: tipoActivo || '',
        estado: 'Registrado',
      }
      addDespacho(nuevo)
    }
    setOpen(false)
  }

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return despachos
    return despachos.filter(d =>
      d.consecutivo.toLowerCase().includes(q) ||
      d.cliente.toLowerCase().includes(q) ||
      d.orden_compra.toLowerCase().includes(q) ||
      d.nombre_conductor.toLowerCase().includes(q)
    )
  }, [despachos, search])

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
          <h1 className="text-3xl font-bold text-white tracking-tight">Despacho Producto Terminado</h1>
          <p className="text-white/50 mt-1">Salidas de productos terminados a clientes</p>
        </div>
        {permisos.editar && (
          <button onClick={abrirNuevo} className="px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            + Nuevo Despacho
          </button>
        )}
      </div>

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por consecutivo, cliente, OC, conductor..."
          className="w-full max-w-md rounded-xl px-4 py-2 outline-none text-base text-white font-bold" style={inputSt} />
      </div>

      <p className="text-white/60 text-sm mb-3">{filtrados.length} despacho(s) registrado(s)</p>

      <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <table className="w-full text-base text-left">
          <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
            <tr>
              {['Consecutivo','Fecha Reg.','Fecha Emis.','Cliente','OC','Items','Total','Conductor','Hora Salida','Estado','Acciones'].map(h => (
                <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={11} className="px-6 py-12 text-center text-white/30">No hay despachos registrados. Crea el primero con <strong>+ Nuevo Despacho</strong>.</td></tr>
            ) : filtrados.map(d => (
              <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3 font-mono font-bold text-blue-300 whitespace-nowrap">{d.consecutivo}</td>
                <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(d.fecha_registro)}</td>
                <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(d.fecha_emision)}</td>
                <td className="px-3 py-3 text-white font-bold">{d.cliente}</td>
                <td className="px-3 py-3 font-mono text-white font-bold">{d.orden_compra || '—'}</td>
                <td className="px-3 py-3 font-mono text-right text-white font-bold">{d.renglones.length}</td>
                <td className="px-3 py-3 font-mono text-right text-emerald-300 font-bold whitespace-nowrap">{d.monto_total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{d.nombre_conductor}</td>
                <td className="px-3 py-3 font-mono text-white font-bold">{d.hora_salida || '—'}</td>
                <td className="px-3 py-3">
                  <span className="px-2 py-1 rounded-md text-xs font-bold" style={
                    d.estado === 'Registrado'
                      ? { background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' }
                      : { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }
                  }>{d.estado}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setViewItem(d)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Ver</button>
                    <button onClick={() => imprimirDespacho(d)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(220,38,38,0.95)', border: '1px solid rgba(185,28,28,0.4)' }} title="Generar PDF">📄 PDF</button>
                    {permisos.editar && d.estado === 'Registrado' && <button onClick={() => editar(d)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(96,165,250,0.95)', border: '1px solid rgba(96,165,250,0.3)' }}>Editar</button>}
                    {permisos.editar && d.estado === 'Registrado' && <button onClick={() => anular(d)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(251,191,36,0.95)', border: '1px solid rgba(251,191,36,0.3)' }}>Anular</button>}
                    {permisos.eliminar && <button onClick={() => eliminar(d)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(239,68,68,0.95)', border: '1px solid rgba(239,68,68,0.3)' }}>Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL VER */}
      {viewItem && (
        <div className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center p-4" style={{ left: '16rem', background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-3xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto" style={{ background: '#0A5A5A', border: '2px solid rgba(255,255,255,0.25)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">📦 Detalle del Despacho <span className="font-mono text-blue-300 text-sm">— {viewItem.consecutivo}</span></h2>
              <button onClick={() => setViewItem(null)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div><label className="block text-xl font-extrabold text-white mb-1">Fecha Registro</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{fDate(viewItem.fecha_registro)}</div></div>
              <div><label className="block text-xl font-extrabold text-white mb-1">Fecha Emisión</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{fDate(viewItem.fecha_emision)}</div></div>
              <div><label className="block text-xl font-extrabold text-white mb-1">Total</label><div className="rounded-xl px-3 py-2 text-base font-mono font-extrabold text-right" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#86efac' }}>{viewItem.monto_total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div></div>
              <div className="md:col-span-2"><label className="block text-xl font-extrabold text-white mb-1">Cliente</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.cliente}</div></div>
              <div><label className="block text-xl font-extrabold text-white mb-1">Orden de Compra</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.orden_compra || '—'}</div></div>
            </div>

            <div className="mb-4">
              <h3 className="text-base font-extrabold text-amber-300 uppercase mb-2">📦 Productos Despachados</h3>
              <table className="w-full text-sm">
                <thead><tr style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <th className="px-2 py-2 text-left text-white text-xs uppercase">Código</th>
                  <th className="px-2 py-2 text-left text-white text-xs uppercase">Cód. SPIN</th>
                  <th className="px-2 py-2 text-left text-white text-xs uppercase">Producto</th>
                  <th className="px-2 py-2 text-right text-white text-xs uppercase">Cant.</th>
                  <th className="px-2 py-2 text-right text-white text-xs uppercase">P.Unit</th>
                  <th className="px-2 py-2 text-right text-white text-xs uppercase">Subtotal</th>
                </tr></thead>
                <tbody>
                  {viewItem.renglones.map(r => {
                    const spin = r.codigo_spin || productos.find(p => p.id === r.producto_id)?.codigo_spin || ''
                    return (
                      <tr key={r.producto_id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <td className="px-2 py-2 font-mono text-white font-bold">{r.codigo}</td>
                        <td className="px-2 py-2 font-mono text-amber-300 font-bold">{spin || '—'}</td>
                        <td className="px-2 py-2 text-white font-bold">{r.nombre}</td>
                        <td className="px-2 py-2 font-mono text-right text-white font-bold">{r.cantidad.toLocaleString('es-CO')}</td>
                        <td className="px-2 py-2 font-mono text-right text-white font-bold">{r.precio_unitario.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                        <td className="px-2 py-2 font-mono text-right text-emerald-300 font-bold">{r.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mb-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <h3 className="text-base font-extrabold text-amber-300 uppercase mb-2">🚛 Datos Transportista</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-base font-extrabold text-white mb-1">Cédula Conductor</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.cedula_conductor}</div></div>
                <div><label className="block text-base font-extrabold text-white mb-1">Nombre Conductor</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.nombre_conductor}</div></div>
                <div><label className="block text-base font-extrabold text-white mb-1">Descripción Vehículo</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.descripcion_vehiculo || '—'}</div></div>
                <div><label className="block text-base font-extrabold text-white mb-1">Año Modelo</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.ano_modelo || '—'}</div></div>
                <div><label className="block text-base font-extrabold text-white mb-1">Hora Salida</label><div className="rounded-xl px-3 py-2 text-base text-white font-bold font-mono" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }}>{viewItem.hora_salida || '—'}</div></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => imprimirDespacho(viewItem)} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(220,38,38,0.95)', border: '1px solid rgba(185,28,28,0.4)' }}>📄 Generar PDF</button>
              <button onClick={() => setViewItem(null)} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO/EDITAR */}
      {open && (
        <div className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center p-4" style={{ left: '16rem', background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-5xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto" style={{ background: '#0A5A5A', border: '2px solid rgba(255,255,255,0.25)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">📦 {editId ? 'Editar Despacho' : 'Nuevo Despacho'} {!editId && <span className="font-mono text-blue-300 text-sm">— {nextDespachoConsecutivo(todosDespachos)}</span>}</h2>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Consecutivo (auto)</label>
                <input readOnly value={editId ? todosDespachos.find(d => d.id === editId)?.consecutivo || '' : nextDespachoConsecutivo(todosDespachos)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Fecha Registro (auto)</label>
                <input readOnly value={fDate(today)} className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Fecha Emisión *</label>
                <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xl font-extrabold text-white mb-1">Cliente *</label>
                <select value={clienteId}
                  onChange={e => {
                    const id = e.target.value
                    setClienteId(id)
                    const cli = clientes.find(c => c.id === id)
                    setCliente(cli?.razon_social || '')
                    setRenglones([])
                    setProductoSel('')
                  }}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione un cliente…</option>
                  {clientes
                    .filter(c => (c.situacion || 'Activo').toLowerCase() === 'activo')
                    .sort((a, b) => a.razon_social.localeCompare(b.razon_social))
                    .map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Orden de Compra</label>
                <input value={ordenCompra} onChange={e => setOrdenCompra(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={inputSt} placeholder="OC del cliente" />
              </div>

              {/* Renglones */}
              <div className="md:col-span-3 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="text-base font-extrabold text-amber-300 uppercase mb-3">📦 Productos a Despachar</h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end mb-3">
                  <div className="md:col-span-6">
                    <label className="block text-base font-extrabold text-white mb-1">Producto</label>
                    <select value={productoSel} onChange={e => handleSelectProducto(e.target.value)}
                      disabled={!clienteId && !cliente}
                      className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold disabled:opacity-50" style={selectSt}>
                      <option value="">
                        {!clienteId && !cliente
                          ? 'Seleccione primero un cliente'
                          : productosFiltrados.length === 0
                            ? 'Este cliente no tiene productos terminados asociados'
                            : 'Seleccione…'}
                      </option>
                      {productosFiltrados.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.codigo}{p.codigo_spin ? ` · SPIN ${p.codigo_spin}` : ''} · {p.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-base font-extrabold text-white mb-1">Cantidad</label>
                    <input type="number" step="0.01" min="0" value={cantidadSel} onChange={e => setCantidadSel(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-base font-extrabold text-white mb-1">P. Unitario</label>
                    <input type="number" step="0.01" min="0" value={precioSel} onChange={e => setPrecioSel(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0.00" />
                  </div>
                  <div className="md:col-span-2">
                    <button onClick={agregarRenglon} type="button" className="w-full rounded-xl px-3 py-2 text-white font-bold text-sm" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>+ Agregar</button>
                  </div>
                </div>

                {renglones.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <table className="w-full text-sm">
                      <thead><tr style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <th className="px-3 py-2 text-left text-white text-xs uppercase">Código</th>
                        <th className="px-3 py-2 text-left text-white text-xs uppercase">Cód. SPIN</th>
                        <th className="px-3 py-2 text-left text-white text-xs uppercase">Producto</th>
                        <th className="px-3 py-2 text-right text-white text-xs uppercase">Cant.</th>
                        <th className="px-3 py-2 text-right text-white text-xs uppercase">P.Unit</th>
                        <th className="px-3 py-2 text-right text-white text-xs uppercase">Subtotal</th>
                        <th className="px-3 py-2"></th>
                      </tr></thead>
                      <tbody>
                        {renglones.map(r => (
                          <tr key={r.producto_id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td className="px-3 py-2 font-mono text-white font-bold">{r.codigo}</td>
                            <td className="px-3 py-2 font-mono text-amber-300 font-bold">{r.codigo_spin || '—'}</td>
                            <td className="px-3 py-2 text-white font-bold">{r.nombre}</td>
                            <td className="px-3 py-2 font-mono text-right text-white font-bold">{r.cantidad}</td>
                            <td className="px-3 py-2 font-mono text-right text-white font-bold">{r.precio_unitario.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 font-mono text-right text-emerald-300 font-bold">{r.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2"><button type="button" onClick={() => quitarRenglon(r.producto_id)} className="text-red-300 hover:text-red-100 font-bold">✕</button></td>
                          </tr>
                        ))}
                        <tr style={{ background: 'rgba(34,197,94,0.1)', borderTop: '2px solid rgba(34,197,94,0.4)' }}>
                          <td colSpan={5} className="px-3 py-2 text-right text-white font-extrabold uppercase text-xs">Total</td>
                          <td className="px-3 py-2 font-mono text-right text-emerald-300 font-extrabold text-base">{totalDespacho.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Datos Transportista */}
              <div className="md:col-span-3 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="text-base font-extrabold text-amber-300 uppercase mb-2">🚛 Datos Transportista</h3>
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

              <div className="md:col-span-2">
                <label className="block text-xl font-extrabold text-white mb-1">Descripción Vehículo</label>
                <input value={descrVehiculo} onChange={e => setDescrVehiculo(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Tipo / Placa / Color" />
              </div>
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Año Modelo</label>
                <input value={anoModelo} onChange={e => setAnoModelo(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={inputSt} placeholder="2018" />
              </div>

              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Hora Salida</label>
                <input type="time" value={horaSalida} onChange={e => setHoraSalida(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
                <input value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Notas del despacho..." />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-200 bg-red-900/30 border border-red-400/40 rounded-xl px-3 py-2 mt-3 font-bold">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button onClick={guardar} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{editId ? 'Guardar Cambios' : 'Registrar Despacho'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
