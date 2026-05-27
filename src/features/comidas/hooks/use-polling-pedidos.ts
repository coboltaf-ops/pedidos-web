import { useEffect } from 'react'
import { usePedidosComidasStore } from '../store/pedidos-comidas-store'
import type { PedidoComida } from '../types'

export function usePollingPedidos(intervalMs: number = 5000) {
  const setPedidos = usePedidosComidasStore((state) => state.setPedidos)

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const response = await fetch('/api/data/pedidos-comidas')
        if (!response.ok) throw new Error('Failed to fetch pedidos')
        const data: PedidoComida[] = await response.json()
        setPedidos(data)
      } catch (error) {
        console.error('Error polling pedidos:', error)
      }
    }

    // Fetch immediately
    fetchPedidos()

    // Set up interval
    const interval = setInterval(fetchPedidos, intervalMs)

    return () => clearInterval(interval)
  }, [setPedidos, intervalMs])
}
