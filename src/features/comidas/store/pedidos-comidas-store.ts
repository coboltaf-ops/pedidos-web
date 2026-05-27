import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PedidoComida } from '../types'

export function nextPedidoConsecutivo(pedidos: PedidoComida[]): string {
  if (pedidos.length === 0) return 'PED-00001'
  const lastPedido = pedidos[pedidos.length - 1]
  const lastNum = parseInt(lastPedido.consecutivo.split('-')[1], 10)
  return `PED-${String(lastNum + 1).padStart(5, '0')}`
}

interface PedidosComidasState {
  pedidos: PedidoComida[]
  addPedido: (pedido: PedidoComida) => void
  updatePedido: (id: string, pedido: Partial<PedidoComida>) => void
  deletePedido: (id: string) => void
  setPedidos: (pedidos: PedidoComida[]) => void
}

export const usePedidosComidasStore = create<PedidosComidasState>()(
  persist(
    (set) => ({
      pedidos: [],

      addPedido: (pedido: PedidoComida) =>
        set((state) => ({
          pedidos: [...state.pedidos, pedido],
        })),

      updatePedido: (id: string, updates: Partial<PedidoComida>) =>
        set((state) => ({
          pedidos: state.pedidos.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      deletePedido: (id: string) =>
        set((state) => ({
          pedidos: state.pedidos.filter((p) => p.id !== id),
        })),

      setPedidos: (pedidos: PedidoComida[]) =>
        set(() => ({
          pedidos,
        })),
    }),
    {
      name: 'pedidos-comidas-storage',
    }
  )
)
