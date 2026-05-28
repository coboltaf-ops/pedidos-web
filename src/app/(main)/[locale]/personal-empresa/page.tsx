'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { usePersonalEmpresaStore } from '@/features/personal-empresa/store/personal-empresa-store'
import { type PersonalEmpresa } from '@/features/personal-empresa/types'
import { usePermisos } from '@/shared/hooks/use-permisos'
import VoiceSearchButton from '@/shared/components/voice-search-button'
import ViewRecordModal from '@/shared/components/view-record-modal'
import ReportPanel from '@/shared/components/report-panel'

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const sitStyle = (s: string): React.CSSProperties => {
  if (s === 'Activo') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
}

const tabActive: React.CSSProperties = { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
const tabInactive: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }

const initForm = (): PersonalEmpresa => ({
  id: '', nombre: '', apellido: '', correo: '', nro_movil: '', situacion: 'Activo',
})

export default function PersonalEmpresaPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tPh = useTranslations('placeholders')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const permisos = usePermisos('personal-empresa')
  const { personal: records, addPersonal, updatePersonal, deletePersonal } = usePersonalEmpresaStore()

  const [form, setForm] = useState<PersonalEmpresa>(initForm())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [viewRecord, setViewRecord] = useState<PersonalEmpresa | null>(null)
  const [tab, setTab] = useState<'registros' | 'reportes'>('registros')

  const filtered = records.filter(r =>
    `${r.nombre} ${r.apellido} ${r.correo} ${r.nro_movil}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setFormError('Nombre y Apellido son obligatorios.')
      return
    }
    const duplicate = records.some(
      r => r.id !== form.id &&
        r.nombre.trim().toLowerCase() === form.nombre.trim().toLowerCase() &&
        r.apellido.trim().toLowerCase() === form.apellido.trim().toLowerCase()
    )
    if (duplicate) {
      setFormError(`Ya existe "${form.nombre} ${form.apellido}" registrado.`)
      return
    }
    if (form.id) { updatePersonal(form.id, form) }
    else { addPersonal({ ...form, id: crypto.randomUUID() }) }
    setIsFormOpen(false)
    setForm(initForm())
  }

  const handleDelete = (id: string) => { if (confirm(tCf('delRegistro'))) deletePersonal(id) }

  const openEdit = (r: PersonalEmpresa) => {
    setForm({ ...r })
    setIsFormOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('personalEmpresa')}</h1>
          <p className="text-white/50 text-sm mt-1">{tSub('personalEmpresa')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="px-3 py-1 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#fff' }}>
            {records.length} registros
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('registros')} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={tab === 'registros' ? tabActive : tabInactive}>{tTab('registros')}</button>
        <button onClick={() => setTab('reportes')} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={tab === 'reportes' ? tabActive : tabInactive}>{tTab('reportes')}</button>
      </div>

      {tab === 'registros' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-4">
            {permisos.registrar && (
              <button
                onClick={() => { setForm(initForm()); setFormError(''); setIsFormOpen(!isFormOpen) }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}
              >
                {isFormOpen ? 'Cerrar Formulario' : '+ Nuevo Personal'}
              </button>
            )}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text" placeholder={tPh('buscarNombreCorreo')}
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none"
                style={inputSt}
              />
              <VoiceSearchButton onResult={setSearch} />
            </div>
          </div>

          {/* Form */}
          {isFormOpen && (
            <form onSubmit={handleSave} className="bg-black/20 p-6 rounded-2xl border border-white/10 space-y-4 shadow-inner">
              {formError && <div className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{formError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Nombre *</label>
                  <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
                </div>
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Apellido *</label>
                  <input required value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
                </div>
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Correo</label>
                  <input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
                </div>
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Nro. Móvil</label>
                  <input value={form.nro_movil} onChange={e => setForm({ ...form, nro_movil: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
                </div>
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
                  <select value={form.situacion} onChange={e => setForm({ ...form, situacion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={selSt}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>
                  {form.id ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setIsFormOpen(false); setForm(initForm()) }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
                  {tBtn('cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <table className="w-full text-left text-sm text-white/80">
              <thead className="text-xs uppercase bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-semibold text-white/90">Nombre</th>
                  <th className="px-6 py-4 font-semibold text-white/90">Apellido</th>
                  <th className="px-6 py-4 font-semibold text-white/90">Correo</th>
                  <th className="px-6 py-4 font-semibold text-white/90">Nro. Móvil</th>
                  <th className="px-6 py-4 font-semibold text-white/90">Situación</th>
                  <th className="px-6 py-4 font-semibold text-white/90 text-right">{tTbl('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-white/30">{tE('noRegistros')}</td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{r.nombre}</td>
                    <td className="px-6 py-4">{r.apellido}</td>
                    <td className="px-6 py-4">{r.correo || '—'}</td>
                    <td className="px-6 py-4">{r.nro_movil || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={sitStyle(r.situacion)}>{r.situacion}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setViewRecord(r)} className="text-white/50 hover:text-white font-medium px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-xs">Ver</button>
                        {permisos.editar && (
                          <button onClick={() => openEdit(r)} className="text-blue-300 hover:text-blue-100 font-medium px-3 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg transition-all text-xs">{tBtn('edit')}</button>
                        )}
                        {permisos.eliminar && (
                          <button onClick={() => handleDelete(r.id)} className="text-red-300 hover:text-red-100 font-medium px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all text-xs">{tBtn('delete')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'reportes' && (
        <ReportPanel
          title="Personal Empresa"
          filename="personal-empresa"
          columns={[
            { header: 'Nombre', key: 'nombre', width: 80 },
            { header: 'Apellido', key: 'apellido', width: 80 },
            { header: 'Correo', key: 'correo', width: 100 },
            { header: tH('nroMovil'), key: 'nro_movil', width: 60 },
            { header: 'Situación', key: 'situacion', width: 50 },
          ]}
          rows={records.map(r => ({ nombre: r.nombre, apellido: r.apellido, correo: r.correo || '—', nro_movil: r.nro_movil || '—', situacion: r.situacion }))}
        />
      )}

      {/* View Modal */}
      {viewRecord && (
        <ViewRecordModal
          title={`${viewRecord.nombre} ${viewRecord.apellido}`}
          fields={[
            { label: 'Nombre', value: viewRecord.nombre },
            { label: tF('apellido'), value: viewRecord.apellido },
            { label: 'Correo', value: viewRecord.correo || '—' },
            { label: tH('nroMovil'), value: viewRecord.nro_movil || '—' },
            { label: 'Situación', value: viewRecord.situacion },
          ]}
          onClose={() => setViewRecord(null)}
        />
      )}
    </div>
  )
}
