import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CierreCaja, MovimientoCaja } from '../types'

export function cajaAbierta(cajas: CierreCaja[]): CierreCaja | undefined {
  return cajas.find((caja) => caja.estado === 'Abierta')
}

export function nextCajaConsecutivo(cajas: CierreCaja[]): string {
  if (cajas.length === 0) return 'CJ-00001'
  const lastCaja = cajas[cajas.length - 1]
  const lastNum = parseInt(lastCaja.consecutivo.split('-')[1], 10)
  return `CJ-${String(lastNum + 1).padStart(5, '0')}`
}

interface CierreCajaState {
  cajas: CierreCaja[]
  addCaja: (caja: CierreCaja) => void
  updateCaja: (id: string, caja: Partial<CierreCaja>) => void
  addMovimiento: (cajaId: string, movimiento: MovimientoCaja) => void
  setCajas: (cajas: CierreCaja[]) => void
}

export const useCierreCajaStore = create<CierreCajaState>()(
  persist(
    (set) => ({
      cajas: [],

      addCaja: (caja: CierreCaja) =>
        set((state) => ({
          cajas: [...state.cajas, caja],
        })),

      updateCaja: (id: string, updates: Partial<CierreCaja>) =>
        set((state) => ({
          cajas: state.cajas.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      addMovimiento: (cajaId: string, movimiento: MovimientoCaja) =>
        set((state) => ({
          cajas: state.cajas.map((c) =>
            c.id === cajaId
              ? {
                  ...c,
                  movimientos: [...c.movimientos, movimiento],
                }
              : c
          ),
        })),

      setCajas: (cajas: CierreCaja[]) =>
        set(() => ({
          cajas,
        })),
    }),
    {
      name: 'cierre-caja-storage',
    }
  )
)
