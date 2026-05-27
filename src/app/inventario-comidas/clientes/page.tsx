'use client'

import { useState, useEffect } from 'react'
import { useClientesComidasStore } from '@/features/inventario-comidas/store/clientes-comidas-store'
import type { ClienteComida } from '@/features/inventario-comidas/types'

export default function ClientesComidasPage() {
  const clientes = useClientesComidasStore((s) => s.clientes)
  const setClientes = useClientesComidasStore((s) => s.setClientes)
  const [editing, setEditing] = useState<ClienteComida | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Partial<ClienteComida>>({
    situacion: 'Activo',
    tipo_cliente: 'Persona Natural',
    tipo_identificacion: 'CC',
  })

  useEffect(() => {
    if (clientes.length === 0) {
      fetch('/api/data/clientes-comidas')
        .then((res) => res.json())
        .then((data) => setClientes(data))
        .catch((err) => console.error('Error cargando clientes:', err))
    }
  }, [])

  const getNextCorrelativo = () => {
    if (clientes.length === 0) return 1
    return Math.max(...clientes.map((c) => c.nro_correlativo || 0)) + 1
  }

  const handleSave = async () => {
    try {
      if (!formData.nombre || !formData.correo || !formData.nro_movil || !formData.nro_documento) {
        alert('Por favor completa todos los campos obligatorios: Nombre, Correo, Teléfono y Documento')
        return
      }

      let cliente: ClienteComida
      if (editing) {
        cliente = { ...editing, ...formData } as ClienteComida
        setClientes(clientes.map((c) => (c.id === editing.id ? cliente : c)))
      } else {
        cliente = {
          id: crypto.randomUUID(),
          nro_correlativo: getNextCorrelativo(),
          fecha_creacion: new Date().toISOString(),
          ...formData,
        } as ClienteComida
        setClientes([...clientes, cliente])
      }

      const allClientes = editing
        ? clientes.map((c) => (c.id === editing.id ? cliente : c))
        : [...clientes, cliente]

      await fetch('/api/data/clientes-comidas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allClientes),
      })

      setShowForm(false)
      setEditing(null)
      setFormData({ situacion: 'Activo', tipo_cliente: 'Persona Natural', tipo_identificacion: 'CC' })
    } catch (err) {
      alert('Error guardando cliente: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      const updated = clientes.filter((c) => c.id !== id)
      setClientes(updated)
      await fetch('/api/data/clientes-comidas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
    } catch (err) {
      alert('Error eliminando: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  const handleExportPDF = (cliente: ClienteComida) => {
    alert('Exportar PDF de cliente: ' + cliente.nombre + '\n(Funcionalidad en desarrollo)')
  }

  const handleViewDetails = (cliente: ClienteComida) => {
    alert('Detalles de ' + cliente.nombre + '\n\nDocumento: ' + cliente.tipo_identificacion + ' ' + cliente.nro_documento + '\nCorreo: ' + cliente.correo + '\nTeléfono: ' + cliente.nro_movil + '\nUbicación: ' + (cliente.direccion || '-') + ', ' + (cliente.ciudad || '-') + ', ' + (cliente.pais || '-'))
  }

  const handleOpenForm = () => {
    setEditing(null)
    setFormData({ situacion: 'Activo', tipo_cliente: 'Persona Natural', tipo_identificacion: 'CC' })
    setShowForm(true)
  }

  const handleEditOpen = (cliente: ClienteComida) => {
    setEditing(cliente)
    setFormData(cliente)
    setShowForm(true)
  }

  return (
    <div style={{ padding: '40px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>👥 CLIENTES</h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
          <button
            onClick={handleOpenForm}
            style={{
              padding: '12px 24px',
              background: '#ea580c',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            ➕ Registro de Cliente
          </button>
          <button
            onClick={() => alert('Reportes en desarrollo')}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            📊 Reportes
          </button>
        </div>

        {clientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <p>No hay clientes. Crea clientes para comenzar.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ea580c' }}>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Nro</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Tipo Cliente</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Tipo ID</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Nro Documento</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Correo</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Móvil</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Ciudad</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Situación</th>
                  <th style={{ textAlign: 'left', padding: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#ea580c' }}>{cliente.nro_correlativo || '-'}</td>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#aaa' }}>{cliente.tipo_cliente}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{cliente.nombre}</td>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#aaa' }}>{cliente.tipo_identificacion}</td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{cliente.nro_documento}</td>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#aaa' }}>{cliente.correo}</td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{cliente.nro_movil}</td>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#aaa' }}>{cliente.ciudad || '-'}</td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          background: cliente.situacion === 'Activo' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                          color: cliente.situacion === 'Activo' ? '#10b981' : '#ef4444',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {cliente.situacion}
                      </span>
                    </td>
                    <td style={{ padding: '10px', display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleViewDetails(cliente)}
                        title="Ver"
                        style={{
                          padding: '6px 12px',
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => handleEditOpen(cliente)}
                        title="Editar"
                        style={{
                          padding: '6px 12px',
                          background: '#3b82f6',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(cliente.id)}
                        title="Eliminar"
                        style={{
                          padding: '6px 12px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: '#111',
                padding: '40px',
                borderRadius: '12px',
                maxWidth: '700px',
                width: '90%',
                border: '2px solid #ea580c',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <h2 style={{ marginBottom: '20px', fontWeight: 'bold' }}>
                {editing ? '✎ Editar' : '➕ Nuevo'} Cliente
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    Tipo Cliente *
                  </label>
                  <select
                    value={formData.tipo_cliente || 'Persona Natural'}
                    onChange={(e) => setFormData({ ...formData, tipo_cliente: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Persona Natural">Persona Natural</option>
                    <option value="Empresa">Empresa</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre || ''}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    Tipo Identificación *
                  </label>
                  <select
                    value={formData.tipo_identificacion || 'CC'}
                    onChange={(e) => setFormData({ ...formData, tipo_identificacion: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="CC">CC</option>
                    <option value="NIT">NIT</option>
                    <option value="TI">TI</option>
                    <option value="Pasaporte">Pasaporte</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    Nro Documento *
                  </label>
                  <input
                    type="text"
                    value={formData.nro_documento || ''}
                    onChange={(e) => setFormData({ ...formData, nro_documento: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    Correo *
                  </label>
                  <input
                    type="email"
                    value={formData.correo || ''}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    Nro Móvil *
                  </label>
                  <input
                    type="tel"
                    value={formData.nro_movil || ''}
                    onChange={(e) => setFormData({ ...formData, nro_movil: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.direccion || ''}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    Ciudad/Población
                  </label>
                  <input
                    type="text"
                    value={formData.ciudad || ''}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    Población
                  </label>
                  <input
                    type="text"
                    value={formData.poblacion || ''}
                    onChange={(e) => setFormData({ ...formData, poblacion: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                    País
                  </label>
                  <input
                    type="text"
                    value={formData.pais || ''}
                    onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#222',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                  Situación
                </label>
                <select
                  value={formData.situacion || 'Activo'}
                  onChange={(e) => setFormData({ ...formData, situacion: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSave}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {editing ? 'ACTUALIZAR' : 'GUARDAR'}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditing(null)
                    setFormData({ situacion: 'Activo', tipo_cliente: 'Persona Natural', tipo_identificacion: 'CC' })
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#666',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
