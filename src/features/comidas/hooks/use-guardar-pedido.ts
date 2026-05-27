import { useState } from 'react'
import { usePedidosComidasStore } from '../store/pedidos-comidas-store'
import { useCierreCajaStore } from '../store/cierre-caja-store'
import { cajaAbierta } from '../store/cierre-caja-store'
import type { PedidoComida, MovimientoCaja } from '../types'

interface UseGuardarPedidoResult {
  guardarPedido: (pedido: PedidoComida) => Promise<void>
  loading: boolean
  error: string | null
}

export function useGuardarPedido(): UseGuardarPedidoResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addPedido = usePedidosComidasStore((state) => state.addPedido)
  const pedidos = usePedidosComidasStore((state) => state.pedidos)
  const cajas = useCierreCajaStore((state) => state.cajas)
  const addMovimiento = useCierreCajaStore((state) => state.addMovimiento)

  const guardarPedido = async (pedido: PedidoComida): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      // Validate that caja is open
      const openCaja = cajaAbierta(cajas)
      if (!openCaja) {
        throw new Error('No hay caja abierta. Abre una caja para continuar.')
      }

      // Save pedido to server
      const newPedidos = [...pedidos, pedido]
      const pedidoResponse = await fetch('/api/data/pedidos-comidas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPedidos),
      })

      if (!pedidoResponse.ok) {
        throw new Error('Error saving pedido')
      }

      // Create movimiento caja
      const movimiento: MovimientoCaja = {
        id: `mov-${Date.now()}`,
        pedido_id: pedido.id,
        consecutivo_pedido: pedido.consecutivo,
        fecha_hora: new Date().toISOString(),
        cliente: pedido.cliente,
        mesa: pedido.numero_mesa,
        forma_pago: pedido.pagos[0]?.forma_pago || 'Efectivo',
        monto: pedido.total,
      }

      // Save movimiento to server
      const newCajas = cajas.map((c) =>
        c.id === openCaja.id
          ? { ...c, movimientos: [...c.movimientos, movimiento] }
          : c
      )

      const cajaResponse = await fetch('/api/data/cierre-caja', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCajas),
      })

      if (!cajaResponse.ok) {
        throw new Error('Error saving caja movimiento')
      }

      // Update local stores
      addPedido(pedido)
      addMovimiento(openCaja.id, movimiento)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { guardarPedido, loading, error }
}
