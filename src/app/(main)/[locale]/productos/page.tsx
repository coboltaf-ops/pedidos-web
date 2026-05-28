'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { fDate } from '@/shared/lib/format-date'
import { useReferenceStore } from '@/features/referencias/store/reference-store'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useProductosStore, type Producto } from '@/features/productos/store/productos-store'
import { useClientesStore } from '@/features/clientes/store/clientes-store'
import ReportPanel from '@/shared/components/report-panel'
import { LOGO_BASE64 } from '@/shared/lib/logo-base64'
import { usePermisos } from '@/shared/hooks/use-permisos'
import VoiceSearchButton from '@/shared/components/voice-search-button'


const fmtNum = (n: number, decimals = 2) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const fmtInt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// Tipos de inventario que NO usan Grupo ni Sub-Grupo
const tipoSinGrupo = (tipo: string): boolean => {
  const t = (tipo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return t.includes('semi elaborado') || t.includes('producto terminado') || t.includes('materia prima')
}

// Prefijo de código según Tipo de Inventario
const prefixForTipo = (tipo: string): string => {
  const t = (tipo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (t.includes('materia prima')) return 'MAP'
  if (t.includes('producto terminado')) return 'PTER'
  if (t.includes('semi elaborado')) return 'PSEL'
  if (t.includes('servicio')) return 'SERV'
  return 'PROD'
}

const nextCodigoForTipo = (records: Producto[], tipo: string): string => {
  const prefix = prefixForTipo(tipo)
  const maxNum = records.reduce((max, r) => {
    if (!r.codigo.startsWith(`${prefix}-`)) return max
    const num = parseInt(r.codigo.replace(`${prefix}-`, ''), 10)
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)
  return `${prefix}-${String(maxNum + 1).padStart(5, '0')}`
}

const initForm = (records: Producto[], tipoInicial = ''): Producto => {
  const cod = nextCodigoForTipo(records, tipoInicial)
  return { id: '', codigo: cod, descripcion: '', tipo_inventario: tipoInicial, categoria: '', grupo: '', sub_grupo: '', ult_costo: 0, costo_promedio: 0, precio_unitario: 0, ult_proveedor: '', codigo_barra: cod, maximo: 0, minimo: 0, unidad_medida: 'Unidad', existencia: 0, usa_seriales: false, situacion: 'Activo', imagen: '' }
}

const sitStyle = (s: string): React.CSSProperties => {
  if (s === 'Activo') return { background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }
  if (s === 'Descontinuado') return { background: 'rgba(245,158,11,0.2)', color: '#fff', border: '1px solid rgba(245,158,11,0.3)' }
  return { background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }
}

const tabActive: React.CSSProperties = { background: 'rgba(59,130,246,1)', color: '#fff', border: '1px solid rgba(37,99,235,1)' }
const tabInactive: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }

export default function ProductosPage() {
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tTab = useTranslations('tabs')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tPh = useTranslations('placeholders')
  const tCf = useTranslations('confirm')
  const tAl = useTranslations('alerts')
  const tH = useTranslations('headers')
  const tTbl = useTranslations('table')
  const tSub = useTranslations('subtitles')
  const tTip = useTranslations('tooltips')
  const tRpt = useTranslations('reportTitles')
  const tOp = useTranslations('options')
  const tEs = useTranslations('emptyState')
  const permisos = usePermisos('productos')
  const refData = useReferenceStore(s => s.data)
  const proveedores = useProveedoresStore(s => s.proveedores)
  const { productos: records, addProducto, addProductos, updateProducto, deleteProducto, deleteAllProductos, resetExistencias, resetUltCosto } = useProductosStore()
  const clientes = useClientesStore(s => s.clientes).filter(c => c.situacion === 'Activo')

  const [form, setForm] = useState<Producto>(initForm(records))

  const selStyle: React.CSSProperties = { background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)' }
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState<string>('') // '' = Todos los Clientes
  const [viewRecordId, setViewRecordId] = useState<string | null>(null)
  const viewRecord = viewRecordId ? records.find(r => r.id === viewRecordId) ?? null : null

  // Tipo de Inventario activo de sesión (única fuente de verdad)
  const tipoInvFiltro = useTipoInventarioSesion(s => s.tipoActivo) || ''
  const setTipoActivoSesion = useTipoInventarioSesion(s => s.setTipoActivo)

  // Tab state
  const [tab, setTab] = useState<'registros' | 'reportes' | 'especificos'>('registros')

  // Reportes Específicos
  const [reporteActivo, setReporteActivo] = useState<string | null>(null)
  const [reporteFecha, setReporteFecha] = useState(new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }))

  const [formError, setFormError] = useState('')

  // Filtros de etiquetas
  const [showEtiquetasFiltro, setShowEtiquetasFiltro] = useState(false)
  const [etqProducto, setEtqProducto] = useState('')
  const [etqCategoria, setEtqCategoria] = useState('')
  const [etqGrupo, setEtqGrupo] = useState('')
  const [etqSubGrupo, setEtqSubGrupo] = useState('')
  const [etqTipoCodigo, setEtqTipoCodigo] = useState<'barra' | 'qr' | 'ambos'>('barra')

  // Al cambiar Tipo de Inventario activo: cerrar form, limpiar b\u00fasqueda y resetear filtros
  // para que la vista se ajuste autom\u00e1ticamente al nuevo tipo
  useEffect(() => {
    setIsFormOpen(false)
    setViewRecordId(null)
    setSearch('')
    setClienteFiltro('')
    setEtqProducto('')
    setEtqCategoria('')
    setEtqGrupo('')
    setEtqSubGrupo('')
    setShowEtiquetasFiltro(false)
    setReporteActivo(null)
    setFormError('')
  }, [tipoInvFiltro])

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const filtered = records.filter(r => {
    if (tipoInvFiltro && r.tipo_inventario !== tipoInvFiltro) return false
    // Filtro por cliente (solo aplica si hay valor seleccionado)
    if (clienteFiltro && (r.cliente_id || '') !== clienteFiltro) return false
    const q = norm(search)
    if (!q) return true
    const words = q.split(/\s+/).filter(Boolean)
    const target = norm(r.codigo) + ' ' + norm(r.descripcion) + ' ' + norm(r.cliente || '') + ' ' + norm(r.codigo_spin || '')
    return words.every(w => target.includes(w))
  })

  // Lista de clientes disponibles para el filtro (solo los que tienen al menos 1 producto del tipo activo)
  const clientesEnProductos = useMemo(() => {
    const ids = new Set<string>()
    for (const r of records) {
      if (tipoInvFiltro && r.tipo_inventario !== tipoInvFiltro) continue
      if (r.cliente_id) ids.add(r.cliente_id)
    }
    return clientes.filter(c => ids.has(c.id))
  }, [records, clientes, tipoInvFiltro])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const duplicate = records.some(
      r => r.id !== form.id && r.descripcion.trim().toLowerCase() === form.descripcion.trim().toLowerCase()
    )
    if (duplicate) {
      setFormError(`Ya existe un producto con la descripción "${form.descripcion}".`)
      return
    }
    if (form.id) { updateProducto(form.id, form) }
    else { addProducto({ ...form, id: crypto.randomUUID() }) }
    setFormError('')
    setIsFormOpen(false)
  }

  const handleDelete = (id: string) => { if (confirm(tCf('delProducto'))) deleteProducto(id) }

  // ── Importar productos desde Excel ─────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      if (rows.length === 0) {
        setImportMsg('❌ El archivo no contiene filas.')
        return
      }

      // Mapeo flexible de nombres de columnas (insensible a mayúsculas/acentos/espacios)
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_-]+/g, '')
      const fieldAliases: Record<keyof Producto, string[]> = {
        codigo: ['codigo', 'code', 'sku'],
        codigo_alterno: ['codigoalterno', 'codalterno', 'codalt'],
        codigo_spin: ['codigospin', 'spin', 'spincodigo', 'codspin'],
        descripcion: ['descripcion', 'description', 'nombre', 'producto'],
        tipo_inventario: ['tipoinventario', 'tipoinv', 'tipo'],
        categoria: ['categoria', 'category'],
        grupo: ['grupo', 'group'],
        sub_grupo: ['subgrupo', 'subgroup'],
        ult_costo: ['ultcosto', 'ultimocosto', 'costo'],
        costo_promedio: ['costopromedio', 'cp'],
        precio_unitario: ['preciounitario', 'precioventa', 'precio'],
        ult_proveedor: ['ultproveedor', 'ultimoproveedor', 'proveedor'],
        codigo_barra: ['codigobarra', 'codigobarras', 'barcode'],
        maximo: ['maximo', 'max'],
        minimo: ['minimo', 'min'],
        unidad_medida: ['unidadmedida', 'unidad', 'um'],
        existencia: ['existencia', 'stock', 'inventario'],
        usa_seriales: ['usaseriales', 'seriales'],
        situacion: ['situacion', 'estado', 'status'],
        imagen: ['imagen', 'image'],
        id: ['id'],
        fecha_ult_compra: ['fechaultcompra'],
        fecha_ult_movimiento: ['fechaultmovimiento'],
        nro_ult_documento: ['nroultdocumento'],
        tipo_ult_movimiento: ['tipoultmovimiento'],
        cliente: ['cliente', 'razonsocial', 'razonsocialcliente'],
        cliente_id: ['clienteid'],
        clase_cliente: ['clasecliente', 'clase', 'tipocliente'],
        tipo_formula: ['tipoformula', 'formula', 'tipodeformula'],
        margen_ganancia: ['margenganancia', 'margen', 'ganancia'],
        margen_contribucion: ['margencontribucion', 'contribucion'],
        trm_dia: ['trmdia', 'trm', 'tasa'],
        conversion_cop: ['conversioncop', 'conversion', 'valorcop'],
        valor_usd: ['valorusd', 'valorus', 'us', 'usd', 'valordolar'],
        tipo_empaque: ['tipoempaque', 'empaque', 'presentacion'],
      }

      // Construir mapa de columnas detectadas
      const headers = Object.keys(rows[0])
      const colMap: Partial<Record<keyof Producto, string>> = {}
      for (const [field, aliases] of Object.entries(fieldAliases)) {
        const found = headers.find(h => aliases.includes(norm(h)))
        if (found) colMap[field as keyof Producto] = found
      }

      const get = (r: Record<string, unknown>, field: keyof Producto): unknown => {
        const col = colMap[field]
        return col ? r[col] : undefined
      }
      const num = (v: unknown): number => {
        if (typeof v === 'number') return v
        if (typeof v === 'string') return parseFloat(v.replace(/,/g, '')) || 0
        return 0
      }
      const str = (v: unknown): string => v == null ? '' : String(v).trim()

      // Construir productos
      const nuevos: Producto[] = []
      let omitidos = 0
      for (const r of rows) {
        const codigo = str(get(r, 'codigo'))
        const descripcion = str(get(r, 'descripcion'))
        if (!codigo || !descripcion) { omitidos++; continue }
        nuevos.push({
          id: crypto.randomUUID(),
          codigo,
          descripcion,
          tipo_inventario: str(get(r, 'tipo_inventario')) || 'Materiales  y Suministros',
          categoria: str(get(r, 'categoria')),
          grupo: str(get(r, 'grupo')),
          sub_grupo: str(get(r, 'sub_grupo')),
          ult_costo: num(get(r, 'ult_costo')),
          costo_promedio: num(get(r, 'costo_promedio')),
          precio_unitario: num(get(r, 'precio_unitario')),
          ult_proveedor: str(get(r, 'ult_proveedor')),
          codigo_barra: str(get(r, 'codigo_barra')) || codigo,
          maximo: num(get(r, 'maximo')),
          minimo: num(get(r, 'minimo')),
          unidad_medida: str(get(r, 'unidad_medida')) || 'Unidad',
          existencia: num(get(r, 'existencia')),
          usa_seriales: String(get(r, 'usa_seriales')).toLowerCase() === 'si' || get(r, 'usa_seriales') === true,
          situacion: str(get(r, 'situacion')) || 'Activo',
          imagen: str(get(r, 'imagen')),
        })
      }

      if (nuevos.length === 0) {
        setImportMsg('❌ Ninguna fila tenía Código y Descripción válidos.')
        return
      }

      addProductos(nuevos)
      setImportMsg(`✅ Importación exitosa: ${nuevos.length} productos cargados${omitidos > 0 ? ` (${omitidos} omitidos por falta de código o descripción)` : ''}.`)
    } catch (err) {
      setImportMsg(`❌ Error al leer el Excel: ${err instanceof Error ? err.message : 'desconocido'}`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAll = () => {
    if (records.length === 0) { alert('No hay productos para eliminar.'); return }
    if (!confirm(`¿ELIMINAR LOS ${records.length} PRODUCTOS DE LA BASE DE DATOS? Esta acción NO se puede deshacer.`)) return
    if (!confirm('Confirma una vez más: se borrarán TODOS los productos. ¿Continuar?')) return
    deleteAllProductos()
    setImportMsg(`🗑 Se eliminaron ${records.length} productos.`)
  }

  const printBarcodes = () => {
    const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
    let base = records.filter(r => r.situacion === 'Activo' && r.codigo_barra)
    // Filtro principal: tipo_inventario debe coincidir con el de la sesión
    if (tipoInvFiltro) {
      const t = norm(tipoInvFiltro)
      base = base.filter(r => norm(r.tipo_inventario) === t)
    }
    if (etqProducto) base = base.filter(r => r.id === etqProducto)
    if (etqCategoria) base = base.filter(r => r.categoria === etqCategoria)
    if (etqGrupo) base = base.filter(r => r.grupo === etqGrupo)
    if (etqSubGrupo) base = base.filter(r => r.sub_grupo === etqSubGrupo)
    const conBarcode = base
    if (conBarcode.length === 0) {
      alert(tipoInvFiltro
        ? `No hay productos de tipo "${tipoInvFiltro}" con código de barra que cumplan los filtros.`
        : tAl('noProductosCodigoBarra'))
      return
    }
    setShowEtiquetasFiltro(false)
    const tipo = etqTipoCodigo
    const showBarcode = tipo === 'barra' || tipo === 'ambos'
    const showQR = tipo === 'qr' || tipo === 'ambos'
    const tipoLabel = tipo === 'barra' ? 'Códigos de Barras' : tipo === 'qr' ? 'Códigos QR' : 'Códigos de Barras y QR'
    const items = conBarcode.map((r, idx) => {
      const spin = r.codigo_spin || ''
      const empaque = r.tipo_empaque || ''
      const qrPayload = [r.codigo_barra, spin, r.descripcion, empaque].filter(Boolean).join('|')
      return `
      <div class="item">
        ${showBarcode ? `<svg class="barcode" id="bc${idx}" data-code="${r.codigo_barra}"></svg>` : ''}
        ${showQR ? `<canvas class="qr" id="qr${idx}" data-text="${qrPayload}" width="120" height="120"></canvas>` : ''}
        <div class="label">${r.descripcion}</div>
        <div class="cod">${r.codigo_barra}</div>
        ${spin ? `<div class="spin">SPIN: ${spin}</div>` : ''}
        ${empaque ? `<div class="empaque">📦 ${empaque}</div>` : ''}
        <div class="meta">${[r.tipo_inventario, r.grupo, r.sub_grupo].filter(Boolean).join(' · ')}</div>
      </div>`
    }).join('')
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>${tipoLabel} — Productos</title>
    ${showBarcode ? `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>` : ''}
    ${showQR ? `<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>` : ''}
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;padding:20px}
      .toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #1a56db}
      h1{font-size:16px;font-weight:700;color:#1a56db}
      .btn-print{background:#1a56db;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer}
      .btn-print:hover{background:#1e40af}
      @media print{.btn-print{display:none}}
      .grid{display:flex;flex-wrap:wrap;gap:16px}
      .item{border:1px solid #d1d5db;border-radius:6px;padding:10px 12px;text-align:center;width:220px;page-break-inside:avoid}
      .item svg{width:100%;height:60px}
      .item canvas{display:block;margin:4px auto;image-rendering:pixelated}
      .label{font-size:11px;font-weight:700;color:#111;margin-top:6px;line-height:1.3}
      .cod{font-size:9px;color:#6b7280;font-family:monospace;margin-top:3px}
      .spin{font-size:10px;color:#b45309;font-weight:800;font-family:monospace;margin-top:3px;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block}
      .empaque{font-size:10px;color:#0A5A5A;font-weight:700;margin-top:3px;background:#d1ede9;padding:2px 6px;border-radius:4px;display:inline-block}
      .meta{font-size:9px;color:#1a56db;font-weight:600;margin-top:4px}
      @media print{body{padding:10px} h1{font-size:13px}}
    </style></head><body>
    <div class="toolbar">
      <h1>${tipoLabel} — Productos</h1>
      <button onclick="window.print()" class="btn-print">🖨 Imprimir</button>
    </div>
    <div class="grid">${items}</div>
    <script>
      window.onload = function() {
        ${showBarcode ? `document.querySelectorAll('.barcode').forEach(function(el) {
          try {
            JsBarcode(el, el.getAttribute('data-code'), {
              format: 'CODE128', width: 2, height: 55,
              displayValue: false, margin: 4
            })
          } catch(e) { el.parentElement.querySelector('.cod').textContent += ' (código inválido)' }
        })` : ''}
        ${showQR ? `document.querySelectorAll('.qr').forEach(function(canvas) {
          try {
            var text = canvas.getAttribute('data-text')
            var qr = qrcode(0, 'M')
            qr.addData(text)
            qr.make()
            var count = qr.getModuleCount()
            var cellSize = 3
            var margin = 2
            var total = (count + margin * 2) * cellSize
            canvas.width = total
            canvas.height = total
            canvas.style.width = total + 'px'
            canvas.style.height = total + 'px'
            var ctx = canvas.getContext('2d')
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, total, total)
            ctx.fillStyle = '#000000'
            for (var r = 0; r < count; r++) {
              for (var c = 0; c < count; c++) {
                if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize)
              }
            }
          } catch(e) { console.error('QR error:', e) }
        })` : ''}
      }
    <\/script>
    </body></html>`
    const win = window.open('', '_blank', 'width=900,height=700')
    if (win) { win.document.write(html); win.document.close() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('productos')}</h1>
          <p className="text-white/50 mt-1">
            {tSub('productos')}
            <span className="ml-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>
              {tipoInvFiltro || 'Todos los Productos'}
              <button onClick={() => setTipoActivoSesion(null)} className="text-white/70 hover:text-white" title="Cambiar filtro">✕</button>
            </span>
          </p>
        </div>
        {tab === 'registros' && permisos.editar && (
          <div className="flex gap-3 flex-wrap items-center">
            {/* Botón principal — siempre primero y bien visible */}
            <button onClick={() => { setForm(initForm(records, tipoInvFiltro || '')); setIsFormOpen(true) }}
              className="px-6 py-3 rounded-xl font-extrabold text-white text-base transition-all hover:scale-105 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', border: '2px solid rgba(96,165,250,0.6)', boxShadow: '0 4px 16px rgba(59,130,246,0.45)' }}>
              ➕ NUEVO PRODUCTO
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 rounded-xl font-medium text-white" style={{ background: 'rgba(34,197,94,0.4)', border: '1px solid rgba(21,128,61,1)' }} title="Importar productos desde un archivo Excel">
              📥 Subir Productos (Excel)
            </button>
            <button onClick={() => { setEtqProducto(''); setEtqCategoria(''); setEtqGrupo(''); setEtqSubGrupo(''); setShowEtiquetasFiltro(true) }} className="px-5 py-2.5 rounded-xl font-medium text-white" style={{ background: 'rgba(139,92,246,0.4)', border: '1px solid rgba(139,92,246,0.5)' }}>
              🔲 Etiquetas
            </button>
            <button onClick={handleDeleteAll} className="px-5 py-2.5 rounded-xl font-medium text-white" style={{ background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(185,28,28,1)' }} title="Eliminar TODOS los productos de la base de datos">
              🗑 Eliminar Todo
            </button>
            <button onClick={() => { if (confirm(tCf('resetExistencias'))) resetExistencias() }} className="px-5 py-2.5 rounded-xl font-medium text-white" style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.4)' }}>
              Resetear Existencias
            </button>
            <button onClick={() => { if (confirm(tCf('resetUltCosto'))) resetUltCosto() }} className="px-5 py-2.5 rounded-xl font-medium text-white" style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.4)' }}>
              Resetear Ult. Costo
            </button>
          </div>
        )}
      </div>

      {importMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-start justify-between gap-3"
          style={{
            background: importMsg.startsWith('✅') ? 'rgba(34,197,94,0.15)' : importMsg.startsWith('🗑') ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${importMsg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : importMsg.startsWith('🗑') ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: importMsg.startsWith('✅') ? '#86efac' : importMsg.startsWith('🗑') ? '#fcd34d' : '#fca5a5',
          }}>
          <span>{importMsg}</span>
          <button onClick={() => setImportMsg(null)} className="text-white/60 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Tab selector */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => setTab('registros')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'registros' ? tabActive : tabInactive}>
          {tTab('registrosEmoji')}
        </button>
        <button onClick={() => setTab('reportes')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'reportes' ? tabActive : tabInactive}>
          {tTab('reportesEmoji')}
        </button>
        <button onClick={() => setTab('especificos')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all" style={tab === 'especificos' ? tabActive : tabInactive}>
          {tTab('especificosEmoji')}
        </button>
      </div>

      {tab === 'registros' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Productos', value: records.length, color: '#60a5fa' },
              { label: 'Activos', value: records.filter(r => r.situacion === 'Activo').length, color: '#60a5fa' },
              { label: 'Stock Bajo', value: records.filter(r => r.existencia <= r.minimo).length, color: '#ef4444' },
              { label: 'Existencia Total', value: records.reduce((s, r) => s + r.existencia, 0), color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-xs text-white/50 uppercase tracking-wider">{label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {isFormOpen && (
            <div className="mb-8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-lg font-semibold text-white mb-4">{form.id ? 'Editar' : 'Nuevo'} Producto</h2>
              {formError && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fff' }}>
                  {formError}
                </div>
              )}
              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Tipo Inventario — PRIMER campo (define qué se muestra) */}
                <div className="lg:col-span-3">
                  <label className="block text-xl font-extrabold text-white mb-1">Tipo Inventario *</label>
                  <select required value={form.tipo_inventario} onChange={e => {
                    const newTipo = e.target.value
                    setForm(prev => {
                      const isNew = !prev.id
                      const newCodigo = isNew ? nextCodigoForTipo(records, newTipo) : prev.codigo
                      return {
                        ...prev,
                        tipo_inventario: newTipo,
                        ...(isNew ? { codigo: newCodigo, codigo_barra: newCodigo } : {}),
                        ...(tipoSinGrupo(newTipo) ? { grupo: '', sub_grupo: '' } : {}),
                        // Si cambia a uno distinto de Producto Terminado, limpia los campos exclusivos
                        ...(newTipo !== 'Producto Terminado' ? { codigo_spin: '', cliente_id: '', cliente: '', clase_cliente: '', tipo_formula: '', margen_ganancia: 0, margen_contribucion: 0, trm_dia: 0, conversion_cop: 0, valor_usd: 0, tipo_empaque: '' } : {}),
                      }
                    })
                  }}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                    <option value="">{tOp('seleccione')}</option>
                    {refData.tipo_inventario.map(t => <option key={t.id} value={t.descripcion}>{t.descripcion}</option>)}
                  </select>
                </div>
                {/* Nro Producto — correlativo automático */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Nro Producto</label>
                  <input readOnly value={form.codigo}
                    className="w-full rounded-xl px-4 py-2.5 outline-none font-mono font-bold"
                    style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#fff', cursor: 'not-allowed' }} />
                </div>
                {/* Código — texto libre */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Código</label>
                  <input value={form.codigo_alterno || ''}
                    onChange={e => setForm({ ...form, codigo_alterno: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none font-mono"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Código alterno (opcional)" />
                </div>
                {/* Descripción */}
                <div className="lg:col-span-2">
                  <label className="block text-xl font-extrabold text-white mb-1">Descripción *</label>
                  <input required value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Nombre del producto" />
                </div>
                {/* ═══ Campos exclusivos para Producto Terminado ═══ */}
                {form.tipo_inventario === 'Producto Terminado' && (
                  <>
                    <div className="lg:col-span-3 mt-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <h3 className="text-sm font-bold tracking-wide uppercase" style={{ color: '#fbbf24' }}>📦 Datos para Producto Terminado</h3>
                    </div>
                    <div className="lg:col-span-3">
                      <label className="block text-xl font-extrabold text-white mb-1">Código SPIN</label>
                      <input value={form.codigo_spin || ''} onChange={e => setForm({ ...form, codigo_spin: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none font-mono"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                        placeholder="Ej. SPN-12345" />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xl font-extrabold text-white mb-1">Cliente *</label>
                      <select
                        required
                        value={form.cliente_id || ''}
                        onChange={e => {
                          const cid = e.target.value
                          const c = clientes.find(x => x.id === cid)
                          setForm({
                            ...form,
                            cliente_id: cid,
                            cliente: c?.razon_social || '',
                            clase_cliente: c?.clase_cliente || form.clase_cliente || '',
                          })
                        }}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {clientes.map(c => (
                          <option key={c.id} value={c.id}>{c.razon_social}</option>
                        ))}
                      </select>
                      {clientes.length === 0 && (
                        <p className="text-xs text-amber-300 mt-1">⚠️ No hay clientes activos. Crea uno en el módulo <strong>Clientes</strong>.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Clase de Cliente</label>
                      <select value={form.clase_cliente || ''} onChange={e => setForm({ ...form, clase_cliente: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {(refData.clase_cliente ?? []).filter(c => c.situacion).map(c => (
                          <option key={c.id} value={c.descripcion}>{c.descripcion}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Tipo de Fórmula</label>
                      <select value={form.tipo_formula || ''} onChange={e => setForm({ ...form, tipo_formula: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {(refData.tipo_formula ?? []).filter(t => t.situacion).map(t => (
                          <option key={t.id} value={t.descripcion}>{t.descripcion}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Margen Ganancia (%)</label>
                      <input type="number" step="0.01" min="0" value={form.margen_ganancia ?? 0} onChange={e => setForm({ ...form, margen_ganancia: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none font-mono text-right"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                        placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Margen Contribución (%)</label>
                      <input type="number" step="0.01" min="0" value={form.margen_contribucion ?? 0} onChange={e => setForm({ ...form, margen_contribucion: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none font-mono text-right"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                        placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">TRM del Día (COP/USD)</label>
                      <input type="number" step="0.01" min="0" value={form.trm_dia ?? 0} onChange={e => setForm({ ...form, trm_dia: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none font-mono text-right"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                        placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Conversión COP</label>
                      <input type="number" step="0.01" min="0" value={form.conversion_cop ?? 0} onChange={e => setForm({ ...form, conversion_cop: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none font-mono text-right"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                        placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Valor US $</label>
                      <input type="number" step="0.01" min="0" value={form.valor_usd ?? 0} onChange={e => setForm({ ...form, valor_usd: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none font-mono text-right"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                        placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Tipo de Empaque</label>
                      <select value={form.tipo_empaque || ''} onChange={e => setForm({ ...form, tipo_empaque: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                        <option value="">Seleccione…</option>
                        <option value="Caja">Caja</option>
                        <option value="Bolsa">Bolsa</option>
                        <option value="Saco">Saco</option>
                        <option value="Granel">Granel</option>
                        <option value="Tambor">Tambor</option>
                        <option value="Garrafa">Garrafa</option>
                        <option value="Botella">Botella</option>
                        <option value="Pallet">Pallet</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div className="lg:col-span-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}></div>
                  </>
                )}
                {/* Usa Seriales — oculto para Producto Terminado y Materia Prima */}
                {form.tipo_inventario !== 'Producto Terminado' && form.tipo_inventario !== 'Materia Prima' && (
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Usa Seriales</label>
                    <select value={form.usa_seriales ? 'Si' : 'No'} onChange={e => setForm({ ...form, usa_seriales: e.target.value === 'Si' })}
                      className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                      <option value="No">No</option>
                      <option value="Si">Sí</option>
                    </select>
                  </div>
                )}
                {/* Categoría — tabla referencia */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                    <option value="">{tOp('seleccione')}</option>
                    {refData.categoria.map(c => <option key={c.id} value={c.descripcion}>{c.descripcion}</option>)}
                  </select>
                </div>
                {/* Grupo y Sub-Grupo — solo si el tipo lo permite */}
                {!tipoSinGrupo(form.tipo_inventario) && (
                  <>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Grupo</label>
                      <select value={form.grupo} onChange={e => setForm({ ...form, grupo: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {refData.grupo.map(g => <option key={g.id} value={g.descripcion}>{g.descripcion}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xl font-extrabold text-white mb-1">Sub-Grupo</label>
                      <select value={form.sub_grupo} onChange={e => setForm({ ...form, sub_grupo: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                        <option value="">{tOp('seleccione')}</option>
                        {refData.subgrupo.map(sg => <option key={sg.id} value={sg.descripcion}>{sg.descripcion}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {/* Unidad de Medida — tabla referencia */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Unidad de Medida</label>
                  <select value={form.unidad_medida} onChange={e => setForm({ ...form, unidad_medida: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                    <option value="">{tOp('seleccione')}</option>
                    {refData.unidad_medida.map(u => <option key={u.id} value={u.descripcion}>{u.descripcion}</option>)}
                  </select>
                </div>
                {/* Código de Barra — oculto para Materia Prima */}
                {form.tipo_inventario !== 'Materia Prima' && (
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Código de Barra</label>
                    <input value={form.codigo_barra || ''} onChange={e => setForm({ ...form, codigo_barra: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 text-white outline-none font-mono"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                      placeholder="Ej: 7501234567890" />
                  </div>
                )}
                {/* Último Proveedor — oculto para Producto Terminado */}
                {form.tipo_inventario !== 'Producto Terminado' && (
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Ult. Proveedor</label>
                    <select value={form.ult_proveedor} onChange={e => setForm({ ...form, ult_proveedor: e.target.value })}
                      className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                      <option value="">{tOp('seleccione')}</option>
                      {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                    </select>
                  </div>
                )}
                {/* Campos numéricos — Materia Prima oculta Precio Unitario, Máximo y Mínimo */}
                {(['ult_costo', 'costo_promedio', 'precio_unitario', 'maximo', 'minimo', 'existencia'] as const)
                  .filter(key => {
                    if (form.tipo_inventario !== 'Materia Prima') return true
                    return !['precio_unitario', 'maximo', 'minimo'].includes(key)
                  })
                  .map(key => (
                  <div key={key}>
                    <label className="block text-xl font-extrabold text-white mb-1">{key === 'ult_costo' ? tH('ultCosto') : key === 'costo_promedio' ? 'Costo Promedio' : key === 'precio_unitario' ? 'Precio Unitario' : key === 'maximo' ? 'Máximo' : key === 'minimo' ? 'Mínimo' : 'Existencia'}</label>
                    <input type="number" min="0" step="0.01" value={(form as Record<string, unknown>)[key] as number ?? 0} onChange={e => setForm({ ...form, [key]: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      className="w-full rounded-xl px-4 py-2.5 text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
                  </div>
                ))}
                {/* Situación — tabla referencia */}
                <div>
                  <label className="block text-xl font-extrabold text-white mb-1">Situación</label>
                  <select value={form.situacion} onChange={e => setForm({ ...form, situacion: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white outline-none" style={selStyle}>
                    {refData.situacion_producto.map(s => <option key={s.id} value={s.descripcion}>{s.descripcion}</option>)}
                  </select>
                </div>
                {/* Foto del Producto */}
                <div className="lg:col-span-3">
                  <label className="block text-xl font-extrabold text-white mb-1">Foto del Producto</label>
                  <div className="flex items-center gap-4">
                    <label className="block text-xl font-extrabold text-white mb-1" style={{ background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.4)' }}>
                      📷 Cargar Imagen
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 2 * 1024 * 1024) { alert(tAl('imagenMax2MB')); return }
                        const reader = new FileReader()
                        reader.onloadend = () => setForm({ ...form, imagen: reader.result as string })
                        reader.readAsDataURL(file)
                      }} />
                    </label>
                    {form.imagen && (
                      <div className="relative">
                        <img src={form.imagen} alt="Foto producto" className="h-20 w-20 object-cover rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.2)' }} />
                        <button type="button" onClick={() => setForm({ ...form, imagen: '' })}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                          style={{ background: 'rgba(239,68,68,0.8)' }}>✕</button>
                      </div>
                    )}
                    {!form.imagen && <span className="text-white/30 text-sm">Sin imagen (máx 2 MB)</span>}
                  </div>
                </div>
                <div className="lg:col-span-3 flex gap-3 pt-2">
                  <button type="submit" className="px-6 py-2 rounded-xl text-white font-medium" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>{tBtn('save')}</button>
                  <button type="button" onClick={() => { setIsFormOpen(false); setTipoActivoSesion(null) }} className="px-6 py-2 rounded-xl text-white font-medium" style={{ background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(37,99,235,1)' }}>⤴ Volver a Seleccionar</button>
                  <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-2 rounded-xl text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>{tBtn('cancel')}</button>
                </div>
              </form>
            </div>
          )}

          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="p-4 border-b flex items-end gap-3 flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 max-w-xs">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl px-4 py-2 text-white outline-none text-base text-white font-bold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  placeholder={tPh('buscarCodigoDesc')} />
                <VoiceSearchButton onResult={setSearch} />
              </div>
              {/* Filtro por Cliente — aparece solo en Producto Terminado */}
              {tipoInvFiltro === 'Producto Terminado' && clientesEnProductos.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setClienteFiltro('')}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                    style={clienteFiltro === ''
                      ? { background: 'rgba(34,197,94,0.95)', border: '1px solid #16a34a', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }
                      : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }}>
                    👥 Todos los Clientes ({clientesEnProductos.length})
                  </button>
                  <select
                    value={clienteFiltro}
                    onChange={e => setClienteFiltro(e.target.value)}
                    className="rounded-xl px-3 py-2 text-base text-white font-bold outline-none min-w-[260px]"
                    style={{ background: '#083d3d', border: '2px solid rgba(255,255,255,0.3)' }}>
                    <option value="">— Filtrar por un Cliente —</option>
                    {clientesEnProductos
                      .slice()
                      .sort((a, b) => a.razon_social.localeCompare(b.razon_social, 'es'))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.razon_social}</option>
                      ))}
                  </select>
                  {clienteFiltro && (
                    <span className="text-xs text-white/70 font-bold">
                      {filtered.length} producto(s) del cliente
                    </span>
                  )}
                </div>
              )}
            </div>
            <table className="w-full text-xs text-left table-fixed">
              <thead style={{ background: 'rgba(255,255,255,0.08)' }}>
                <tr>
                  {tipoInvFiltro === 'Producto Terminado' ? (
                    // Vista especial para Producto Terminado
                    ['Código SPIN', 'Descripción', 'Tipo Inventario', 'Cliente', 'Clase Cliente', 'Unid. Medida', 'Tipo Empaque', 'Precio', 'Acciones'].map(h => (
                      <th key={h} className={`px-2 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${h === 'Precio' ? 'text-right' : ''}`} style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                    ))
                  ) : tipoInvFiltro === 'Materia Prima' ? (
                    // Vista especial para Materia Prima — títulos amarillos grandes
                    ['Código', 'Descripción', 'Unid. Medida', 'Existencia', 'Situación', 'Acciones'].map(h => (
                      <th key={h} className={`px-3 py-3 text-base font-extrabold uppercase tracking-wider whitespace-nowrap ${h === 'Existencia' ? 'text-right' : ''}`} style={{ color: '#facc15', textShadow: '0 0 6px rgba(250,204,21,0.4)' }}>{h}</th>
                    ))
                  ) : (
                    [
                      tF('codigo'),
                      tF('descripcion'),
                      tH('tipoInv'),
                      tF('categoria'),
                      ...(tipoSinGrupo(tipoInvFiltro || '') ? [] : [tF('grupo'), tH('subGrupoHyphen')]),
                      tF('unidad'),
                      tH('costoProm'),
                      tH('existShort'),
                      tH('valor'),
                      tF('situacion'),
                      tTbl('actions'),
                    ].map(h => (
                      <th key={h} className={`px-2 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${h === tH('valor') || h === tH('costoProm') ? 'text-right' : h === tH('existShort') ? 'text-right' : ''}`} style={{ color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {tipoInvFiltro === 'Producto Terminado' ? (
                  // Vista de filas para Producto Terminado
                  filtered.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-2 py-3 font-mono font-bold text-blue-300 whitespace-nowrap">{r.codigo_spin || '—'}</td>
                      <td className="px-2 py-3 text-white font-bold">{r.descripcion}</td>
                      <td className="px-2 py-3 text-white font-bold">{r.tipo_inventario}</td>
                      <td className="px-2 py-3 text-white font-bold">{r.cliente || '—'}</td>
                      <td className="px-2 py-3 text-white font-bold">{r.clase_cliente || '—'}</td>
                      <td className="px-2 py-3 text-white font-bold">{r.unidad_medida}</td>
                      <td className="px-2 py-3 text-white font-bold">{r.tipo_empaque || '—'}</td>
                      <td className="px-2 py-3 text-emerald-300 font-bold text-right whitespace-nowrap">Pesos {fmtNum(r.precio_unitario || 0)}</td>
                      <td className="px-2 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => setViewRecordId(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}>Ver</button>
                          {permisos.editar && <button onClick={() => { setForm({ ...r }); setIsFormOpen(true) }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(96,165,250,0.95)', border: '1px solid rgba(96,165,250,0.3)' }}>Editar</button>}
                          {permisos.eliminar && <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'rgba(239,68,68,0.95)', border: '1px solid rgba(239,68,68,0.3)' }}>Eliminar</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : tipoInvFiltro === 'Materia Prima' ? (
                  // Vista de filas para Materia Prima — datos en blanco intenso grande
                  filtered.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-3 py-3 font-mono font-extrabold text-white text-base whitespace-nowrap">{r.codigo_alterno || '—'}</td>
                      <td className="px-3 py-3 font-extrabold text-white text-base">{r.descripcion}</td>
                      <td className="px-3 py-3 font-extrabold text-white text-base">{r.unidad_medida || '—'}</td>
                      <td className="px-3 py-3 font-extrabold text-white text-base text-right font-mono">{fmtInt(r.existencia)}</td>
                      <td className="px-3 py-3">
                        <span className="px-3 py-1 rounded-full text-sm font-extrabold" style={sitStyle(r.situacion)}>{r.situacion}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          <button onClick={() => setViewRecordId(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105" style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)', boxShadow: '0 2px 6px rgba(59,130,246,0.35)' }}>Ver</button>
                          <a href={`/kardex?producto=${r.id}`} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105" style={{ background: 'rgba(168,85,247,1)', border: '1px solid rgba(126,34,206,1)', boxShadow: '0 2px 6px rgba(168,85,247,0.35)' }} title={tTip('verKardex')}>📒 Kardex</a>
                          {permisos.editar && <button onClick={() => { setForm({ ...r }); setIsFormOpen(true) }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105" style={{ background: 'rgba(245,158,11,1)', border: '1px solid rgba(217,119,6,1)', boxShadow: '0 2px 6px rgba(245,158,11,0.35)' }}>{tBtn('edit')}</button>}
                          {permisos.eliminar && <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105" style={{ background: 'rgba(220,38,38,1)', border: '1px solid rgba(185,28,28,1)', boxShadow: '0 2px 6px rgba(220,38,38,0.35)' }}>{tBtn('delete')}</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  filtered.map(r => {
                    const hideGrupos = tipoSinGrupo(tipoInvFiltro || '')
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="px-2 py-3 font-mono font-medium text-white whitespace-nowrap">{r.codigo}</td>
                        <td className="px-2 py-3 text-white/80 truncate max-w-[180px]">{r.descripcion}</td>
                        <td className="px-2 py-3 text-white/60 truncate max-w-[120px]">{r.tipo_inventario}</td>
                        <td className="px-2 py-3 text-white/60 truncate max-w-[100px]">{r.categoria}</td>
                        {!hideGrupos && <td className="px-2 py-3 text-white/60 truncate">{r.grupo}</td>}
                        {!hideGrupos && <td className="px-2 py-3 text-white/60 truncate">{r.sub_grupo}</td>}
                        <td className="px-2 py-3 text-white/60">{r.unidad_medida}</td>
                        <td className="px-2 py-3 text-white/70 text-right">Pesos {fmtNum(r.costo_promedio || (r.existencia > 0 ? r.ult_costo : 0))}</td>
                        <td className="px-2 py-3 text-white font-bold text-right">{fmtInt(r.existencia)}</td>
                        <td className="px-2 py-3 text-white/70 text-right">Pesos {fmtNum(r.ult_costo * r.existencia)}</td>
                        <td className="px-2 py-3">
                          <span className="px-2 py-1 rounded-full text-xs font-medium" style={sitStyle(r.situacion)}>{r.situacion}</span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => setViewRecordId(r.id)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)' }}>Ver</button>
                            <a href={`/kardex?producto=${r.id}`} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(168,85,247,0.2)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.3)' }} title={tTip('verKardex')}>📒 Kardex</a>
                            {permisos.editar && <button onClick={() => { setForm({ ...r }); setIsFormOpen(true) }} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(96,165,250,0.95)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)' }}>{tBtn('edit')}</button>}
                            {permisos.eliminar && <button onClick={() => handleDelete(r.id)} className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.95)', color: '#fff', border: '1px solid rgba(239,68,68,0.3)' }}>{tBtn('delete')}</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
                {filtered.length === 0 && (
                  <tr><td colSpan={tipoInvFiltro === 'Producto Terminado' ? 9 : 11} className="px-6 py-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{tE('noProductos')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'reportes' && (
        <ReportPanel
          title={tRpt('productos')}
          filename="productos"
          columns={[
            { header: 'Código', key: 'codigo', width: 14 },
            { header: 'Descripción', key: 'descripcion', width: 28 },
            { header: tH('tipoInv'), key: 'tipo_inventario', width: 14 },
            { header: 'Categoría', key: 'categoria', width: 12 },
            { header: 'Grupo', key: 'grupo', width: 12 },
            { header: tH('subGrupoHyphen'), key: 'sub_grupo', width: 12 },
            { header: 'Unidad', key: 'unidad_medida', width: 10 },
            { header: 'Existencia', key: 'existencia', width: 10 },
            { header: tH('valorInv'), key: 'valor_inventario', width: 14 },
            { header: tH('ultCosto'), key: 'ult_costo', width: 12 },
            { header: 'Situación', key: 'situacion', width: 12 },
          ]}
          rows={records.map(r => ({
            codigo: r.codigo,
            descripcion: r.descripcion,
            tipo_inventario: r.tipo_inventario,
            categoria: r.categoria,
            grupo: r.grupo,
            sub_grupo: r.sub_grupo,
            unidad_medida: r.unidad_medida,
            existencia: fmtInt(r.existencia),
            valor_inventario: 'Pesos ' + fmtNum(r.ult_costo * r.existencia),
            ult_costo: 'Pesos ' + fmtNum(r.ult_costo),
            situacion: r.situacion,
          }))}
          filters={[
            { label: 'Situación', key: 'situacion', options: ['Activo', 'Inactivo', 'Descontinuado'] },
            { label: tF('tipoInventario'), key: 'tipo_inventario', options: [...new Set(records.map(r => r.tipo_inventario).filter(Boolean))] },
            { label: 'Categoría', key: 'categoria', options: [...new Set(records.map(r => r.categoria).filter(Boolean))] },
            { label: 'Grupo', key: 'grupo', options: [...new Set(records.map(r => r.grupo).filter(Boolean))] },
          ]}
          summableKeys={['existencia', 'valor_inventario', 'ult_costo']}
        />
      )}

      {tab === 'especificos' && (
        <div className="glass-card p-6 md:p-8">
          <h2 className="text-xl font-bold text-white mb-4">{tTab('especificos')}</h2>
          <p className="text-white/50 text-sm mb-6">{tSub('seleccioneReporte')}</p>

          {/* Selector de reportes */}
          {!reporteActivo && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => setReporteActivo('inventario-valorizado')}
                className="rounded-xl p-5 text-left transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}
              >
                <h3 className="text-white font-semibold mb-1">Inventario Valorizado</h3>
                <p className="text-white/50 text-xs">{tSub('inventarioValorizado')}</p>
              </button>
              <button
                onClick={() => setReporteActivo('inventario-categoria')}
                className="rounded-xl p-5 text-left transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}
              >
                <h3 className="text-white font-semibold mb-1">{tRpt('inventariosCategoria')}</h3>
                <p className="text-white/50 text-xs">{tSub('montosCategoria')}</p>
              </button>
            </div>
          )}

          {/* ── Reporte: Inventarios por Categoría ─────────────────────────── */}
          {reporteActivo === 'inventario-categoria' && (() => {
            // Filtrar por tipo de inventario activo de la sesión
            const normCat = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
            const recordsCategoria = tipoInvFiltro
              ? records.filter(r => normCat(r.tipo_inventario) === normCat(tipoInvFiltro))
              : records
            // Agrupar montos por categoría
            const porCategoria: Record<string, number> = {}
            recordsCategoria.forEach(r => {
              const cat = r.categoria || 'Sin Categoría'
              const valor = (r.existencia || 0) * (r.ult_costo || 0)
              porCategoria[cat] = (porCategoria[cat] || 0) + valor
            })
            const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])
            const totalGenCat = categoriasOrdenadas.reduce((s, [, m]) => s + m, 0)

            return (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setReporteActivo(null)} className="text-white/50 hover:text-white transition-colors text-sm">← Volver</button>
                  <h3 className="text-lg font-bold text-white">{tRpt('inventariosCategoria')}{tipoInvFiltro ? ` · ${tipoInvFiltro}` : ''}</h3>
                </div>

                {/* Filtros */}
                <div className="flex items-end gap-4 mb-6 flex-wrap">
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha del Reporte (DD/MM/AAAA)</label>
                    <input type="text" value={reporteFecha}
                      onChange={e => { let v = e.target.value.replace(/[^0-9/]/g, ''); if (v.length === 2 && !v.includes('/')) v += '/'; if (v.length === 5 && v.split('/').length === 2) v += '/'; if (v.length <= 10) setReporteFecha(v) }}
                      placeholder="DD/MM/AAAA" className="rounded-xl px-4 py-2.5 text-white outline-none w-48"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
                  </div>
                  <button
                    onClick={async () => {
                      const { jsPDF } = await import('jspdf')
                      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
                      const pageW = doc.internal.pageSize.getWidth()
                      const m = 14
                      // Encabezado
                      doc.setFillColor(30, 27, 75)
                      doc.rect(0, 0, pageW, 28, 'F')
                      try { doc.addImage(LOGO_BASE64, 'JPEG', m, 8, 11, 11) } catch { /* */ }
                      const logoOff = 28
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(16)
                      doc.setFont('helvetica', 'bold')
                      doc.text(`Reporte de Inventarios por Categoría${tipoInvFiltro ? ' — ' + tipoInvFiltro : ''}`, logoOff, 13)
                      doc.setFontSize(9)
                      doc.setFont('helvetica', 'normal')
                      doc.setTextColor(180, 180, 210)
                      doc.text(`Fecha: ${reporteFecha || new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`, logoOff, 21)
                      doc.text(`Emitido: ${new Date().toLocaleString('es-VE')}`, pageW - m, 13, { align: 'right' })

                      // Cabecera tabla
                      let y = 35
                      doc.setFillColor(60, 55, 120)
                      doc.rect(m, y, pageW - m * 2, 8, 'F')
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(8)
                      doc.setFont('helvetica', 'bold')
                      doc.text('CATEGORÍA', m + 2, y + 5.5)
                      doc.text('MONTO', pageW - m - 2, y + 5.5, { align: 'right' })
                      y += 8

                      // Filas
                      doc.setFont('helvetica', 'normal')
                      doc.setFontSize(9)
                      categoriasOrdenadas.forEach(([cat, monto], ri) => {
                        if (y > 270) { doc.addPage(); y = 14 }
                        doc.setFillColor(ri % 2 === 0 ? 245 : 255, ri % 2 === 0 ? 245 : 255, ri % 2 === 0 ? 252 : 255)
                        doc.rect(m, y, pageW - m * 2, 8, 'F')
                        doc.setTextColor(30, 30, 60)
                        doc.text(cat, m + 2, y + 5.5)
                        doc.text('Pesos ' + fmtNum(monto), pageW - m - 2, y + 5.5, { align: 'right' })
                        y += 8
                      })

                      // Total General
                      y += 3
                      doc.setFillColor(30, 64, 175)
                      doc.rect(m, y, pageW - m * 2, 10, 'F')
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(10)
                      doc.setFont('helvetica', 'bold')
                      doc.text('TOTAL GENERAL:', m + 4, y + 7)
                      doc.setFontSize(12)
                      doc.text('Pesos ' + fmtNum(totalGenCat), pageW - m - 2, y + 7, { align: 'right' })

                      doc.save(`inventario-por-categoria${reporteFecha ? '-' + reporteFecha.replace(/\//g, '-') : ''}.pdf`)
                    }}
                    className="px-5 py-2.5 rounded-xl font-medium text-white transition-all"
                    style={{ background: 'rgba(96,165,250,0.35)', border: '1px solid rgba(96,165,250,0.4)' }}
                  >
                    📄 Generar PDF
                  </button>
                </div>

                {/* Tabla preview */}
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/10">
                  <table className="w-full text-base text-left">
                    <thead style={{ background: '#1e3a8a' }}>
                      <tr>
                        <th className="px-5 py-3 text-xs font-semibold uppercase text-white tracking-wide">Categoría</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase text-white tracking-wide text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoriasOrdenadas.map(([cat, monto]) => (
                        <tr key={cat} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/5 transition-colors">
                          <td className="px-5 py-3 text-white/90 font-medium">{cat}</td>
                          <td className="px-5 py-3 text-right text-white font-bold">Pesos {fmtNum(monto)}</td>
                        </tr>
                      ))}
                      {categoriasOrdenadas.length === 0 && (
                        <tr><td colSpan={2} className="px-5 py-8 text-center text-white/40">{tEs('sinProductosRegistrados')}</td></tr>
                      )}
                    </tbody>
                    {categoriasOrdenadas.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: '2px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.1)' }}>
                          <td className="px-5 py-4 text-white font-bold text-sm uppercase">Total General</td>
                          <td className="px-5 py-4 text-right text-white font-bold text-base">Pesos {fmtNum(totalGenCat)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="mt-4">
                  <span className="text-xs text-white/40">{reporteFecha ? `Fecha: ${reporteFecha}` : ''} — {categoriasOrdenadas.length} categorías{tipoInvFiltro ? ` · ${tipoInvFiltro}` : ''}</span>
                </div>
              </div>
            )
          })()}

          {/* ── Reporte: Inventario Valorizado ──────────────────────────────── */}
          {reporteActivo === 'inventario-valorizado' && (() => {
            const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
            const recordsValorizado = tipoInvFiltro
              ? records.filter(r => norm(r.tipo_inventario) === norm(tipoInvFiltro))
              : records
            const totalGeneral = recordsValorizado.reduce((sum, r) => sum + (r.ult_costo * r.existencia), 0)
            return (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setReporteActivo(null)} className="text-white/50 hover:text-white transition-colors text-sm">
                    ← Volver
                  </button>
                  <h3 className="text-lg font-bold text-white">Inventario Valorizado{tipoInvFiltro ? ` · ${tipoInvFiltro}` : ''}</h3>
                </div>

                {/* Fecha del reporte */}
                <div className="flex items-end gap-4 mb-6">
                  <div>
                    <label className="block text-xl font-extrabold text-white mb-1">Fecha del Reporte (DD/MM/AAAA)</label>
                    <input
                      type="text"
                      value={reporteFecha}
                      onChange={e => {
                        let v = e.target.value.replace(/[^0-9/]/g, '')
                        if (v.length === 2 && !v.includes('/')) v += '/'
                        if (v.length === 5 && v.split('/').length === 2) v += '/'
                        if (v.length <= 10) setReporteFecha(v)
                      }}
                      placeholder="DD/MM/AAAA"
                      className="rounded-xl px-4 py-2.5 text-white outline-none w-48"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      const { jsPDF } = await import('jspdf')
                      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
                      const pageW = doc.internal.pageSize.getWidth()
                      const m = 14
                      const cols = [
                        { header: 'Código', key: 'codigo', w: 28 },
                        { header: 'Descripción', key: 'descripcion', w: 55 },
                        { header: 'Categoría', key: 'categoria', w: 30 },
                        { header: 'Grupo', key: 'grupo', w: 30 },
                        { header: tH('subGrupoHyphen'), key: 'sub_grupo', w: 30 },
                        { header: 'Existencia', key: 'existencia', w: 25 },
                        { header: tH('ultCosto'), key: 'ult_costo', w: 30 },
                        { header: tH('valorInv'), key: 'valor_inv', w: 35 },
                      ]
                      // Encabezado
                      doc.setFillColor(30, 27, 75)
                      doc.rect(0, 0, pageW, 28, 'F')
                      // Logo
                      try { doc.addImage(LOGO_BASE64, 'JPEG', m, 8, 11, 11) } catch { /* */ }
                      const logoOff = 28
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(16)
                      doc.setFont('helvetica', 'bold')
                      doc.text(`Inventario Valorizado${tipoInvFiltro ? ' — ' + tipoInvFiltro : ''}`, logoOff, 13)
                      doc.setFontSize(9)
                      doc.setFont('helvetica', 'normal')
                      doc.setTextColor(180, 180, 210)
                      doc.text(`Fecha: ${reporteFecha || new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`, logoOff, 21)
                      doc.text(`Emitido: ${new Date().toLocaleString('es-VE')}`, pageW - m, 13, { align: 'right' })

                      // Cabecera tabla
                      let y = 35
                      let x = m
                      doc.setFillColor(60, 55, 120)
                      doc.rect(m, y, pageW - m * 2, 8, 'F')
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(7)
                      doc.setFont('helvetica', 'bold')
                      cols.forEach(c => { doc.text(c.header.toUpperCase(), x + 2, y + 5.5); x += c.w })
                      y += 8

                      // Filas
                      doc.setFont('helvetica', 'normal')
                      doc.setFontSize(7)
                      recordsValorizado.forEach((r, ri) => {
                        if (y > 185) { doc.addPage(); y = 14 }
                        doc.setFillColor(ri % 2 === 0 ? 245 : 255, ri % 2 === 0 ? 245 : 255, ri % 2 === 0 ? 252 : 255)
                        doc.rect(m, y, pageW - m * 2, 7, 'F')
                        doc.setTextColor(30, 30, 60)
                        x = m
                        const vals: Record<string, string> = {
                          codigo: r.codigo, descripcion: r.descripcion, categoria: r.categoria,
                          grupo: r.grupo, sub_grupo: r.sub_grupo, existencia: fmtInt(r.existencia),
                          ult_costo: 'Pesos ' + fmtNum(r.ult_costo), valor_inv: 'Pesos ' + fmtNum(r.ult_costo * r.existencia),
                        }
                        cols.forEach(c => {
                          const val = vals[c.key] || ''
                          doc.text(val.length > 35 ? val.slice(0, 33) + '…' : val, x + 2, y + 5)
                          x += c.w
                        })
                        y += 7
                      })

                      // Total General resaltado
                      y += 3
                      doc.setFillColor(30, 64, 175)
                      doc.rect(m, y, pageW - m * 2, 10, 'F')
                      doc.setTextColor(255, 255, 255)
                      doc.setFontSize(10)
                      doc.setFont('helvetica', 'bold')
                      doc.text('TOTAL GENERAL INVENTARIO VALORIZADO:', pageW - m - 40, y + 7, { align: 'right' })
                      doc.setFontSize(12)
                      doc.text('Pesos ' + fmtNum(totalGeneral), pageW - m - 2, y + 7, { align: 'right' })

                      // Pie
                      y += 16
                      doc.setFontSize(7)
                      doc.setTextColor(100, 100, 140)
                      doc.text(`Total productos: ${recordsValorizado.length}${tipoInvFiltro ? ' · Tipo: ' + tipoInvFiltro : ''}`, m, y)

                      doc.save(`inventario-valorizado${reporteFecha ? '-' + reporteFecha.replace(/\//g, '-') : ''}.pdf`)
                    }}
                    className="px-5 py-2.5 rounded-xl font-medium text-white transition-all"
                    style={{ background: 'rgba(96,165,250,0.35)', border: '1px solid rgba(96,165,250,0.4)' }}
                  >
                    📄 Generar PDF
                  </button>
                </div>

                {/* Tabla del reporte */}
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/10 print:bg-white print:border-gray-300">
                  <table className="w-full text-base text-left">
                    <thead style={{ background: 'rgba(255,255,255,0.05)' }} className="print:bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-white/60 print:text-black">Código</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-white/60 print:text-black">Descripción</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-white/60 print:text-black">Categoría</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-white/60 print:text-black">Grupo</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-white/60 print:text-black">Sub-Grupo</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-white/60 text-right print:text-black">Existencia</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-white/60 text-right print:text-black">Ult. Costo</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-white/60 text-right print:text-black">Valor Inv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordsValorizado.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">
                          {tipoInvFiltro
                            ? `No hay productos del tipo "${tipoInvFiltro}" para listar.`
                            : 'No hay productos para listar.'}
                        </td></tr>
                      )}
                      {recordsValorizado.map(r => (
                        <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="print:border-gray-200">
                          <td className="px-4 py-2.5 font-mono text-white print:text-black">{r.codigo}</td>
                          <td className="px-4 py-2.5 text-white/80 print:text-black">{r.descripcion}</td>
                          <td className="px-4 py-2.5 text-white/60 print:text-gray-600">{r.categoria}</td>
                          <td className="px-4 py-2.5 text-white/60 print:text-gray-600">{r.grupo}</td>
                          <td className="px-4 py-2.5 text-white/60 print:text-gray-600">{r.sub_grupo}</td>
                          <td className="px-4 py-2.5 text-white text-right print:text-black">{fmtInt(r.existencia)}</td>
                          <td className="px-4 py-2.5 text-white/70 text-right print:text-black">Pesos {fmtNum(r.ult_costo)}</td>
                          <td className="px-4 py-2.5 text-white text-right print:text-black">Pesos {fmtNum(r.ult_costo * r.existencia)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid rgba(96,165,250,0.4)' }} className="print:border-t-2 print:border-black">
                        <td colSpan={7} className="px-4 py-4 text-right text-white font-bold text-base print:text-black">
                          TOTAL GENERAL INVENTARIO VALORIZADO:
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-lg print:text-black"
                          style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.15)' }}>
                          ${fmtNum(totalGeneral)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Pie con fecha y total resaltado */}
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs text-white/40">
                    {reporteFecha ? `Fecha: ${reporteFecha}` : ''} — {recordsValorizado.length} productos{tipoInvFiltro ? ` · ${tipoInvFiltro}` : ''}
                  </span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Modal Ver Registro */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Producto: {viewRecord.codigo}</h2>
              <button onClick={() => setViewRecordId(null)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>
            {viewRecord.imagen && (
              <div className="flex justify-center mb-5">
                <img src={viewRecord.imagen} alt={viewRecord.descripcion} className="max-h-48 rounded-xl object-contain" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(() => {
                const esPT = viewRecord.tipo_inventario === 'Producto Terminado'
                const esMP = viewRecord.tipo_inventario === 'Materia Prima'
                const camposBase = [
                  { label: 'Nro Producto', value: viewRecord.codigo },
                  ...(viewRecord.codigo_alterno ? [{ label: 'Código', value: viewRecord.codigo_alterno }] : []),
                  ...(esPT ? [{ label: 'Código SPIN', value: viewRecord.codigo_spin || '—' }] : []),
                  { label: 'Descripción', value: viewRecord.descripcion },
                  { label: tF('tipoInventario'), value: viewRecord.tipo_inventario },
                  ...(esPT ? [
                    { label: 'Cliente', value: viewRecord.cliente || '—' },
                    { label: 'Clase de Cliente', value: viewRecord.clase_cliente || '—' },
                    { label: 'Tipo de Fórmula', value: viewRecord.tipo_formula || '—' },
                    { label: 'Margen Ganancia %', value: String(viewRecord.margen_ganancia ?? 0) },
                    { label: 'Margen Contribución %', value: String(viewRecord.margen_contribucion ?? 0) },
                    { label: 'TRM del Día', value: fmtNum(viewRecord.trm_dia ?? 0) },
                    { label: 'Conversión COP', value: fmtNum(viewRecord.conversion_cop ?? 0) },
                    { label: 'Valor US $', value: fmtNum(viewRecord.valor_usd ?? 0) },
                    { label: 'Tipo de Empaque', value: viewRecord.tipo_empaque || '—' },
                  ] : [
                    ...(esMP ? [] : [{ label: 'Usa Seriales', value: viewRecord.usa_seriales ? 'Sí' : 'No' }]),
                    { label: 'Categoría', value: viewRecord.categoria },
                    ...(esMP ? [] : [
                      { label: 'Grupo', value: viewRecord.grupo },
                      { label: tH('subGrupoHyphen'), value: viewRecord.sub_grupo },
                    ]),
                    ...(esMP ? [] : [{ label: 'Código de Barra', value: viewRecord.codigo_barra || '—' }]),
                    { label: tF('ultimoProveedor'), value: viewRecord.ult_proveedor },
                  ]),
                  { label: 'Unidad de Medida', value: viewRecord.unidad_medida },
                  ...(esMP ? [] : [{ label: 'Precio Unitario', value: 'Pesos ' + fmtNum(viewRecord.precio_unitario || 0) }]),
                  { label: 'Costo Promedio', value: 'Pesos ' + fmtNum(viewRecord.costo_promedio || 0) },
                  { label: tF('ultimoCosto'), value: 'Pesos ' + fmtNum(viewRecord.ult_costo) },
                  { label: 'Existencia', value: fmtInt(viewRecord.existencia) },
                  ...(esPT || esMP ? [
                    ...(esMP ? [{ label: tF('valorInventario'), value: 'Pesos ' + fmtNum(viewRecord.ult_costo * viewRecord.existencia) }] : []),
                  ] : [
                    { label: 'Máximo', value: fmtInt(viewRecord.maximo) },
                    { label: 'Mínimo', value: fmtInt(viewRecord.minimo) },
                    { label: tF('valorInventario'), value: 'Pesos ' + fmtNum(viewRecord.ult_costo * viewRecord.existencia) },
                  ]),
                  { label: 'Fecha Ult. Compra', value: viewRecord.fecha_ult_compra ? fDate(viewRecord.fecha_ult_compra) : '—' },
                  { label: 'Fecha Ult. Movimiento', value: viewRecord.fecha_ult_movimiento ? fDate(viewRecord.fecha_ult_movimiento) : '—' },
                  { label: 'Situación', value: viewRecord.situacion },
                ]
                return camposBase
              })().map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#f97316' }}>{label}</p>
                  <p className="text-white font-medium text-sm">{value || '—'}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => { setViewRecordId(null); setTipoActivoSesion(null) }}
                className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm"
                style={{ background: 'rgba(59,130,246,1)', border: '1px solid rgba(37,99,235,1)' }}
              >
                ⤴ Volver a Seleccionar
              </button>
              <button
                onClick={() => setViewRecordId(null)}
                className="px-5 py-2.5 rounded-xl font-medium text-white text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Filtros Etiquetas */}
      {showEtiquetasFiltro && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">🔲 Filtrar Etiquetas</h3>
              <button onClick={() => setShowEtiquetasFiltro(false)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              {/* Producto */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Producto</label>
                <select value={etqProducto} onChange={e => setEtqProducto(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>
                  <option value="">{tOp('todosProductos')}{tipoInvFiltro ? ` (${tipoInvFiltro})` : ''}</option>
                  {records
                    .filter(r => r.situacion === 'Activo' && r.codigo_barra)
                    .filter(r => !tipoInvFiltro || (r.tipo_inventario || '').replace(/\s+/g, ' ').trim().toLowerCase() === tipoInvFiltro.toLowerCase())
                    .map(r => (
                      <option key={r.id} value={r.id}>{r.codigo} — {r.descripcion}</option>
                    ))}
                </select>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Categoría</label>
                <select value={etqCategoria} onChange={e => { setEtqCategoria(e.target.value); setEtqGrupo(''); setEtqSubGrupo('') }} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>
                  <option value="">{tOp('todas')}</option>
                  {[...new Set(records.filter(r => r.situacion === 'Activo').map(r => r.categoria).filter(Boolean))].sort().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Grupo */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Grupo</label>
                <select value={etqGrupo} onChange={e => { setEtqGrupo(e.target.value); setEtqSubGrupo('') }} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>
                  <option value="">{tOp('todos')}</option>
                  {[...new Set(records.filter(r => r.situacion === 'Activo' && (!etqCategoria || r.categoria === etqCategoria)).map(r => r.grupo).filter(Boolean))].sort().map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Sub-Grupo */}
              <div>
                <label className="block text-xl font-extrabold text-white mb-1">Sub-Grupo</label>
                <select value={etqSubGrupo} onChange={e => setEtqSubGrupo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'rgba(12,26,61,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>
                  <option value="">{tOp('todos')}</option>
                  {[...new Set(records.filter(r => r.situacion === 'Activo' && (!etqCategoria || r.categoria === etqCategoria) && (!etqGrupo || r.grupo === etqGrupo)).map(r => r.sub_grupo).filter(Boolean))].sort().map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tipo de Código */}
            <div>
              <label className="block text-xl font-extrabold text-white mb-2">Tipo de Código</label>
              <div className="flex gap-3">
                {([
                  { value: 'barra', label: '|||  Código de Barras', icon: '📊' },
                  { value: 'qr', label: '◼◼  Código QR', icon: '📱' },
                  { value: 'ambos', label: '|||+◼◼  Ambos', icon: '🔲' },
                ] as { value: 'barra' | 'qr' | 'ambos'; label: string; icon: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEtqTipoCodigo(opt.value)}
                    className="flex-1 px-3 py-2.5 rounded-lg text-xs font-bold transition-all"
                    style={etqTipoCodigo === opt.value
                      ? { background: 'rgba(124,58,237,0.4)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.6)' }
                      : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }
                    }
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview cantidad */}
            <div className="text-xs text-white/40">
              {(() => {
                const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
                let base = records.filter(r => r.situacion === 'Activo' && r.codigo_barra)
                if (tipoInvFiltro) {
                  const t = norm(tipoInvFiltro)
                  base = base.filter(r => norm(r.tipo_inventario) === t)
                }
                if (etqProducto) base = base.filter(r => r.id === etqProducto)
                if (etqCategoria) base = base.filter(r => r.categoria === etqCategoria)
                if (etqGrupo) base = base.filter(r => r.grupo === etqGrupo)
                if (etqSubGrupo) base = base.filter(r => r.sub_grupo === etqSubGrupo)
                const tipo = etqTipoCodigo === 'barra' ? 'Código de Barras' : etqTipoCodigo === 'qr' ? 'Código QR' : 'Ambos (Barras + QR)'
                const sufijo = tipoInvFiltro ? ` · solo ${tipoInvFiltro}` : ''
                return `${base.length} etiquetas a generar — ${tipo}${sufijo}`
              })()}
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-2">
              <button onClick={printBarcodes} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                🖨 Generar Etiquetas
              </button>
              <button onClick={() => setShowEtiquetasFiltro(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all">
                {tBtn('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
