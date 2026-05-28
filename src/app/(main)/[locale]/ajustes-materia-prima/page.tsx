'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { useAjustesMPStore } from '@/features/ajustes-materia-prima/store/ajustes-mp-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { usePersonalEmpresaStore } from '@/features/personal-empresa/store/personal-empresa-store'
import { type AjusteMateriaPrima } from '@/features/produccion/types'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { fDate, todayColombia } from '@/shared/lib/format-date'
import ViewRecordModal from '@/shared/components/view-record-modal'

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const nextConsecutivo = (nro: number) => `AMP-${String(nro).padStart(5, '0')}`

export default function AjustesMateriaPrimaPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tPh = useTranslations('placeholders')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('ajustes-materia-prima')
  const { ajustes, addAjuste, deleteAjuste } = useAjustesMPStore()
  const { productos, updateProducto } = useProductosStore()
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const personalList = usePersonalEmpresaStore(s => s.personal).filter(p => p.situacion === 'Activo')

  const materiasPrimas = productos.filter(p => p.situacion === 'Activo')

  const maxNum = ajustes.reduce((max, r) => Math.max(max, r.nro_ajuste || 0), 0)

  const initForm = (): AjusteMateriaPrima => ({
    id: '', nro_ajuste: maxNum + 1, consecutivo: nextConsecutivo(maxNum + 1),
    fecha: todayColombia(), producto_id: '', producto_codigo: '', producto_nombre: '',
    tipo_ajuste: 'Entrada', cantidad: 0, unidad_medida: 'Unidad',
    motivo: '', referencia: '', responsable: '', observaciones: '',
  })

  const [form, setForm] = useState<AjusteMateriaPrima>(initForm())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [viewRecord, setViewRecord] = useState<AjusteMateriaPrima | null>(null)

  const filtered = ajustes.filter(r =>
    `${r.consecutivo} ${r.producto_nombre} ${r.tipo_ajuste} ${r.motivo}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleProductoChange = (id: string) => {
    const p = materiasPrimas.find(x => x.id === id)
    setForm({ ...form, producto_id: id, producto_codigo: p?.codigo || '', producto_nombre: p?.descripcion || '', unidad_medida: p?.unidad_medida || 'Unidad' })
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.producto_id) { setFormError('Seleccione un producto.'); return }
    if (form.cantidad <= 0) { setFormError('La cantidad debe ser mayor a 0.'); return }
    if (!form.motivo.trim()) { setFormError('El motivo es obligatorio.'); return }

    // Actualizar existencia
    const prod = productos.find(p => p.id === form.producto_id)
    if (prod) {
      const nuevaExistencia = form.tipo_ajuste === 'Entrada'
        ? (prod.existencia || 0) + form.cantidad
        : Math.max(0, (prod.existencia || 0) - form.cantidad)
      updateProducto(prod.id, { existencia: nuevaExistencia })
    }

    // Heredar tipo_inventario del contexto activo (grupo del menú)
    const tipoActual = form.tipo_inventario || tipoActivo || 'Producto Terminado'
    addAjuste({ ...form, id: crypto.randomUUID(), tipo_inventario: tipoActual })
    setIsFormOpen(false)
    setForm(initForm())
  }

  const handleDelete = (id: string) => { if (confirm(tCf('delAjusteInv'))) deleteAjuste(id) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('ajustesMateriaPrima')}</h1>
          <p className="text-white/50 text-sm mt-1">{tSub('ajustesMateriaPrima')}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: 'rgba(96,165,250,0.15)', color: '#fff' }}>{ajustes.length} ajustes</span>
      </div>

      <div className="flex items-center gap-4">
        {permisos.registrar && (
          <button onClick={() => { setForm(initForm()); setFormError(''); setIsFormOpen(!isFormOpen) }}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>
            {isFormOpen ? 'Cerrar' : '+ Nuevo Ajuste'}
          </button>
        )}
        <input type="text" placeholder={tPh('buscar')} value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none" style={inputSt} />
      </div>

      {isFormOpen && (
        <form onSubmit={handleSave} className="bg-black/20 p-6 rounded-2xl border border-white/10 space-y-4">
          {formError && <div className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{formError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Nro. Ajuste</label>
              <input readOnly value={form.consecutivo} className="w-full px-3 py-2 rounded-lg text-sm text-white/50 outline-none cursor-not-allowed" style={{ ...inputSt, opacity: 0.6 }} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Tipo Ajuste *</label>
              <select value={form.tipo_ajuste} onChange={e => setForm({ ...form, tipo_ajuste: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={selSt}>
                <option value="Entrada">Entrada (+)</option>
                <option value="Salida">Salida (−)</option>
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Materia Prima *</label>
              <select required value={form.producto_id} onChange={e => handleProductoChange(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={selSt}>
                <option value="">{tOp('seleccionarGuion')}</option>
                {materiasPrimas.map(p => {
                  return <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion} (Stock: {p.existencia})</option>
                })}
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Cantidad *</label>
              <input type="number" min={0} step="0.01" value={form.cantidad || ''} onChange={e => setForm({ ...form, cantidad: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Unidad</label>
              <input readOnly value={form.unidad_medida} className="w-full px-3 py-2 rounded-lg text-sm text-white/50 outline-none" style={{ ...inputSt, opacity: 0.6 }} />
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Responsable</label>
              <select value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={selSt}>
                <option value="">{tOp('seleccionarGuion')}</option>
                {personalList.map(p => <option key={p.id} value={`${p.nombre} ${p.apellido}`}>{p.nombre} {p.apellido}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1">Referencia</label>
              <input value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} placeholder="OPR-00001 o libre" className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
            </div>
          </div>

          <div>
            <label className="block text-xl font-extrabold text-white mb-1">Motivo del Ajuste *</label>
            <input required value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} placeholder="Ej: Material dañado, merma, devolución..." className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
          </div>

          <div>
            <label className="block text-xl font-extrabold text-white mb-1">Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none" style={inputSt} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>{tBtn('save')}</button>
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
                <th className="px-4 py-4">Tipo</th>
                <th className="px-4 py-4">Producto</th>
                <th className="px-4 py-4">Cantidad</th>
                <th className="px-4 py-4">Motivo</th>
                <th className="px-4 py-4">Responsable</th>
                <th className="px-4 py-4 text-right">{tTbl('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-white/30">{tE('noAjustes')}</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono font-bold text-white">{r.consecutivo}</td>
                  <td className="px-4 py-3">{fDate(r.fecha)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={r.tipo_ajuste === 'Entrada' ? { background: 'rgba(34,197,94,0.95)', color: '#fff' } : { background: 'rgba(239,68,68,0.95)', color: '#fff' }}>
                      {r.tipo_ajuste === 'Entrada' ? '+ Entrada' : '− Salida'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.producto_nombre}</td>
                  <td className="px-4 py-3 font-bold">{r.cantidad} {r.unidad_medida}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{r.motivo}</td>
                  <td className="px-4 py-3">{r.responsable || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setViewRecord(r)} className="text-white/50 hover:text-white px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs">Ver</button>
                      {permisos.eliminar && <button onClick={() => handleDelete(r.id)} className="text-red-300 hover:text-red-100 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs">{tBtn('delete')}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewRecord && (
        <ViewRecordModal title={`Ajuste: ${viewRecord.consecutivo}`} fields={[
          { label: tF('consecutivo'), value: viewRecord.consecutivo },
          { label: 'Fecha', value: fDate(viewRecord.fecha) },
          { label: 'Tipo', value: viewRecord.tipo_ajuste },
          { label: 'Producto', value: `${viewRecord.producto_codigo} — ${viewRecord.producto_nombre}` },
          { label: 'Cantidad', value: `${viewRecord.cantidad} ${viewRecord.unidad_medida}` },
          { label: tH('motivo'), value: viewRecord.motivo },
          { label: 'Referencia', value: viewRecord.referencia },
          { label: 'Responsable', value: viewRecord.responsable },
          { label: 'Observaciones', value: viewRecord.observaciones },
        ]} onClose={() => setViewRecord(null)} />
      )}
    </div>
  )
}
