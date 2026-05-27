'use client'

import { useState } from 'react'
import { useCierreCajaStore, cajaAbierta, nextCajaConsecutivo } from '@/features/comidas/store/cierre-caja-store'
import { usePollingCaja } from '@/features/comidas/hooks/use-polling-caja'
import type { CierreCaja } from '@/features/comidas/types'

export default function CajaPage() {
  usePollingCaja(5000)
  const cajas = useCierreCajaStore((s) => s.cajas)
  const addCaja = useCierreCajaStore((s) => s.addCaja)
  const updateCaja = useCierreCajaStore((s) => s.updateCaja)

  const [montoContado, setMontoContado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const openCaja = cajaAbierta(cajas)

  const handleAbrirCaja = async () => {
    try {
      const nuevaCaja: CierreCaja = {
        id: `caja-${Date.now()}`,
        consecutivo: nextCajaConsecutivo(cajas),
        nro_caja: (cajas.length || 0) + 1,
        fecha_apertura: new Date().toISOString(),
        monto_inicial: 500000,
        estado: 'Abierta',
        usuario_abre: 'admin@spin.com',
        movimientos: [],
        observaciones: '',
      }

      addCaja(nuevaCaja)

      // Save to server
      const response = await fetch('/api/data/cierre-caja', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([...cajas, nuevaCaja]),
      })

      if (!response.ok) throw new Error('Error saving caja')
      setMontoContado('')
      setObservaciones('')
    } catch (err) {
      alert('Error abriendo caja: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  const handleCerrarCaja = async () => {
    if (!openCaja) return
    setErrorMsg('')

    if (!montoContado.trim()) {
      setErrorMsg('Ingresa el monto contado')
      return
    }

    setProcesando(true)

    try {
      const montoContadoNum = parseInt(montoContado, 10)
      const montoEfectivo = openCaja.movimientos
        .filter((m) => m.forma_pago === 'Efectivo')
        .reduce((sum, m) => sum + m.monto, 0)

      const montoEsperado = openCaja.monto_inicial + montoEfectivo
      const diferencia = montoContadoNum - montoEsperado

      const cajaActualizada: CierreCaja = {
        ...openCaja,
        estado: 'Cerrada',
        fecha_cierre: new Date().toISOString(),
        monto_contado_efectivo: montoContadoNum,
        usuario_cierra: 'admin@spin.com',
        observaciones,
      }

      updateCaja(openCaja.id, cajaActualizada)

      // Save to server
      const cajasActualizadas = cajas.map((c) =>
        c.id === openCaja.id ? cajaActualizada : c
      )
      const response = await fetch('/api/data/cierre-caja', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cajasActualizadas),
      })

      if (!response.ok) throw new Error('Error saving caja')

      alert(`Caja cerrada. Diferencia: $${diferencia.toLocaleString()} (${diferencia === 0 ? 'EXACTO' : diferencia > 0 ? 'SOBRANTE' : 'FALTANTE'})`)
      setMontoContado('')
      setObservaciones('')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error cerrando caja')
    } finally {
      setProcesando(false)
    }
  }

  const imprimirCierre = () => {
    window.print()
  }

  if (!openCaja) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '40px 20px' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '20px', fontWeight: 'bold' }}>🔐 CUADRE DE CAJA</h1>
          <p style={{ fontSize: '16px', color: '#aaa', marginBottom: '40px' }}>
            No hay caja abierta
          </p>
          <button onClick={handleAbrirCaja} style={{
            width: '100%',
            padding: '20px',
            background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '18px',
          }}>
            🔓 ABRIR CAJA
          </button>
        </div>
      </div>
    )
  }

  // Calcular totales
  const montoEfectivo = openCaja.movimientos
    .filter((m) => m.forma_pago === 'Efectivo')
    .reduce((sum, m) => sum + m.monto, 0)

  const montoTarjeta = openCaja.movimientos
    .filter((m) => m.forma_pago === 'Tarjeta')
    .reduce((sum, m) => sum + m.monto, 0)

  const montoTransferencia = openCaja.movimientos
    .filter((m) => m.forma_pago === 'Transferencia')
    .reduce((sum, m) => sum + m.monto, 0)

  const totalVentas = montoEfectivo + montoTarjeta + montoTransferencia
  const montoEsperadoEfectivo = openCaja.monto_inicial + montoEfectivo

  let diferencia = 0
  let colorDiferencia = '#aaa'
  if (montoContado) {
    diferencia = parseInt(montoContado, 10) - montoEsperadoEfectivo
    if (diferencia === 0) {
      colorDiferencia = '#10b981' // Verde
    } else if (diferencia > 0) {
      colorDiferencia = '#f59e0b' // Amarillo (sobrante)
    } else {
      colorDiferencia = '#ef4444' // Rojo (faltante)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '20px' }}>
      <style>{`
        @media print {
          body { background: white; color: black; }
          .no-print { display: none; }
          .recibo-print { background: white; color: black; }
        }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', fontSize: '36px', marginBottom: '10px', fontWeight: 'bold' }}>
          💰 CUADRE DE CAJA
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }}>
          {/* Apertura/Estado */}
          <div style={{
            background: openCaja.estado === 'Abierta' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: openCaja.estado === 'Abierta' ? '2px solid #10b981' : '2px solid #ef4444',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>
              {openCaja.estado === 'Abierta' ? '🔓 CAJA ABIERTA' : '🔒 CAJA CERRADA'}
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Consecutivo</p>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{openCaja.consecutivo}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Hora Apertura</p>
              <p style={{ margin: 0, fontSize: '16px' }}>
                {new Date(openCaja.fecha_apertura).toLocaleTimeString('es-CO')}
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Monto Inicial</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                ${openCaja.monto_inicial.toLocaleString()}
              </p>
            </div>

            {openCaja.estado === 'Cerrada' && (
              <div>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Hora Cierre</p>
                <p style={{ margin: 0, fontSize: '16px' }}>
                  {openCaja.fecha_cierre ? new Date(openCaja.fecha_cierre).toLocaleTimeString('es-CO') : 'N/A'}
                </p>
              </div>
            )}
          </div>

          {/* Resumen Ventas */}
          <div style={{
            background: 'rgba(234,88,12,0.1)',
            border: '2px solid #ea580c',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>📊 VENTAS DEL DÍA</h2>

            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #333' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Efectivo</p>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>${montoEfectivo.toLocaleString()}</p>
            </div>

            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #333' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Tarjeta</p>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>${montoTarjeta.toLocaleString()}</p>
            </div>

            <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #333' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Transferencia</p>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>${montoTransferencia.toLocaleString()}</p>
            </div>

            <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>TOTAL VENTAS</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#ea580c' }}>
                ${totalVentas.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Cierre de Caja (solo si está abierta) */}
        {openCaja.estado === 'Abierta' && (
          <div style={{
            background: 'rgba(245,158,11,0.1)',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '40px',
          }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>🔐 CIERRE DE CAJA</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Monto Inicial</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                  ${openCaja.monto_inicial.toLocaleString()}
                </p>
              </div>
              <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Ventas Efectivo</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                  ${montoEfectivo.toLocaleString()}
                </p>
              </div>
              <div style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#888' }}>Esperado</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                  ${montoEsperadoEfectivo.toLocaleString()}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                Monto Contado (Efectivo físico)
              </label>
              <input
                type="number"
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #f59e0b',
                  borderRadius: '6px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  fontWeight: 'bold',
                }}
              />
            </div>

            {montoContado && (
              <div style={{
                marginBottom: '20px',
                padding: '15px',
                background: diferencia === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: diferencia === 0 ? '2px solid #10b981' : '2px solid #ef4444',
                borderRadius: '6px',
              }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                  DIFERENCIA
                </p>
                <p style={{
                  margin: '0 0 5px 0',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: colorDiferencia,
                }}>
                  ${diferencia.toLocaleString()}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
                  {diferencia === 0 ? '✓ CUADRE EXACTO' : diferencia > 0 ? `📈 SOBRANTE de $${Math.abs(diferencia).toLocaleString()}` : `📉 FALTANTE de $${Math.abs(diferencia).toLocaleString()}`}
                </p>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas del cierre..."
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #666',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  minHeight: '80px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              onClick={handleCerrarCaja}
              disabled={procesando}
              className="no-print"
              style={{
                width: '100%',
                padding: '15px',
                background: procesando ? '#999' : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: procesando ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
            >
              {procesando ? '⏳ PROCESANDO...' : '🔐 CERRAR CAJA'}
            </button>
          </div>
        )}

        {/* Transacciones */}
        <div style={{
          background: 'rgba(99,102,241,0.1)',
          border: '2px solid #6366f1',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '40px',
        }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>📋 TRANSACCIONES</h2>

          {openCaja.movimientos.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>
              Sin transacciones
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #6366f1' }}>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                      Pedido
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                      Forma Pago
                    </th>
                    <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                      Monto
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
                      Hora
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openCaja.movimientos.map((mov) => (
                    <tr key={mov.id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{mov.consecutivo_pedido}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          background:
                            mov.forma_pago === 'Efectivo'
                              ? 'rgba(34,197,94,0.2)'
                              : mov.forma_pago === 'Tarjeta'
                                ? 'rgba(59,130,246,0.2)'
                                : 'rgba(168,85,247,0.2)',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}>
                          {mov.forma_pago}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                        ${mov.monto.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', color: '#888', fontSize: '12px' }}>
                        {new Date(mov.fecha_hora).toLocaleTimeString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Botón Imprimir */}
        {openCaja.estado === 'Cerrada' && (
          <div className="no-print" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <button onClick={imprimirCierre} style={{
              padding: '15px 30px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
            }}>
              🖨️ IMPRIMIR CIERRE
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
