'use client'

import { useState, useMemo } from 'react'
import { useHojaProcesoStore, type HojaProceso } from '@/features/hoja-proceso/store/hoja-proceso-store'
import { hojaDelDia, saldoCelda, saldosPorCelda } from '@/features/lote-celda/lib/helpers'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { todayColombia, fDate } from '@/shared/lib/format-date'

const TIPO = 'Materia Prima'

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }
const selSt: React.CSSProperties = { background: '#083d3d', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }
const readSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

export default function HojaProcesoPage() {
  const permisos = usePermisos('hoja-proceso')
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const today = todayColombia()

  const { hojas: todasHojas, addHoja, updateHoja, deleteHoja } = useHojaProcesoStore()
  const productos = useProductosStore(s => s.productos)
  const proveedoresAll = useProveedoresStore(s => s.proveedores)
  const proveedoresActivos = useMemo(
    () => proveedoresAll
      .filter(p => p.situacion === 'Activo')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [proveedoresAll]
  )
  const celdasRef = useReferenceStore(s => s.data.celda)
  const celdasActivas = useMemo(
    () => (celdasRef || []).filter(c => c.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')),
    [celdasRef]
  )

  const productosMP = useMemo(
    () => productos
      .filter(p => p.situacion === 'Activo' && (p.tipo_inventario || '') === 'Materia Prima')
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')),
    [productos]
  )

  const hojas = useMemo(() => {
    const filtradas = tipoActivo
      ? todasHojas.filter(h => !h.tipo_inventario || h.tipo_inventario === tipoActivo)
      : todasHojas
    return [...filtradas].sort((a, b) => {
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
      return (b.nro_operacion || 0) - (a.nro_operacion || 0)
    })
  }, [todasHojas, tipoActivo])

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewItem, setViewItem] = useState<HojaProceso | null>(null)
  const [fecha, setFecha] = useState(today)
  const [productoId, setProductoId] = useState('')
  const [codigoProducto, setCodigoProducto] = useState('')
  const [codigoAlterno, setCodigoAlterno] = useState('')
  const [nombreProducto, setNombreProducto] = useState('')
  const [unidadMedida, setUnidadMedida] = useState('')
  const [lote, setLote] = useState('')
  const [nroCelda, setNroCelda] = useState('')
  const [codigoMP, setCodigoMP] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [fechaRemision, setFechaRemision] = useState('')
  const [nroRemision, setNroRemision] = useState('')
  const [cantidadKg, setCantidadKg] = useState(0)
  const [movimiento, setMovimiento] = useState<'Entra' | 'Sale'>('Entra')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const infoHoja = useMemo(() => hojaDelDia(todasHojas, fecha), [todasHojas, fecha])
  const consecutivoNuevo = infoHoja.consecutivo

  const resetForm = () => {
    setEditId(null)
    setFecha(today)
    setProductoId('')
    setCodigoProducto('')
    setCodigoAlterno('')
    setNombreProducto('')
    setUnidadMedida('')
    setLote('')
    setNroCelda('')
    setCodigoMP('')
    setProveedorId('')
    setFechaRemision('')
    setNroRemision('')
    setCantidadKg(0)
    setMovimiento('Entra')
    setObservaciones('')
    setError('')
  }

  const abrirNuevo = () => { resetForm(); setOpen(true) }

  const handleProductoChange = (id: string) => {
    setProductoId(id)
    const p = productos.find(x => x.id === id)
    if (!p) {
      setCodigoProducto(''); setCodigoAlterno(''); setNombreProducto(''); setUnidadMedida('')
      return
    }
    setCodigoProducto(p.codigo)
    setCodigoAlterno(p.codigo_alterno || '')
    setNombreProducto(p.descripcion)
    setUnidadMedida(p.unidad_medida || 'kg')
  }

  const editar = (h: HojaProceso) => {
    setEditId(h.id)
    setFecha(h.fecha)
    setProductoId(h.producto_id)
    setCodigoProducto(h.codigo_producto)
    setCodigoAlterno(h.codigo_alterno || '')
    setNombreProducto(h.nombre_producto)
    setUnidadMedida(h.unidad_medida)
    setLote(h.lote)
    setNroCelda(h.nro_celda || '')
    setCodigoMP(h.codigo_materia_prima || '')
    setProveedorId(h.proveedor_id || '')
    setFechaRemision(h.fecha_remision || '')
    setNroRemision(h.nro_remision || '')
    setCantidadKg(h.cantidad_kg)
    setMovimiento(h.movimiento)
    setObservaciones(h.observaciones || '')
    setError('')
    setOpen(true)
  }

  const anular = (h: HojaProceso) => {
    if (h.estado === 'Anulado') return
    if (!confirm(`¿Anular la Hoja de Proceso ${h.consecutivo}?`)) return
    updateHoja(h.id, { estado: 'Anulado' })
  }

  const eliminar = (h: HojaProceso) => {
    if (!confirm(`¿Eliminar definitivamente la Hoja ${h.consecutivo}? Esta acción es irreversible.`)) return
    deleteHoja(h.id)
  }

  const guardar = () => {
    setError('')
    if (!productoId) { setError('Seleccione un producto de Materia Prima.'); return }
    if (!nroCelda.trim()) { setError('Indique el Nro. de Celda.'); return }
    if (!cantidadKg || cantidadKg <= 0) { setError('Indique una cantidad mayor a 0.'); return }
    if (movimiento === 'Sale' && cantidadKg > saldoActualCelda) {
      setError(`Saldo insuficiente en celda ${nroCelda.trim().toUpperCase()}: ${saldoActualCelda.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg disponibles.`)
      return
    }

    const provObj = proveedoresActivos.find(p => p.id === proveedorId)
    const datos = {
      fecha,
      producto_id: productoId,
      codigo_producto: codigoProducto,
      codigo_alterno: codigoAlterno,
      nombre_producto: nombreProducto,
      unidad_medida: unidadMedida || 'kg',
      lote: lote.trim(),
      nro_celda: nroCelda.trim(),
      codigo_materia_prima: codigoMP.trim(),
      proveedor_id: movimiento === 'Entra' ? proveedorId : '',
      proveedor_nombre: movimiento === 'Entra' ? (provObj?.nombre || '') : '',
      fecha_remision: movimiento === 'Entra' ? fechaRemision : '',
      nro_remision: movimiento === 'Entra' ? nroRemision.trim() : '',
      cantidad_kg: cantidadKg,
      movimiento,
      observaciones: observaciones.trim(),
      tipo_inventario: tipoActivo || TIPO,
    }

    if (editId) {
      updateHoja(editId, datos)
    } else {
      const info = hojaDelDia(todasHojas, fecha)
      const nueva: HojaProceso = {
        id: crypto.randomUUID(),
        nro_correlativo: info.nro_correlativo,
        consecutivo: info.consecutivo,
        nro_operacion: info.nro_operacion,
        ...datos,
        estado: 'Registrado',
      }
      addHoja(nueva)
    }
    setOpen(false)
    resetForm()
  }

  const filtered = hojas.filter(h => {
    const q = search.toLowerCase()
    if (!q) return true
    return [h.consecutivo, h.codigo_producto, h.nombre_producto, h.lote].join(' ').toLowerCase().includes(q)
  })

  const totalEntra = filtered.filter(h => h.estado === 'Registrado' && h.movimiento === 'Entra').reduce((s, h) => s + h.cantidad_kg, 0)
  const totalSale = filtered.filter(h => h.estado === 'Registrado' && h.movimiento === 'Sale').reduce((s, h) => s + h.cantidad_kg, 0)

  const saldosCeldas = useMemo(() => saldosPorCelda(todasHojas), [todasHojas])
  const saldoActualCelda = useMemo(
    () => saldoCelda(todasHojas, nroCelda, editId || undefined),
    [todasHojas, nroCelda, editId]
  )
  const saldoProyectado = saldoActualCelda + (movimiento === 'Entra' ? cantidadKg : -cantidadKg)

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">📋 Hoja de Proceso en Celdas</h1>
          <p className="text-white/50 mt-1">Registro de Entradas y Salidas de Materia Prima en Celdas</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {permisos.editar && (
            <button onClick={abrirNuevo}
              className="px-6 py-3 rounded-xl text-base font-extrabold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
              ➕ Nueva Hoja Proceso
            </button>
          )}
          <div className="rounded-xl px-4 py-2 text-right"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.4), rgba(217,119,6,0.25))', border: '2px solid rgba(245,158,11,0.5)', boxShadow: '0 4px 12px rgba(245,158,11,0.25)' }}>
            <p className="text-[10px] uppercase tracking-wider text-amber-200 font-bold">Próximo Correlativo</p>
            <p className="text-xl font-extrabold font-mono text-white">{consecutivoNuevo}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
          <p className="text-xs uppercase font-bold mb-1 text-green-200">Total Entra (kg)</p>
          <p className="text-2xl font-extrabold font-mono text-green-100">{totalEntra.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)' }}>
          <p className="text-xs uppercase font-bold mb-1 text-red-200">Total Sale (kg)</p>
          <p className="text-2xl font-extrabold font-mono text-red-100">{totalSale.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(96,165,250,0.15)', border: '2px solid rgba(96,165,250,0.4)' }}>
          <p className="text-xs uppercase font-bold mb-1 text-blue-200">Saldo Neto (kg)</p>
          <p className="text-2xl font-extrabold font-mono text-blue-100">{(totalEntra - totalSale).toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(168,85,247,0.15)', border: '2px solid rgba(168,85,247,0.4)' }}>
          <p className="text-xs uppercase font-bold mb-1 text-purple-200">Total Registros</p>
          <p className="text-2xl font-extrabold font-mono text-purple-100">{filtered.length}</p>
        </div>
      </div>

      {saldosCeldas.length > 0 && (
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)' }}>
          <p className="text-xs uppercase tracking-wider font-bold text-cyan-200 mb-2">Saldos por Celda</p>
          <div className="flex flex-wrap gap-2">
            {saldosCeldas.map(({ celda, saldo }) => (
              <div key={celda} className="rounded-xl px-3 py-2 flex items-center gap-2"
                style={{
                  background: saldo < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${saldo < 0 ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                }}>
                <span className="font-mono font-extrabold text-white text-sm">{celda}</span>
                <span className={`font-mono font-extrabold text-sm ${saldo < 0 ? 'text-red-300' : 'text-cyan-200'}`}>
                  {saldo.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por consecutivo, código, nombre o lote…"
          className="w-full max-w-md rounded-xl px-4 py-2.5 text-base text-white outline-none" style={inputSt} />
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <table className="w-full text-base">
          <thead style={{ background: 'rgba(255,255,255,0.08)' }}>
            <tr>
              {['Consecutivo','Op','Fecha','Código','Nombre','Lote','Celda','Movim.','Cantidad Kg','Estado','Acciones'].map(h => (
                <th key={h} className={`px-3 py-3 text-base font-extrabold uppercase tracking-wider whitespace-nowrap ${h === 'Cantidad Kg' ? 'text-right' : ''}`}
                  style={{ color: '#facc15', textShadow: '0 0 6px rgba(250,204,21,0.4)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-6 py-12 text-center text-white/30">No hay hojas de proceso registradas. Crea la primera con <strong>+ Nueva Hoja Proceso</strong>.</td></tr>
            )}
            {filtered.map(h => (
              <tr key={h.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', opacity: h.estado === 'Anulado' ? 0.5 : 1 }}>
                <td className="px-3 py-3 font-mono font-extrabold text-white whitespace-nowrap">{h.consecutivo}</td>
                <td className="px-3 py-3 font-mono font-extrabold text-center text-amber-300 whitespace-nowrap">{h.nro_operacion}</td>
                <td className="px-3 py-3 font-extrabold text-white whitespace-nowrap">{fDate(h.fecha)}</td>
                <td className="px-3 py-3 font-mono font-extrabold text-white whitespace-nowrap">{h.codigo_alterno || h.codigo_producto}</td>
                <td className="px-3 py-3 font-extrabold text-white">{h.nombre_producto}</td>
                <td className="px-3 py-3 font-mono font-bold text-white">{h.lote || '—'}</td>
                <td className="px-3 py-3 font-mono font-bold text-white">{h.nro_celda || '—'}</td>
                <td className="px-3 py-3">
                  <span className="px-3 py-1 rounded-full text-sm font-extrabold"
                    style={h.movimiento === 'Entra'
                      ? { background: 'rgba(34,197,94,0.95)', color: '#fff' }
                      : { background: 'rgba(239,68,68,0.95)', color: '#fff' }}>
                    {h.movimiento === 'Entra' ? '⬇ Entra' : '⬆ Sale'}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-mono font-extrabold text-white">
                  {h.cantidad_kg.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg
                </td>
                <td className="px-3 py-3">
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold"
                    style={h.estado === 'Registrado'
                      ? { background: 'rgba(96,165,250,0.95)', color: '#fff' }
                      : { background: 'rgba(107,114,128,0.95)', color: '#fff' }}>
                    {h.estado}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setViewItem(h)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                      style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Ver</button>
                    {permisos.editar && h.estado === 'Registrado' && (
                      <button onClick={() => editar(h)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'rgba(245,158,11,1)', border: '1px solid rgba(217,119,6,1)' }}>Editar</button>
                    )}
                    {permisos.editar && h.estado === 'Registrado' && (
                      <button onClick={() => anular(h)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'rgba(251,191,36,0.95)', border: '1px solid rgba(217,119,6,0.6)' }}>Anular</button>
                    )}
                    {permisos.eliminar && (
                      <button onClick={() => eliminar(h)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'rgba(220,38,38,1)', border: '1px solid rgba(185,28,28,1)' }}>Eliminar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
            style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-extrabold text-white">📋 Hoja Proceso · <span className="font-mono text-blue-300">{viewItem.consecutivo}</span> <span className="text-white/50 text-sm">· Op {viewItem.nro_operacion}</span></h2>
              <button onClick={() => setViewItem(null)} className="text-white/40 hover:text-white text-3xl leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { l: 'Fecha', v: fDate(viewItem.fecha), span: false },
                { l: 'Código', v: viewItem.codigo_alterno || viewItem.codigo_producto, span: false },
                { l: 'Movimiento', v: viewItem.movimiento, span: false },
                { l: 'Nombre Producto', v: viewItem.nombre_producto, span: true },
                { l: 'Unidad', v: viewItem.unidad_medida, span: false },
                { l: 'Lote', v: viewItem.lote || '—', span: false },
                { l: 'Nro. Celda', v: viewItem.nro_celda || '—', span: false },
                { l: 'Código Materia Prima', v: viewItem.codigo_materia_prima || '—', span: false },
                { l: 'Proveedor', v: viewItem.proveedor_nombre || '—', span: false },
                { l: 'Fecha Remisión', v: viewItem.fecha_remision ? fDate(viewItem.fecha_remision) : '—', span: false },
                { l: 'Nro. Remisión', v: viewItem.nro_remision || '—', span: false },
                { l: 'Cantidad', v: `${viewItem.cantidad_kg.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`, span: false },
                { l: 'Estado', v: viewItem.estado, span: false },
              ].map((f, i) => (
                <div key={i} className={`rounded-xl p-3 ${f.span ? 'col-span-2 md:col-span-3' : ''}`}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs uppercase tracking-wider mb-1 font-bold text-orange-400">{f.l}</p>
                  <p className="text-white font-bold">{f.v}</p>
                </div>
              ))}
              {viewItem.observaciones && (
                <div className="col-span-2 md:col-span-3 rounded-xl p-3"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px dashed rgba(245,158,11,0.4)' }}>
                  <p className="text-xs uppercase tracking-wider mb-1 font-bold text-amber-300">Observaciones</p>
                  <p className="text-white whitespace-pre-wrap">{viewItem.observaciones}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setViewItem(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
            style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-extrabold text-white">{editId ? 'Editar Hoja' : 'Nueva Hoja de Proceso'}</h2>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-3xl leading-none">&times;</button>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-base font-bold"
                style={{ background: 'rgba(239,68,68,0.18)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}>
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Fecha de Registro *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-base text-white outline-none" style={inputSt} />
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Nro Correlativo</label>
                <input readOnly value={editId ? hojas.find(h => h.id === editId)?.consecutivo || '' : consecutivoNuevo}
                  className="w-full rounded-xl px-3 py-2 text-base font-mono font-bold outline-none cursor-not-allowed"
                  style={readSt} />
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Nro Operación</label>
                <input readOnly value={editId ? String(hojas.find(h => h.id === editId)?.nro_operacion || '') : String(infoHoja.nro_operacion)}
                  className="w-full rounded-xl px-3 py-2 text-base font-mono font-bold outline-none cursor-not-allowed text-center"
                  style={readSt} />
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Movimiento *</label>
                <select value={movimiento} onChange={e => setMovimiento(e.target.value as 'Entra' | 'Sale')}
                  className="w-full rounded-xl px-3 py-2 text-base font-bold outline-none" style={selSt}>
                  <option value="Entra">⬇ Entra</option>
                  <option value="Sale">⬆ Sale</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="block text-base font-extrabold text-white mb-1">Producto Materia Prima *</label>
                <select value={productoId} onChange={e => handleProductoChange(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold outline-none" style={selSt}>
                  <option value="">Seleccione una Materia Prima…</option>
                  {productosMP.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.codigo_alterno ? `${p.codigo_alterno} — ` : ''}{p.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-base font-extrabold text-white mb-1">Código</label>
                <input readOnly value={codigoAlterno || codigoProducto || '—'}
                  className="w-full rounded-xl px-3 py-2 text-base font-mono font-bold outline-none" style={readSt} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-base font-extrabold text-white mb-1">Nombre Producto</label>
                <input readOnly value={nombreProducto || '—'}
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold outline-none" style={readSt} />
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Código Materia Prima</label>
                <input value={codigoMP} onChange={e => setCodigoMP(e.target.value)}
                  placeholder="MP-001"
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold font-mono outline-none" style={inputSt} />
              </div>

              <div>
                <label className="block text-base font-extrabold text-white mb-1">Nro. Lote</label>
                <input value={lote} onChange={e => setLote(e.target.value)}
                  placeholder="LOTE-2026-0001"
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold font-mono outline-none" style={inputSt} />
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Nro. Celda *</label>
                <select value={nroCelda} onChange={e => setNroCelda(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold font-mono outline-none" style={selSt}>
                  <option value="">Seleccione una celda…</option>
                  {celdasActivas.map(c => (
                    <option key={c.id} value={c.descripcion}>{c.descripcion}</option>
                  ))}
                </select>
                {nroCelda.trim() && (
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs font-bold">
                    <span className="text-white/60">Saldo actual:</span>
                    <span className="font-mono text-cyan-300">
                      {saldoActualCelda.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg
                    </span>
                    {cantidadKg > 0 && (
                      <>
                        <span className="text-white/40">→</span>
                        <span className={`font-mono ${saldoProyectado < 0 ? 'text-red-300' : 'text-green-300'}`}>
                          {saldoProyectado.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Cantidad Kg *</label>
                <input type="text" inputMode="decimal"
                  value={cantidadKg ? cantidadKg.toLocaleString('es-CO', { maximumFractionDigits: 4 }) : ''}
                  onChange={e => {
                    const soloNum = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
                    const num = soloNum ? parseFloat(soloNum) || 0 : 0
                    setCantidadKg(num)
                  }}
                  placeholder="0"
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold font-mono text-right outline-none" style={inputSt} />
              </div>
              <div>
                <label className="block text-base font-extrabold text-white mb-1">Unidad</label>
                <input readOnly value={unidadMedida || 'kg'}
                  className="w-full rounded-xl px-3 py-2 text-base text-center font-bold outline-none" style={readSt} />
              </div>

              {movimiento === 'Entra' && (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-base font-extrabold text-white mb-1">Proveedor</label>
                    <select value={proveedorId} onChange={e => setProveedorId(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-base text-white font-bold outline-none" style={selSt}>
                      <option value="">Seleccione un proveedor…</option>
                      {proveedoresActivos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-base font-extrabold text-white mb-1">Fecha Remisión</label>
                    <input type="date" value={fechaRemision} onChange={e => setFechaRemision(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-base text-white outline-none" style={inputSt} />
                  </div>
                  <div>
                    <label className="block text-base font-extrabold text-white mb-1">Nro. Remisión</label>
                    <input value={nroRemision} onChange={e => setNroRemision(e.target.value)}
                      placeholder="REM-0001"
                      className="w-full rounded-xl px-3 py-2 text-base text-white font-bold font-mono outline-none" style={inputSt} />
                  </div>
                </>
              )}

              <div className="md:col-span-4">
                <label className="block text-base font-extrabold text-white mb-1">Observaciones</label>
                <textarea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  placeholder="Notas opcionales del movimiento…"
                  className="w-full rounded-xl px-3 py-2 text-base text-white font-bold outline-none resize-none" style={inputSt} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setOpen(false)}
                className="px-6 py-2.5 rounded-xl text-base font-bold text-white/70 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancelar
              </button>
              <button onClick={guardar}
                className="px-8 py-2.5 rounded-xl text-base font-extrabold text-white"
                style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
                💾 {editId ? 'Actualizar' : 'Grabar Hoja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
