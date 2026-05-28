'use client'

import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { useCorreosStore, type CorreoEnviado } from '@/features/correos-enviados/store/correos-store'
import { fDate } from '@/shared/lib/format-date'
import ReportPanel from '@/shared/components/report-panel'
import VoiceSearchButton from '@/shared/components/voice-search-button'

const statusStyle = (s: string): React.CSSProperties => {
  if (s === 'Enviado') return { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.3)' }
  return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
}

export default function CorreosEnviadosPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tCf = useTranslations('confirm')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tRpt = useTranslations('reportTitles')
  const { correos, deleteCorreo, clearAll } = useCorreosStore()
  const [viewDetail, setViewDetail] = useState<CorreoEnviado | null>(null)
  const [tab, setTab] = useState<'registros' | 'reportes'>('registros')
  const [search, setSearch] = useState('')

  const filtered = correos.filter(c =>
    c.proveedor.toLowerCase().includes(search.toLowerCase()) ||
    c.destinatario.toLowerCase().includes(search.toLowerCase()) ||
    c.consecutivo.toLowerCase().includes(search.toLowerCase()) ||
    c.asunto.toLowerCase().includes(search.toLowerCase())
  )

  const reportColumns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: tH('hora'), key: 'hora', width: 10 },
    { header: 'Destinatario', key: 'destinatario', width: 22 },
    { header: 'Proveedor', key: 'proveedor', width: 20 },
    { header: 'Orden', key: 'consecutivo', width: 12 },
    { header: 'Asunto', key: 'asunto', width: 24 },
    { header: 'Estado', key: 'estado', width: 12 },
  ]

  const reportRows = correos.map(c => ({
    fecha: c.fecha,
    hora: c.hora,
    destinatario: c.destinatario,
    proveedor: c.proveedor,
    consecutivo: c.consecutivo,
    asunto: c.asunto,
    estado: c.estado,
  }))

  const reportFilters = [
    { label: 'Estado', key: 'estado', options: ['Enviado', 'Abierto en cliente'] },
    { label: 'Proveedor', key: 'proveedor', options: Array.from(new Set(correos.map(c => c.proveedor).filter(Boolean))) },
  ]

  if (viewDetail) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setViewDetail(null)} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            ← Volver a Correos
          </button>
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Detalle del Correo</h1>
              <p className="text-white/50 mt-1">Enviado el {viewDetail.fecha} a las {viewDetail.hora}</p>
            </div>
            <span className="px-4 py-2 rounded-full font-medium text-sm" style={statusStyle(viewDetail.estado)}>{viewDetail.estado}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Destinatario', value: viewDetail.destinatario },
              { label: 'Proveedor', value: viewDetail.proveedor },
              { label: 'Orden de Compra', value: viewDetail.consecutivo },
              { label: 'Total de la Orden', value: `${viewDetail.tipo_moneda} ${viewDetail.total}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wider" style={{ color: '#f97316' }}>{label}</p>
                <p className="text-white font-medium mt-1">{value || '-'}</p>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>Asunto</p>
            <p className="text-white font-medium">{viewDetail.asunto}</p>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs uppercase tracking-wider mb-3" style={{ color: '#f97316' }}>Mensaje</p>
            <p className="text-white/70 whitespace-pre-line">{viewDetail.mensaje}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('correosEnviados')}</h1>
          <p className="text-white/50 mt-1">{tSub('correosEnviados')}</p>
        </div>
        {tab === 'registros' && correos.length > 0 && (
          <button onClick={() => { if (confirm(tCf('clearHistorialCorreos'))) clearAll() }}
            className="px-4 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>
            🗑 Limpiar Historial
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {(['registros', 'reportes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t
              ? { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
              : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}>
            {t === 'registros' ? tTab('registrosEmoji') : tTab('reportesEmoji')}
          </button>
        ))}
      </div>

      {tab === 'registros' && (
        <>
          {/* Search */}
          <div className="mb-6">
            <div className="flex items-center gap-2 max-w-md">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por proveedor, email, orden o asunto..."
                className="w-full rounded-xl px-4 py-2.5 text-white outline-none text-base text-white font-bold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
              <VoiceSearchButton onResult={setSearch} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-4xl mb-4">📭</p>
              <p className="text-white/60 text-lg">{tE('noCorreos')}</p>
              <p className="text-white/30 text-sm mt-2">Los correos aparecerán aquí cuando envíes órdenes de compra por email</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <table className="w-full text-base text-left">
                <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <tr>
                    {[tF('fecha'), tH('hora'), tF('destinatario'), tF('proveedor'), tF('orden'), tF('asunto'), tF('estado'), tTbl('actions')].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-5 py-4 text-white/60">{fDate(c.fecha)}</td>
                      <td className="px-5 py-4 text-white/50 text-xs font-mono">{c.hora}</td>
                      <td className="px-5 py-4 text-white font-bold">{c.destinatario}</td>
                      <td className="px-5 py-4 text-white font-medium">{c.proveedor}</td>
                      <td className="px-5 py-4 font-mono font-bold" style={{ color: '#fff' }}>{c.consecutivo}</td>
                      <td className="px-5 py-4 text-white/60 max-w-[200px] truncate">{c.asunto}</td>
                      <td className="px-5 py-4"><span className="px-3 py-1 rounded-full text-xs font-medium" style={statusStyle(c.estado)}>{c.estado}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => setViewDetail(c)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>Ver</button>
                          <button onClick={() => { if (confirm(tCf('delRegistro'))) deleteCorreo(c.id) }} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'reportes' && (
        <ReportPanel
          title={tRpt('correosEnviados')}
          columns={reportColumns}
          rows={reportRows}
          filters={reportFilters}
          filename="correos-enviados"
          summableKeys={[]}
        />
      )}
    </div>
  )
}
