'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useProveedoresStore, type Proveedor } from '@/features/proveedores/store/proveedores-store'
import ReportPanel from '@/shared/components/report-panel'
import { usePermisos } from '@/shared/hooks/use-permisos'
import VoiceSearchButton from '@/shared/components/voice-search-button'
import ViewRecordModal from '@/shared/components/view-record-modal'

const initForm = (): Proveedor => ({
  id: '', nombre: '', tipo_id: '', nro_documento: '', actividad: '', correo: '', telf_oficina: '', movil_oficina: '',
  persona_contacto: '', referencias: '', observacion_referencia: '', direccion: '', ciudad: '', pais: 'Colombia',
  tipo_inventario_atiende: '', situacion: 'Activo',
  tipo_persona: '', regimen_iva: '', autorretenedor_renta: 'No', gran_contribuyente: 'No', regimen_tributario: 'Ordinario',
  agente_retenedor_iva: 'No', actividad_ciiu: '', pct_retencion_renta: 0, pct_retencion_iva: 0, pct_retencion_ica: 0,
  responsable_ica: 'No', responsabilidades_rut: '', resolucion_facturacion: '', correo_notificacion_dian: '',
})

const sitStyleProv = (s: string): React.CSSProperties => {
  if (s === 'Activo') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Bloqueado') return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
  return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
}

const tabActive: React.CSSProperties = { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
const tabInactive: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }

export default function ProveedoresPage() {
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
  const tRpt = useTranslations('reportTitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('proveedores')
  const refData = useReferenceStore(s => s.data)
  const { proveedores: records, addProveedor, updateProveedor, deleteProveedor } = useProveedoresStore()
  const selStyle: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)' }

  const [form, setForm] = useState<Proveedor>(initForm())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [viewRecord, setViewRecord] = useState<Proveedor | null>(null)

  // Tab state
  const [tab, setTab] = useState<'registros' | 'reportes' | 'especificos'>('registros')

  const [formError, setFormError] = useState('')

  // Validaciones en tiempo real
  const nombreDuplicadoLive = form.nombre.trim() !== '' && records.some(
    r => r.id !== form.id && r.nombre.trim().toLowerCase() === form.nombre.trim().toLowerCase()
  )
  const docDuplicadoLive = form.nro_documento.trim() !== '' && records.some(
    r => r.id !== form.id && r.nro_documento.trim().toLowerCase() === form.nro_documento.trim().toLowerCase()
  )
  const correoDuplicadoLive = form.correo.trim() !== '' && records.some(
    r => r.id !== form.id && (r.correo || '').trim().toLowerCase() === form.correo.trim().toLowerCase()
  )

  const filtered = records.filter(r =>
    r.nombre.toLowerCase().includes(search.toLowerCase()) ||
    r.nro_documento.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    // Validar Tipo Inventario que Atiende — obligatorio
    if (!form.tipo_inventario_atiende || !form.tipo_inventario_atiende.trim()) {
      setFormError('Debe seleccionar el Tipo de Inventario que Atiende.')
      return
    }
    // Validar nombre duplicado (case-insensitive, sin espacios extras)
    const nombreDuplicado = records.some(
      r => r.id !== form.id && r.nombre.trim().toLowerCase() === form.nombre.trim().toLowerCase()
    )
    if (nombreDuplicado) {
      setFormError(`Ya existe un proveedor con el nombre "${form.nombre.trim()}".`)
      return
    }
    // Validar número de documento duplicado (sin espacios)
    if (form.nro_documento.trim()) {
      const docDuplicado = records.some(
        r => r.id !== form.id && r.nro_documento.trim().toLowerCase() === form.nro_documento.trim().toLowerCase()
      )
      if (docDuplicado) {
        setFormError(`Ya existe un proveedor con el documento "${form.nro_documento.trim()}".`)
        return
      }
    }
    // Validar correo duplicado
    if (form.correo.trim()) {
      const correoDuplicado = records.some(
        r => r.id !== form.id && (r.correo || '').trim().toLowerCase() === form.correo.trim().toLowerCase()
      )
      if (correoDuplicado) {
        setFormError(`Ya existe un proveedor con el correo "${form.correo.trim()}".`)
        return
      }
    }
    if (form.id) { updateProveedor(form.id, { ...form }) }
    else { addProveedor({ ...form, id: crypto.randomUUID() }) }
    setFormError('')
    setIsFormOpen(false)
  }

  const handleDelete = (id: string) => { if (confirm(tCf('delProveedor'))) deleteProveedor(id) }


  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('proveedores')}</h1>
          <p className="text-white/50 mt-1">{tSub('proveedores')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button onClick={() => { setForm(initForm()); setIsFormOpen(true) }} className="px-5 py-2.5 rounded-xl font-medium text-white" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newSupplier')}
          </button>
        )}
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => setTab('registros')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'registros' ? tabActive : tabInactive}>
          {tTab('registrosEmoji')}
        </button>
        <button onClick={() => setTab('reportes')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'reportes' ? tabActive : tabInactive}>
          {tTab('reportesEmoji')}
        </button>
        <button onClick={() => setTab('especificos')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'especificos' ? tabActive : tabInactive}>
          {tTab('especificosEmoji')}
        </button>
      </div>

      {tab === 'registros' && (
        <>
          {isFormOpen && (
            <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-lg font-semibold text-white mb-4">{form.id ? 'Editar' : 'Nuevo'} Proveedor</h2>
              {formError && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                  {formError}
                </div>
              )}
              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Nombre */}
                <div className="lg:col-span-3">
                  <label className="block text-xl font-extrabold text-white mb-1">{tF('nombreRequired')}</label>
                  <input required value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: nombreDuplicadoLive ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Razón Social" />
                  {nombreDuplicadoLive && <p className="text-xs mt-1 font-medium text-white">⚠ Ya existe un proveedor con este nombre</p>}
                </div>

                {/* 2. Tipo de Identificación */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Tipo de Identificación</label>
                  <select value={form.tipo_id} onChange={e => setForm({ ...form, tipo_id: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="">{tOp('seleccione')}</option>
                    {refData.tipo_identificacion.map(t => <option key={t.id} value={t.descripcion}>{t.descripcion}</option>)}
                  </select>
                </div>

                {/* 3. Nro Documento */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Nro. Documento *</label>
                  <input required value={form.nro_documento}
                    onChange={e => setForm({ ...form, nro_documento: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: docDuplicadoLive ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="J-12345678-9" />
                  {docDuplicadoLive && <p className="text-xs mt-1 font-medium text-white">⚠ Ya existe un proveedor con este documento</p>}
                </div>

                {/* 4. Correo */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Correo</label>
                  <input value={form.correo}
                    onChange={e => setForm({ ...form, correo: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: correoDuplicadoLive ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="email@proveedor.com" />
                  {correoDuplicadoLive && <p className="text-xs mt-1 font-medium text-white">⚠ Ya existe un proveedor con este correo</p>}
                </div>

                {/* 5. Telf. Oficina */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Telf. Oficina</label>
                  <input value={form.telf_oficina}
                    onChange={e => setForm({ ...form, telf_oficina: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="0212-0000000" />
                </div>

                {/* 6. Móvil Oficina */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Móvil Oficina</label>
                  <input value={form.movil_oficina}
                    onChange={e => setForm({ ...form, movil_oficina: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="0414-0000000" />
                </div>

                {/* 7. Persona Contacto */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">{tF('personaContacto')}</label>
                  <input value={form.persona_contacto}
                    onChange={e => setForm({ ...form, persona_contacto: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Nombre del contacto" />
                </div>

                {/* 8. Actividad */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Actividad</label>
                  <select value={form.actividad} onChange={e => setForm({ ...form, actividad: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="">{tOp('seleccione')}</option>
                    {refData.actividad_proveedor.map(a => <option key={a.id} value={a.descripcion}>{a.descripcion}</option>)}
                  </select>
                </div>

                {/* 9. Tipo Inventario que Atiende — OBLIGATORIO */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">
                    Tipo Inventario que Atiende <span className="text-red-400">*</span>
                  </label>
                  <select required value={form.tipo_inventario_atiende || ''}
                    onChange={e => setForm({ ...form, tipo_inventario_atiende: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ ...selStyle, borderColor: !form.tipo_inventario_atiende ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)' }}>
                    <option value="">{tOp('seleccione')}</option>
                    {(refData.tipo_inventario ?? [])
                      .filter(t => t.situacion)
                      .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
                      .map(t => <option key={t.id} value={t.descripcion}>{t.descripcion}</option>)}
                  </select>
                </div>

                {/* 10. Referencias */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Referencia</label>
                  <select value={form.referencias} onChange={e => {
                      const sel = (refData.referencia_proveedor ?? []).find(r => r.descripcion === e.target.value)
                      setForm({ ...form, referencias: e.target.value, observacion_referencia: sel?.detalle ?? '' })
                    }}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="">{tOp('seleccione')}</option>
                    {(refData.referencia_proveedor ?? []).filter(r => r.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')).map(r => (
                      <option key={r.id} value={r.descripcion}>{r.descripcion}{r.detalle ? ` — ${r.detalle}` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* ─── Apartado UBICACIÓN ─── */}
                <div className="lg:col-span-3 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">📍</span>
                    <h3 className="text-lg font-extrabold tracking-tight" style={{ color: '#86efac' }}>UBICACIÓN</h3>
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-xl font-extrabold text-white mb-1">Dirección</label>
                  <input value={form.direccion}
                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Av. Principal #123" />
                </div>

                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Ciudad</label>
                  <select value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="">{tOp('seleccione')}</option>
                    {(refData.ciudad ?? []).filter(c => c.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')).map(c => (
                      <option key={c.id} value={c.descripcion}>{c.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xl font-extrabold text-white mb-1">País</label>
                  <select value={form.pais} onChange={e => setForm({ ...form, pais: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="">{tOp('seleccione')}</option>
                    {(refData.pais ?? []).filter(p => p.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')).map(p => (
                      <option key={p.id} value={p.descripcion}>{p.descripcion}</option>
                    ))}
                  </select>
                </div>

                {/* ── Régimen DIAN en Colombia ── */}
                <div className="lg:col-span-3 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🇨🇴</span>
                    <h3 className="text-lg font-extrabold tracking-tight" style={{ color: '#fbbf24' }}>Régimen DIAN en Colombia</h3>
                  </div>
                  <p className="text-xs text-white/50 mb-4">Datos tributarios para cálculo automático de retenciones en facturas y pagos.</p>
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">Tipo de Persona</label>
                  <select value={form.tipo_persona || ''} onChange={e => setForm({ ...form, tipo_persona: e.target.value as Proveedor['tipo_persona'] })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="">Seleccione…</option>
                    <option value="Natural">Persona Natural</option>
                    <option value="Jurídica">Persona Jurídica</option>
                  </select>
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">Régimen IVA</label>
                  <select value={form.regimen_iva || ''} onChange={e => setForm({ ...form, regimen_iva: e.target.value as Proveedor['regimen_iva'] })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="">Seleccione…</option>
                    <option value="Responsable IVA">Responsable IVA</option>
                    <option value="No Responsable IVA">No Responsable IVA</option>
                    <option value="Régimen Simple">Régimen Simple</option>
                  </select>
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">Régimen Tributario</label>
                  <select value={form.regimen_tributario || ''} onChange={e => setForm({ ...form, regimen_tributario: e.target.value as Proveedor['regimen_tributario'] })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="">Seleccione…</option>
                    <option value="Ordinario">Ordinario</option>
                    <option value="Simple">Simple</option>
                  </select>
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">Autorretenedor de Renta</label>
                  <select value={form.autorretenedor_renta || ''} onChange={e => setForm({ ...form, autorretenedor_renta: e.target.value as Proveedor['autorretenedor_renta'] })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">Gran Contribuyente</label>
                  <select value={form.gran_contribuyente || ''} onChange={e => setForm({ ...form, gran_contribuyente: e.target.value as Proveedor['gran_contribuyente'] })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">Agente Retenedor IVA</label>
                  <select value={form.agente_retenedor_iva || ''} onChange={e => setForm({ ...form, agente_retenedor_iva: e.target.value as Proveedor['agente_retenedor_iva'] })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">Responsable ICA</label>
                  <select value={form.responsable_ica || ''} onChange={e => setForm({ ...form, responsable_ica: e.target.value as Proveedor['responsable_ica'] })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-base font-extrabold text-white mb-1">Actividad Económica (CIIU)</label>
                  <input value={form.actividad_ciiu || ''} onChange={e => setForm({ ...form, actividad_ciiu: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Ej. 4663 - Comercio al por mayor de materiales..." />
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">% Retención Renta</label>
                  <input type="number" step="0.01" min="0" value={form.pct_retencion_renta ?? 0} onChange={e => setForm({ ...form, pct_retencion_renta: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none font-mono text-right"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="0.00" />
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">% Retención IVA</label>
                  <input type="number" step="1" min="0" max="100" value={form.pct_retencion_iva ?? 0} onChange={e => setForm({ ...form, pct_retencion_iva: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none font-mono text-right"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="0, 15, 50, 100" />
                </div>

                <div>
                  <label className="block text-base font-extrabold text-white mb-1">Tarifa ICA (× mil)</label>
                  <input type="number" step="0.01" min="0" value={form.pct_retencion_ica ?? 0} onChange={e => setForm({ ...form, pct_retencion_ica: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none font-mono text-right"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Ej. 9.66" />
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-base font-extrabold text-white mb-1">Responsabilidades RUT (códigos)</label>
                  <input value={form.responsabilidades_rut || ''} onChange={e => setForm({ ...form, responsabilidades_rut: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Ej. O-13, O-15, O-23, O-47, O-48 (separados por coma según RUT del proveedor)" />
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-base font-extrabold text-white mb-1">Resolución de Facturación DIAN</label>
                  <input value={form.resolucion_facturacion || ''} onChange={e => setForm({ ...form, resolucion_facturacion: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Ej. Resolución 18764000000000 — Vigencia desde…" />
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-base font-extrabold text-white mb-1">Correo de Notificación DIAN</label>
                  <input type="email" value={form.correo_notificacion_dian || ''} onChange={e => setForm({ ...form, correo_notificacion_dian: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="correo.certificado@empresa.com (notificaciones electrónicas DIAN)" />
                </div>

                {/* Situación — tabla referencia */}
                <div className="lg:col-span-3 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
                  <select value={form.situacion} onChange={e => setForm({ ...form, situacion: e.target.value })}
                    className="w-full md:w-1/3 rounded-xl px-4 py-2.5 text-white font-bold outline-none" style={selStyle}>
                    {refData.situacion_proveedor.map(s => <option key={s.id} value={s.descripcion}>{s.descripcion}</option>)}
                  </select>
                </div>
                <div className="lg:col-span-3 flex gap-3 pt-2">
                  <button type="submit" disabled={nombreDuplicadoLive || docDuplicadoLive || correoDuplicadoLive} className="px-6 py-2 rounded-xl text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{tBtn('save')}</button>
                  <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-2 rounded-xl text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>{tBtn('cancel')}</button>
                </div>
              </form>
            </div>
          )}

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 max-w-xs">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl px-4 py-2 text-white outline-none text-base text-white font-bold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  placeholder={tPh('buscarProveedor')} />
                <VoiceSearchButton onResult={setSearch} />
              </div>
            </div>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {[tF('nombre'), tH('documento'), tH('actividad'), 'Tipo Inv. Atiende', tH('contacto'), tF('telefonoSingle'), tF('ciudad'), tF('estado'), tTbl('actions')].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-5 py-4 font-bold text-white whitespace-nowrap">{r.nombre}</td>
                    <td className="px-5 py-4 text-white font-bold font-mono text-xs">{r.tipo_id}-{r.nro_documento}</td>
                    <td className="px-5 py-4 text-white font-bold">{r.actividad}</td>
                    <td className="px-5 py-4 text-amber-300 font-bold whitespace-nowrap">{r.tipo_inventario_atiende || '—'}</td>
                    <td className="px-5 py-4 text-white font-bold">{r.persona_contacto}</td>
                    <td className="px-5 py-4 text-white font-bold">{r.telf_oficina}</td>
                    <td className="px-5 py-4 text-white font-bold">{r.ciudad}</td>
                    <td className="px-5 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium" style={sitStyleProv(r.situacion)}>
                        {r.situacion}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => setViewRecord(r)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)' }}>Ver</button>
                        {permisos.editar && <button onClick={() => { setForm({ ...r }); setIsFormOpen(true) }} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>{tBtn('edit')}</button>}
                        {permisos.eliminar && <button onClick={() => handleDelete(r.id)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tE('noProveedores')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'reportes' && (
        <ReportPanel
          title={tRpt('proveedores')}
          filename="proveedores"
          columns={[
            { header: 'Nombre', key: 'nombre', width: 30 },
            { header: 'Nro. Documento', key: 'nro_documento', width: 20 },
            { header: 'Situación', key: 'situacion', width: 14 },
          ]}
          rows={records.map(p => ({
            nombre: p.nombre,
            nro_documento: p.nro_documento,
            situacion: p.situacion,
          }))}
          filters={[
            { label: 'Situación', key: 'situacion', options: ['Activo', 'Inactivo'] },
          ]}
        />
      )}

      {tab === 'especificos' && (
        <div className="glass-card p-6 md:p-8">
          <h2 className="text-xl font-bold text-white mb-4">{tTab('especificos')}</h2>
          <p className="text-white/50 text-sm mb-6">{tSub('seleccioneReporte')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/40 text-sm">Los reportes específicos se irán agregando según sus necesidades</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Registro */}
      {viewRecord && (
        <ViewRecordModal
          title={`Proveedor: ${viewRecord.nombre}`}
          fields={[
            { label: 'Nombre', value: viewRecord.nombre },
            { label: tF('tipoIdentificacion'), value: viewRecord.tipo_id },
            { label: tF('nroDocumento'), value: viewRecord.nro_documento },
            { label: tH('actividad'), value: viewRecord.actividad },
            { label: 'Correo', value: viewRecord.correo },
            { label: tF('telefonoOficina'), value: viewRecord.telf_oficina },
            { label: 'Móvil', value: viewRecord.movil_oficina },
            { label: tF('personaContacto'), value: viewRecord.persona_contacto },
            { label: 'Referencias', value: viewRecord.referencias },
            { label: 'Dirección', value: viewRecord.direccion },
            { label: 'Ciudad', value: viewRecord.ciudad },
            { label: 'País', value: viewRecord.pais },
            { label: 'Tipo Inventario que Atiende', value: viewRecord.tipo_inventario_atiende || '—' },
            { label: 'Situación', value: viewRecord.situacion },
          ]}
          onClose={() => setViewRecord(null)}
        />
      )}
    </div>
  )
}
