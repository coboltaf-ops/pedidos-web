'use client'

import { useState, useEffect } from 'react'
import { usePedidosComidasStore } from '@/features/comidas/store/pedidos-comidas-store'
import { usePollingPedidos } from '@/features/comidas/hooks/use-polling-pedidos'
import type { PedidoComida } from '@/features/comidas/types'

function calcularMinutosTranscurridos(horaStr: string): number {
  const ahora = new Date()
  const [hora, minutos] = horaStr.split(':').map(Number)
  const pedidoHora = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hora, minutos)
  const diff = ahora.getTime() - pedidoHora.getTime()
  return Math.floor(diff / 60000)
}

function getColorTimer(minutosTranscurridos: number): string {
  if (minutosTranscurridos < 10) return '#10b981' // Verde
  if (minutosTranscurridos < 20) return '#f59e0b' // Amarillo
  return '#ef4444' // Rojo
}

function formatearTimer(minutos: number): string {
  if (minutos < 1) return '<1 min'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const mins = minutos % 60
  return `${horas}h ${mins}m`
}

export default function CocinaPage() {
  usePollingPedidos(5000)
  const pedidos = usePedidosComidasStore((s) => s.pedidos)
  const updatePedido = usePedidosComidasStore((s) => s.updatePedido)

  const [marcandoListo, setMarcandoListo] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [timerUpdate, setTimerUpdate] = useState(0)

  // Auto refresh del timer cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerUpdate((t) => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const marcarListo = async (pedido: PedidoComida) => {
    setMarcandoListo(pedido.id)
    setErrorMsg('')

    try {
      const response = await fetch('/api/comidas/marcar-listo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedido.id,
          detalles: pedido.detalles,
        }),
      })

      if (!response.ok) {
        throw new Error('Error marking pedido as listo')
      }

      const result = await response.json()

      // Update local store
      updatePedido(pedido.id, {
        estado: 'LISTO',
        fecha_hora_listo: new Date().toISOString(),
      })

      alert(`✅ ${pedido.consecutivo} marcado como LISTO`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      setErrorMsg(msg)
      alert(`❌ Error: ${msg}`)
    } finally {
      setMarcandoListo(null)
    }
  }

  // Filtrar y ordenar pedidos
  const pedidosEnCocina = pedidos
    .filter((p) => p.estado === 'SOLICITADO' || p.estado === 'EN_COCINA')
    .sort((a, b) => a.hora.localeCompare(b.hora))

  const pedidosParaEntrega = pedidos
    .filter((p) => p.estado === 'LISTO')
    .sort((a, b) => a.hora.localeCompare(b.hora))

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '20px' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <h1 style={{ textAlign: 'center', fontSize: '40px', marginBottom: '10px', fontWeight: 'bold' }}>
          👨‍🍳 COCINA - PANTALLA DE PEDIDOS
        </h1>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: '40px', fontSize: '16px' }}>
          Pedidos en tiempo real • Total: {pedidosEnCocina.length + pedidosParaEntrega.length}
        </p>

        {errorMsg && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '2px solid #ef4444',
            color: '#fca5a5',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '30px',
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* EN COCINA Section */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '20px',
            paddingBottom: '10px',
            borderBottom: '2px solid #f59e0b',
          }}>
            🔥 EN COCINA ({pedidosEnCocina.length})
          </h2>

          {pedidosEnCocina.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
            }}>
              <p style={{ fontSize: '18px', color: '#aaa' }}>😎 Sin pedidos pendientes</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
              {pedidosEnCocina.map((pedido) => {
                const minutosTranscurridos = calcularMinutosTranscurridos(pedido.hora)
                const colorTimer = getColorTimer(minutosTranscurridos)

                return (
                  <div key={pedido.id} style={{
                    background: `${colorTimer}15`,
                    border: `3px solid ${colorTimer}`,
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}>
                    {/* Header */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                        <div>
                          <h3 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0' }}>
                            {pedido.consecutivo}
                          </h3>
                          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
                            Hora: {pedido.hora}
                          </p>
                        </div>
                        <div style={{
                          textAlign: 'center',
                          padding: '10px 15px',
                          background: colorTimer,
                          color: '#000',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                        }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>TIEMPO</p>
                          <p style={{ margin: 0, fontSize: '18px' }}>
                            {formatearTimer(minutosTranscurridos)}
                          </p>
                        </div>
                      </div>

                      {/* Cliente o Mesa */}
                      <div style={{
                        padding: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        marginBottom: '15px',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                      }}>
                        {pedido.tipo === 'Mesa' ? (
                          <>🪑 MESA {pedido.numero_mesa}</>
                        ) : (
                          <>📦 {pedido.cliente}</>
                        )}
                      </div>

                      {/* Platos */}
                      <div style={{ marginBottom: '15px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                          PLATOS
                        </p>
                        {pedido.detalles.map((plato, idx) => (
                          <div key={idx} style={{
                            padding: '10px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                          }}>
                            • {plato.descripcion} <span style={{ color: '#aaa', fontSize: '14px' }}>x{plato.cantidad}</span>
                          </div>
                        ))}
                      </div>

                      {/* Observaciones */}
                      {pedido.detalles.some((d) => d.observaciones) && (
                        <div style={{
                          padding: '12px',
                          background: 'rgba(239,68,68,0.15)',
                          border: '1px solid rgba(239,68,68,0.5)',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#fca5a5',
                          marginBottom: '15px',
                        }}>
                          {pedido.detalles.map((d, idx) => d.observaciones && (
                            <div key={idx}>⚠️ {d.descripcion}: {d.observaciones}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Botón Marcar Listo */}
                    <button
                      onClick={() => marcarListo(pedido)}
                      disabled={marcandoListo === pedido.id}
                      style={{
                        width: '100%',
                        padding: '15px',
                        background: marcandoListo === pedido.id ? '#999' : 'linear-gradient(135deg, #10b981, #34d399)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: marcandoListo === pedido.id ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        fontSize: '16px',
                      }}
                    >
                      {marcandoListo === pedido.id ? '⏳ MARCANDO...' : '✓ LISTO PARA ENTREGAR'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PARA ENTREGA Section */}
        <div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '20px',
            paddingBottom: '10px',
            borderBottom: '2px solid #10b981',
          }}>
            ✅ PARA ENTREGA ({pedidosParaEntrega.length})
          </h2>

          {pedidosParaEntrega.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
            }}>
              <p style={{ fontSize: '18px', color: '#aaa' }}>Sin pedidos listos</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {pedidosParaEntrega.map((pedido) => (
                <div key={pedido.id} style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '2px solid #10b981',
                  borderRadius: '12px',
                  padding: '20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                    <div>
                      <h3 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 5px 0' }}>
                        {pedido.consecutivo}
                      </h3>
                      <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
                        Listo: {pedido.fecha_hora_listo ? new Date(pedido.fecha_hora_listo).toLocaleTimeString('es-CO') : 'N/A'}
                      </p>
                    </div>
                    <span style={{
                      padding: '8px 16px',
                      background: '#10b981',
                      color: '#000',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '12px',
                    }}>
                      ✓ LISTO
                    </span>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    marginBottom: '15px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}>
                    {pedido.tipo === 'Mesa' ? (
                      <>🪑 MESA {pedido.numero_mesa}</>
                    ) : (
                      <>📦 {pedido.cliente}</>
                    )}
                  </div>

                  <div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                      PLATOS
                    </p>
                    {pedido.detalles.map((plato, idx) => (
                      <p key={idx} style={{
                        margin: '8px 0',
                        padding: '8px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}>
                        • {plato.descripcion} x{plato.cantidad}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
