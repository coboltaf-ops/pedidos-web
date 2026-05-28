import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface State {
  data: any[]
  [key: string]: any
}

export const store_creator = (storeName: string) =>
  create<State>()(
    persist(
      (set) => ({
        data: [],
      }),
      { name: `${storeName}-storage` }
    )
  )
export const usehojaprocesoStore = store_creator('hoja-proceso-store')
