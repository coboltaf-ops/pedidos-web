'use client'

import { useTranslations } from 'next-intl'

import { useState, useRef, useEffect } from 'react'
import { useEmpresaStore, type DatosEmpresa } from '@/features/datos-empresa/store/empresa-store'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import VoiceSearchButton from '@/shared/components/voice-search-button'

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }
const selectSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)' }

const initForm = (): DatosEmpresa => ({
  id: '', nombre: '', tipo_identificacion: '', nro_documento: '', correo: '',
  telefono_oficina: '', direccion: '', ciudad: '', pais: '', representante_legal: '', servidor_correo: '', logo: '',
})

export default function DatosEmpresaPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tPh = useTranslations('placeholders')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tSec = useTranslations('sections')
  const tOp = useTranslations('options')
  const permisos = usePermisos('datos-empresa')
  const { empresas, addEmpresa, updateEmpresa, deleteEmpresa, isHydrated, hydrate } = useEmpresaStore()
  const refData = useReferenceStore(s => s.data)

    // Hydrate store on mount
  useEffect(() => {
    const doHydrate = async () => {
      await useEmpresaStore.getState().hydrate()
    }
    doHydrate()
  }, [])

  const [form, setForm] = useState<DatosEmpresa>(initForm())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [viewRecord, setViewRecord] = useState<DatosEmpresa | null>(null)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ensure complete hydration on mount (including logos from IndexedDB)
  useEffect(() => {
    if (!isHydrated) {
      hydrate()
    }
  }, [isHydrated, hydrate])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setFormError('Solo se permiten archivos de imagen.'); return }
    if (file.size > 2 * 1024 * 1024) { setFormError('La imagen no puede superar 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = (ev) => { setForm(f => ({ ...f, logo: ev.target?.result as string })); setFormError('') }
    reader.readAsDataURL(file)
  }

  if (!permisos.leer) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/60 text-lg">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  const filtered = empresas.filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.nro_documento.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); return }
    const duplicate = empresas.some(r => r.id !== form.id && r.nombre.trim().toLowerCase() === form.nombre.trim().toLowerCase())
    if (duplicate) { setFormError(`Ya existe una empresa con el nombre "${form.nombre}".`); return }
    if (form.id) {
      updateEmpresa(form.id, { ...form })
      console.log('✅ Empresa actualizada:', form.nombre, 'Logo size:', form.logo?.length)
    }
    else { addEmpresa({ ...form, id: crypto.randomUUID() }) }
    setFormError('')
    setIsFormOpen(false)
  }

  const handleEdit = (e: DatosEmpresa) => { setForm({ ...e }); setIsFormOpen(true) }
  const handleDelete = (id: string) => { if (confirm(tCf('delEmpresa'))) deleteEmpresa(id) }

  const viewFields: { label: string; key: keyof DatosEmpresa }[] = [
    { label: 'Nombre', key: 'nombre' },
    { label: tF('tipoIdentificacion'), key: 'tipo_identificacion' },
    { label: tF('nroDocumento'), key: 'nro_documento' },
    { label: 'Correo', key: 'correo' },
    { label: tF('telefonoOficina'), key: 'telefono_oficina' },
    { label: 'Servidor de Correo', key: 'servidor_correo' },
    { label: 'Dirección', key: 'direccion' },
    { label: 'Ciudad', key: 'ciudad' },
    { label: 'País', key: 'pais' },
    { label: 'Representante Legal', key: 'representante_legal' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('datosEmpresa')}</h1>
          <p className="text-white/50 mt-1">{tSub('datosEmpresa')}</p>
        </div>
        {permisos.editar && (
          <button
            onClick={() => { setForm(initForm()); setFormError(''); setIsFormOpen(true) }}
            className="px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}
          >
            {tBtn('newRecord')}
          </button>
        )}
      </div>

      {/* View Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl mx-4 rounded-2xl p-8" style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{tSec('detalleEmpresa')}</h2>
              <button onClick={() => setViewRecord(null)} className="text-white/50 hover:text-white text-xl">&times;</button>
            </div>
            {viewRecord.logo && (
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <img src={viewRecord.logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-white/50 text-sm">Logo de la Empresa</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {viewFields.map(f => (
                <div key={f.key}>
                  <label className="block text-xl font-extrabold text-white mb-1" style={{ color: '#f97316' }}>{f.label}</label>
                  <p className="px-4 py-2.5 rounded-xl text-white text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {viewRecord[f.key] || '—'}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setViewRecord(null)} className="px-5 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}>
                {tBtn('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <form onSubmit={handleSave} className="w-full max-w-3xl mx-4 rounded-2xl p-8" style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{form.id ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-white/50 hover:text-white text-xl">&times;</button>
            </div>

            {formError && (
              <div className="mb-4 px-4 py-2 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>
                {formError}
              </div>
            )}

            {/* Logo Upload */}
            <div className="flex items-center gap-5 mb-6">
              <div className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {form.logo ? (
                  <img src={form.logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-white/30 text-3xl">🏢</span>
                )}
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-2">Logo de la Empresa</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl text-white text-xs font-medium"
                    style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}>
                    {tBtn('uploadLogo')}
                  </button>
                  {form.logo && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, logo: '' }))}
                      className="px-4 py-2 rounded-xl text-white/60 text-xs font-medium"
                      style={{ background: 'rgba(239,68,68,0.95)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      Quitar
                    </button>
                  )}
                </div>
                <p className="text-white/30 text-[10px] mt-1">PNG, JPG o SVG. Max 2 MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Nombre */}
              <div className="lg:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Nombre de la Empresa *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={inputSt} placeholder="Razón social" />
              </div>

              {/* Tipo Identificación */}
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Tipo Identificación</label>
                <select value={form.tipo_identificacion} onChange={e => setForm({ ...form, tipo_identificacion: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={selectSt}>
                  <option value="">{tOp('seleccionar')}</option>
                  {refData.tipo_identificacion.filter(o => o.situacion).map(o => (
                    <option key={o.id ?? o.descripcion} value={o.descripcion}>{o.descripcion}</option>
                  ))}
                </select>
              </div>

              {/* Nro Documento */}
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Nro. Documento</label>
                <input value={form.nro_documento} onChange={e => setForm({ ...form, nro_documento: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={inputSt} placeholder="J-12345678-9" />
              </div>

              {/* Correo */}
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Correo Empresa</label>
                <input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={inputSt} placeholder="info@empresa.com" />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Teléfono Oficina</label>
                <input type="tel" value={form.telefono_oficina} onChange={e => setForm({ ...form, telefono_oficina: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={inputSt} placeholder="0212-0000000" />
              </div>

              {/* Servidor de Correo */}
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Servidor de Correo</label>
                <input value={form.servidor_correo || ''} onChange={e => setForm({ ...form, servidor_correo: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={inputSt} placeholder="smtp.empresa.com" />
              </div>

              {/* Dirección */}
              <div className="lg:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Dirección</label>
                <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={inputSt} placeholder="Av. Principal #123" />
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Ciudad</label>
                <select value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={selectSt}>
                  <option value="">{tOp('seleccionar')}</option>
                  {refData.ciudad.filter(o => o.situacion).map(o => (
                    <option key={o.id ?? o.descripcion} value={o.descripcion}>{o.descripcion}</option>
                  ))}
                </select>
              </div>

              {/* País */}
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">País</label>
                <select value={form.pais} onChange={e => setForm({ ...form, pais: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={selectSt}>
                  <option value="">{tOp('seleccionar')}</option>
                  {refData.pais.filter(o => o.situacion).map(o => (
                    <option key={o.id ?? o.descripcion} value={o.descripcion}>{o.descripcion}</option>
                  ))}
                </select>
              </div>

              {/* Representante Legal */}
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Representante Legal</label>
                <input value={form.representante_legal} onChange={e => setForm({ ...form, representante_legal: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40" style={inputSt} placeholder="Nombre completo" />
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 mt-8">
              <button type="button" onClick={() => setIsFormOpen(false)}
                className="px-5 py-2.5 rounded-xl text-white/70 font-medium text-sm hover:text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {tBtn('cancel')}
              </button>
              <button type="submit"
                className="px-5 py-2.5 rounded-xl text-white font-medium text-sm hover:opacity-90"
                style={{ background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.4)' }}>
                {form.id ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="flex items-center gap-2 max-w-md">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tPh('buscarNombreDoc')}
            className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-blue-400/40"
            style={inputSt}
          />
          <VoiceSearchButton onResult={setSearch} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(96,165,250,0.15)' }}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">Nombre</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">Tipo Id</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">Nro. Documento</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">Correo</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">Teléfono</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">Ciudad</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">País</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">{tTbl('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-white/40">{tE('noEmpresas')}</td></tr>
              )}
              {filtered.map(e => (
                <tr key={e.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4 text-sm text-white font-medium">{e.nombre}</td>
                  <td className="px-5 py-4 text-sm text-white/70">{e.tipo_identificacion || '—'}</td>
                  <td className="px-5 py-4 text-sm text-white/70">{e.nro_documento || '—'}</td>
                  <td className="px-5 py-4 text-sm text-white/70">{e.correo || '—'}</td>
                  <td className="px-5 py-4 text-sm text-white/70">{e.telefono_oficina || '—'}</td>
                  <td className="px-5 py-4 text-sm text-white/70">{e.ciudad || '—'}</td>
                  <td className="px-5 py-4 text-sm text-white/70">{e.pais || '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setViewRecord(e)}
                        className="px-3 py-1 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
                        {tBtn('view')}
                      </button>
                      {permisos.editar && (
                        <button onClick={() => handleEdit(e)}
                          className="px-3 py-1 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }}>
                          {tBtn('edit')}
                        </button>
                      )}
                      {permisos.eliminar && (
                        <button onClick={() => handleDelete(e.id)}
                          className="px-3 py-1 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>
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
    </div>
  )
}
