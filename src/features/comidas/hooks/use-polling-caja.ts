import { useEffect } from 'react'
import { useCierreCajaStore } from '../store/cierre-caja-store'
import type { CierreCaja } from '../types'

export function usePollingCaja(intervalMs: number = 5000) {
  const setCajas = useCierreCajaStore((state) => state.setCajas)

  useEffect(() => {
    const fetchCajas = async () => {
      try {
        const response = await fetch('/api/data/cierre-caja')
        if (!response.ok) throw new Error('Failed to fetch cierre caja')
        const data: CierreCaja[] = await response.json()
        setCajas(data)
      } catch (error) {
        console.error('Error polling caja:', error)
      }
    }

    // Fetch immediately
    fetchCajas()

    // Set up interval
    const interval = setInterval(fetchCajas, intervalMs)

    return () => clearInterval(interval)
  }, [setCajas, intervalMs])
}
