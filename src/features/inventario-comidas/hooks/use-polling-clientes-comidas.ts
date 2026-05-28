import { useEffect } from 'react'
import { useClientesComidasStore } from '../store/clientes-comidas-store'

export function usePollingClientesComidas(interval: number = 5000) {
  const setClientes = useClientesComidasStore((s) => s.setClientes)
  const clientes = useClientesComidasStore((s) => s.clientes)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data/clientes-comidas')
        const data = await response.json()
        // Solo actualizar si:
        // 1. El servidor devuelve datos (data.length > 0)
        // 2. Y son diferentes de lo que tenemos localmente
        if (Array.isArray(data) && data.length > clientes.length) {
          // El servidor tiene más clientes que los locales
          setClientes(data)
        }
      } catch (err) {
        console.error('Error polling clientes-comidas:', err)
      }
    }

    const timer = setInterval(fetchData, interval)
    return () => clearInterval(timer)
  }, [setClientes, clientes.length])
}
