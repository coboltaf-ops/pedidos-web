import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DatosEmpresa = {
  id: string
  nombre: string
  nit: string
  razon_social: string
  correo: string
  telefono_oficina: string
  direccion: string
  ciudad: string
  pais: string
  representante_legal: string
  servidor_correo: string
  logo: string
}

interface EmpresaState {
  empresas: DatosEmpresa[]
  addEmpresa: (empresa: DatosEmpresa) => void
  updateEmpresa: (id: string, empresa: Partial<DatosEmpresa>) => void
  deleteEmpresa: (id: string) => void
}

export const useEmpresaStore = create<EmpresaState>()(
  persist(
    (set, get) => ({
      empresas: [
        {
          id: '1',
          nombre: 'Mi Empresa',
          nit: '',
          razon_social: '',
          correo: '',
          telefono_oficina: '',
          direccion: '',
          ciudad: '',
          pais: 'Colombia',
          representante_legal: '',
          servidor_correo: '',
          logo: '',
        },
      ],
      addEmpresa: (empresa) =>
        set((state) => ({
          empresas: [...state.empresas, empresa],
        })),
      updateEmpresa: (id, empresa) =>
        set((state) => ({
          empresas: state.empresas.map((e) =>
            e.id === id ? { ...e, ...empresa } : e
          ),
        })),
      deleteEmpresa: (id) =>
        set((state) => ({
          empresas: state.empresas.filter((e) => e.id !== id),
        })),
    }),
    {
      name: 'empresa-storage',
      version: 1,
      // Solo hidrata si hay datos válidos en storage
      partialize: (state) => ({
        empresas: state.empresas.filter(e => e.nombre && e.nombre.trim().length > 0),
      }),
    }
  )
)
