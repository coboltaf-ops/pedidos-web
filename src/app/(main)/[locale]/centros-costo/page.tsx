'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { exportToPDF, exportToExcel, printReport } from '@/shared/lib/export-report'
import { useCentrosCostoStore } from '@/features/centros-costo/store/centros-costo-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import VoiceSearchButton from '@/shared/components/voice-search-button'
import ViewRecordModal from '@/shared/components/view-record-modal'

type CentroCosto = { id: string; codigo: string; descripcion: string; situacion: string }

const SITUACIONES = ['Activo', 'Inactivo']

const initialData: CentroCosto[] = [
  { id: '1', codigo: 'CC-001', descripcion: 'Administración General', situacion: 'Activo' },
  { id: '2', codigo: 'CC-002', descripcion: 'Operaciones y Logística', situacion: 'Activo' },
]

const sitStyle = (s: string): React.CSSProperties =>
  s === 'Activo'
    ? { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
    : { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }

const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
const selectSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

const tabActive: React.CSSProperties = { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
const tabInactive: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }

export default function CentrosCostoPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tPh = useTranslations('placeholders')
  const tCf = useTranslations('confirm')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tTip = useTranslations('tooltips')
  const tRpt = useTranslations('reportTitles')
  const permisos = usePermisos('centros-costo')
  const { centros: records } = useCentrosCostoStore()
  const setRecords = (fn: (prev: CentroCosto[]) => CentroCosto[]) => useCentrosCostoStore.setState(s => ({ centros: fn(s.centros) }))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<CentroCosto>({ id: '', codigo: '', descripcion: '', situacion: 'Activo' })
  const [search, setSearch] = useState('')
  const [viewRecord, setViewRecord] = useState<CentroCosto | null>(null)
  const [tab, setTab] = useState<'registros' | 'reportes'>('registros')

  // Reporte states
  const [rptTitle, setRptTitle] = useState(tRpt('centrosCosto'))
  const [rptSituacion, setRptSituacion] = useState('Todos')
  const [isExporting, setIsExporting] = useState(false)

  const filtered = records.filter(r =>
    r.codigo.toLowerCase().includes(search.toLowerCase()) ||
    r.descripcion.toLowerCase().includes(search.toLowerCase())
  )

  const filteredReport = records.filter(r =>
    rptSituacion === 'Todos' || r.situacion === rptSituacion
  )

  const reportColumns = [
    { header: 'Código',      key: 'codigo',      width: 12 },
    { header: 'Descripción', key: 'descripcion', width: 36 },
    { header: 'Situación',   key: 'situacion',   width: 12 },
  ]

  const reportRows: Record<string, string | number>[] = filteredReport.map(r => ({
    codigo:      r.codigo,
    descripcion: r.descripcion,
    situacion:   r.situacion,
  }))

  const today = new Date().toISOString().slice(0, 10)

  const doExport = async (format: 'pdf' | 'excel' | 'print') => {
    setIsExporting(true)
    try {
      const opts = {
        title: rptTitle,
        columns: reportColumns,
        rows: reportRows,
        filename: `centros-costo-${today}`,
      }
      if (format === 'pdf')   await exportToPDF(opts)
      if (format === 'excel') await exportToExcel(opts)
      if (format === 'print') printReport(opts)
    } finally {
      setIsExporting(false)
    }
  }

  const openNew = () => { setForm({ id: '', codigo: '', descripcion: '', situacion: 'Activo' }); setIsFormOpen(true) }
  const openEdit = (r: CentroCosto) => { setForm({ ...r }); setIsFormOpen(true) }
  const handleDelete = (id: string) => { if (confirm(tCf('delCentroCosto'))) setRecords(prev => prev.filter(r => r.id !== id)) }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.id) { setRecords(prev => prev.map(r => r.id === form.id ? { ...form } : r)) }
    else { setRecords(prev => [...prev, { ...form, id: crypto.randomUUID() }]) }
    setIsFormOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('centrosCosto')}</h1>
          <p className="text-white/50 mt-1">{tSub('centrosCosto')}</p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <button onClick={openNew} className="px-5 py-2.5 rounded-xl font-medium text-white transition-all" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
            {tBtn('newCostCenter')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => setTab('registros')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={tab === 'registros' ? tabActive : tabInactive}>
          {tTab('registrosEmoji')}
        </button>
        <button onClick={() => setTab('reportes')}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={tab === 'reportes' ? tabActive : tabInactive}>
          {tTab('reportesEmoji')}
        </button>
      </div>

      {/* Tab: Registros */}
      {tab === 'registros' && (
        <>
          {isFormOpen && (
            <div className="mb-8 rounded-2xl p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-lg font-semibold text-white">{form.id ? 'Editar' : 'Nuevo'} Centro de Costo</h2>
              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Código *</label>
                  <input required value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="CC-001" />
                </div>
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Descripción *</label>
                  <input required value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Nombre del centro de costo" />
                </div>
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
                  <select value={form.situacion} onChange={e => setForm({ ...form, situacion: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none"
                    style={{ background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    {SITUACIONES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 flex gap-3 pt-2">
                  <button type="submit" className="px-6 py-2 rounded-xl text-white font-medium" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{tBtn('save')}</button>
                  <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-2 rounded-xl text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>{tBtn('cancel')}</button>
                </div>
              </form>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 max-w-xs">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl px-4 py-2 text-white outline-none text-base text-white font-bold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  placeholder={tPh('buscarCodigoDesc')} />
                <VoiceSearchButton onResult={setSearch} />
              </div>
            </div>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {[tF('codigo'), tF('descripcion'), tF('situacion'), tTbl('actions')].map(h => (
                    <th key={h} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-6 py-4 font-mono font-medium text-white">{r.codigo}</td>
                    <td className="px-6 py-4 text-white/80">{r.descripcion}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium" style={sitStyle(r.situacion)}>{r.situacion}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => setViewRecord(r)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)' }}>Ver</button>
                        {permisos.editar && <button onClick={() => openEdit(r)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>{tBtn('edit')}</button>}
                        {permisos.eliminar && <button onClick={() => handleDelete(r.id)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tE('noRegistros')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab: Reportes */}
      {tab === 'reportes' && (
        <div className="space-y-6">
          {/* Panel título + filtros */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <h2 className="text-lg font-semibold text-white mb-5">Configurar Reporte</h2>

            {/* Campo título */}
            <div className="mb-5">
              <label className="block text-xl font-extrabold text-white mb-1">Título del Reporte</label>
              <input value={rptTitle} onChange={e => setRptTitle(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 outline-none text-lg font-semibold" style={inputSt} />
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
                <select value={rptSituacion} onChange={e => setRptSituacion(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 outline-none" style={selectSt}>
                  <option value="Todos">Todos</option>
                  {SITUACIONES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Botones */}
            <div className="flex flex-wrap gap-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="w-full text-xs text-white/40 mb-1">{filteredReport.length} registros encontrados</p>
              <button disabled={isExporting || filteredReport.length === 0} onClick={() => doExport('pdf')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }}>
                📄 Exportar PDF
              </button>
              <button disabled={isExporting || filteredReport.length === 0} onClick={() => doExport('excel')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white disabled:opacity-40"
                style={{ background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(37,99,235,1)' }}>
                📊 Exportar Excel
              </button>
              <button disabled={isExporting || filteredReport.length === 0} onClick={() => doExport('print')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white disabled:opacity-40"
                style={{ background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(37,99,235,1)' }}>
                🖨️ Imprimir
              </button>
            </div>
          </div>

          {/* Vista previa */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="px-6 py-4" style={{ background: 'rgba(96,165,250,0.1)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs uppercase tracking-wider text-white/40 mb-0.5">Vista Previa</p>
              <p className="text-white font-semibold">{rptTitle}</p>
            </div>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {reportColumns.map(c => (
                    <th key={c.key} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReport.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="px-6 py-3 font-mono text-white/80">{r.codigo}</td>
                    <td className="px-6 py-3 text-white/80">{r.descripcion}</td>
                    <td className="px-6 py-3">
                      <span className="px-3 py-1 rounded-full text-xs font-medium" style={sitStyle(r.situacion)}>{r.situacion}</span>
                    </td>
                  </tr>
                ))}
                {filteredReport.length === 0 && (
                  <tr><td colSpan={3} className="px-6 py-10 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tE('noRegistrosFiltros')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {viewRecord && (
        <ViewRecordModal
          title={tTip('detalleCentroCosto')}
          fields={[
            { label: 'Código', value: viewRecord.codigo },
            { label: 'Descripción', value: viewRecord.descripcion },
            { label: 'Situación', value: viewRecord.situacion },
          ]}
          onClose={() => setViewRecord(null)}
        />
      )}
    </div>
  )
}
