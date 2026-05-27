'use client'

import { useState } from 'react'
import { useProductosComidasStore } from '@/features/inventario-comidas/store/productos-comidas-store'
import { usePedidosComidasStore, nextPedidoConsecutivo } from '@/features/comidas/store/pedidos-comidas-store'
import { useCierreCajaStore, cajaAbierta } from '@/features/comidas/store/cierre-caja-store'
import { useGuardarPedido } from '@/features/comidas/hooks/use-guardar-pedido'
import type { PedidoComida, DetallePedidoComida, PagoComida } from '@/features/comidas/types'

interface CarritoItem {
  id: string
  codigo: string
  descripcion: string
  precio_unitario: number
  cantidad: number
  observaciones: string
}

interface PersonaPago {
  id: string
  nombre: string
  monto: number
  forma_pago: 'Efectivo' | 'Tarjeta' | 'Transferencia'
  pagado: boolean
}

const ScreenWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: '100vh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
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
    {children}
  </div>
)

export default function QRPage() {
  const productos = useProductosComidasStore((s) => s.productos)
  const pedidos = usePedidosComidasStore((s) => s.pedidos)
  const cajas = useCierreCajaStore((s) => s.cajas)
  const { guardarPedido, loading } = useGuardarPedido()

  const [numeroMesa, setNumeroMesa] = useState<number | null>(null)
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [step, setStep] = useState<'mesa' | 'menu' | 'cuenta'>('mesa')
  const [showDividir, setShowDividir] = useState(false)
  const [numeroDivisiones, setNumeroDivisiones] = useState(2)
  const [personas, setPersonas] = useState<PersonaPago[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const platosComidasItems = productos.filter((p) => p.tipo === 'Plato' && p.situacion === 'Activo' && p.disponible)

  const total = carrito.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0)

  const mesas = Array.from({ length: 20 }, (_, i) => i + 1)

  const seleccionarMesa = (mesa: number) => {
    setNumeroMesa(mesa)
    setCarrito([])
    setStep('menu')
    setErrorMsg('')
  }

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

  const enviarPedidoACocina = async () => {
    setErrorMsg('')

    if (!numeroMesa) {
      setErrorMsg('Selecciona una mesa')
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
      const impuesto = 0
      const totalPedido = subtotal + impuesto

      const nuevoPedido: PedidoComida = {
        id: `ped-${consecutivo}`,
        consecutivo,
        nro_pedido: nroPedido,
        tipo: 'Mesa',
        fecha,
        hora,
        cliente: `Mesa ${numeroMesa}`,
        numero_mesa: numeroMesa,
        detalles,
        subtotal,
        impuesto,
        total: totalPedido,
        estado: 'SOLICITADO',
        pagos: [],
        total_pagado: 0,
        pagado_completo: false,
        observaciones: '',
      }

      await guardarPedido(nuevoPedido)
      setCarrito([])
      setStep('cuenta')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar pedido'
      setErrorMsg(msg)
    }
  }

  const initializarDivision = () => {
    const montoBase = Math.floor(total / numeroDivisiones)
    const personasArray: PersonaPago[] = Array.from({ length: numeroDivisiones }, (_, i) => ({
      id: `persona-${i}`,
      nombre: `Persona ${i + 1}`,
      monto: montoBase,
      forma_pago: 'Efectivo',
      pagado: false,
    }))

    // Distribuir resto
    const resto = total - montoBase * numeroDivisiones
    for (let i = 0; i < resto; i++) {
      personasArray[i].monto += 1
    }

    setPersonas(personasArray)
    setShowDividir(true)
  }

  const actualizarPersona = (id: string, updates: Partial<PersonaPago>) => {
    setPersonas(personas.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    ))
  }

  const validarDivision = () => {
    const suma = personas.reduce((sum, p) => sum + p.monto, 0)
    const diferencia = Math.abs(suma - total)
    return diferencia <= 1 // Tolerancia de $1
  }

  const procesarDivisionCuenta = async () => {
    if (!validarDivision()) {
      setErrorMsg(`La suma debe ser igual a $${total.toLocaleString()} (tolerancia ±$1)`)
      return
    }

    if (!personas.every((p) => p.pagado)) {
      setErrorMsg('Todos los comensales deben confirmar el pago')
      return
    }

    // Crear movimientos de caja para cada persona
    // Aquí solo mostramos éxito - en producción se ejecutaría el guardado
    setShowDividir(false)
    alert('Cuenta pagada correctamente. ¡Gracias!')
    setStep('mesa')
    setNumeroMesa(null)
    setPersonas([])
  }

  // Pantalla de selección de mesa
  if (step === 'mesa') {
    return (
      <ScreenWrapper>
        <div style={{ padding: '40px 20px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h1 style={{ textAlign: 'center', fontSize: '32px', marginBottom: '40px', fontWeight: 'bold' }}>
            📱 SELECCIONA TU MESA
          </h1>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '15px' }}>
            {mesas.map((mesa) => (
              <button
                key={mesa}
                onClick={() => seleccionarMesa(mesa)}
                style={{
                  padding: '30px',
                  background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '20px',
                  transition: 'all 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                🪑<br />MESA<br />{mesa}
              </button>
            ))}
          </div>
          </div>
        </div>
      </ScreenWrapper>
    )
  }

  // Pantalla de menú
  if (step === 'menu' && numeroMesa) {
    return (
      <ScreenWrapper>
        <div style={{ padding: '20px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <nav style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '40px',
            paddingBottom: '20px',
            borderBottom: '2px solid #3b82f6',
          }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              🪑 MESA {numeroMesa}
            </h1>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep('mesa')} style={{
                padding: '12px 24px',
                background: '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}>
                ← CAMBIAR MESA
              </button>
              <button onClick={() => setStep('cuenta')} style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981, #34d399)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}>
                🧾 CONSULTAR CUENTA ({carrito.length})
              </button>
            </div>
          </nav>

          {/* Menu */}
          {platosComidasItems.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
            }}>
              <p style={{ fontSize: '18px', color: '#aaa' }}>
                No hay platos disponibles.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {platosComidasItems.map((plato) => (
                <div key={plato.id} style={{
                  background: 'rgba(59,130,246,0.05)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  padding: '20px',
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', margin: '0 0 10px 0' }}>
                    {plato.descripcion}
                  </h3>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '15px' }}>
                    ${plato.precio_unitario.toLocaleString()}
                  </p>
                  <button onClick={() => agregarCarrito(plato)} style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
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
        </div>
      </ScreenWrapper>
    )
  }

  // Pantalla de cuenta
  if (step === 'cuenta' && numeroMesa) {
    return (
      <ScreenWrapper>
        <div style={{ padding: '20px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{
            background: 'rgba(16,185,129,0.05)',
            border: '2px solid #10b981',
            borderRadius: '12px',
            padding: '30px',
          }}>
            <h2 style={{ fontSize: '24px', marginBottom: '20px', fontWeight: 'bold' }}>
              🧾 CUENTA - MESA {numeroMesa}
            </h2>

            {showDividir ? (
              <>
                <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '20px' }}>
                  Dividir entre {numeroDivisiones} personas
                </p>

                <div style={{ marginBottom: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                  {personas.map((persona, idx) => (
                    <div key={persona.id} style={{
                      padding: '15px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      marginBottom: '10px',
                    }}>
                      <div style={{ marginBottom: '10px' }}>
                        <input
                          type="text"
                          value={persona.nombre}
                          onChange={(e) => actualizarPersona(persona.id, { nombre: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#111',
                            color: '#fff',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            marginBottom: '8px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <input
                          type="number"
                          value={persona.monto}
                          onChange={(e) => actualizarPersona(persona.id, { monto: parseInt(e.target.value) })}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: '#111',
                            color: '#fff',
                            border: '1px solid #333',
                            borderRadius: '4px',
                          }}
                        />
                        <select
                          value={persona.forma_pago}
                          onChange={(e) => actualizarPersona(persona.id, { forma_pago: e.target.value as any })}
                          style={{
                            padding: '8px',
                            background: '#111',
                            color: '#fff',
                            border: '1px solid #333',
                            borderRadius: '4px',
                          }}
                        >
                          <option value="Efectivo">Efectivo</option>
                          <option value="Tarjeta">Tarjeta</option>
                          <option value="Transferencia">Transferencia</option>
                        </select>
                      </div>

                      <button
                        onClick={() => actualizarPersona(persona.id, { pagado: !persona.pagado })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: persona.pagado ? '#10b981' : '#666',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        {persona.pagado ? '✓ PAGADO' : 'MARCAR PAGADO'}
                      </button>
                    </div>
                  ))}
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

                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#aaa' }}>
                    TOTAL: ${total.toLocaleString()} | SUMA INGRESADA: ${personas.reduce((s, p) => s + p.monto, 0).toLocaleString()}
                  </p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: validarDivision() ? '#10b981' : '#ef4444' }}>
                    {validarDivision() ? '✓ SUMA VÁLIDA' : '✗ SUMA INVÁLIDA'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setShowDividir(false)}
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
                    onClick={procesarDivisionCuenta}
                    disabled={!validarDivision() || !personas.every((p) => p.pagado)}
                    style={{
                      flex: 1,
                      padding: '15px',
                      background: (validarDivision() && personas.every((p) => p.pagado)) ? '#10b981' : '#999',
                      color: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (validarDivision() && personas.every((p) => p.pagado)) ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                    }}
                  >
                    ✓ CERRAR CUENTA
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                  {carrito.length === 0 ? (
                    <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>
                      Sin platos en esta mesa
                    </p>
                  ) : (
                    carrito.map((item) => (
                      <div key={item.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #333',
                      }}>
                        <div>
                          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '14px' }}>
                            {item.descripcion}
                          </p>
                          <p style={{ margin: 0, color: '#aaa', fontSize: '12px' }}>
                            x{item.cantidad}
                          </p>
                        </div>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>
                          ${(item.precio_unitario * item.cantidad).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '18px',
                  fontWeight: 'bold',
                }}>
                  <span>TOTAL:</span>
                  <span style={{ color: '#10b981' }}>${total.toLocaleString()}</span>
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

                {carrito.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                      onClick={() => initializarDivision()}
                      style={{
                        flex: 1,
                        padding: '15px',
                        background: '#f59e0b',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      👥 DIVIDIR CUENTA
                    </button>
                    <button
                      onClick={async () => {
                        if (carrito.length === 0) {
                          setErrorMsg('Agrega platos primero')
                          return
                        }
                        await enviarPedidoACocina()
                      }}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '15px',
                        background: loading ? '#999' : 'linear-gradient(135deg, #10b981, #34d399)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      {loading ? '⏳ ENVIANDO...' : '✓ PAGAR'}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setStep('menu')}
                  style={{
                    width: '100%',
                    padding: '15px',
                    background: '#666',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  ← ATRÁS AL MENÚ
                </button>
              </>
            )}
          </div>
          </div>
        </div>
      </ScreenWrapper>
    )
  }

  return null
}
