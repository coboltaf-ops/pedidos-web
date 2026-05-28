'use client'

import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useOrdenesStore } from '@/features/ordenes-compra/store/ordenes-store'

export default function DebugDataPage() {
  const proveedores = useProveedoresStore(s => s.proveedores)
  const productos = useProductosStore(s => s.productos)
  const ordenes = useOrdenesStore(s => s.ordenes)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-white">Debug: Estado de Stores</h1>

      <div className="space-y-4">
        <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500">
          <h2 className="text-xl font-bold text-white">Proveedores</h2>
          <p className="text-lg text-blue-200">Total: {proveedores.length}</p>
          {proveedores.length > 0 && (
            <div className="mt-2 space-y-1">
              {proveedores.slice(0, 5).map((p) => (
                <p key={p.id} className="text-sm text-blue-100">
                  - {p.nombre}
                </p>
              ))}
              {proveedores.length > 5 && <p className="text-sm text-blue-100">... y {proveedores.length - 5} más</p>}
            </div>
          )}
        </div>

        <div className="bg-green-900/30 p-4 rounded-lg border border-green-500">
          <h2 className="text-xl font-bold text-white">Productos</h2>
          <p className="text-lg text-green-200">Total: {productos.length}</p>
          {productos.length > 0 && (
            <div className="mt-2 space-y-1">
              {productos.slice(0, 5).map((p) => (
                <p key={p.id} className="text-sm text-green-100">
                  - {p.nombre}
                </p>
              ))}
              {productos.length > 5 && <p className="text-sm text-green-100">... y {productos.length - 5} más</p>}
            </div>
          )}
        </div>

        <div className="bg-purple-900/30 p-4 rounded-lg border border-purple-500">
          <h2 className="text-xl font-bold text-white">Órdenes de Compra</h2>
          <p className="text-lg text-purple-200">Total: {ordenes.length}</p>
          {ordenes.length > 0 && (
            <div className="mt-2 space-y-1">
              {ordenes.slice(0, 5).map((o: any) => (
                <p key={o.id} className="text-sm text-purple-100">
                  - Orden ID: {o.id}
                </p>
              ))}
              {ordenes.length > 5 && <p className="text-sm text-purple-100">... y {ordenes.length - 5} más</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
