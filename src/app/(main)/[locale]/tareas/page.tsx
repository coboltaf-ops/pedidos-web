'use client'

import { useTranslations } from 'next-intl'

import { useEffect, useState } from 'react'
import { useTareasStore } from '@/features/tareas/store/tareas-store'
import { type Tarea } from '@/features/tareas/types'
import { usePersonalEmpresaStore } from '@/features/personal-empresa/store/personal-empresa-store'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { fDate, todayColombia } from '@/shared/lib/format-date'
import VoiceSearchButton from '@/shared/components/voice-search-button'
import ViewRecordModal from '@/shared/components/view-record-modal'
import ReportPanel from '@/shared/components/report-panel'
import { useCorreosStore } from '@/features/correos-enviados/store/correos-store'

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const tabActive: React.CSSProperties = { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
const tabInactive: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }

/* Kanban column config — keys in DB remain in Spanish */
const KANBAN_KEYS = ['Pendiente', 'En Proceso', 'Completada', 'Vencida', 'Cancelada'] as const
const KANBAN_META: Record<string, { color: string; bg: string; border: string; labelKey: string }> = {
  'Pendiente':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', labelKey: 'pendiente' },
  'En Proceso':  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)', labelKey: 'enProceso' },
  'Completada':  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', labelKey: 'completada' },
  'Vencida':     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', labelKey: 'vencida' },
  'Cancelada':   { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', labelKey: 'cancelada' },
}

const nextConsecutivo = (nro: number) => `TAR-${String(nro).padStart(5, '0')}`

const nowTimeCO = () => new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })

const initForm = (records: Tarea[]): Tarea => {
  const maxNum = records.reduce((max, r) => Math.max(max, r.nro_tarea || 0), 0)
  return {
    id: '',
    nro_tarea: maxNum + 1,
    consecutivo: nextConsecutivo(maxNum + 1),
    fecha_asignacion: todayColombia(),
    hora_asignacion: nowTimeCO(),
    persona_asigna_id: '',
    persona_asigna_nombre: '',
    persona_ejecuta_id: '',
    persona_ejecuta_nombre: '',
    fecha_requerida_finalizar: '',
    fecha_real_finalizacion: '',
    descripcion: '',
    situacion: 'En Proceso',
  }
}

const sitStyle = (s: string): React.CSSProperties => {
  if (s === 'Completada') return { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' }
  if (s === 'En Proceso') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Pendiente') return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
  if (s === 'Vencida') return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
  return { background: 'rgba(107,114,128,0.2)', color: '#d1d5db', border: '1px solid rgba(107,114,128,0.3)' }
}

export default function TareasPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTbl = useTranslations('table')
  const tTab = useTranslations('tabs')
  const tStatus = useTranslations('status')
  const tKan = useTranslations('kanban')
  const kanbanColumns = KANBAN_KEYS.map(k => ({ key: k, label: tStatus(KANBAN_META[k].labelKey), ...KANBAN_META[k] }))
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tSub = useTranslations('subtitles')
  const tOp = useTranslations('options')
  const permisos = usePermisos('tareas')
  const addCorreo = useCorreosStore(s => s.addCorreo)
  const { tareas: records, addTarea, updateTarea, deleteTarea } = useTareasStore()
  const allPersonal = usePersonalEmpresaStore(s => s.personal)
  const personalList = allPersonal.filter(p => p.situacion === 'Activo')
  const situacionesTarea = useReferenceStore(s => s.data.situacion_tarea).filter(s => s.situacion)

  const [form, setForm] = useState<Tarea>(initForm(records))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [viewRecord, setViewRecord] = useState<Tarea | null>(null)
  const [tab, setTab] = useState<'registros' | 'kanban' | 'reportes'>('registros')
  const [draggedTarea, setDraggedTarea] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  // Auto-marcar tareas como Vencidas si la fecha requerida < hoy (solo si no están finalizadas)
  useEffect(() => {
    const today = todayColombia()
    const ESTADOS_FINALES = ['Completada', 'Cancelada', 'Anulada', 'Vencida']
    records.forEach(r => {
      if (!r.fecha_requerida_finalizar) return
      if (ESTADOS_FINALES.includes(r.situacion)) return
      if (r.fecha_requerida_finalizar < today) {
        updateTarea(r.id, { situacion: 'Vencida' })
      }
    })
  }, [records, updateTarea])

  const filtered = records.filter(r =>
    `${r.consecutivo} ${r.descripcion} ${r.persona_asigna_nombre} ${r.persona_ejecuta_nombre} ${r.situacion}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.fecha_asignacion) { setFormError('La fecha de asignación es obligatoria.'); return }
    if (!form.hora_asignacion) { setFormError('La hora de asignación es obligatoria.'); return }
    if (!form.persona_asigna_id) { setFormError('Debe seleccionar la persona que asigna.'); return }
    if (!form.persona_ejecuta_id) { setFormError('Debe seleccionar la persona que ejecuta.'); return }
    if (!form.fecha_requerida_finalizar) { setFormError('La fecha estimada de finalización es obligatoria.'); return }
    if (!form.descripcion.trim()) { setFormError('La descripción es obligatoria.'); return }

    const isNew = !form.id
    if (form.id) { updateTarea(form.id, form) }
    else { addTarea({ ...form, id: crypto.randomUUID() }) }
    setIsFormOpen(false)
    setForm(initForm(records))

    // Enviar correo de notificación al crear una tarea nueva
    if (isNew) {
      const ejecuta = allPersonal.find(p => p.id === form.persona_ejecuta_id)
      if (ejecuta?.correo) {
        const ahora = new Date()
        const horaEnvio = ahora.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })

        fetch('/api/send-task-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: ejecuta.correo,
            nombre_ejecuta: `${ejecuta.nombre} ${ejecuta.apellido}`,
            consecutivo: form.consecutivo,
            fecha_asignacion: fDate(form.fecha_asignacion),
            persona_asigna: form.persona_asigna_nombre,
            fecha_requerida_finalizar: fDate(form.fecha_requerida_finalizar),
            descripcion: form.descripcion,
          }),
        }).then(res => res.json()).then(result => {
          if (result.success) {
            addCorreo({
              id: crypto.randomUUID(),
              fecha: todayColombia(),
              hora: horaEnvio,
              destinatario: ejecuta.correo,
              proveedor: `${ejecuta.nombre} ${ejecuta.apellido}`,
              asunto: `Nueva Tarea Asignada: ${form.consecutivo}`,
              mensaje: `Tarea ${form.consecutivo} asignada a ${ejecuta.nombre} ${ejecuta.apellido}. ${form.descripcion}`,
              consecutivo: form.consecutivo,
              total: '',
              tipo_moneda: '',
              estado: 'Enviado',
            })
          }
        }).catch(() => { /* silencioso si falla */ })
      }
    }
  }

  const handleDelete = (id: string) => { if (confirm(tCf('delTarea'))) deleteTarea(id) }

  const openEdit = (r: Tarea) => {
    setForm({ ...r })
    setIsFormOpen(true)
  }

  const handlePersonaAsignaChange = (id: string) => {
    const p = personalList.find(x => x.id === id)
    setForm({ ...form, persona_asigna_id: id, persona_asigna_nombre: p ? `${p.nombre} ${p.apellido}` : '' })
  }

  const handlePersonaEjecutaChange = (id: string) => {
    const p = personalList.find(x => x.id === id)
    setForm({ ...form, persona_ejecuta_id: id, persona_ejecuta_nombre: p ? `${p.nombre} ${p.apellido}` : '' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('tareas')}</h1>
          <p className="text-white/50 text-sm mt-1">{tSub('tareas')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="px-3 py-1 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#fff' }}>
            {records.filter(r => r.situacion === 'En Proceso').length} en proceso
          </span>
          <span className="px-3 py-1 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#fff' }}>
            {records.length} total
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('registros')} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={tab === 'registros' ? tabActive : tabInactive}>{tTab('registros')}</button>
        <button onClick={() => setTab('kanban')} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={tab === 'kanban' ? tabActive : tabInactive}>{tTab('kanban')}</button>
        <button onClick={() => setTab('reportes')} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={tab === 'reportes' ? tabActive : tabInactive}>{tTab('reportes')}</button>
      </div>

      {tab === 'registros' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-4">
            {permisos.registrar && (
              <button
                onClick={() => { setForm(initForm(records)); setFormError(''); setIsFormOpen(!isFormOpen) }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}
              >
                {isFormOpen ? 'Cerrar Formulario' : '+ Nueva Tarea'}
              </button>
            )}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text" placeholder="Buscar por número, descripción, persona..."
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Nro Tarea (auto) */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Nro. Tarea</label>
                  <input readOnly value={form.consecutivo} className="w-full px-3 py-2 rounded-lg text-sm text-white/50 outline-none cursor-not-allowed" style={{ ...inputSt, opacity: 0.6 }} />
                </div>

                {/* Fecha Asignación */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Fecha Asignación *</label>
                  <input required type="date" value={form.fecha_asignacion} onChange={e => setForm({ ...form, fecha_asignacion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
                </div>

                {/* Hora Asignación */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Hora Asignación *</label>
                  <input required type="time" value={form.hora_asignacion} onChange={e => setForm({ ...form, hora_asignacion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
                </div>

                {/* Persona que Asigna */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Persona que Asigna *</label>
                  <select required value={form.persona_asigna_id} onChange={e => handlePersonaAsignaChange(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={selSt}>
                    <option value="">{tOp('seleccionarGuion')}</option>
                    {personalList.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                    ))}
                  </select>
                </div>

                {/* Persona que Ejecuta */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Persona que Ejecuta *</label>
                  <select required value={form.persona_ejecuta_id} onChange={e => handlePersonaEjecutaChange(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={selSt}>
                    <option value="">{tOp('seleccionarGuion')}</option>
                    {personalList.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                    ))}
                  </select>
                </div>

                {/* Fecha Estimada Finalización */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Fecha Estimada Finalización *</label>
                  <input required type="date" value={form.fecha_requerida_finalizar} onChange={e => setForm({ ...form, fecha_requerida_finalizar: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
                </div>

                {/* Fecha Real Finalización */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Fecha Real Finalización</label>
                  <input type="date" value={form.fecha_real_finalizacion} onChange={e => setForm({ ...form, fecha_real_finalizacion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputSt} />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Descripción de la Tarea *</label>
                <textarea
                  required rows={3} value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
                  style={inputSt}
                />
              </div>

              {/* Situación — después de Descripción */}
              <div className="max-w-xs">
                <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
                <select value={form.situacion} onChange={e => setForm({ ...form, situacion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={selSt}>
                  {situacionesTarea.map(s => (
                    <option key={s.id} value={s.descripcion}>{s.descripcion}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>
                  {form.id ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setIsFormOpen(false); setForm(initForm(records)) }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
                  {tBtn('cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-white/80">
                <thead className="text-xs uppercase bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-4 font-semibold text-white/90">Nro.</th>
                    <th className="px-4 py-4 font-semibold text-white/90">Fecha Asig.</th>
                    <th className="px-4 py-4 font-semibold text-white/90">Hora</th>
                    <th className="px-4 py-4 font-semibold text-white/90">Asigna</th>
                    <th className="px-4 py-4 font-semibold text-white/90">Ejecuta</th>
                    <th className="px-4 py-4 font-semibold text-white/90">{tKan('fechaReq')}</th>
                    <th className="px-4 py-4 font-semibold text-white/90">Fecha Real</th>
                    <th className="px-4 py-4 font-semibold text-white/90">Descripción</th>
                    <th className="px-4 py-4 font-semibold text-white/90">Situación</th>
                    <th className="px-4 py-4 font-semibold text-white/90 text-right whitespace-nowrap min-w-[200px]">{tTbl('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="px-6 py-12 text-center text-white/30">{tE('noTareas')}</td></tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-white">{r.consecutivo}</td>
                      <td className="px-4 py-3">{fDate(r.fecha_asignacion)}</td>
                      <td className="px-4 py-3">{r.hora_asignacion}</td>
                      <td className="px-4 py-3">{r.persona_asigna_nombre}</td>
                      <td className="px-4 py-3">{r.persona_ejecuta_nombre}</td>
                      <td className="px-4 py-3">{fDate(r.fecha_requerida_finalizar)}</td>
                      <td className="px-4 py-3">{fDate(r.fecha_real_finalizacion)}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={r.descripcion}>{r.descripcion}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={sitStyle(r.situacion)}>{r.situacion}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setViewRecord(r)} className="text-white/50 hover:text-white font-medium px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-xs">Ver</button>
                          {permisos.editar && !['Completada', 'Anulada'].includes(r.situacion) && (
                            <button onClick={() => openEdit(r)} className="text-blue-300 hover:text-blue-100 font-medium px-3 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg transition-all text-xs">{tBtn('edit')}</button>
                          )}
                          {permisos.eliminar && !['Completada', 'Anulada'].includes(r.situacion) && (
                            <button onClick={() => handleDelete(r.id)} className="text-red-300 hover:text-red-100 font-medium px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all text-xs">{tBtn('delete')}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Kanban View */}
      {tab === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 250px)' }}>
          {kanbanColumns.map(col => {
            const colTareas = records.filter(r => r.situacion === col.key)
            return (
              <div
                key={col.key}
                className="flex-shrink-0 w-72 rounded-2xl border flex flex-col"
                style={{
                  background: dragOverCol === col.key ? col.bg.replace('0.12', '0.25') : col.bg,
                  borderColor: col.border,
                  transition: 'background 0.2s',
                }}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOverCol(null)
                  if (draggedTarea && permisos.editar) {
                    updateTarea(draggedTarea, { situacion: col.key })
                  }
                  setDraggedTarea(null)
                }}
              >
                {/* Column Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: col.border }}>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-bold text-white">{col.label}</span>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: col.border, color: col.color }}
                  >
                    {colTareas.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 330px)' }}>
                  {colTareas.length === 0 && (
                    <div className="text-center text-white/20 text-xs py-8">{tKan('sinTareas')}</div>
                  )}
                  {colTareas.map(tarea => (
                    <div
                      key={tarea.id}
                      draggable={permisos.editar}
                      onDragStart={() => setDraggedTarea(tarea.id)}
                      onDragEnd={() => { setDraggedTarea(null); setDragOverCol(null) }}
                      className="rounded-xl border p-3 space-y-2 transition-all hover:scale-[1.02]"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        cursor: permisos.editar ? 'grab' : 'default',
                        opacity: draggedTarea === tarea.id ? 0.5 : 1,
                      }}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-white/80">{tarea.consecutivo}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setViewRecord(tarea)}
                            className="text-white/40 hover:text-white p-1 rounded transition-all text-xs"
                            title={tKan('verDetalle')}
                          >
                            👁
                          </button>
                          {permisos.editar && !['Completada', 'Anulada'].includes(tarea.situacion) && (
                            <button
                              onClick={() => openEdit(tarea)}
                              className="text-blue-300/60 hover:text-blue-300 p-1 rounded transition-all text-xs"
                              title={tKan('editarTooltip')}
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-white/70 line-clamp-3 leading-relaxed">
                        {tarea.descripcion}
                      </p>

                      {/* Footer */}
                      <div className="space-y-1.5 pt-1 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-white/30">{tKan('asigna')}</span>
                            <span className="text-xs text-white/60 truncate max-w-[120px]">{tarea.persona_asigna_nombre}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[10px] text-white/30">{tKan('fechaAsignacion')}</span>
                            <span className="text-xs text-white/60">{fDate(tarea.fecha_asignacion)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-white/30">Ejecuta</span>
                            <span className="text-xs text-white/60 truncate max-w-[120px]">{tarea.persona_ejecuta_nombre}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[10px] text-white/30">{tKan('fechaReq')}</span>
                            <span className="text-xs text-white/60">{fDate(tarea.fecha_requerida_finalizar)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'reportes' && (
        <ReportPanel
          title="Tareas"
          filename="tareas"
          columns={[
            { header: tH('nro'), key: 'consecutivo', width: 40 },
            { header: tH('fechaAsig'), key: 'fecha_asignacion', width: 45 },
            { header: tH('hora'), key: 'hora_asignacion', width: 30 },
            { header: tH('asigna'), key: 'persona_asigna_nombre', width: 60 },
            { header: 'Ejecuta', key: 'persona_ejecuta_nombre', width: 60 },
            { header: 'Fecha Req.', key: 'fecha_requerida', width: 45 },
            { header: tH('fechaReal'), key: 'fecha_real', width: 45 },
            { header: 'Descripción', key: 'descripcion', width: 80 },
            { header: 'Situación', key: 'situacion', width: 40 },
          ]}
          rows={records.map(r => ({
            consecutivo: r.consecutivo,
            fecha_asignacion: fDate(r.fecha_asignacion),
            hora_asignacion: r.hora_asignacion,
            persona_asigna_nombre: r.persona_asigna_nombre,
            persona_ejecuta_nombre: r.persona_ejecuta_nombre,
            fecha_requerida: fDate(r.fecha_requerida_finalizar),
            fecha_real: fDate(r.fecha_real_finalizacion),
            descripcion: r.descripcion,
            situacion: r.situacion,
          }))}
        />
      )}

      {/* View Modal */}
      {viewRecord && (
        <ViewRecordModal
          title={`Tarea: ${viewRecord.consecutivo}`}
          fields={[
            { label: 'Nro. Tarea', value: viewRecord.consecutivo },
            { label: 'Fecha Asignación', value: fDate(viewRecord.fecha_asignacion) },
            { label: 'Hora Asignación', value: viewRecord.hora_asignacion },
            { label: 'Persona que Asigna', value: viewRecord.persona_asigna_nombre },
            { label: 'Persona que Ejecuta', value: viewRecord.persona_ejecuta_nombre },
            { label: 'Fecha Requerida Finalizar', value: fDate(viewRecord.fecha_requerida_finalizar) },
            { label: 'Fecha Real Finalización', value: fDate(viewRecord.fecha_real_finalizacion) },
            { label: 'Descripción', value: viewRecord.descripcion },
            { label: 'Situación', value: viewRecord.situacion },
          ]}
          onClose={() => setViewRecord(null)}
        />
      )}
    </div>
  )
}
