export type DetallePedidoComida = {
  id: string
  producto_id: string
  codigo: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  observaciones: string
}

export type PagoComida = {
  id: string
  persona: string
  monto: number
  forma_pago: 'Efectivo' | 'Tarjeta' | 'Transferencia'
  fecha_hora: string
  pagado: boolean
}

export type PedidoComida = {
  id: string
  consecutivo: string
  nro_pedido: number
  tipo: 'Web' | 'Mesa'
  fecha: string
  hora: string
  cliente: string
  numero_mesa?: number
  mesero?: string
  detalles: DetallePedidoComida[]
  subtotal: number
  impuesto: number
  total: number
  estado: 'SOLICITADO' | 'EN_COCINA' | 'LISTO' | 'ENTREGADO'
  pagos: PagoComida[]
  total_pagado: number
  pagado_completo: boolean
  fecha_hora_listo?: string
  observaciones: string
}

export type MovimientoCaja = {
  id: string
  pedido_id: string
  consecutivo_pedido: string
  fecha_hora: string
  cliente: string
  mesa?: number
  forma_pago: 'Efectivo' | 'Tarjeta' | 'Transferencia'
  monto: number
}

export type CierreCaja = {
  id: string
  consecutivo: string
  nro_caja: number
  fecha_apertura: string
  fecha_cierre?: string
  monto_inicial: number
  monto_contado_efectivo?: number
  estado: 'Abierta' | 'Cerrada'
  usuario_abre: string
  usuario_cierra?: string
  movimientos: MovimientoCaja[]
  observaciones: string
}
