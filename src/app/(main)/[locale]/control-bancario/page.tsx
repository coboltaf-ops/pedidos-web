'use client'

import { useState } from 'react'
import { useControlBancarioStore, type Banco, type Deposito } from '@/features/control-bancario/store/control-bancario-store'
import { nextDepositoConsecutivo } from '@/features/control-bancario/lib/helpers'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { todayColombia, fDate } from '@/shared/lib/format-date'

export default function ControlBancarioPage() {
  const permisos = usePermisos('control-bancario')
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const today = todayColombia()

  const { bancos, depositos, movimientos: todosMovimientos, addBanco, updateBanco, deleteBanco, addDeposito, updateDeposito, deleteDeposito } = useControlBancarioStore()
  const movimientos = tipoActivo ? todosMovimientos.filter(m => m.tipo_inventario === tipoActivo) : todosMovimientos
  const bancosActivos = bancos.filter(b => b.estado === 'Activo')

  const [tab, setTab] = useState<'bancos' | 'depositos' | 'movimientos'>('bancos')

  // ─── State Depósito ───────────────────────────────────────────────────────
  const [depOpen, setDepOpen] = useState(false)
  const [depEditId, setDepEditId] = useState<string | null>(null)
  const [depFecha, setDepFecha] = useState('')
  const [depBancoId, setDepBancoId] = useState('')
  const [depOrigen, setDepOrigen] = useState('')
  const [depMonto, setDepMonto] = useState('')
  const [depReferencia, setDepReferencia] = useState('')
  const [depDepositadoPor, setDepDepositadoPor] = useState('')
  const [depConcepto, setDepConcepto] = useState('')
  const [depObservaciones, setDepObservaciones] = useState('')
  const [depError, setDepError] = useState('')

  // ─── State Banco ──────────────────────────────────────────────────────────
  const [bcoOpen, setBcoOpen] = useState(false)
  const [bcoEditId, setBcoEditId] = useState<string | null>(null)
  const [bcoNombre, setBcoNombre] = useState('')
  const [bcoTipoCuenta, setBcoTipoCuenta] = useState('')
  const [bcoNroCuenta, setBcoNroCuenta] = useState('')
  const [bcoFechaSaldo, setBcoFechaSaldo] = useState('')
  const [bcoSaldo, setBcoSaldo] = useState('')
  const [bcoEstado, setBcoEstado] = useState<'Activo' | 'Inactivo'>('Activo')
  const [bcoError, setBcoError] = useState('')

  const inputSt: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }
  const selectSt: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }

  const abrirNuevoBanco = () => {
    setBcoEditId(null)
    setBcoNombre('')
    setBcoTipoCuenta('')
    setBcoNroCuenta('')
    setBcoFechaSaldo(new Date().toISOString().slice(0, 10))
    setBcoSaldo('')
    setBcoEstado('Activo')
    setBcoError('')
    setBcoOpen(true)
  }

  const editarBanco = (b: Banco) => {
    setBcoEditId(b.id)
    setBcoNombre(b.nombre_banco)
    setBcoTipoCuenta(b.tipo_cuenta)
    setBcoNroCuenta(b.nro_cuenta)
    setBcoFechaSaldo(b.fecha_saldo || '')
    setBcoSaldo(b.saldo != null ? String(b.saldo) : '')
    setBcoEstado(b.estado)
    setBcoError('')
    setBcoOpen(true)
  }

  const eliminarBanco = (b: Banco) => {
    if (!confirm(`¿Eliminar el banco ${b.nombre_banco} · ${b.nro_cuenta}?`)) return
    deleteBanco(b.id)
  }

  const guardarBanco = () => {
    setBcoError('')
    if (!bcoNombre.trim()) { setBcoError('Indica el Nombre del Banco.'); return }
    if (!bcoTipoCuenta) { setBcoError('Selecciona el Tipo de Cuenta.'); return }
    if (!bcoNroCuenta.trim()) { setBcoError('Indica el N° de Cuenta.'); return }
    if (!bcoFechaSaldo) { setBcoError('Indica la Fecha del Saldo.'); return }
    const saldoNum = Number(bcoSaldo)
    if (bcoSaldo === '' || isNaN(saldoNum)) { setBcoError('Indica un Saldo válido.'); return }

    if (bcoEditId) {
      updateBanco(bcoEditId, { nombre_banco: bcoNombre.trim(), tipo_cuenta: bcoTipoCuenta, nro_cuenta: bcoNroCuenta.trim(), fecha_saldo: bcoFechaSaldo, saldo: saldoNum, estado: bcoEstado })
    } else {
      const nuevo: Banco = {
        id: crypto.randomUUID(),
        nombre_banco: bcoNombre.trim(),
        tipo_cuenta: bcoTipoCuenta,
        nro_cuenta: bcoNroCuenta.trim(),
        fecha_saldo: bcoFechaSaldo,
        saldo: saldoNum,
        estado: bcoEstado,
      }
      addBanco(nuevo)
    }
    setBcoOpen(false)
  }

  // ─── Handlers Depósito ────────────────────────────────────────────────────
  const abrirNuevoDeposito = () => {
    setDepEditId(null)
    setDepFecha(today)
    setDepBancoId(bancosActivos.length === 1 ? bancosActivos[0].id : '')
    setDepOrigen('')
    setDepMonto('')
    setDepReferencia('')
    setDepDepositadoPor('')
    setDepConcepto('')
    setDepObservaciones('')
    setDepError('')
    setDepOpen(true)
  }

  const editarDeposito = (d: Deposito) => {
    setDepEditId(d.id)
    setDepFecha(d.fecha_registro)
    setDepBancoId(d.banco_id)
    setDepOrigen(d.origen)
    setDepMonto(String(d.monto))
    setDepReferencia(d.nro_referencia)
    setDepDepositadoPor(d.depositado_por)
    setDepConcepto(d.concepto)
    setDepObservaciones(d.observaciones)
    setDepError('')
    setDepOpen(true)
  }

  const anularDeposito = (d: Deposito) => {
    if (d.estado === 'Anulado') return
    if (!confirm(`¿Anular el depósito ${d.consecutivo} por ${d.monto.toLocaleString('es-CO', { minimumFractionDigits: 2 })}?`)) return
    updateDeposito(d.id, { estado: 'Anulado' })
  }

  const eliminarDeposito = (d: Deposito) => {
    if (!confirm(`¿Eliminar definitivamente el depósito ${d.consecutivo}? Esta acción es irreversible.`)) return
    deleteDeposito(d.id)
  }

  const guardarDeposito = () => {
    setDepError('')
    if (!depFecha) { setDepError('Indica la Fecha del depósito.'); return }
    if (!depBancoId) { setDepError('Selecciona el Banco destino.'); return }
    if (!depOrigen) { setDepError('Selecciona el Origen del depósito.'); return }
    const montoNum = Number(depMonto)
    if (depMonto === '' || isNaN(montoNum) || montoNum <= 0) { setDepError('Indica un Monto mayor a 0.'); return }
    if (!depDepositadoPor.trim()) { setDepError('Indica la persona que realiza el depósito.'); return }

    const banco = bancos.find(b => b.id === depBancoId)
    if (!banco) { setDepError('El banco seleccionado no existe.'); return }
    const bancoDescripcion = `${banco.nombre_banco} · ${banco.tipo_cuenta} · ${banco.nro_cuenta}`

    if (depEditId) {
      updateDeposito(depEditId, {
        fecha_registro: depFecha,
        banco_id: depBancoId,
        banco_descripcion: bancoDescripcion,
        origen: depOrigen,
        monto: montoNum,
        nro_referencia: depReferencia.trim(),
        depositado_por: depDepositadoPor.trim(),
        concepto: depConcepto.trim(),
        observaciones: depObservaciones.trim(),
      })
    } else {
      const nro = depositos.reduce((m, d) => Math.max(m, d.nro_correlativo || 0), 0) + 1
      const nuevo: Deposito = {
        id: crypto.randomUUID(),
        nro_correlativo: nro,
        consecutivo: nextDepositoConsecutivo(depositos),
        fecha_registro: depFecha,
        banco_id: depBancoId,
        banco_descripcion: bancoDescripcion,
        origen: depOrigen,
        monto: montoNum,
        nro_referencia: depReferencia.trim(),
        depositado_por: depDepositadoPor.trim(),
        concepto: depConcepto.trim(),
        observaciones: depObservaciones.trim(),
        estado: 'Registrado',
      }
      addDeposito(nuevo)
    }
    setDepOpen(false)
  }

  if (!permisos.leer) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/60 text-lg">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Control Bancario</h1>
          <p className="text-white/50 mt-1">Bancos, Depósitos y Movimientos Bancarios</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit flex-wrap" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {[
          { id: 'bancos' as const, label: '🏦 Bancos', count: bancos.length },
          { id: 'depositos' as const, label: '💰 Depósitos', count: depositos.length },
          { id: 'movimientos' as const, label: '🔄 Movimientos', count: movimientos.length },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={tab === t.id
              ? { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
              : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}
          >
            <span>{t.label}</span>
            <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.1)' }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* TAB BANCOS */}
      {tab === 'bancos' && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-white/60 text-sm">{bancos.length} cuenta(s) bancaria(s) registrada(s) <span className="text-white/30">· compartidas en toda la empresa</span></p>
            {permisos.editar && (
              <button onClick={abrirNuevoBanco} className="px-5 py-2.5 rounded-xl font-medium text-white"
                style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>
                + Nuevo Banco
              </button>
            )}
          </div>

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {['Nombre Banco', 'Tipo Cuenta', 'N° Cuenta', 'Fecha Saldo', 'Saldo', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bancos.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-white/30">No hay bancos registrados. Crea el primero con <strong>+ Nuevo Banco</strong>.</td></tr>
                ) : bancos.map(b => (
                  <tr key={b.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-3 text-white font-semibold">{b.nombre_banco}</td>
                    <td className="px-3 py-3 text-white font-bold">{b.tipo_cuenta}</td>
                    <td className="px-3 py-3 font-mono text-white">{b.nro_cuenta}</td>
                    <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(b.fecha_saldo)}</td>
                    <td className="px-3 py-3 font-mono text-right text-emerald-300 whitespace-nowrap">{b.saldo != null ? b.saldo.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-bold" style={
                        b.estado === 'Activo'
                          ? { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.4)' }
                          : { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.4)' }
                      }>{b.estado}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {permisos.editar && <button onClick={() => editarBanco(b)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>Editar</button>}
                        {permisos.eliminar && <button onClick={() => eliminarBanco(b)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>Eliminar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'depositos' && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-white/60 text-sm">{depositos.length} depósito(s) registrado(s)</p>
            {permisos.editar && (
              <button onClick={abrirNuevoDeposito} className="px-5 py-2.5 rounded-xl font-medium text-white"
                style={{ background: 'rgba(22,163,74,1)', border: '1px solid rgba(21,128,61,1)' }}>
                + Nuevo Depósito
              </button>
            )}
          </div>

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <table className="w-full text-base text-left">
              <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                <tr>
                  {['Consecutivo', 'Fecha', 'Banco', 'Origen', 'Monto', 'Referencia', 'Depositado Por', 'Concepto', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {depositos.length === 0 ? (
                  <tr><td colSpan={10} className="px-6 py-12 text-center text-white/30">No hay depósitos registrados. Crea el primero con <strong>+ Nuevo Depósito</strong>.</td></tr>
                ) : depositos.map(d => (
                  <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-mono font-bold text-emerald-300 whitespace-nowrap">{d.consecutivo}</td>
                    <td className="px-3 py-3 text-white font-bold whitespace-nowrap">{fDate(d.fecha_registro)}</td>
                    <td className="px-3 py-3 text-white">{d.banco_descripcion}</td>
                    <td className="px-3 py-3 text-white font-bold">{d.origen}</td>
                    <td className="px-3 py-3 font-mono text-right text-emerald-300 whitespace-nowrap">{d.monto.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 font-mono text-white font-bold">{d.nro_referencia || '—'}</td>
                    <td className="px-3 py-3 text-white font-bold">{d.depositado_por}</td>
                    <td className="px-3 py-3 text-white font-bold max-w-xs truncate" title={d.concepto}>{d.concepto || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-1 rounded-md text-xs font-bold" style={
                        d.estado === 'Registrado'
                          ? { background: 'rgba(34,197,94,0.95)', color: '#fff', border: '1px solid rgba(34,197,94,0.4)' }
                          : { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.4)' }
                      }>{d.estado}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {permisos.editar && d.estado === 'Registrado' && <button onClick={() => editarDeposito(d)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>Editar</button>}
                        {permisos.editar && d.estado === 'Registrado' && <button onClick={() => anularDeposito(d)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(251,191,36,0.95)', color: '#fff', border: '1px solid rgba(251,191,36,0.3)' }}>Anular</button>}
                        {permisos.eliminar && <button onClick={() => eliminarDeposito(d)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>Eliminar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'movimientos' && (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-5xl mb-3">🔄</p>
          <p className="text-white text-lg font-bold mb-2">Movimientos Bancarios</p>
          <p className="text-white/40 text-sm">Diseño de campos pendiente — listo para implementar</p>
        </div>
      )}

      {/* MODAL NUEVO/EDITAR BANCO */}
      {bcoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-xl rounded-2xl p-6" style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">🏦 {bcoEditId ? 'Editar Banco' : 'Nuevo Banco'}</h2>
              <button onClick={() => setBcoOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Nombre Banco *</label>
                <input value={bcoNombre} onChange={e => setBcoNombre(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Bancolombia, Davivienda, BBVA..." autoFocus />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Tipo Cuenta *</label>
                <select value={bcoTipoCuenta} onChange={e => setBcoTipoCuenta(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  <option value="Ahorros">Ahorros</option>
                  <option value="Corriente">Corriente</option>
                  <option value="Crédito">Crédito</option>
                  <option value="Otra">Otra</option>
                </select>
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">N° Cuenta *</label>
                <input value={bcoNroCuenta} onChange={e => setBcoNroCuenta(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={inputSt} placeholder="1234567890" />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha Saldo *</label>
                <input type="date" value={bcoFechaSaldo} onChange={e => setBcoFechaSaldo(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Saldo *</label>
                <input type="number" step="0.01" value={bcoSaldo} onChange={e => setBcoSaldo(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0.00" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Estado</label>
                <select value={bcoEstado} onChange={e => setBcoEstado(e.target.value as 'Activo' | 'Inactivo')}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            {bcoError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 mt-3">{bcoError}</p>
            )}

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setBcoOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button onClick={guardarBanco} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{bcoEditId ? 'Guardar Cambios' : 'Registrar Banco'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO/EDITAR DEPÓSITO */}
      {depOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto" style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">💰 {depEditId ? 'Editar Depósito' : 'Nuevo Depósito'} {!depEditId && <span className="font-mono text-emerald-300 text-sm">— {nextDepositoConsecutivo(depositos)}</span>}</h2>
              <button onClick={() => setDepOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Fecha del Depósito *</label>
                <input type="date" value={depFecha} onChange={e => setDepFecha(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Origen *</label>
                <select value={depOrigen} onChange={e => setDepOrigen(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione…</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Consignación">Consignación</option>
                  <option value="ACH">ACH</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Banco Destino *</label>
                <select value={depBancoId} onChange={e => setDepBancoId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={selectSt}>
                  <option value="">Seleccione el banco…</option>
                  {bancosActivos.map(b => (
                    <option key={b.id} value={b.id}>{b.nombre_banco} · {b.tipo_cuenta} · {b.nro_cuenta}</option>
                  ))}
                </select>
                {bancosActivos.length === 0 && (
                  <p className="text-xs text-amber-300/80 mt-1">⚠ No hay bancos activos. Crea uno en la pestaña <strong>Bancos</strong>.</p>
                )}
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Monto *</label>
                <input type="number" step="0.01" value={depMonto} onChange={e => setDepMonto(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono text-right" style={inputSt} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">N° Referencia / Comprobante</label>
                <input value={depReferencia} onChange={e => setDepReferencia(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold font-mono" style={inputSt} placeholder="Consignación, cheque, transacción..." />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Depositado Por *</label>
                <input value={depDepositadoPor} onChange={e => setDepDepositadoPor(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Persona que realiza el depósito" />
              </div>
              <div>
                <label className="block text-xl text-white font-extrabold mb-1">Concepto</label>
                <input value={depConcepto} onChange={e => setDepConcepto(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Origen del ingreso (venta, cobro, ajuste...)" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xl text-white font-extrabold mb-1">Observaciones</label>
                <textarea value={depObservaciones} onChange={e => setDepObservaciones(e.target.value)} rows={2}
                  className="w-full rounded-xl px-3 py-2 outline-none text-base text-white font-bold" style={inputSt} placeholder="Notas adicionales..." />
              </div>
            </div>

            {depError && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 mt-3">{depError}</p>
            )}

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setDepOpen(false)} className="px-5 py-2 rounded-xl text-white/70 text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button onClick={guardarDeposito} className="px-5 py-2 rounded-xl text-white text-sm font-bold" style={{ background: 'rgba(22,163,74,1)', border: '1px solid rgba(21,128,61,1)' }}>{depEditId ? 'Guardar Cambios' : 'Registrar Depósito'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
