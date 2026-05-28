'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useTareasStore } from '@/features/tareas/store/tareas-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'

const HUBS = [
  {
    href: '/dashboard-mp',
    icon: '🔶',
    title: 'Dashboard Materia Prima',
    desc: 'Pesajes, kg recibidos, top proveedores, OCs y existencias',
    tipo: 'Materia Prima',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.18)',
    border: 'rgba(249,115,22,0.5)',
  },
  {
    href: '/dashboard-ms',
    icon: '🔷',
    title: 'Dashboard Materiales y Suministros',
    desc: 'Stock crítico, OCs, recepciones, salidas y valor por bodega',
    tipo: 'Materiales y Suministros',
    color: '#2563eb',
    bg: 'rgba(59,130,246,0.18)',
    border: 'rgba(59,130,246,0.5)',
  },
  {
    href: '/dashboard-pt',
    icon: '🟢',
    title: 'Dashboard Producto Terminado',
    desc: 'Ventas, despachos, top clientes, márgenes y clases',
    tipo: 'Producto Terminado',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.18)',
    border: 'rgba(34,197,94,0.5)',
  },
]

export default function DashboardHubPage() {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tareas = useTareasStore(s => s.tareas)
  const setTipoActivo = useTipoInventarioSesion(s => s.setTipoActivo)

  // Tareas por situación (transversales — no se filtran por tipo)
  const estadosTarea: Record<string, number> = {}
  tareas.forEach(t => {
    const s = t.situacion || 'Sin estado'
    estadosTarea[s] = (estadosTarea[s] || 0) + 1
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">📊</span>
        <h1 className="text-2xl font-extrabold text-white">{t('title')}</h1>
      </div>

      {/* Hubs hacia los 3 dashboards específicos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {HUBS.map(h => (
          <Link key={h.href} href={h.href}
            onClick={() => setTipoActivo(h.tipo)}
            className="block rounded-2xl p-6 transition-all hover:scale-[1.02] group"
            style={{ background: h.bg, border: `2px solid ${h.border}`, boxShadow: `0 4px 16px ${h.bg}` }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{h.icon}</span>
              <h2 className="text-lg font-extrabold text-white" style={{ textShadow: `0 0 8px ${h.color}66` }}>{h.title}</h2>
            </div>
            <p className="text-sm text-white/80 mb-4">{h.desc}</p>
            <div className="flex items-center justify-end text-white/70 group-hover:text-white text-sm font-bold transition-colors">
              Abrir dashboard →
            </div>
          </Link>
        ))}
      </div>

      {/* Agente de Voz (transversal) */}
      <Link href="/asistente" className="block rounded-2xl p-6 transition-all hover:scale-[1.01] group"
        style={{ background: 'linear-gradient(135deg, rgba(30,58,138,0.4), rgba(59,130,246,0.2))', border: '1px solid rgba(96,165,250,0.3)' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
            style={{ background: 'rgba(96,165,250,0.95)', border: '1px solid rgba(96,165,250,0.3)' }}>🤖</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">{t('agenteTitle')}</h2>
            <p className="text-sm text-white/50">{t('agenteDescripcion')}</p>
          </div>
          <div className="text-white/30 group-hover:text-white/60 text-2xl transition-colors">→</div>
        </div>
      </Link>

      {/* Tareas (transversal) */}
      {Object.keys(estadosTarea).length > 0 && (
        <Link href="/tareas" className="block rounded-2xl p-6 transition-all hover:scale-[1.005] hover:bg-white/[0.07] cursor-pointer group"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white">{t('graficoTareasTitle')}</h2>
            <span className="text-white/30 group-hover:text-white/70 text-sm transition-colors">{tCommon('goToModule')} →</span>
          </div>
          <p className="text-xs text-white/40 mb-6">{t('graficoTareasDescripcion')} · {tCommon('clickForDetail')}</p>

          {(() => {
            const COLORS: Record<string, string> = {
              'Pendiente': '#f59e0b', 'En Proceso': '#3b82f6',
              'Completada': '#10b981', 'Vencida': '#ef4444',
              'Cancelada': '#6b7280', 'Sin estado': '#94a3b8',
            }
            const entries = Object.entries(estadosTarea)
            const total = entries.reduce((sum, [, c]) => sum + c, 0)
            const radius = 95
            const cx = 110
            const cy = 110
            let acumulado = 0

            const segmentos = entries.map(([estado, count]) => {
              const porcentaje = count / total
              const startAngle = acumulado * 2 * Math.PI - Math.PI / 2
              acumulado += porcentaje
              const endAngle = acumulado * 2 * Math.PI - Math.PI / 2
              const x1 = cx + radius * Math.cos(startAngle)
              const y1 = cy + radius * Math.sin(startAngle)
              const x2 = cx + radius * Math.cos(endAngle)
              const y2 = cy + radius * Math.sin(endAngle)
              const largeArc = porcentaje > 0.5 ? 1 : 0
              const path = porcentaje >= 1
                ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
                : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
              const midAngle = (startAngle + endAngle) / 2
              const labelRadius = radius * 0.6
              const labelX = cx + labelRadius * Math.cos(midAngle)
              const labelY = cy + labelRadius * Math.sin(midAngle)
              return { estado, count, porcentaje, color: COLORS[estado] || '#94a3b8', path, labelX, labelY }
            })

            return (
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex items-center justify-center">
                  <svg width="220" height="220" viewBox="0 0 220 220">
                    {segmentos.map((seg, i) => (
                      <path key={i} d={seg.path} fill={seg.color}
                        stroke="rgba(255,255,255,0.15)" strokeWidth="2"
                        style={{ filter: `drop-shadow(0 0 8px ${seg.color}66)` }} />
                    ))}
                    {segmentos.map((seg, i) => seg.porcentaje >= 0.05 && (
                      <text key={`label-${i}`} x={seg.labelX} y={seg.labelY}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="#fff" fontSize="14" fontWeight="bold"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                        {(seg.porcentaje * 100).toFixed(0)}%
                      </text>
                    ))}
                  </svg>
                </div>
                <div className="flex-1 space-y-3 w-full">
                  {segmentos.map(seg => (
                    <div key={seg.estado} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded shrink-0" style={{ background: seg.color, boxShadow: `0 0 8px ${seg.color}66` }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">{seg.estado}</span>
                          <span className="text-xs font-bold text-white/80">
                            {seg.count} ({(seg.porcentaje * 100).toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${seg.porcentaje * 100}%`, background: seg.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </Link>
      )}
    </div>
  )
}
