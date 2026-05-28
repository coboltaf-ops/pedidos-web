'use client'

import { useState, useMemo } from 'react'
import { useClientesStore, type Cliente } from '@/features/clientes/store/clientes-store'
import { generarCodigoAcceso } from '@/features/lote-celda/lib/helpers'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { usePermisos } from '@/shared/hooks/use-permisos'
import { todayColombia, fDate } from '@/shared/lib/format-date'

const emptyCliente = (codigo: string): Cliente => ({
  id: '', codigo,
  tipo_identificacion: 'NIT', nro_documento: '', digito_verificacion: '',
  razon_social: '', macro_sector: '', actividad: '', actividad_codigo: '',
  direccion: '', departamento: '', ciudad: '', codigo_ciudad: '',
  pais: 'Colombia', codigo_pais: 'CO', codigo_postal: '',
  telefono: '', nro_movil: '', email: '', sitio_web: '',
  condicion_pago: 'Contado', tipo_moneda: 'COP', calificacion_pagador: 'Bueno',
  representante_legal: '', tipo_cuenta_cliente: 'Cliente', clase_cliente: 'Otros Clientes',
  autoretenedor: 'No', agente_retenedor: 'No', como_nos_conocio: '',
  gran_contribuyente: 'No', regimen_iva: 'Responsable IVA', clasificacion_tributaria: '',
  mes_cierre_anual: 'Diciembre',
  retencion_fuente_pct: 0, tipo_retencion_fuente: '',
  retencion_iva_pct: 0, tipo_retencion_iva: '',
  retencion_ica_pct: 0, cupo_credito: 0,
  banco_pagos: '', cuenta_banco: '', tipo_cuenta_banco: 'Ahorros', naturaleza_cuenta: 'Persona Jurídica',
  observaciones: '', situacion: 'Activo',
  fecha_registro: todayColombia(), fecha_ingreso_cliente: todayColombia(),
  seguimientos: [], codigo_acceso: generarCodigoAcceso(),
  tipo_persona: 'Jurídica', responsabilidades_rut: '',
  actividad_dian_ciiu: '', tipo_regimen: 'Ordinario',
})

export default function ClientesPage() {
  const permisos = usePermisos('clientes')
  const { clientes, addCliente, updateCliente, deleteCliente } = useClientesStore()
  const refData = useReferenceStore(s => s.data)

  const [viewDetail, setViewDetail] = useState<Cliente | null>(null)
  const [isForm, setIsForm] = useState(false)
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  // ─── Estilos compartidos (mismo patrón que CRM SPIN) ──────────────────────
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff', fontSize: 13, outline: 'none', boxSizing: 'border-box', height: 38 }
  const btnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
  const labelStyle: React.CSSProperties = { color: '#ffffff', fontSize: 14, fontWeight: 800, display: 'block', marginBottom: 6 }
  const th: React.CSSProperties = { padding: '12px 14px', background: '#0F8888', color: '#fff', fontSize: 12, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', fontSize: 13 }

  const statusStyle = (s: string): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      'Activo': { background: '#4169E1', color: '#ffffff', border: '1px solid #3b82f6' },
      'Inactivo': { background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' },
      'Bloqueado': { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' },
      'Prospecto': { background: '#14B4B4', color: '#ffffff', border: '1px solid #3b82f6' },
    }
    return map[s] || {}
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(c =>
      (c.razon_social || '').toLowerCase().includes(q) ||
      (c.codigo || '').toLowerCase().includes(q) ||
      (c.nro_documento || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.ciudad || '').toLowerCase().includes(q)
    )
  }, [clientes, search])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setError('')
    if (!selected.razon_social.trim()) { setError('Razón Social es obligatoria'); return }
    if (!selected.nro_documento.trim()) { setError('N° Documento es obligatorio'); return }
    const dup = clientes.find(c => c.id !== selected.id && c.nro_documento.trim().toLowerCase() === selected.nro_documento.trim().toLowerCase())
    if (dup) { setError(`Ya existe un cliente con documento ${selected.nro_documento}`); return }

    if (selected.id) {
      updateCliente(selected.id, selected)
    } else {
      const codigo = selected.codigo || `CLI-${String(clientes.length + 1).padStart(5, '0')}`
      addCliente({ ...selected, id: crypto.randomUUID(), codigo })
    }
    setIsForm(false); setSelected(null)
  }

  if (!permisos.leer) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>No tienes permisos para acceder a esta sección.</p></div>
  }

  // ═══════════════ VISTA DETALLE (Ver) ═══════════════
  if (viewDetail) {
    const fields = [
      { label: 'Código', value: viewDetail.codigo },
      { label: 'Tipo Documento', value: viewDetail.tipo_identificacion },
      { label: 'Nro. Documento', value: viewDetail.nro_documento },
      { label: 'Dígito Verificación', value: viewDetail.digito_verificacion || '—' },
      { label: 'Razón Social', value: viewDetail.razon_social },
      { label: 'Macro Sector', value: viewDetail.macro_sector },
      { label: 'Actividad Económica CIU', value: viewDetail.actividad_codigo ? `${viewDetail.actividad_codigo} — ${viewDetail.actividad}` : (viewDetail.actividad || '—') },
      { label: 'Dirección', value: viewDetail.direccion || '—' },
      { label: 'Ciudad', value: viewDetail.ciudad || '—' },
      { label: 'Departamento', value: viewDetail.departamento || '—' },
      { label: 'País', value: viewDetail.pais || '—' },
      { label: 'Teléfono', value: viewDetail.telefono || '—' },
      { label: 'Nro Móvil', value: viewDetail.nro_movil || '—' },
      { label: 'Correo', value: viewDetail.email || '—' },
      { label: 'Sitio Web', value: viewDetail.sitio_web || '—' },
      { label: 'Condición de Pago', value: viewDetail.condicion_pago },
      { label: 'Moneda', value: viewDetail.tipo_moneda },
      { label: 'Calificación como Pagador', value: viewDetail.calificacion_pagador || '—' },
      { label: 'Representante Legal', value: viewDetail.representante_legal || '—' },
      { label: 'Tipo de Cuenta', value: viewDetail.tipo_cuenta_cliente || '—' },
      { label: 'Clase de Cliente', value: viewDetail.clase_cliente || '—' },
      { label: 'Tipo Persona', value: viewDetail.tipo_persona || '—' },
      { label: 'Régimen IVA', value: viewDetail.regimen_iva || '—' },
      { label: 'Tipo Régimen', value: viewDetail.tipo_regimen || '—' },
      { label: 'Gran Contribuyente', value: viewDetail.gran_contribuyente || '—' },
      { label: 'Autorretenedor', value: viewDetail.autoretenedor || '—' },
      { label: 'Agente Retenedor', value: viewDetail.agente_retenedor || '—' },
      { label: 'CIIU DIAN', value: viewDetail.actividad_dian_ciiu || '—' },
      { label: 'Responsabilidades RUT', value: viewDetail.responsabilidades_rut || '—' },
      { label: 'Ret. Fuente %', value: String(viewDetail.retencion_fuente_pct) },
      { label: 'Ret. IVA %', value: String(viewDetail.retencion_iva_pct) },
      { label: 'Tarifa ICA (×mil)', value: String(viewDetail.retencion_ica_pct) },
      { label: 'Cupo Crédito', value: viewDetail.cupo_credito.toLocaleString('es-CO') },
      { label: 'Banco Pagos', value: viewDetail.banco_pagos || '—' },
      { label: 'Cuenta Banco', value: viewDetail.cuenta_banco || '—' },
      { label: 'Tipo Cuenta Banco', value: viewDetail.tipo_cuenta_banco || '—' },
      { label: 'Mes Cierre Anual', value: viewDetail.mes_cierre_anual || '—' },
      { label: 'Situación', value: viewDetail.situacion },
      { label: 'Fecha Registro', value: fDate(viewDetail.fecha_registro) },
      { label: 'Fecha Ingreso', value: viewDetail.fecha_ingreso_cliente ? fDate(viewDetail.fecha_ingreso_cliente) : '—' },
      { label: 'Cómo nos Conoció', value: viewDetail.como_nos_conocio || '—' },
      { label: 'Código Acceso', value: viewDetail.codigo_acceso || '—' },
    ]
    return (
      <div>
        <button onClick={() => setViewDetail(null)} style={{ ...btnStyle, background: '#000000', color: '#ffffff', border: '1px solid #333333', marginBottom: 16 }}>← Volver</button>
        <div style={{ background: '#0A5A5A', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.15)' }}>
          <h2 style={{ color: '#ffffff', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{viewDetail.razon_social}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            {fields.map(f => (
              <div key={f.label}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</label>
                <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{f.value || '—'}</div>
              </div>
            ))}
          </div>
          {viewDetail.observaciones && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Observaciones</label>
              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, marginTop: 4, whiteSpace: 'pre-wrap' }}>{viewDetail.observaciones}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════ FORMULARIO (Editar / Nuevo) ═══════════════
  if (isForm && selected) {
    return (
      <div>
        <button onClick={() => { setIsForm(false); setSelected(null); setError('') }} style={{ ...btnStyle, background: '#000000', color: '#ffffff', border: '1px solid #333333', marginBottom: 16 }}>← Volver</button>
        <form onSubmit={handleSave} style={{ background: '#0A5A5A', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.15)' }}>
          <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>{selected.id ? 'Editar' : 'Nuevo'} Cliente</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div><label style={labelStyle}>Código</label><input value={selected.codigo} readOnly style={{ ...inputStyle, opacity: 0.5 }} /></div>
            <div><label style={labelStyle}>Fecha Registro</label><input value={fDate(selected.fecha_registro)} readOnly style={{ ...inputStyle, opacity: 0.5 }} /></div>
            <div><label style={labelStyle}>Fecha Ingreso Cliente</label><input type="date" value={selected.fecha_ingreso_cliente} onChange={e => setSelected({ ...selected, fecha_ingreso_cliente: e.target.value })} style={inputStyle} /></div>

            <div><label style={labelStyle}>Tipo Documento</label>
              <select value={selected.tipo_identificacion} onChange={e => setSelected({ ...selected, tipo_identificacion: e.target.value })} style={inputStyle}>
                {['NIT','CC','CE','PAS','RUT','TI','Otro'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Nro. Documento *</label><input value={selected.nro_documento} onChange={e => setSelected({ ...selected, nro_documento: e.target.value })} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Dígito Verificación</label><input value={selected.digito_verificacion} onChange={e => setSelected({ ...selected, digito_verificacion: e.target.value })} maxLength={2} style={inputStyle} /></div>

            <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Razón Social *</label><input value={selected.razon_social} onChange={e => setSelected({ ...selected, razon_social: e.target.value })} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Macro Sector</label><input value={selected.macro_sector} onChange={e => setSelected({ ...selected, macro_sector: e.target.value })} style={inputStyle} /></div>

            <div><label style={labelStyle}>Actividad</label><input value={selected.actividad} onChange={e => setSelected({ ...selected, actividad: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Cód. Actividad</label><input value={selected.actividad_codigo} onChange={e => setSelected({ ...selected, actividad_codigo: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>CIIU DIAN</label><input value={selected.actividad_dian_ciiu} onChange={e => setSelected({ ...selected, actividad_dian_ciiu: e.target.value })} style={inputStyle} /></div>

            <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Dirección</label><input value={selected.direccion} onChange={e => setSelected({ ...selected, direccion: e.target.value })} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>País</label>
              <select value={selected.pais} onChange={e => setSelected({ ...selected, pais: e.target.value })} style={inputStyle}>
                <option value="">Seleccionar…</option>
                {(refData.pais ?? []).filter(p => p.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')).map(p => (
                  <option key={p.id} value={p.descripcion}>{p.descripcion}</option>
                ))}
                {selected.pais && !(refData.pais ?? []).some(p => p.descripcion === selected.pais) && (
                  <option value={selected.pais}>⚠ {selected.pais}</option>
                )}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Departamento</label>
              <select value={selected.departamento} onChange={e => {
                const newDep = e.target.value
                // Si la ciudad actual no pertenece al nuevo depto, limpiarla
                const ciudadValida = newDep && (refData.ciudad ?? []).some(c => {
                  const cc = c as { descripcion: string; departamento?: string }
                  return cc.descripcion === selected.ciudad && (cc.departamento || '') === newDep
                })
                setSelected({ ...selected, departamento: newDep, ciudad: ciudadValida ? selected.ciudad : '' })
              }} style={inputStyle}>
                <option value="">Seleccionar…</option>
                {(refData.departamento ?? []).filter(d => d.situacion).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')).map(d => (
                  <option key={d.id} value={d.descripcion}>{d.descripcion}</option>
                ))}
                {selected.departamento && !(refData.departamento ?? []).some(d => d.descripcion === selected.departamento) && (
                  <option value={selected.departamento}>⚠ {selected.departamento}</option>
                )}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ciudad</label>
              <select value={selected.ciudad} onChange={e => setSelected({ ...selected, ciudad: e.target.value })} style={inputStyle}>
                <option value="">Seleccionar…</option>
                {(refData.ciudad ?? [])
                  .filter(c => {
                    const cc = c as { situacion: boolean; departamento?: string }
                    if (!cc.situacion) return false
                    if (selected.departamento && cc.departamento) return cc.departamento === selected.departamento
                    return true
                  })
                  .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'))
                  .map(c => <option key={c.id} value={c.descripcion}>{c.descripcion}</option>)}
                {selected.ciudad && !(refData.ciudad ?? []).some(c => c.descripcion === selected.ciudad) && (
                  <option value={selected.ciudad}>⚠ {selected.ciudad}</option>
                )}
              </select>
            </div>
            <div><label style={labelStyle}>Cód. Postal</label><input value={selected.codigo_postal} onChange={e => setSelected({ ...selected, codigo_postal: e.target.value })} style={inputStyle} /></div>

            <div><label style={labelStyle}>Teléfono</label><input value={selected.telefono} onChange={e => setSelected({ ...selected, telefono: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Nro Móvil</label><input value={selected.nro_movil} onChange={e => setSelected({ ...selected, nro_movil: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Correo *</label><input type="email" value={selected.email} onChange={e => setSelected({ ...selected, email: e.target.value })} required style={inputStyle} /></div>
            <div><label style={labelStyle}>Sitio Web</label><input value={selected.sitio_web} onChange={e => setSelected({ ...selected, sitio_web: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Representante Legal</label><input value={selected.representante_legal} onChange={e => setSelected({ ...selected, representante_legal: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Cómo nos conoció</label><input value={selected.como_nos_conocio} onChange={e => setSelected({ ...selected, como_nos_conocio: e.target.value })} style={inputStyle} /></div>

            <div><label style={labelStyle}>Condición de Pago</label>
              <select value={selected.condicion_pago} onChange={e => setSelected({ ...selected, condicion_pago: e.target.value })} style={inputStyle}>
                {['Contado','Crédito 15 días','Crédito 30 días','Crédito 60 días','Crédito 90 días'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Moneda</label>
              <select value={selected.tipo_moneda} onChange={e => setSelected({ ...selected, tipo_moneda: e.target.value })} style={inputStyle}>
                {['COP','USD','EUR','Pesos Colombianos'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Cupo Crédito</label><input type="number" value={selected.cupo_credito} onChange={e => setSelected({ ...selected, cupo_credito: Number(e.target.value) || 0 })} style={inputStyle} /></div>

            <div><label style={labelStyle}>Calificación Pagador</label>
              <select value={selected.calificacion_pagador} onChange={e => setSelected({ ...selected, calificacion_pagador: e.target.value })} style={inputStyle}>
                {['Excelente','Bueno','Regular','Malo','En mora'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Tipo Cuenta Cliente</label>
              <select value={selected.tipo_cuenta_cliente} onChange={e => setSelected({ ...selected, tipo_cuenta_cliente: e.target.value })} style={inputStyle}>
                {['Cliente','Cliente y Proveedor','Prospecto'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Clase Cliente</label>
              <select value={selected.clase_cliente} onChange={e => setSelected({ ...selected, clase_cliente: e.target.value })} style={inputStyle}>
                {['Clientes Especiales','VIP','Recurrente','Otros Clientes'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div><label style={labelStyle}>Tipo Persona</label>
              <select value={selected.tipo_persona} onChange={e => setSelected({ ...selected, tipo_persona: e.target.value })} style={inputStyle}>
                {['Natural','Jurídica'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Régimen IVA</label>
              <select value={selected.regimen_iva} onChange={e => setSelected({ ...selected, regimen_iva: e.target.value })} style={inputStyle}>
                {['Responsable IVA','No Responsable IVA','No Responsable','Régimen Simple'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Tipo Régimen</label>
              <select value={selected.tipo_regimen} onChange={e => setSelected({ ...selected, tipo_regimen: e.target.value })} style={inputStyle}>
                {['Ordinario','Simple'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Gran Contribuyente</label>
              <select value={selected.gran_contribuyente} onChange={e => setSelected({ ...selected, gran_contribuyente: e.target.value })} style={inputStyle}>
                {['No','Sí'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Autorretenedor</label>
              <select value={selected.autoretenedor} onChange={e => setSelected({ ...selected, autoretenedor: e.target.value })} style={inputStyle}>
                {['No','Sí'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Agente Retenedor</label>
              <select value={selected.agente_retenedor} onChange={e => setSelected({ ...selected, agente_retenedor: e.target.value })} style={inputStyle}>
                {['No','Sí'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div><label style={labelStyle}>% Ret. Fuente</label><input type="number" step="0.01" value={selected.retencion_fuente_pct} onChange={e => setSelected({ ...selected, retencion_fuente_pct: Number(e.target.value) || 0 })} style={inputStyle} /></div>
            <div><label style={labelStyle}>% Ret. IVA</label><input type="number" step="1" value={selected.retencion_iva_pct} onChange={e => setSelected({ ...selected, retencion_iva_pct: Number(e.target.value) || 0 })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Tarifa ICA (×mil)</label><input type="number" step="0.01" value={selected.retencion_ica_pct} onChange={e => setSelected({ ...selected, retencion_ica_pct: Number(e.target.value) || 0 })} style={inputStyle} /></div>

            <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>Responsabilidades RUT</label><input value={selected.responsabilidades_rut} onChange={e => setSelected({ ...selected, responsabilidades_rut: e.target.value })} style={inputStyle} placeholder="O-13, O-15, O-23..." /></div>

            <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Banco Pagos</label><input value={selected.banco_pagos} onChange={e => setSelected({ ...selected, banco_pagos: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Tipo Cuenta Banco</label>
              <select value={selected.tipo_cuenta_banco} onChange={e => setSelected({ ...selected, tipo_cuenta_banco: e.target.value })} style={inputStyle}>
                {['Ahorros','Ahorro','Corriente','Crédito'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>N° Cuenta Banco</label><input value={selected.cuenta_banco} onChange={e => setSelected({ ...selected, cuenta_banco: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Naturaleza Cuenta</label>
              <select value={selected.naturaleza_cuenta} onChange={e => setSelected({ ...selected, naturaleza_cuenta: e.target.value })} style={inputStyle}>
                {['Persona Natural','Persona Jurídica','J','N'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div><label style={labelStyle}>Mes Cierre Anual</label>
              <select value={selected.mes_cierre_anual} onChange={e => setSelected({ ...selected, mes_cierre_anual: e.target.value })} style={inputStyle}>
                {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Clasificación Tributaria</label><input value={selected.clasificacion_tributaria} onChange={e => setSelected({ ...selected, clasificacion_tributaria: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Situación</label>
              <select value={selected.situacion} onChange={e => setSelected({ ...selected, situacion: e.target.value })} style={inputStyle}>
                {['Activo','Inactivo','Bloqueado','Prospecto'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>Observaciones</label><textarea rows={3} value={selected.observaciones} onChange={e => setSelected({ ...selected, observaciones: e.target.value })} style={{ ...inputStyle, height: 'auto', paddingTop: 10 }} /></div>
          </div>

          {error && <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, color: '#fca5a5', fontSize: 13, fontWeight: 700 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setIsForm(false); setSelected(null); setError('') }} style={{ ...btnStyle, background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>Cancelar</button>
            <button type="submit" style={{ ...btnStyle, background: '#0A5A5A', color: '#ffffff', border: '1px solid #14B4B4' }}>{selected.id ? 'Guardar Cambios' : 'Crear Cliente'}</button>
          </div>
        </form>
      </div>
    )
  }

  // ═══════════════ LISTA PRINCIPAL (Consulta) ═══════════════
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 800 }}>Clientes</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>Maestro de clientes — datos comerciales y tributarios</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {permisos.editar && (
            <button onClick={() => { setSelected(emptyCliente(`CLI-${String(clientes.length + 1).padStart(5, '0')}`)); setIsForm(true) }} style={{ ...btnStyle, background: '#0A5A5A', color: '#ffffff', border: '1px solid #14B4B4' }}>+ Nuevo Cliente</button>
          )}
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por razón social, código, documento, ciudad o correo..." style={{ ...inputStyle, maxWidth: 500, marginBottom: 16 }} />

      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12 }}>{filtered.length} cliente(s)</p>

      <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Razón Social','Ciudad','Teléfono','Correo','Situación','Acciones'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                <td style={{ ...td, color: '#ffffff', fontWeight: 600 }}>{c.razon_social}</td>
                <td style={td}>{c.ciudad || '—'}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{c.telefono || c.nro_movil || '—'}</td>
                <td style={td}>{c.email || '—'}</td>
                <td style={td}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...statusStyle(c.situacion) }}>{c.situacion}</span></td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setViewDetail(c)} style={{ ...btnStyle, padding: '4px 12px', fontSize: 11, background: '#ea580c', color: '#ffffff', border: '1px solid #f97316' }}>Ver</button>
                    {permisos.editar && <button onClick={() => { setSelected(c); setIsForm(true) }} style={{ ...btnStyle, padding: '4px 12px', fontSize: 11, background: '#14B4B4', color: '#ffffff', border: '1px solid #3b82f6' }}>Editar</button>}
                    {permisos.eliminar && <button onClick={() => { if (confirm(`¿Eliminar cliente "${c.razon_social}"?`)) deleteCliente(c.id) }} style={{ ...btnStyle, padding: '4px 12px', fontSize: 11, background: '#dc2626', color: '#ffffff', border: '1px solid #ef4444' }}>Eliminar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>No hay clientes registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
