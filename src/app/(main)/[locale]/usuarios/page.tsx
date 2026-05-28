'use client'

import { useTranslations } from 'next-intl'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUsuariosStore } from '@/features/usuarios-gestion/store/usuarios-store'
import { useCurrentUserStore } from '@/features/usuarios/store/current-user-store'
import { type Usuario } from '@/features/usuarios-gestion/types'
import { UsuariosTabla } from '@/features/usuarios-gestion/components/usuarios-tabla'
import { UsuarioForm } from '@/features/usuarios-gestion/components/usuario-form'
import { PermisosMatriz } from '@/features/usuarios-gestion/components/permisos-matriz'
import ReportPanel from '@/shared/components/report-panel'
import ViewRecordModal from '@/shared/components/view-record-modal'
import { ESTADOS } from '@/features/usuarios-gestion/types'
import { useReferenceStore } from '@/features/referencias/store/reference-store'

// ─── Estilos de tabs ─────────────────────────────────────────────────────────

const tabActive: React.CSSProperties = {
  background: 'rgba(59,130,246,1)',
  color: '#fff',
  border: '1px solid rgba(37,99,235,1)',
}
const tabInactive: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  border: '1px solid transparent',
}

// ─── Página Principal ────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const t = useTranslations('pages')
  const tTab = useTranslations('tabs')
  const tAl = useTranslations('alerts')
  const tF = useTranslations('fields')
  const tSub = useTranslations('subtitles')
  const tRpt = useTranslations('reportTitles')
  const router = useRouter()
  const { usuarios, addUsuario, updateUsuario, deleteUsuario } = useUsuariosStore()
  const esAdmin = useCurrentUserStore(s => s.esAdmin)
  const rolesRef = useReferenceStore(s => s.data.roles).filter(r => r.situacion)

  // Proteger ruta: solo Admin
  useEffect(() => {
    if (!esAdmin()) router.push('/dashboard')
  }, [esAdmin, router])

  const [tab, setTab] = useState<'registros' | 'permisos' | 'reportes'>('registros')
  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [viewRecord, setViewRecord] = useState<Usuario | null>(null)

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleNew = () => {
    setEditUser(null)
    setFormOpen(true)
  }

  const handleEdit = (u: Usuario) => {
    setEditUser({ ...u, clave: '' })
  }

  const handleDelete = (u: Usuario) => {
    if (u.rol === 'Admin') {
      alert(tAl('noEliminarAdmin'))
      return
    }
    if (confirm(`¿Eliminar usuario "${u.nombre} ${u.apellido}"?`)) {
      deleteUsuario(u.id)
    }
  }

  const handleSave = (u: Usuario) => {
    if (u.id) {
      // Edición: mantener clave anterior si no se cambió
      const existing = usuarios.find(r => r.id === u.id)
      const claveToSave = u.clave || existing?.clave || ''
      updateUsuario(u.id, { ...u, clave: claveToSave })
    } else {
      addUsuario({ ...u, id: crypto.randomUUID() })
    }
    setFormOpen(false)
    setEditUser(null)
  }

  // ── Reportes ────────────────────────────────────────────────────────────

  const reportColumns = [
    { header: 'Usuario', key: 'usuario', width: 16 },
    { header: 'Nombre', key: 'nombre', width: 16 },
    { header: 'Apellido', key: 'apellido', width: 16 },
    { header: 'Correo', key: 'correo', width: 24 },
    { header: 'Rol', key: 'rol', width: 16 },
    { header: 'Estado', key: 'situacion', width: 12 },
  ]

  const reportRows = usuarios.map(r => ({
    usuario: r.usuario,
    nombre: r.nombre,
    apellido: r.apellido,
    correo: r.correo,
    rol: r.rol,
    situacion: r.situacion,
  }))

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('usuarios')}</h1>
          <p className="text-white/50 mt-1">{tSub('usuarios')}</p>
        </div>
      </div>

      {/* Tabs: Registros | Permisos | Reportes */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {[
          { id: 'registros' as const, label: tTab('registros'), icon: '📋' },
          { id: 'permisos' as const, label: 'Permisos', icon: '🔐' },
          { id: 'reportes' as const, label: tTab('reportes'), icon: '📊' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.id ? tabActive : tabInactive}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Registros (Tabla + Stats) */}
      {tab === 'registros' && (
        <UsuariosTabla
          usuarios={usuarios}
          esAdmin={esAdmin()}
          onNew={handleNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={setViewRecord}
        />
      )}

      {/* Tab: Permisos (Matriz estilo CRM) */}
      {tab === 'permisos' && (
        <PermisosMatriz
          usuarios={usuarios}
          onUpdateUsuario={updateUsuario}
        />
      )}

      {/* Tab: Reportes */}
      {tab === 'reportes' && (
        <ReportPanel
          title={tRpt('usuarios')}
          columns={reportColumns}
          rows={reportRows}
          filters={[
            { label: tF('rol'), key: 'rol', options: rolesRef.map(r => r.descripcion) },
            { label: 'Estado', key: 'situacion', options: [...ESTADOS] },
          ]}
          filename="usuarios"
        />
      )}

      {/* Modal: Nuevo usuario */}
      {formOpen && (
        <UsuarioForm
          onSubmit={handleSave}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Modal: Editar usuario */}
      {editUser && (
        <UsuarioForm
          usuario={editUser}
          onSubmit={handleSave}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* Modal: Ver detalle */}
      {viewRecord && (
        <ViewRecordModal
          title={`Usuario: ${viewRecord.usuario}`}
          fields={[
            { label: 'Usuario', value: viewRecord.usuario },
            { label: 'Nombre', value: viewRecord.nombre },
            { label: tF('apellido'), value: viewRecord.apellido },
            { label: 'Correo', value: viewRecord.correo },
            { label: tF('rol'), value: viewRecord.rol },
            { label: 'Estado', value: viewRecord.situacion },
          ]}
          onClose={() => setViewRecord(null)}
        />
      )}
    </div>
  )
}
