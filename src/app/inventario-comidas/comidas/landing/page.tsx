'use client'

import { useState } from 'react'
import { useProductosComidasStore } from '@/features/inventario-comidas/store/productos-comidas-store'
import { usePedidosComidasStore, nextPedidoConsecutivo } from '@/features/comidas/store/pedidos-comidas-store'
import { useCierreCajaStore, cajaAbierta } from '@/features/comidas/store/cierre-caja-store'
import { useGuardarPedido } from '@/features/comidas/hooks/use-guardar-pedido'
import type { PedidoComida, DetallePedidoComida } from '@/features/comidas/types'

interface CarritoItem {
  id: string
  codigo: string
  descripcion: string
  precio_unitario: number
  cantidad: number
  observaciones: string
}

export default function LandingPage() {
  const productos = useProductosComidasStore((s) => s.productos)
  const pedidos = usePedidosComidasStore((s) => s.pedidos)
  const cajas = useCierreCajaStore((s) => s.cajas)
  const { guardarPedido, loading, error } = useGuardarPedido()

  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [showCarrito, setShowCarrito] = useState(false)
  const [step, setStep] = useState<'menu' | 'checkout' | 'confirmation'>('menu')
  const [clienteNombre, setClienteNombre] = useState('')
  const [formaPago, setFormaPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo')
  const [pedidoConfirmado, setPedidoConfirmado] = useState<PedidoComida | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Filter productos for Platos (only menu items)
  const platosComidasItems = productos.filter((p) => p.tipo === 'Plato' && p.situacion === 'Activo' && p.disponible)

  const total = carrito.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0)

  const agregarCarrito = (producto: typeof productos[0]) => {
    const existe = carrito.find((p) => p.id === producto.id)
    if (existe) {
      setCarrito(carrito.map((p) =>
        p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
      ))
    } else {
      setCarrito([...carrito, {
        id: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        precio_unitario: producto.precio_unitario,
        cantidad: 1,
        observaciones: '',
      }])
    }
  }

  const removerCarrito = (id: string) => {
    setCarrito(carrito.filter((p) => p.id !== id))
  }

  const actualizarCantidad = (id: string, cantidad: number) => {
    if (cantidad <= 0) {
      removerCarrito(id)
    } else {
      setCarrito(carrito.map((p) =>
        p.id === id ? { ...p, cantidad } : p
      ))
    }
  }

  const actualizarObservaciones = (id: string, observaciones: string) => {
    setCarrito(carrito.map((p) =>
      p.id === id ? { ...p, observaciones } : p
    ))
  }

  const confirmarPedido = async () => {
    setErrorMsg('')

    if (!clienteNombre.trim()) {
      setErrorMsg('Ingresa tu nombre para continuar')
      return
    }

    if (carrito.length === 0) {
      setErrorMsg('Agrega al menos un plato')
      return
    }

    const openCaja = cajaAbierta(cajas)
    if (!openCaja) {
      setErrorMsg('No hay caja abierta. Contacta al restaurante.')
      return
    }

    try {
      const consecutivo = nextPedidoConsecutivo(pedidos)
      const nroPedido = pedidos.length + 1
      const ahora = new Date()
      const fecha = ahora.toISOString().split('T')[0]
      const hora = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

      const detalles: DetallePedidoComida[] = carrito.map((item) => ({
        id: `det-${item.id}-${Date.now()}`,
        producto_id: item.id,
        codigo: item.codigo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.precio_unitario * item.cantidad,
        observaciones: item.observaciones,
      }))

      const subtotal = detalles.reduce((sum, d) => sum + d.subtotal, 0)
      const impuesto = 0 // Sin impuesto para comidas delivery
      const totalPedido = subtotal + impuesto

      const nuevoPedido: PedidoComida = {
        id: `ped-${consecutivo}`,
        consecutivo,
        nro_pedido: nroPedido,
        tipo: 'Web',
        fecha,
        hora,
        cliente: clienteNombre,
        detalles,
        subtotal,
        impuesto,
        total: totalPedido,
        estado: 'SOLICITADO',
        pagos: [
          {
            id: `pago-${Date.now()}`,
            persona: clienteNombre,
            monto: totalPedido,
            forma_pago: formaPago,
            fecha_hora: ahora.toISOString(),
            pagado: true,
          },
        ],
        total_pagado: totalPedido,
        pagado_completo: true,
        observaciones: '',
      }

      await guardarPedido(nuevoPedido)
      setPedidoConfirmado(nuevoPedido)
      setStep('confirmation')
      setCarrito([])
      setClienteNombre('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar pedido'
      setErrorMsg(msg)
    }
  }

  const imprimirRecibo = () => {
    window.print()
  }

  if (step === 'confirmation' && pedidoConfirmado) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '40px 20px' }}>
        <style>{`
          @media print {
            body { background: white; color: black; }
            .no-print { display: none; }
            .recibo-print { background: white; color: black; padding: 20px; border: 1px solid #000; }
          }
        `}</style>

        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="recibo-print" style={{
            padding: '30px',
            border: '2px solid #ea580c',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.5)',
            textAlign: 'center',
          }}>
            <h1 style={{ fontSize: '32px', marginBottom: '10px', fontWeight: 'bold' }}>✅ ¡PEDIDO CONFIRMADO!</h1>

            <div style={{
              background: 'rgba(234,88,12,0.2)',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              borderLeft: '4px solid #ea580c',
            }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ea580c', margin: '0 0 10px 0' }}>
                {pedidoConfirmado.consecutivo}
              </p>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#aaa' }}>
                Hora: {pedidoConfirmado.hora}
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px', marginBottom: '20px', textAlign: 'left' }}>
              <p style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                CLIENTE: {pedidoConfirmado.cliente}
              </p>

              <div style={{ fontSize: '14px', marginBottom: '15px' }}>
                <p style={{ margin: '8px 0', fontWeight: 'bold' }}>PLATOS:</p>
                {pedidoConfirmado.detalles.map((d, idx) => (
                  <div key={idx} style={{
                    margin: '8px 0',
                    padding: '10px',
                    background: 'rgba(234,88,12,0.1)',
                    borderRadius: '4px',
                  }}>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
                      {d.descripcion} x{d.cantidad}
                    </p>
                    <p style={{ margin: '0', color: '#aaa', fontSize: '12px' }}>
                      ${d.subtotal.toLocaleString()} COP
                    </p>
                    {d.observaciones && (
                      <p style={{ margin: '5px 0 0 0', color: '#fca5a5', fontSize: '12px' }}>
                        Nota: {d.observaciones}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>Subtotal:</span>
                  <span>${pedidoConfirmado.subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', color: '#ea580c' }}>
                  <span>TOTAL:</span>
                  <span>${pedidoConfirmado.total.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '14px', color: '#aaa' }}>
                  <span>Forma de pago:</span>
                  <span>{pedidoConfirmado.pagos[0]?.forma_pago || 'Efectivo'}</span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '20px' }}>
              Tu pedido está siendo preparado. Te notificaremos cuando esté listo.
            </p>

            <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button onClick={imprimirRecibo} style={{
                flex: 1,
                padding: '15px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}>
                🖨️ IMPRIMIR RECIBO
              </button>
              <button onClick={() => {
                setStep('menu')
                setPedidoConfirmado(null)
              }} style={{
                flex: 1,
                padding: '15px',
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}>
                📱 NUEVO PEDIDO
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      {/* Welcome Banner */}
      <div style={{
        background: '#ea580c',
        color: '#000',
        padding: '16px 20px',
        textAlign: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        letterSpacing: '0.5px',
      }}>
        ¡Bienvenido a Happy Express!
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Header */}
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px',
          paddingBottom: '20px',
          borderBottom: '2px solid #ea580c',
        }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>🍽️ PORTAL DE COMIDAS</h1>
          <button onClick={() => setShowCarrito(!showCarrito)} style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #ea580c, #ff6b35)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
          }}>
            🛒 Carrito ({carrito.length})
          </button>
        </nav>

        {step === 'menu' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '30px' }}>
            {/* Menu */}
            <div>
              <h2 style={{ fontSize: '24px', marginBottom: '20px', fontWeight: 'bold' }}>Nuestros Platos</h2>

              {platosComidasItems.length === 0 ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                }}>
                  <p style={{ fontSize: '18px', color: '#aaa' }}>
                    No hay platos disponibles. Contacta al restaurante.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                  {platosComidasItems.map((plato) => (
                    <div key={plato.id} style={{
                      background: 'rgba(234,88,12,0.05)',
                      border: '1px solid rgba(234,88,12,0.3)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      padding: '20px',
                    }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', margin: '0 0 10px 0' }}>
                        {plato.descripcion}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px', margin: '0 0 10px 0' }}>
                        {plato.categoria || 'Comida'}
                      </p>
                      <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#ea580c', marginBottom: '15px' }}>
                        ${plato.precio_unitario.toLocaleString()}
                      </p>
                      <button onClick={() => agregarCarrito(plato)} style={{
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #ea580c, #ff6b35)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}>
                        + AGREGAR
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Carrito Sidebar */}
            {showCarrito && (
              <div style={{
                background: 'rgba(16,185,129,0.05)',
                border: '2px solid #10b981',
                borderRadius: '12px',
                padding: '20px',
                height: 'fit-content',
              }}>
                <h3 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold', margin: '0 0 20px 0' }}>
                  Tu Carrito
                </h3>

                {carrito.length === 0 ? (
                  <p style={{ color: '#666', textAlign: 'center' }}>
                    Sin platos seleccionados
                  </p>
                ) : (
                  <>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
                      {carrito.map((item) => (
                        <div key={item.id} style={{
                          padding: '12px 0',
                          borderBottom: '1px solid #333',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '14px' }}>
                                {item.descripcion}
                              </p>
                              <p style={{ margin: 0, color: '#aaa', fontSize: '12px' }}>
                                ${item.precio_unitario.toLocaleString()}
                              </p>
                            </div>
                            <button onClick={() => removerCarrito(item.id)} style={{
                              padding: '4px 8px',
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}>
                              ✕
                            </button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <button onClick={() => actualizarCantidad(item.id, item.cantidad - 1)} style={{
                              padding: '4px 8px',
                              background: '#666',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}>
                              −
                            </button>
                            <input type="number" value={item.cantidad} onChange={(e) => actualizarCantidad(item.id, parseInt(e.target.value))} style={{
                              width: '40px',
                              padding: '4px',
                              background: '#111',
                              color: '#fff',
                              border: '1px solid #333',
                              borderRadius: '4px',
                              textAlign: 'center',
                            }} />
                            <button onClick={() => actualizarCantidad(item.id, item.cantidad + 1)} style={{
                              padding: '4px 8px',
                              background: '#666',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}>
                              +
                            </button>
                            <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
                              ${(item.precio_unitario * item.cantidad).toLocaleString()}
                            </span>
                          </div>
                          <input
                            type="text"
                            placeholder="Observaciones..."
                            value={item.observaciones}
                            onChange={(e) => actualizarObservaciones(item.id, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px',
                              background: '#111',
                              color: '#fff',
                              border: '1px solid #333',
                              borderRadius: '4px',
                              fontSize: '12px',
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{
                      padding: '15px 0',
                      borderTop: '2px solid #10b981',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      marginBottom: '20px',
                    }}>
                      <span>Total:</span>
                      <span style={{ color: '#10b981' }}>${total.toLocaleString()}</span>
                    </div>

                    <button onClick={() => setStep('checkout')} style={{
                      width: '100%',
                      padding: '15px',
                      background: 'linear-gradient(135deg, #10b981, #34d399)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '16px',
                    }}>
                      🛒 IR A PAGAR
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'checkout' && (
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div style={{
              background: 'rgba(245,158,11,0.1)',
              border: '2px solid #f59e0b',
              borderRadius: '12px',
              padding: '30px',
            }}>
              <h2 style={{ fontSize: '24px', marginBottom: '30px', fontWeight: 'bold' }}>📋 FINALIZAR PEDIDO</h2>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                  Tu Nombre
                </label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ingresa tu nombre"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#111',
                    color: '#fff',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                  Forma de Pago
                </label>
                <select value={formaPago} onChange={(e) => setFormaPago(e.target.value as any)} style={{
                  width: '100%',
                  padding: '12px',
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #f59e0b',
                  borderRadius: '6px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}>
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Tarjeta">💳 Tarjeta</option>
                  <option value="Transferencia">🏦 Transferencia</option>
                </select>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
              }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#aaa' }}>TOTAL A PAGAR</p>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>
                  ${total.toLocaleString()}
                </p>
              </div>

              {(errorMsg || error) && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                  fontSize: '14px',
                }}>
                  ⚠️ {errorMsg || error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setStep('menu')}
                  style={{
                    flex: 1,
                    padding: '15px',
                    background: '#666',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  ATRÁS
                </button>
                <button
                  onClick={confirmarPedido}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '15px',
                    background: loading ? '#999' : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {loading ? '⏳ PROCESANDO...' : '✓ CONFIRMAR PEDIDO'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
