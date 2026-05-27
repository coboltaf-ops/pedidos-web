import fs from 'fs'
import path from 'path'
import os from 'os'
import { put, list, del } from '@vercel/blob'

const DATA_DIR = path.join(process.cwd(), 'data')
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN

if (!USE_BLOB && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

function filePath(collection: string) {
  return path.join(DATA_DIR, `${collection}.json`)
}

function atomicWrite(fp: string, content: string): void {
  try {
    // Crear directorio si no existe
    const dir = path.dirname(fp)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Intenta usar rename atómico (funciona en sistemas de archivos normales)
    const tmpPath = path.join(os.tmpdir(), `${path.basename(fp)}.${Date.now()}.tmp`)
    fs.writeFileSync(tmpPath, content, 'utf-8')
    fs.renameSync(tmpPath, fp)
  } catch (err) {
    // Si falla (ej: EXDEV en serverless), escribe directamente sin rename
    try {
      const dir = path.dirname(fp)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(fp, content, 'utf-8')
    } catch (writeErr) {
      // En Vercel sin Blob Storage, la escritura a /data/ no persiste
      // pero el cliente tiene los datos en localStorage
      console.warn('[DB] No se pudo escribir archivo (posible Vercel sin Blob):', writeErr)
      throw writeErr
    }
  }
}

// ─── Vercel Blob helpers ──────────────────────────────────────────────────────
//
// Estrategia: cada write crea un blob con nombre único (timestamp).
// Cada read hace list() para encontrar el más reciente.
// list() usa la API directa (no CDN) por lo que siempre está fresco.
// Después de cada write, eliminamos los blobs antiguos del mismo collection.

function makeBlobName(collection: string): string {
  return `${collection}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
}

let blobSuspended = false

async function blobRead<T>(collection: string): Promise<{ exists: boolean; data: T | null }> {
  if (blobSuspended) return { exists: false, data: null }
  try {
    const { blobs } = await list({ prefix: `${collection}/` })
    if (blobs.length === 0) return { exists: false, data: null }
    const sorted = [...blobs].sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
    const latest = sorted[0]
    const res = await fetch(latest.url, { cache: 'no-store' })
    if (!res.ok) return { exists: false, data: null }
    const data = (await res.json()) as T
    return { exists: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('suspended')) blobSuspended = true
    return { exists: false, data: null }
  }
}

async function blobWrite<T>(collection: string, data: T): Promise<void> {
  if (blobSuspended) return // No intentar escribir si esta suspendido
  try {
    const newPath = makeBlobName(collection)
    await put(newPath, JSON.stringify(data, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 0,
    })
    // Limpiar blobs antiguos
    try {
      const { blobs } = await list({ prefix: `${collection}/` })
      if (blobs.length > 3) {
        const sorted = [...blobs].sort((a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )
        const toDelete = sorted.slice(3).map(b => b.url)
        if (toDelete.length > 0) await del(toDelete)
      }
    } catch { /* limpieza no critica */ }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('suspended')) blobSuspended = true
    // Si blob falla, no lanzar error — el cliente persiste en localStorage
  }
}

function readSeedArray<T>(collection: string, fallback: T[]): T[] {
  const fp = filePath(collection)
  if (!fs.existsSync(fp)) return fallback
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')) } catch { return fallback }
}

function readSeedJson<T>(collection: string, fallback: T): T {
  const fp = filePath(collection)
  if (!fs.existsSync(fp)) return fallback
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')) } catch { return fallback }
}

// ─── API publica ──────────────────────────────────────────────────────────────

export async function readCollection<T>(collection: string, fallback: T[] = []): Promise<T[]> {
  if (USE_BLOB) {
    if (blobSuspended) {
      // Blob suspendido → devolver vacío para que el cliente use su localStorage
      return fallback
    }
    const { exists, data } = await blobRead<T[]>(collection)
    if (exists) {
      return Array.isArray(data) ? data : fallback
    }
    // No existe blob aun — usar seed del bundle como inicializacion
    return readSeedArray(collection, fallback)
  }
  return readSeedArray(collection, fallback)
}

export async function writeCollection<T>(collection: string, data: T[]): Promise<void> {
  if (USE_BLOB) {
    await blobWrite(collection, data)
    return
  }
  atomicWrite(filePath(collection), JSON.stringify(data, null, 2))
}

export async function readJson<T>(collection: string, fallback: T): Promise<T> {
  if (USE_BLOB) {
    if (blobSuspended) return fallback
    const { exists, data } = await blobRead<T>(collection)
    if (exists) {
      return (data ?? fallback) as T
    }
    return readSeedJson(collection, fallback)
  }
  return readSeedJson(collection, fallback)
}

export async function writeJson<T>(collection: string, data: T): Promise<void> {
  if (USE_BLOB) {
    await blobWrite(collection, data)
    return
  }
  atomicWrite(filePath(collection), JSON.stringify(data, null, 2))
}
