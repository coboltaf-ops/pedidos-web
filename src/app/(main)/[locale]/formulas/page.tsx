'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { useFormulasStore } from '@/features/produccion/store/formulas-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { type Formula, type Ingrediente } from '@/features/produccion/types'
import { usePermisos } from '@/shared/hooks/use-permisos'
import ViewRecordModal from '@/shared/components/view-record-modal'

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const readSt: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }

const nextConsecutivo = (nro: number) => `FORM-${String(nro).padStart(5, '0')}`

const emptyIngrediente = (): Ingrediente => ({ id: crypto.randomUUID(), producto_id: '', codigo: '', descripcion: '', cantidad: 0, unidad_medida: '' })

export default function FormulasPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tPh = useTranslations('placeholders')
  const tCf = useTranslations('confirm')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('formulas')
  const { formulas, addFormula, updateFormula, deleteFormula } = useFormulasStore()
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const productos = useProductosStore(s => s.productos)

  const materiasPrimas = productos.filter(p => p.situacion === 'Activo' && (p.tipo_inventario || '') === 'Materia Prima')
  const productosTerminados = productos.filter(p => p.situacion === 'Activo' && (p.tipo_inventario || '') === 'Producto Terminado')

  const maxNum = formulas.reduce((max, r) => Math.max(max, r.nro_formula || 0), 0)

  const initForm = (): Formula => ({
    id: '', nro_formula: maxNum + 1, consecutivo: nextConsecutivo(maxNum + 1),
    producto_terminado_id: '', producto_terminado_codigo: '', producto_terminado_nombre: '',
    nombre_formula: '', descripcion: '', cantidad_produce: 0, unidad_medida: 'kg',
    ingredientes: [emptyIngrediente()], situacion: 'Activa',
  })

  const [form, setForm] = useState<Formula>(initForm())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [viewRecord, setViewRecord] = useState<Formula | null>(null)

  const filtered = formulas.filter(r =>
    `${r.consecutivo} ${r.producto_terminado_codigo} ${r.producto_terminado_nombre}`.toLowerCase().includes(search.toLowerCase())
  )

  const handlePTChange = (id: string) => {
    const p = productosTerminados.find(x => x.id === id)
    setForm({
      ...form,
      producto_terminado_id: id,
      producto_terminado_codigo: p?.codigo_spin || p?.codigo || '',
      producto_terminado_nombre: p?.descripcion || '',
      unidad_medida: p?.unidad_medida || 'kg',
      // Si nombre_formula está vacío, propon uno por defecto = descripción
      nombre_formula: form.nombre_formula || p?.descripcion || '',
    })
  }

  const handleIngredienteChange = (idx: number, productoId: string) => {
    const p = materiasPrimas.find(x => x.id === productoId)
    const newIng = [...form.ingredientes]
    newIng[idx] = {
      ...newIng[idx],
      producto_id: productoId,
      codigo: p?.codigo || '',
      descripcion: p?.descripcion || '',
      unidad_medida: p?.unidad_medida || '',
    }
    setForm({ ...form, ingredientes: newIng })
  }

  const handleIngCantidad = (idx: number, val: string) => {
    const soloNum = val.replace(/[^0-9.,]/g, '').replace(',', '.')
    const cantidad = soloNum ? parseFloat(soloNum) || 0 : 0
    const newIng = [...form.ingredientes]
    newIng[idx] = { ...newIng[idx], cantidad }
    setForm({ ...form, ingredientes: newIng })
  }

  const addIngrediente = () => setForm({ ...form, ingredientes: [...form.ingredientes, emptyIngrediente()] })
  const removeIngrediente = (idx: number) => {
    if (form.ingredientes.length <= 1) return
    setForm({ ...form, ingredientes: form.ingredientes.filter((_, i) => i !== idx) })
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.producto_terminado_id) { setFormError('Seleccione el Producto Terminado.'); return }
    if (!form.cantidad_produce || form.cantidad_produce <= 0) { setFormError('Indique la Cantidad Base de Producción.'); return }
    const ingredientesValidos = form.ingredientes.filter(i => i.producto_id && i.cantidad > 0)
    if (ingredientesValidos.length === 0) { setFormError('Agregue al menos una Materia Prima con cantidad mayor a 0.'); return }

    const tipoActual = form.tipo_inventario || tipoActivo || 'Producto Terminado'
    const data = { ...form, ingredientes: ingredientesValidos, tipo_inventario: tipoActual }
    if (form.id) { updateFormula(form.id, data) }
    else { addFormula({ ...data, id: crypto.randomUUID() }) }
    setIsFormOpen(false)
    setForm(initForm())
  }

  const handleDelete = (id: string) => { if (confirm(tCf('delFormula'))) deleteFormula(id) }
  const openEdit = (r: Formula) => { setForm({ ...r }); setIsFormOpen(true) }

  // Total de materia prima requerida (suma)
  const totalMP = form.ingredientes.reduce((s, i) => s + (Number(i.cantidad) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('formulas')}</h1>
          <p className="text-white/50 text-sm mt-1">{tSub('formulas')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {permisos.registrar && (
            <button onClick={() => { setForm(initForm()); setFormError(''); setIsFormOpen(!isFormOpen) }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
              {isFormOpen ? 'Cerrar' : '+ Nueva Fórmula'}
            </button>
          )}
          <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: 'rgba(96,165,250,0.15)', color: '#fff' }}>{formulas.length} fórmulas</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <input type="text" placeholder={tPh('buscarFormula')} value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl text-base text-white placeholder-white/30 outline-none" style={inputSt} />
      </div>

      {/* Formulario */}
      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-black/20 p-6 rounded-2xl border border-white/10 space-y-5">
          {formError && (
            <div className="text-base font-bold px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>
              {formError}
            </div>
          )}

          {/* ── Encabezado de la Fórmula ── */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-base font-extrabold text-amber-300 uppercase mb-3">📝 Datos de la Fórmula</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-lg font-extrabold text-white mb-1">Correlativo</label>
                <input readOnly value={form.consecutivo}
                  className="w-full px-4 py-3 rounded-lg text-lg text-white font-mono font-bold outline-none cursor-not-allowed"
                  style={{ ...readSt, opacity: 0.85 }} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-lg font-extrabold text-white mb-1">Producto Terminado *</label>
                <select required value={form.producto_terminado_id} onChange={e => handlePTChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-lg outline-none" style={selSt}>
                  <option value="">{tOp('seleccionarGuion')}</option>
                  {productosTerminados
                    .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.codigo_spin ? `SPIN ${p.codigo_spin} · ` : ''}{p.descripcion}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-lg font-extrabold text-white mb-1">Unidad Medida</label>
                <input readOnly value={form.unidad_medida || '—'}
                  className="w-full px-4 py-3 rounded-lg text-lg font-bold outline-none text-center"
                  style={readSt} />
              </div>
              <div>
                <label className="block text-lg font-extrabold text-white mb-1">Cantidad Base Producción *</label>
                <input type="text" inputMode="decimal"
                  value={form.cantidad_produce ? form.cantidad_produce.toLocaleString('es-CO', { maximumFractionDigits: 4 }) : ''}
                  onChange={e => {
                    const soloNum = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
                    const num = soloNum ? parseFloat(soloNum) || 0 : 0
                    setForm({ ...form, cantidad_produce: num })
                  }}
                  className="w-full px-4 py-3 rounded-lg text-lg text-white font-bold font-mono text-right outline-none"
                  style={inputSt} placeholder="0 kg" />
              </div>
            </div>
          </div>

          {/* ── Requerimientos de Materia Prima ── */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(34,197,94,0.05)', border: '2px solid rgba(34,197,94,0.25)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold uppercase" style={{ color: '#86efac' }}>
                🧪 Requerimientos de Materia Prima para Producir
              </h3>
              <button type="button" onClick={addIngrediente}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:scale-105"
                style={{ background: 'rgba(34,197,94,1)', border: '1px solid rgba(22,163,74,1)', boxShadow: '0 2px 6px rgba(34,197,94,0.35)' }}>
                + Agregar Materia Prima
              </button>
            </div>

            <div className="rounded-lg overflow-hidden border border-white/10">
              <table className="w-full text-sm">
                <thead style={{ background: 'rgba(34,197,94,0.18)' }}>
                  <tr className="text-left text-white">
                    <th className="px-3 py-2 font-extrabold uppercase text-xs" style={{ width: '40%' }}>Código Materia Prima</th>
                    <th className="px-3 py-2 font-extrabold uppercase text-xs">Descripción</th>
                    <th className="px-3 py-2 font-extrabold uppercase text-xs text-center">Unid. Medida</th>
                    <th className="px-3 py-2 font-extrabold uppercase text-xs text-right">Cantidad para Base</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.ingredientes.map((ing, idx) => (
                    <tr key={ing.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td className="px-3 py-2">
                        <select value={ing.producto_id} onChange={e => handleIngredienteChange(idx, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-base text-white outline-none" style={selSt}>
                          <option value="">{tOp('seleccionarMateria') || 'Seleccione MP…'}</option>
                          {materiasPrimas
                            .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
                            .map(p => (
                              <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>
                            ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-white/85">{ing.descripcion || '—'}</td>
                      <td className="px-3 py-2 text-center text-white/70 font-bold">{ing.unidad_medida || '—'}</td>
                      <td className="px-3 py-2">
                        <input type="text" inputMode="decimal"
                          value={ing.cantidad ? ing.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 4 }) : ''}
                          onChange={e => handleIngCantidad(idx, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-base text-white font-bold font-mono text-right outline-none"
                          style={inputSt} placeholder="0" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => removeIngrediente(idx)}
                          disabled={form.ingredientes.length <= 1}
                          className="text-red-300 hover:text-red-100 font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Quitar renglón">✕</button>
                      </td>
                    </tr>
                  ))}
                  {form.ingredientes.length > 0 && (
                    <tr style={{ background: 'rgba(34,197,94,0.12)', borderTop: '2px solid rgba(34,197,94,0.4)' }}>
                      <td colSpan={3} className="px-3 py-2 text-right text-white font-extrabold uppercase text-xs">Total Materia Prima</td>
                      <td className="px-3 py-2 text-right text-white font-extrabold font-mono text-base">{totalMP.toLocaleString('es-CO', { maximumFractionDigits: 4 })}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Situación + Botones ── */}
          <div className="flex items-end gap-3 pt-2 flex-wrap">
            <div className="max-w-xs">
              <label className="block text-lg font-extrabold text-white mb-1">Situación</label>
              <select value={form.situacion} onChange={e => setForm({ ...form, situacion: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-lg text-white outline-none" style={selSt}>
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
              </select>
            </div>
            <button type="submit"
              className="px-8 py-3 rounded-xl text-base font-extrabold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
              💾 {form.id ? 'Actualizar Fórmula' : 'Grabar Fórmula'}
            </button>
            <button type="button" onClick={() => { setIsFormOpen(false); setForm(initForm()) }}
              className="px-6 py-3 rounded-xl text-base font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
              {tBtn('cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/80">
            <thead className="text-xs uppercase bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-4 py-4 font-semibold text-white/90">Correlativo</th>
                <th className="px-4 py-4 font-semibold text-white/90">Cód. SPIN</th>
                <th className="px-4 py-4 font-semibold text-white/90">Descripción</th>
                <th className="px-4 py-4 font-semibold text-white/90 text-right">Cantidad Base</th>
                <th className="px-4 py-4 font-semibold text-white/90 text-center">Renglones MP</th>
                <th className="px-4 py-4 font-semibold text-white/90">Situación</th>
                <th className="px-4 py-4 font-semibold text-white/90 text-right">{tTbl('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-white/30">{tE('noFormulas')}</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-white">{r.consecutivo}</td>
                  <td className="px-4 py-3 font-mono font-bold text-amber-300">{r.producto_terminado_codigo || '—'}</td>
                  <td className="px-4 py-3 text-white/90">{r.producto_terminado_nombre}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">{(r.cantidad_produce || 0).toLocaleString('es-CO', { maximumFractionDigits: 4 })} {r.unidad_medida}</td>
                  <td className="px-4 py-3 text-center">{r.ingredientes.length}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={r.situacion === 'Activa' ? { background: 'rgba(34,197,94,0.95)', color: '#fff' } : { background: 'rgba(107,114,128,0.5)', color: '#fff' }}>{r.situacion}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setViewRecord(r)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105"
                        style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)', boxShadow: '0 2px 6px rgba(59,130,246,0.35)' }}>
                        Ver
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

      {viewRecord && (
        <ViewRecordModal
          title={`Fórmula: ${viewRecord.consecutivo}`}
          fields={[
            { label: tF('consecutivo'), value: viewRecord.consecutivo },
            { label: 'Cód. SPIN del Producto', value: viewRecord.producto_terminado_codigo || '—' },
            { label: 'Descripción', value: viewRecord.producto_terminado_nombre },
            { label: 'Unidad de Medida', value: viewRecord.unidad_medida || '—' },
            { label: 'Cantidad Base Producción', value: `${(viewRecord.cantidad_produce || 0).toLocaleString('es-CO', { maximumFractionDigits: 4 })} ${viewRecord.unidad_medida}` },
            { label: 'Materia Prima Requerida', value: viewRecord.ingredientes.length === 0 ? '—' : viewRecord.ingredientes.map(i => `${i.codigo} ${i.descripcion}: ${i.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 4 })} ${i.unidad_medida}`).join('\n') },
            { label: 'Situación', value: viewRecord.situacion },
          ]}
          onClose={() => setViewRecord(null)}
        />
      )}
    </div>
  )
}
