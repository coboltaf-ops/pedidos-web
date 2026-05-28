'use client'

import { useState } from 'react'
import { todayColombia, fDate } from '@/shared/lib/format-date'
import { fmtMoney } from '@/shared/lib/format-number'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import { useCentrosCostoStore } from '@/features/centros-costo/store/centros-costo-store'
import { usePagosProveedoresStore, type FacturaProveedor, type PagoProveedor, type RenglonPago, type AnticipoProveedor, type AnticipoAplicado } from '@/features/pagos-proveedores/store/pagos-proveedores-store'
import { nextFacturaConsecutivo, nextPagoConsecutivo, nextAnticipoConsecutivo } from '@/features/pagos-proveedores/lib/helpers'
import { useRecepcionesStore } from '@/features/recepcion-facturas/store/recepciones-store'
import { useOrdenesStore } from '@/features/ordenes-compra/store/ordenes-store'
import { useControlBancarioStore } from '@/features/control-bancario/store/control-bancario-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { usePermisos } from '@/shared/hooks/use-permisos'

const emptyFactura = (consec: string): FacturaProveedor => {
  const hoy = todayColombia()
  return ({
  id: '',
  nro_correlativo: 0,
  consecutivo: consec,
  fecha_registro: hoy,
  nro_factura: '',
  fecha_emision: hoy,
  fecha_vencimiento: '',
  proveedor: '',
  tipo_moneda: '',
  bodega_llegada: '',
  condicion_pago: '',
  comprador: '',
  orden_compra_consecutivo: '',
  centro_costo: '',
  autorizado: '',
  monto_sin_impuesto: 0,
  retencion_fuente: 0,
  retencion_iva: 0,
  pct_iva: 0,
  monto_iva: 0,
  monto_total: 0,
  concepto: '',
  observaciones: '',
  estado: 'Pendiente',
  saldo_pendiente: 0,
})
}

export default function PagosProveedoresPage() {
  const today = todayColombia()
  const permisos = usePermisos('pagos-proveedores')
  const refData = useReferenceStore(s => s.data)
  const proveedores = useProveedoresStore(s => s.proveedores).filter(p => p.situacion === 'Activo')
  const todasBodegas = useBodegasStore(s => s.bodegas)
  const centrosCosto = useCentrosCostoStore(s => s.centros).filter(c => c.situacion === 'Activo')
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const bodegas = todasBodegas.filter(b => b.situacion === 'Activa' && (!tipoActivo || b.tipo_inventario === tipoActivo))

  const { facturas: todasFacturas, addFactura, updateFactura, deleteFactura, deleteAllFacturas, pagos: todosPagos, addPago, anticipos: todosAnticipos, addAnticipo, updateAnticipo, deleteAnticipo } = usePagosProveedoresStore()
  const facturas = todasFacturas

  // Para "Traer Facturas Recibidas"
  const recepciones = useRecepcionesStore(s => s.recepciones)
  const updateRecepcion = useRecepcionesStore(s => s.updateRecepcion)
  const ordenes = useOrdenesStore(s => s.ordenes)

  // Bancos disponibles (Activos) para selección en Pagos y Anticipos
  const bancosActivos = useControlBancarioStore(s => s.bancos).filter(b => b.estado === 'Activo')

  const [tab, setTab] = useState<'facturas' | 'pagos' | 'anticipos' | 'notas-db' | 'notas-cr'>('facturas')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<FacturaProveedor>(emptyFactura(nextFacturaConsecutivo(todasFacturas)))
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Modal Traer Facturas Recibidas
  const [traerOpen, setTraerOpen] = useState(false)
  const firstOfMonth = today.slice(0, 8) + '01'
  const [traerDesde, setTraerDesde] = useState(firstOfMonth)
  const [traerHasta, setTraerHasta] = useState(today)
  const [traerMsg, setTraerMsg] = useState<string | null>(null)

  // Modal Eliminar Todas (TESTING — quitar cuando el sistema esté en producción)
  const [eliminarOpen, setEliminarOpen] = useState(false)
  const [eliminarConfirmText, setEliminarConfirmText] = useState('')
  const [eliminarMsg, setEliminarMsg] = useState<string | null>(null)

  // ─── Estado de Registro de Pagos ──────────────────────────────────────────
  const pagos = todosPagos
  const anticipos = tipoActivo ? todosAnticipos.filter(a => a.tipo_inventario === tipoActivo) : todosAnticipos

  // ─── State de Anticipos ───────────────────────────────────────────────────
  const [antOpen, setAntOpen] = useState(false)
  const [antEditId, setAntEditId] = useState<string | null>(null)
  const [antProveedor, setAntProveedor] = useState('')
  const [antMonto, setAntMonto] = useState(0)
  const [antFormaPago, setAntFormaPago] = useState('')
  const [antBanco, setAntBanco] = useState('')
  const [antReferencia, setAntReferencia] = useState('')
  const [antPersonaAprueba, setAntPersonaAprueba] = useState('')
  const [antConcepto, setAntConcepto] = useState('')
  const [antObservaciones, setAntObservaciones] = useState('')
  const [antError, setAntError] = useState('')

  const abrirNuevoAnticipo = () => {
    setAntEditId(null)
    setAntProveedor('')
    setAntMonto(0)
    setAntFormaPago('')
    setAntBanco('')
    setAntReferencia('')
    setAntPersonaAprueba('')
    setAntConcepto('')
    setAntObservaciones('')
    setAntError('')
    setAntOpen(true)
  }

  const guardarAnticipo = () => {
    setAntError('')
    if (!antProveedor) { setAntError('Selecciona un proveedor.'); return }
    if (antMonto <= 0) { setAntError('El monto del anticipo debe ser mayor a 0.'); return }
    if (!antFormaPago) { setAntError('Indica la forma de pago.'); return }
    if (!antPersonaAprueba.trim()) { setAntError('Indica la persona que aprueba el anticipo.'); return }

    const nro = todosAnticipos.reduce((m, a) => Math.max(m, a.nro_correlativo), 0) + 1
    const consec = nextAnticipoConsecutivo(todosAnticipos)
    const nuevo: AnticipoProveedor = {
      id: crypto.randomUUID(),
      nro_correlativo: nro,
      consecutivo: consec,
      fecha_registro: today,
      proveedor: antProveedor,
      monto: antMonto,
      saldo_disponible: antMonto,
      forma_pago: antFormaPago,
      banco: antBanco,
      nro_referencia: antReferencia,
      persona_aprueba: antPersonaAprueba,
      concepto: antConcepto,
      observaciones: antObservaciones,
      tipo_inventario: tipoActivo || '',
      estado: 'Disponible',
    }
    addAnticipo(nuevo)
    setAntOpen(false)
  }

  const handleAnularAnticipo = (a: AnticipoProveedor) => {
    if (a.saldo_disponible !== a.monto) { alert('No se puede anular un anticipo que ya tiene aplicaciones a pagos.'); return }
    if (!confirm(`¿Anular el anticipo ${a.consecutivo}?`)) return
    updateAnticipo(a.id, { estado: 'Anulado', saldo_disponible: 0 })
  }

  const handleEliminarAnticipo = (a: AnticipoProveedor) => {
    if (a.saldo_disponible !== a.monto) { alert('No se puede eliminar un anticipo que ya tiene aplicaciones a pagos.'); return }
    if (!confirm(`¿ELIMINAR el anticipo ${a.consecutivo}? Esta acción es irreversible.`)) return
    deleteAnticipo(a.id)
  }

  const [pagoAnticiposSel, setPagoAnticiposSel] = useState<Record<string, number>>({}) // anticipo_id -> monto a aplicar
  const [pagoOpen, setPagoOpen] = useState(false)
  const [pagoProveedor, setPagoProveedor] = useState('')
  const [pagoFacturasSel, setPagoFacturasSel] = useState<string[]>([])  // ids de facturas seleccionadas (max 5)
  const [pagoMontos, setPagoMontos] = useState<Record<string, number>>({})  // factura_id -> monto a pagar
  const [pagoAnticipos, setPagoAnticipos] = useState<Record<string, number>>({})  // factura_id -> anticipo editable
  const [pagoFormaPago, setPagoFormaPago] = useState('')
  const [pagoBanco, setPagoBanco] = useState('')
  const [pagoReferencia, setPagoReferencia] = useState('')
  const [pagoObservaciones, setPagoObservaciones] = useState('')
  const [pagoError, setPagoError] = useState('')

  const facturasPendientesDelProveedor = pagoProveedor
    ? facturas.filter(f => f.proveedor === pagoProveedor && f.estado !== 'Pagada' && f.estado !== 'Anulada' && (f.saldo_pendiente || 0) > 0)
    : []

  const togglePagoFactura = (id: string) => {
    setPagoError('')
    if (pagoFacturasSel.includes(id)) {
      setPagoFacturasSel(pagoFacturasSel.filter(x => x !== id))
      const m = { ...pagoMontos }; delete m[id]; setPagoMontos(m)
      const a = { ...pagoAnticipos }; delete a[id]; setPagoAnticipos(a)
    } else {
      if (pagoFacturasSel.length >= 5) {
        setPagoError('Máximo 5 facturas simultáneas por pago.')
        return
      }
      const fac = facturas.find(f => f.id === id)
      setPagoFacturasSel([...pagoFacturasSel, id])
      setPagoMontos({ ...pagoMontos, [id]: fac?.saldo_pendiente || 0 })
      setPagoAnticipos({ ...pagoAnticipos, [id]: fac?.anticipo || 0 })
    }
  }

  const totalPagoCalc = pagoFacturasSel.reduce((s, id) => s + (pagoMontos[id] || 0), 0)

  const abrirNuevoPago = () => {
    setPagoProveedor('')
    setPagoFacturasSel([])
    setPagoMontos({})
    setPagoAnticipos({})
    setPagoAnticiposSel({})
    setPagoFormaPago('')
    setPagoBanco('')
    setPagoReferencia('')
    setPagoObservaciones('')
    setPagoError('')
    setPagoOpen(true)
  }

  // Anticipos disponibles del proveedor seleccionado en el modal de Pago
  const anticiposDisponibles = pagoProveedor
    ? anticipos.filter(a => a.proveedor === pagoProveedor && a.estado !== 'Anulado' && (a.saldo_disponible || 0) > 0.001)
    : []
  const togglePagoAnticipo = (id: string) => {
    if (pagoAnticiposSel[id] !== undefined) {
      const m = { ...pagoAnticiposSel }; delete m[id]; setPagoAnticiposSel(m)
    } else {
      const ant = anticipos.find(a => a.id === id)
      setPagoAnticiposSel({ ...pagoAnticiposSel, [id]: ant?.saldo_disponible || 0 })
    }
  }
  const totalAnticiposAplicados = Object.values(pagoAnticiposSel).reduce((s, v) => s + (v || 0), 0)

  const guardarPago = () => {
    setPagoError('')
    if (!pagoProveedor) { setPagoError('Selecciona un proveedor.'); return }
    if (pagoFacturasSel.length === 0) { setPagoError('Selecciona al menos una factura.'); return }
    if (!pagoFormaPago) { setPagoError('Indica la forma de pago.'); return }
    for (const id of pagoFacturasSel) {
      const fac = facturas.find(f => f.id === id)
      const monto = pagoMontos[id] || 0
      if (monto <= 0) { setPagoError(`El monto a pagar de ${fac?.nro_factura} debe ser mayor a 0.`); return }
      if (fac && monto > (fac.saldo_pendiente || 0) + 0.01) { setPagoError(`El monto a pagar de ${fac.nro_factura} (${monto}) excede el saldo pendiente (${fac.saldo_pendiente}).`); return }
    }
    // Validar anticipos seleccionados
    for (const [id, monto] of Object.entries(pagoAnticiposSel)) {
      const ant = anticipos.find(a => a.id === id)
      if (!ant) continue
      if (monto > (ant.saldo_disponible || 0) + 0.01) { setPagoError(`El anticipo ${ant.consecutivo} solo tiene disponible ${ant.saldo_disponible}.`); return }
    }
    if (totalAnticiposAplicados > totalPagoCalc + 0.01) { setPagoError(`Los anticipos aplicados (${totalAnticiposAplicados}) exceden el total a pagar (${totalPagoCalc}).`); return }

    const renglones: RenglonPago[] = pagoFacturasSel.map(id => {
      const f = facturas.find(x => x.id === id)!
      const anticipoEdit = pagoAnticipos[id] ?? (f.anticipo || 0)
      const neto = (f.monto_total || 0) - anticipoEdit
      return {
        factura_id: f.id,
        factura_consecutivo: f.consecutivo,
        nro_factura: f.nro_factura,
        concepto: f.concepto || '',
        monto_sin_impuesto: f.monto_sin_impuesto || 0,
        monto_iva: f.monto_iva || 0,
        retencion_fuente: f.retencion_fuente || 0,
        retencion_iva: f.retencion_iva || 0,
        anticipo: anticipoEdit,
        neto_a_pagar: neto,
        monto_aplicado: pagoMontos[id] || 0,
      }
    })

    const nro = todosPagos.reduce((m, p) => Math.max(m, p.nro_correlativo), 0) + 1
    const consecutivo = nextPagoConsecutivo(todosPagos)

    const anticiposAplicadosLista: AnticipoAplicado[] = Object.entries(pagoAnticiposSel)
      .filter(([, m]) => m > 0)
      .map(([id, m]) => {
        const ant = anticipos.find(a => a.id === id)!
        return { anticipo_id: id, anticipo_consecutivo: ant.consecutivo, monto_aplicado: m }
      })

    const nuevo: PagoProveedor = {
      id: crypto.randomUUID(),
      nro_correlativo: nro,
      consecutivo,
      fecha_registro: today,
      proveedor: pagoProveedor,
      facturas_aplicadas: renglones,
      anticipos_aplicados: anticiposAplicadosLista,
      forma_pago: pagoFormaPago,
      banco: pagoBanco,
      nro_referencia: pagoReferencia,
      monto_total: Math.max(0, totalPagoCalc - totalAnticiposAplicados),
      monto_anticipos_aplicados: totalAnticiposAplicados,
      observaciones: pagoObservaciones,
      estado: 'Registrado',
    }

    addPago(nuevo)

    // Actualizar saldo, anticipo y estado de cada factura
    for (const r of renglones) {
      const f = todasFacturas.find(x => x.id === r.factura_id)
      if (!f) continue
      const nuevoSaldo = (f.saldo_pendiente || 0) - r.monto_aplicado
      const nuevoEstado: FacturaProveedor['estado'] = nuevoSaldo <= 0.01 ? 'Pagada' : 'Pagada Parcial'
      updateFactura(f.id, { saldo_pendiente: Math.max(0, nuevoSaldo), estado: nuevoEstado, anticipo: r.anticipo })
    }

    // Descontar saldo de los anticipos aplicados
    for (const aa of anticiposAplicadosLista) {
      const ant = todosAnticipos.find(x => x.id === aa.anticipo_id)
      if (!ant) continue
      const nuevoSaldoAnt = (ant.saldo_disponible || 0) - aa.monto_aplicado
      const nuevoEstadoAnt: AnticipoProveedor['estado'] = nuevoSaldoAnt <= 0.01 ? 'Aplicado Total' : 'Aplicado Parcial'
      updateAnticipo(ant.id, { saldo_disponible: Math.max(0, nuevoSaldoAnt), estado: nuevoEstadoAnt })
    }

    setPagoOpen(false)
  }

  const handleEliminarTodas = () => {
    if (eliminarConfirmText.trim().toUpperCase() !== 'ELIMINAR TODAS') {
      setEliminarMsg('❌ Debes escribir exactamente "ELIMINAR TODAS" para confirmar.')
      return
    }
    const totalFacturas = todasFacturas.length
    // 1) Resetear flag pasada_a_pagos en todas las recepciones que apuntaban a estas facturas
    recepciones.forEach(r => {
      if (r.pasada_a_pagos) {
        updateRecepcion(r.id, { pasada_a_pagos: false, pasada_a_pagos_fecha: '', pasada_a_pagos_factura_id: '' })
      }
    })
    // 2) Borrar todas las facturas
    deleteAllFacturas()
    setEliminarMsg(`🗑 Se eliminaron ${totalFacturas} factura(s) y se liberaron las recepciones para volver a traerlas.`)
    setEliminarConfirmText('')
    setTimeout(() => setEliminarOpen(false), 2500)
  }

  const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
  const selectSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
  const readOnlySt: React.CSSProperties = { background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff', cursor: 'not-allowed' }

  if (!permisos.leer) {
    return <div className="flex items-center justify-center h-full"><p className="text-white/60 text-lg">No tienes permisos para acceder a esta sección.</p></div>
  }

  const handleNueva = () => {
    setForm(emptyFactura(nextFacturaConsecutivo(todasFacturas)))
    setError('')
    setIsFormOpen(true)
  }

  const handleEditar = (f: FacturaProveedor) => {
    setForm({ ...f })
    setError('')
    setIsFormOpen(true)
  }

  const handleEliminar = (f: FacturaProveedor) => {
    if (f.estado !== 'Pendiente') { alert('Solo se pueden eliminar facturas en estado Pendiente.'); return }
    if (confirm(`¿Eliminar la factura ${f.consecutivo}?`)) deleteFactura(f.id)
  }

  // Recalcular monto neto a pagar
  const calcMontoTotal = (f: FacturaProveedor): number => {
    return (f.monto_sin_impuesto || 0) + (f.monto_iva || 0) - (f.retencion_fuente || 0) - (f.retencion_iva || 0)
  }

  // Detecta duplicado por (nro_factura + proveedor) excluyendo la propia
  const facturaDuplicada = (nro: string, proveedor: string, idActual: string): FacturaProveedor | undefined => {
    const n = nro.trim().toLowerCase()
    const p = proveedor.trim().toLowerCase()
    if (!n || !p) return undefined
    return todasFacturas.find(f =>
      f.id !== idActual &&
      f.nro_factura.trim().toLowerCase() === n &&
      f.proveedor.trim().toLowerCase() === p &&
      f.estado !== 'Anulada'
    )
  }

  // Detecta si la combinación (Nro Factura + OC) ya fue procesada en Recepción de Facturas
  const recepcionExistente = (nro: string, ocConsec: string) => {
    const n = nro.trim().toLowerCase()
    const oc = ocConsec.trim().toLowerCase()
    if (!n || !oc) return undefined
    return recepciones.find(r =>
      r.estado !== 'Anulada' &&
      r.nro_factura.trim().toLowerCase() === n &&
      r.orden_compra_consecutivo.trim().toLowerCase() === oc
    )
  }

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.nro_factura.trim()) { setError('Debe indicar el N° de Factura.'); return }
    if (!form.fecha_emision) { setError('Debe indicar la Fecha de Emisión.'); return }
    if (!form.fecha_vencimiento) { setError('Debe indicar la Fecha de Vencimiento.'); return }
    if (!form.proveedor) { setError('Debe seleccionar el Proveedor.'); return }
    if (!form.bodega_llegada) { setError('Debe seleccionar la Bodega de Llegada.'); return }
    if (!form.autorizado.trim()) { setError('Debe indicar quién Autorizó.'); return }
    if (form.monto_sin_impuesto <= 0) { setError('El Monto Sin Impuesto debe ser mayor que 0.'); return }

    // 1) Validar si la combinación (Factura + OC) ya fue procesada en Recepción de Facturas
    const recepcion = recepcionExistente(form.nro_factura, form.orden_compra_consecutivo)
    if (recepcion) {
      setError(`🚫 FACTURA YA PROCESADA POR RECEPCIÓN — N° ${recepcion.nro_factura} con OC ${recepcion.orden_compra_consecutivo} ya registrada en Recepción ${recepcion.consecutivo} (${fDate(recepcion.fecha_recibida)}).`)
      return
    }

    // 2) Validar duplicado: misma factura + mismo proveedor (incluye facturas traídas automáticamente)
    const dup = facturaDuplicada(form.nro_factura, form.proveedor, form.id)
    if (dup) {
      if (dup.origen_recepcion_id) {
        setError(`🚫 ESTA FACTURA FUE RECIBIDA EN RECEPCIÓN AUTOMÁTICA — NO PUEDE PROCESARSE MANUAL. Origen: ${dup.origen_recepcion_consecutivo} · Consecutivo: ${dup.consecutivo} · Estado: ${dup.estado}`)
      } else {
        setError(`⚠ La factura "${form.nro_factura}" del proveedor "${form.proveedor}" ya está registrada (${dup.consecutivo}, estado: ${dup.estado}). No se permite duplicar.`)
      }
      return
    }

    const monto_total = calcMontoTotal(form)

    if (form.id) {
      updateFactura(form.id, { ...form, monto_total, saldo_pendiente: monto_total })
    } else {
      const nro = (todasFacturas.reduce((m, f) => Math.max(m, f.nro_correlativo), 0)) + 1
      addFactura({
        ...form,
        id: crypto.randomUUID(),
        nro_correlativo: nro,
        consecutivo: nextFacturaConsecutivo(todasFacturas),
        monto_total,
        saldo_pendiente: monto_total,
      })
    }
    setIsFormOpen(false)
  }

  // ─── Traer Facturas Recibidas ────────────────────────────────────────────
  const handleTraerFacturas = () => {
    if (!traerDesde || !traerHasta || traerDesde > traerHasta) {
      setTraerMsg('❌ Seleccione un rango de fechas válido (Desde ≤ Hasta).')
      return
    }
    // Filtrar recepciones del tipo activo, en el rango, y NO pasadas a pagos
    const elegibles = recepciones.filter(r => {
      if (tipoActivo && r.tipo_inventario !== tipoActivo) return false
      if (r.pasada_a_pagos) return false
      if (r.estado === 'Anulada') return false
      const f = r.fecha_recibida
      return f >= traerDesde && f <= traerHasta
    })

    if (elegibles.length === 0) {
      setTraerMsg('ℹ️ No hay facturas pendientes de pasar en el rango seleccionado.')
      return
    }

    let creadas = 0
    let correlativoBase = todasFacturas.reduce((m, f) => Math.max(m, f.nro_correlativo), 0)

    for (const r of elegibles) {
      // Buscar OC asociada
      const oc = ordenes.find(o =>
        (r.orden_compra_id && o.id === r.orden_compra_id) ||
        (r.orden_compra_consecutivo && o.consecutivo === r.orden_compra_consecutivo)
      )
      const subtotal = r.renglones.reduce((s, rn) => {
        const cant = rn.cantidad_a_recibir > 0 ? rn.cantidad_a_recibir : rn.cantidad_pedida
        return s + cant * rn.costo_unitario
      }, 0)
      const pctIva = oc?.pct_impuesto ?? 0
      const monto_iva = subtotal * (pctIva / 100)
      const monto_total = subtotal + monto_iva  // sin retenciones por defecto, usuario las edita después

      correlativoBase += 1
      const newId = crypto.randomUUID()
      const consecutivo = `FAC-PRO-${String(correlativoBase).padStart(5, '0')}`

      addFactura({
        id: newId,
        nro_correlativo: correlativoBase,
        consecutivo,
        fecha_registro: today,
        nro_factura: r.nro_factura,
        fecha_emision: r.fecha_emision,
        fecha_vencimiento: oc?.fecha_vencimiento || '',
        proveedor: r.proveedor,
        tipo_moneda: oc?.tipo_moneda || '',
        bodega_llegada: r.bodega_llegada,
        condicion_pago: oc?.condicion_pago || '',
        comprador: oc?.comprador || r.comprador || '',
        orden_compra_consecutivo: r.orden_compra_consecutivo || oc?.consecutivo || '',
        centro_costo: oc?.centro_costo || '',
        autorizado: r.persona_recibe || '',
        monto_sin_impuesto: subtotal,
        retencion_fuente: 0,
        retencion_iva: 0,
        pct_iva: pctIva,
        monto_iva,
        monto_total,
        concepto: '',
        observaciones: `Traída automáticamente de Recepción ${r.consecutivo}`,
        estado: 'Pendiente',
        saldo_pendiente: monto_total,
        origen_recepcion_id: r.id,
        origen_recepcion_consecutivo: r.consecutivo,
      })
      // Marcar la recepción como Pasada a Pagos
      updateRecepcion(r.id, {
        pasada_a_pagos: true,
        pasada_a_pagos_fecha: today,
        pasada_a_pagos_factura_id: consecutivo,
      })
      creadas++
    }

    setTraerMsg(`✅ Se trajeron ${creadas} factura(s) recibidas y se marcaron como Pasadas a Pagos.`)
    setTimeout(() => setTraerOpen(false), 2000)
  }

  const filtradas = facturas.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    return f.nro_factura.toLowerCase().includes(q) || f.proveedor.toLowerCase().includes(q) || f.consecutivo.toLowerCase().includes(q)
  })

  // Cálculo en vivo en el formulario
  const montoTotalCalc = calcMontoTotal(form)
  const ivaCalc = (form.monto_sin_impuesto || 0) * (form.pct_iva || 0) / 100

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Pagos Proveedores y Servicios</h1>
          <p className="text-white/50 mt-1">Registro de Facturas, Pagos, Notas Débito y Notas Crédito</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {[
          { id: 'facturas' as const, label: '📄 Registro Facturas' },
          { id: 'pagos' as const, label: '💰 Registro Pagos' },
          { id: 'anticipos' as const, label: '💵 Anticipos' },
          { id: 'notas-db' as const, label: '➕ Notas Débito' },
          { id: 'notas-cr' as const, label: '➖ Notas Crédito' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.id
              ? { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
              : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: FACTURAS */}
      {tab === 'facturas' && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por N° Factura, proveedor o consecutivo…"
              className="w-full max-w-md rounded-xl px-4 py-2 outline-none text-base text-white font-bold" style={inputSt} />
            <div className="flex gap-3 flex-wrap">
              {permisos.editar && (
                <button onClick={() => { setTraerMsg(null); setTraerOpen(true) }} className="px-5 py-2.5 rounded-xl font-medium text-white"
                  style={{ background: 'rgba(34,197,94,0.4)', border: '1px solid rgba(21,128,61,1)' }}
                  title="Importar desde Recepción de Facturas">
                  📥 Traer Facturas Recibidas
                </button>
              )}
              {permisos.editar && (
                <button onClick={handleNueva} className="px-5 py-2.5 rounded-xl font-medium text-white"
                  style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                  + Nueva Factura
                </button>
              )}
              {permisos.editar && (
                <button
                  onClick={() => { setEliminarMsg(null); setEliminarConfirmText(''); setEliminarOpen(true) }}
                  className="px-5 py-2.5 rounded-xl font-extrabold text-white whitespace-nowrap"
                  style={{ background: '#dc2626', border: '2px solid #b91c1c', boxShadow: '0 0 12px rgba(220,38,38,0.4)' }}
                  title="TESTING — Eliminar TODAS las facturas">
                  🗑 ELIMINAR TODAS (PRUEBAS)
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {['Consecutivo', 'F. Registro', 'N° Factura', 'F. Emisión', 'F. Vencimiento', 'Proveedor', 'Moneda', 'Total Neto', 'Saldo', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr><td colSpan={11} className="px-6 py-12 text-center text-white/30">No hay facturas registradas. Crea una con <strong>+ Nueva Factura</strong> o tráelas desde Recepción.</td></tr>
                ) : filtradas.map(f => (
                  <tr key={f.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-mono font-bold text-blue-300">{f.consecutivo}</td>
                    <td className="px-3 py-3 text-white font-bold">{fDate(f.fecha_registro)}</td>
                    <td className="px-3 py-3 font-mono text-white">{f.nro_factura}</td>
                    <td className="px-3 py-3 text-white font-bold">{fDate(f.fecha_emision)}</td>
                    <td className="px-3 py-3 text-white font-bold">{fDate(f.fecha_vencimiento)}</td>
                    <td className="px-3 py-3 text-white">{f.proveedor}</td>
                    <td className="px-3 py-3 text-white font-bold">{f.tipo_moneda}</td>
                    <td className="px-3 py-3 text-right font-mono text-white">{fmtMoney(f.monto_total)}</td>
                    <td className="px-3 py-3 text-right font-mono text-white/70">{fmtMoney(f.saldo_pendiente)}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-bold" style={
                        f.estado === 'Pagada' ? { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.4)' } :
                        f.estado === 'Pagada Parcial' ? { background: 'rgba(251,191,36,0.95)', color: '#fff', border: '1px solid rgba(251,191,36,0.4)' } :
                        f.estado === 'Anulada' ? { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.4)' } :
                        { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.4)' }
                      }>{f.estado}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {permisos.editar && <button onClick={() => handleEditar(f)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>Editar</button>}
                        {permisos.eliminar && <button onClick={() => handleEliminar(f)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>Eliminar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'pagos' && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-white/60 text-sm">{pagos.length} pago(s) registrados</p>
            {permisos.editar && (
              <button onClick={abrirNuevoPago} className="px-5 py-2.5 rounded-xl font-medium text-white"
                style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                + Nuevo Pago
              </button>
            )}
          </div>

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {['Consecutivo', 'F. Registro', 'Proveedor', 'Forma Pago', 'Banco', 'N° Referencia', 'Facturas', 'Total', 'Estado'].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagos.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-white/30">No hay pagos registrados. Crea el primero con <strong>+ Nuevo Pago</strong>.</td></tr>
                ) : pagos.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-mono font-bold text-blue-300">{p.consecutivo}</td>
                    <td className="px-3 py-3 text-white font-bold">{fDate(p.fecha_registro)}</td>
                    <td className="px-3 py-3 text-white">{p.proveedor}</td>
                    <td className="px-3 py-3 text-white font-bold">{p.forma_pago}</td>
                    <td className="px-3 py-3 text-white font-bold">{p.banco || '—'}</td>
                    <td className="px-3 py-3 text-white font-bold font-mono">{p.nro_referencia || '—'}</td>
                    <td className="px-3 py-3 text-white font-bold">{p.facturas_aplicadas.length} fact.</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-white">{fmtMoney(p.monto_total)}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-bold" style={
                        p.estado === 'Anulado'
                          ? { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.4)' }
                          : { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.4)' }
                      }>{p.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === 'anticipos' && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-white/60 text-sm">{anticipos.length} anticipo(s) registrados · Disponibles: {anticipos.filter(a => a.estado !== 'Anulado' && (a.saldo_disponible || 0) > 0.001).length}</p>
            {permisos.editar && (
              <button onClick={abrirNuevoAnticipo} className="px-5 py-2.5 rounded-xl font-medium text-white"
                style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                + Nuevo Anticipo
              </button>
            )}
          </div>

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {['Consecutivo', 'F. Registro', 'Proveedor', 'Forma Pago', 'Banco', 'Referencia', 'Aprobado por', 'Concepto', 'Monto', 'Saldo Disponible', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anticipos.length === 0 ? (
                  <tr><td colSpan={12} className="px-6 py-12 text-center text-white/30">No hay anticipos registrados. Crea el primero con <strong>+ Nuevo Anticipo</strong>.</td></tr>
                ) : anticipos.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-mono font-bold text-blue-300">{a.consecutivo}</td>
                    <td className="px-3 py-3 text-white font-bold">{fDate(a.fecha_registro)}</td>
                    <td className="px-3 py-3 text-white">{a.proveedor}</td>
                    <td className="px-3 py-3 text-white font-bold">{a.forma_pago}</td>
                    <td className="px-3 py-3 text-white font-bold">{a.banco || '—'}</td>
                    <td className="px-3 py-3 text-white font-bold font-mono">{a.nro_referencia || '—'}</td>
                    <td className="px-3 py-3 text-white font-bold">{a.persona_aprueba || '—'}</td>
                    <td className="px-3 py-3 text-white font-bold max-w-[160px] truncate" title={a.concepto}>{a.concepto || '—'}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-white">{fmtMoney(a.monto)}</td>
                    <td className="px-3 py-3 text-right font-mono text-yellow-300">{fmtMoney(a.saldo_disponible || 0)}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-bold" style={
                        a.estado === 'Aplicado Total' ? { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.4)' } :
                        a.estado === 'Aplicado Parcial' ? { background: 'rgba(251,191,36,0.95)', color: '#fff', border: '1px solid rgba(251,191,36,0.4)' } :
                        a.estado === 'Anulado' ? { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.4)' } :
                        { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.4)' }
                      }>{a.estado}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {permisos.editar && a.estado !== 'Anulado' && a.saldo_disponible === a.monto && (
                          <button onClick={() => handleAnularAnticipo(a)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(251,191,36,0.95)', color: '#fff', border: '1px solid rgba(251,191,36,0.3)' }} title="Anular">⚠ Anular</button>
                        )}
                        {permisos.eliminar && a.saldo_disponible === a.monto && (
                          <button onClick={() => handleEliminarAnticipo(a)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>Eliminar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL NUEVO ANTICIPO */}
      {antOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">💵 {antEditId ? 'Editar Anticipo' : 'Nuevo Anticipo'} — <span className="font-mono text-blue-300">{nextAnticipoConsecutivo(todosAnticipos)}</span></h2>
              <button onClick={() => setAntOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Consecutivo (auto)</label>
                <input readOnly value={nextAnticipoConsecutivo(todosAnticipos)} className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono font-bold" style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha Registro (auto)</label>
                <input readOnly value={fDate(today)} className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={readOnlySt} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Proveedor *</label>
                <select value={antProveedor} onChange={e => setAntProveedor(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">— Selecciona proveedor —</option>
                  {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Monto del Anticipo *</label>
                <input type="number" step="0.01" min="0" value={antMonto || ''}
                  onChange={e => setAntMonto(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Forma de Pago *</label>
                <select value={antFormaPago} onChange={e => setAntFormaPago(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Banco</label>
                <select value={antBanco} onChange={e => setAntBanco(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  {bancosActivos.map(b => (
                    <option key={b.id} value={`${b.nombre_banco} · ${b.tipo_cuenta} · ${b.nro_cuenta}`}>
                      {b.nombre_banco} · {b.tipo_cuenta} · {b.nro_cuenta}
                    </option>
                  ))}
                </select>
                {bancosActivos.length === 0 && (
                  <p className="text-xs text-amber-300/80 mt-1">⚠ No hay bancos registrados. Crea cuentas en <strong>Control Bancario</strong>.</p>
                )}
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">N° Referencia</label>
                <input value={antReferencia} onChange={e => setAntReferencia(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={inputSt} placeholder="N° de transferencia o cheque" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Persona que Aprueba el Anticipo *</label>
                <input value={antPersonaAprueba} onChange={e => setAntPersonaAprueba(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Nombre del autorizante" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Concepto</label>
                <input value={antConcepto} onChange={e => setAntConcepto(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Motivo del anticipo (ej: reserva de pedido, separación de mercancía…)" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Observaciones</label>
                <textarea rows={2} value={antObservaciones} onChange={e => setAntObservaciones(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Notas adicionales…" />
              </div>
            </div>

            {antError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 mt-3">{antError}</p>
            )}

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setAntOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button onClick={guardarAnticipo} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Registrar Anticipo</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'notas-db' && (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-white/40">➕ Notas Débito — próximamente</p>
        </div>
      )}
      {tab === 'notas-cr' && (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-white/40">➖ Notas Crédito — próximamente</p>
        </div>
      )}

      {/* MODAL NUEVO PAGO */}
      {pagoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-6xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto" style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">💰 Nuevo Pago — <span className="font-mono text-blue-300">{nextPagoConsecutivo(todosPagos)}</span></h2>
              <button onClick={() => setPagoOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            {/* Encabezado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Consecutivo (auto)</label>
                <input readOnly value={nextPagoConsecutivo(todosPagos)} className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono font-bold" style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha Registro (auto)</label>
                <input readOnly value={fDate(today)} className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={readOnlySt} />
              </div>
              {/* Proveedor — solo los que tienen facturas pendientes */}
              <div className="md:col-span-3">
                <label className="block text-xl text-white font-extrabold mb-1">Proveedor *</label>
                {(() => {
                  const facturasPendientes = facturas.filter(f => f.estado !== 'Pagada' && f.estado !== 'Anulada' && (f.saldo_pendiente || 0) > 0)
                  const proveedoresConPendientes = Array.from(new Set(facturasPendientes.map(f => f.proveedor)))
                    .map(nombre => ({
                      nombre,
                      cantidad: facturasPendientes.filter(f => f.proveedor === nombre).length,
                      total: facturasPendientes.filter(f => f.proveedor === nombre).reduce((s, f) => s + (f.saldo_pendiente || 0), 0),
                    }))
                    .sort((a, b) => a.nombre.localeCompare(b.nombre))

                  if (proveedoresConPendientes.length === 0) {
                    return (
                      <div className="rounded-xl px-3 py-3 text-sm" style={{ background: 'rgba(251,191,36,0.15)', color: '#fff', border: '1px solid rgba(251,191,36,0.3)' }}>
                        ⚠ No hay facturas registradas pendientes de pago. Primero registra facturas o tráelas desde Recepción de Facturas.
                      </div>
                    )
                  }
                  return (
                    <>
                      <select value={pagoProveedor}
                        onChange={e => { setPagoProveedor(e.target.value); setPagoFacturasSel([]); setPagoMontos({}); setPagoError('') }}
                        className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                        <option value="">— Selecciona proveedor —</option>
                        {proveedoresConPendientes.map(p => (
                          <option key={p.nombre} value={p.nombre}>
                            {p.nombre} — {p.cantidad} factura{p.cantidad !== 1 ? 's' : ''} · Saldo {fmtMoney(p.total)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-white/40 mt-1">{proveedoresConPendientes.length} proveedor{proveedoresConPendientes.length !== 1 ? 'es' : ''} con facturas pendientes de pago.</p>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Tabla de facturas pendientes */}
            {pagoProveedor && (
              <div className="rounded-xl mb-4 overflow-x-auto" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(96,165,250,0.2)' }}>
                  <h3 className="text-sm font-bold text-white">Facturas pendientes de {pagoProveedor}</h3>
                  <span className="text-xs text-white/60">Facturas marcadas para pagar: <strong className="text-blue-300">{pagoFacturasSel.length} de 5 máx</strong></span>
                </div>
                <table className="w-full text-base text-left">
                  <thead style={{ background: 'rgba(96,165,250,0.1)' }}>
                    <tr>
                      {['', 'N° Factura', 'F. Vencim.', 'Concepto', 'Monto Antes Imp.', 'Monto Imp.', 'Ret. Fuente', 'Ret. IVA', 'Anticipo', 'Neto a Pagar', 'Saldo', 'Monto a Pagar'].map(h => (
                        <th key={h} className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-white/60 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {facturasPendientesDelProveedor.length === 0 ? (
                      <tr><td colSpan={12} className="px-4 py-6 text-center text-white/40">Este proveedor no tiene facturas pendientes.</td></tr>
                    ) : facturasPendientesDelProveedor.map(f => {
                      const sel = pagoFacturasSel.includes(f.id)
                      const anticipoActual = pagoAnticipos[f.id] ?? (f.anticipo || 0)
                      const neto = (f.monto_total || 0) - anticipoActual
                      return (
                        <tr key={f.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: sel ? 'rgba(96,165,250,0.08)' : 'transparent' }}>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked={sel} onChange={() => togglePagoFactura(f.id)}
                              style={{ accentColor: '#60a5fa', width: 16, height: 16, cursor: 'pointer' }} />
                          </td>
                          <td className="px-2 py-2 font-mono text-white whitespace-nowrap">{f.nro_factura}</td>
                          <td className="px-2 py-2 text-white/70 whitespace-nowrap">{fDate(f.fecha_vencimiento)}</td>
                          <td className="px-2 py-2 text-white/60 max-w-[140px] truncate" title={f.concepto}>{f.concepto || '—'}</td>
                          <td className="px-2 py-2 text-right font-mono text-white/80">{fmtMoney(f.monto_sin_impuesto || 0)}</td>
                          <td className="px-2 py-2 text-right font-mono text-white/80">{fmtMoney(f.monto_iva || 0)}</td>
                          <td className="px-2 py-2 text-right font-mono text-white/80">{fmtMoney(f.retencion_fuente || 0)}</td>
                          <td className="px-2 py-2 text-right font-mono text-white/80">{fmtMoney(f.retencion_iva || 0)}</td>
                          <td className="px-2 py-2">
                            <input
                              type="number" step="0.01" min="0"
                              value={pagoAnticipos[f.id] ?? (f.anticipo || 0)}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0
                                setPagoAnticipos({ ...pagoAnticipos, [f.id]: val })
                                // Guardar el anticipo en la factura inmediatamente
                                updateFactura(f.id, { anticipo: val })
                              }}
                              className="w-24 rounded-lg px-2 py-1 outline-none text-xs font-mono text-right"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(96,165,250,0.3)', color: '#fff' }}
                              title="Editable. Se guarda en la factura al instante." />
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-bold text-white">{fmtMoney(neto)}</td>
                          <td className="px-2 py-2 text-right font-mono text-yellow-300">{fmtMoney(f.saldo_pendiente || 0)}</td>
                          <td className="px-2 py-2">
                            <input type="number" step="0.01" min="0" disabled={!sel}
                              value={sel ? (pagoMontos[f.id] ?? '') : ''}
                              onChange={e => setPagoMontos({ ...pagoMontos, [f.id]: parseFloat(e.target.value) || 0 })}
                              className="w-32 rounded-lg px-2 py-1 outline-none text-xs font-mono text-right disabled:opacity-30"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Anticipos disponibles del proveedor */}
            {pagoProveedor && anticiposDisponibles.length > 0 && (
              <div className="rounded-xl mb-4 overflow-x-auto" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(34,197,94,0.25)' }}>
                  <h3 className="text-sm font-bold text-white">💵 Anticipos disponibles de {pagoProveedor}</h3>
                  <span className="text-xs text-white/60">Aplicados en este pago: <strong className="text-green-300">{fmtMoney(totalAnticiposAplicados)}</strong></span>
                </div>
                <table className="w-full text-base text-left">
                  <thead style={{ background: 'rgba(34,197,94,0.1)' }}>
                    <tr>
                      {['', 'Consecutivo', 'F. Registro', 'Concepto', 'Saldo Disponible', 'Monto a Aplicar'].map(h => (
                        <th key={h} className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-white/60 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {anticiposDisponibles.map(a => {
                      const sel = pagoAnticiposSel[a.id] !== undefined
                      return (
                        <tr key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: sel ? 'rgba(34,197,94,0.08)' : 'transparent' }}>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked={sel} onChange={() => togglePagoAnticipo(a.id)}
                              style={{ accentColor: '#22c55e', width: 16, height: 16, cursor: 'pointer' }} />
                          </td>
                          <td className="px-2 py-2 font-mono font-bold text-blue-300 whitespace-nowrap">{a.consecutivo}</td>
                          <td className="px-2 py-2 text-white/70 whitespace-nowrap">{fDate(a.fecha_registro)}</td>
                          <td className="px-2 py-2 text-white/70 max-w-[200px] truncate" title={a.concepto}>{a.concepto || '—'}</td>
                          <td className="px-2 py-2 text-right font-mono text-green-300">{fmtMoney(a.saldo_disponible || 0)}</td>
                          <td className="px-2 py-2">
                            <input type="number" step="0.01" min="0" max={a.saldo_disponible} disabled={!sel}
                              value={sel ? (pagoAnticiposSel[a.id] ?? '') : ''}
                              onChange={e => setPagoAnticiposSel({ ...pagoAnticiposSel, [a.id]: parseFloat(e.target.value) || 0 })}
                              className="w-32 rounded-lg px-2 py-1 outline-none text-xs font-mono text-right disabled:opacity-30"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(34,197,94,0.4)', color: '#fff' }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Datos del pago */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Forma de Pago *</label>
                <select value={pagoFormaPago} onChange={e => setPagoFormaPago(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Banco</label>
                <select value={pagoBanco} onChange={e => setPagoBanco(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  {bancosActivos.map(b => (
                    <option key={b.id} value={`${b.nombre_banco} · ${b.tipo_cuenta} · ${b.nro_cuenta}`}>
                      {b.nombre_banco} · {b.tipo_cuenta} · {b.nro_cuenta}
                    </option>
                  ))}
                </select>
                {bancosActivos.length === 0 && (
                  <p className="text-xs text-amber-300/80 mt-1">⚠ No hay bancos registrados. Crea cuentas en <strong>Control Bancario</strong>.</p>
                )}
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">N° Referencia</label>
                <input value={pagoReferencia} onChange={e => setPagoReferencia(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={inputSt} placeholder="N° de transferencia o cheque" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xl text-white font-extrabold mb-1">Observaciones</label>
                <textarea rows={2} value={pagoObservaciones} onChange={e => setPagoObservaciones(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Notas del pago…" />
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-end gap-4 mb-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)' }}>
              <span className="text-white/70 text-sm font-bold">TOTAL A PAGAR:</span>
              <span className="text-2xl font-mono font-extrabold text-blue-300">{fmtMoney(totalPagoCalc)}</span>
            </div>

            {pagoError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 mb-3">{pagoError}</p>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setPagoOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button onClick={guardarPago} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Registrar Pago</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR TODAS — TESTING */}
      {eliminarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'rgba(15,23,42,0.97)', border: '2px solid #dc2626', boxShadow: '0 0 30px rgba(220,38,38,0.4)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold" style={{ color: '#fff' }}>🗑 ELIMINAR TODAS LAS FACTURAS</h2>
              <button onClick={() => setEliminarOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>
            <div className="px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)' }}>
              <p className="text-sm font-bold" style={{ color: '#fff' }}>
                ⚠ ACCIÓN IRREVERSIBLE — Esta acción borrará TODAS las facturas registradas ({todasFacturas.length}) y liberará las recepciones para volver a traerlas.
              </p>
              <p className="text-xs mt-2" style={{ color: '#fff' }}>
                Solo para uso de PRUEBAS. Cuando el sistema esté en producción este botón debe quitarse.
              </p>
            </div>
            <div>
              <label className="block text-xl font-extrabold text-white mb-1" style={{ color: '#fff' }}>
                Para confirmar, escribe exactamente: <span className="font-mono" style={{ color: '#dc2626', textShadow: '0 0 8px rgba(220,38,38,0.6)' }}>ELIMINAR TODAS</span>
              </label>
              <input
                value={eliminarConfirmText}
                onChange={e => setEliminarConfirmText(e.target.value)}
                placeholder="ELIMINAR TODAS"
                className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono font-bold"
                style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid #dc2626', color: '#fff' }}
                autoFocus
              />
            </div>
            {eliminarMsg && (
              <div className="mt-4 px-3 py-2 rounded-xl text-sm font-medium" style={{
                background: eliminarMsg.startsWith('🗑') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: eliminarMsg.startsWith('🗑') ? '#86efac' : '#fca5a5',
                border: `1px solid ${eliminarMsg.startsWith('🗑') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>{eliminarMsg}</div>
            )}
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setEliminarOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button
                onClick={handleEliminarTodas}
                disabled={eliminarConfirmText.trim().toUpperCase() !== 'ELIMINAR TODAS'}
                className="px-5 py-2 rounded-xl text-white text-sm font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#dc2626', border: '2px solid #b91c1c', boxShadow: '0 0 12px rgba(220,38,38,0.5)' }}>
                🗑 Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRAER FACTURAS RECIBIDAS */}
      {traerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">📥 Traer Facturas Recibidas</h2>
              <button onClick={() => setTraerOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-white/60 text-sm mb-5">Selecciona el rango de fechas para importar las recepciones que aún no han sido pasadas a Pagos.</p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha Inicial</label>
                <input type="date" value={traerDesde} onChange={e => setTraerDesde(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha Final</label>
                <input type="date" value={traerHasta} onChange={e => setTraerHasta(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>
            </div>
            {traerMsg && (
              <div className="mb-4 px-3 py-2 rounded-xl text-sm font-medium" style={{
                background: traerMsg.startsWith('✅') ? 'rgba(34,197,94,0.15)' : traerMsg.startsWith('ℹ') ? 'rgba(96,165,250,0.15)' : 'rgba(239,68,68,0.15)',
                color: traerMsg.startsWith('✅') ? '#86efac' : traerMsg.startsWith('ℹ') ? '#93c5fd' : '#fca5a5',
                border: `1px solid ${traerMsg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : traerMsg.startsWith('ℹ') ? 'rgba(96,165,250,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>{traerMsg}</div>
            )}
            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setTraerOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button onClick={handleTraerFacturas} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(22,163,74,1)', border: '1px solid rgba(21,128,61,1)' }}>Importar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORMULARIO FACTURA */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-5xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{form.id ? 'Editar Factura' : 'Nueva Factura'} — <span className="font-mono text-blue-300">{form.consecutivo}</span></h2>
              <button onClick={() => setIsFormOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Consecutivo (auto)</label>
                <input readOnly value={form.consecutivo}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono font-bold"
                  style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha Registro (auto)</label>
                <input readOnly value={fDate(form.fecha_registro)} className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">N° Factura *</label>
                <input
                  value={form.nro_factura}
                  onChange={e => setForm({ ...form, nro_factura: e.target.value })}
                  onKeyDown={e => {
                    // Si hay un error de duplicación visible, cualquier tecla limpia el campo y permite reescribir
                    if (error && (error.includes('🚫') || error.includes('⚠'))) {
                      e.preventDefault()
                      setForm({ ...form, nro_factura: '' })
                      setError('')
                      return
                    }
                  }}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="FC-12345" />
                {(() => {
                  // Prioridad 1: ya procesada por recepción (Factura + OC ya recibida)
                  const recep = recepcionExistente(form.nro_factura, form.orden_compra_consecutivo)
                  if (recep) {
                    return (
                      <p className="text-xs mt-1 px-3 py-2 rounded font-extrabold" style={{ background: '#dc2626', color: '#fff', border: '1px solid #b91c1c' }}>
                        🚫 FACTURA YA PROCESADA POR RECEPCIÓN ({recep.consecutivo} · OC {recep.orden_compra_consecutivo})
                      </p>
                    )
                  }
                  // Prioridad 2: duplicado en Pagos Proveedores
                  const dup = facturaDuplicada(form.nro_factura, form.proveedor, form.id)
                  if (!dup) return null
                  if (dup.origen_recepcion_id) {
                    return (
                      <p className="text-xs mt-1 px-3 py-2 rounded font-extrabold" style={{ background: '#dc2626', color: '#fff', border: '1px solid #b91c1c' }}>
                        🚫 ESTA FACTURA FUE RECIBIDA EN RECEPCIÓN AUTOMÁTICA — NO PUEDE PROCESARSE MANUAL ({dup.consecutivo})
                      </p>
                    )
                  }
                  return (
                    <p className="text-xs mt-1 px-2 py-1 rounded font-semibold" style={{ background: 'rgba(239,68,68,0.15)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>
                      ⚠ Ya existe esta factura para {form.proveedor} ({dup.consecutivo})
                    </p>
                  )
                })()}
              </div>

              {/* Selector de Orden de Compra (autollena Proveedor, Moneda, Cond. Pago, Comprador) */}
              <div className="md:col-span-3">
                <label className="block text-xl text-white font-extrabold mb-1">Orden de Compra (opcional — autollenado)</label>
                <select value={form.orden_compra_consecutivo}
                  onChange={e => {
                    const consec = e.target.value
                    if (!consec) { setForm({ ...form, orden_compra_consecutivo: '' }); return }
                    const oc = ordenes.find(o => o.consecutivo === consec)
                    if (!oc) { setForm({ ...form, orden_compra_consecutivo: consec }); return }
                    setForm({
                      ...form,
                      orden_compra_consecutivo: consec,
                      proveedor: oc.proveedor || form.proveedor,
                      tipo_moneda: oc.tipo_moneda || form.tipo_moneda,
                      condicion_pago: oc.condicion_pago || form.condicion_pago,
                      comprador: oc.comprador || form.comprador,
                      bodega_llegada: oc.bodega_llegada || form.bodega_llegada,
                      centro_costo: oc.centro_costo || form.centro_costo,
                      fecha_vencimiento: oc.fecha_vencimiento || form.fecha_vencimiento,
                    })
                  }}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">— Sin OC asociada —</option>
                  {ordenes
                    .filter(o => !tipoActivo || o.tipo_inventario === tipoActivo)
                    .sort((a, b) => b.consecutivo.localeCompare(a.consecutivo))
                    .map(o => (
                      <option key={o.id} value={o.consecutivo}>
                        {o.consecutivo} · {o.proveedor} · {o.situacion}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-white/40 mt-1">Al seleccionar una OC se completan automáticamente: Proveedor, Tipo Moneda, Condición de Pago, Comprador, Bodega de Llegada y Fecha de Vencimiento.</p>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha Emisión Factura *</label>
                <input type="date" value={form.fecha_emision} onChange={e => setForm({ ...form, fecha_emision: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha Vencimiento Factura *</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Proveedor *</label>
                <select value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Tipo Moneda</label>
                <select value={form.tipo_moneda} onChange={e => setForm({ ...form, tipo_moneda: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  {(refData.tipo_moneda ?? []).filter(m => m.situacion).map(m => <option key={m.id} value={m.descripcion}>{m.descripcion}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Bodega de Llegada *</label>
                <select value={form.bodega_llegada} onChange={e => setForm({ ...form, bodega_llegada: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  {bodegas.map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Comprador</label>
                <input value={form.comprador} onChange={e => setForm({ ...form, comprador: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Comprador (heredado de la OC)" />
              </div>

              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Centro de Costo</label>
                <select value={form.centro_costo} onChange={e => setForm({ ...form, centro_costo: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">— Sin centro de costo —</option>
                  {centrosCosto.map(c => (
                    <option key={c.id} value={c.descripcion}>{c.codigo} — {c.descripcion}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Condición de Pago</label>
                <select value={form.condicion_pago} onChange={e => setForm({ ...form, condicion_pago: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  {(refData.condiciones_pago ?? []).filter(c => c.situacion).map(c => <option key={c.id} value={c.descripcion}>{c.descripcion}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Persona que Autorizó *</label>
                <input value={form.autorizado} onChange={e => setForm({ ...form, autorizado: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Nombre del autorizante" />
              </div>

              {/* Sección de Montos */}
              <div className="md:col-span-3 mt-2 mb-1">
                <h3 className="text-xs font-bold text-white/80 uppercase tracking-wider">Montos y Retenciones</h3>
              </div>

              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Monto Antes de Impuesto *</label>
                <input type="number" step="0.01" min="0" value={form.monto_sin_impuesto || ''}
                  onChange={e => setForm({ ...form, monto_sin_impuesto: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">% IVA</label>
                <input type="number" step="0.01" min="0" max="100" value={form.pct_iva || ''}
                  onChange={e => {
                    const pct = parseFloat(e.target.value) || 0
                    const iva = (form.monto_sin_impuesto || 0) * pct / 100
                    setForm({ ...form, pct_iva: pct, monto_iva: iva })
                  }}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Monto IVA (auto)</label>
                <input readOnly value={fmtMoney(ivaCalc || form.monto_iva)} className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={readOnlySt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Total Neto a Pagar (auto)</label>
                <input readOnly value={fmtMoney(montoTotalCalc)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right font-bold" style={readOnlySt} />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xl text-white font-extrabold mb-1">Concepto</label>
                <textarea rows={2} value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Concepto de la factura (servicio, producto, motivo del cargo…)" />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xl text-white font-extrabold mb-1">Observaciones</label>
                <textarea rows={2} value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Notas adicionales…" />
              </div>

              {error && (
                <p className="md:col-span-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>
              )}

              <div className="md:col-span-3 flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{form.id ? 'Guardar Cambios' : 'Registrar Factura'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
