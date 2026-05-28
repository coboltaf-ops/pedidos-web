'use client'

import { useTranslations } from 'next-intl'

import { useState, useRef } from 'react'
import { todayColombia, fDate } from '@/shared/lib/format-date'
import { useBodegasStore, type SaldoBodega, type MovimientoBodega } from '@/features/bodegas/store/bodegas-store'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useTipoInventarioSesion } from '@/features/contexto-sesion/store/tipo-inventario-store'
import { codigoMatchesTipo } from '@/shared/lib/tipo-inventario-prefijo'
import { exportToPDF } from '@/shared/lib/export-report'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type LineaComparacion = {
  producto_id: string
  codigo: string
  descripcion: string
  unidad_medida: string
  costo_promedio: number
  existencia_sistema: number
  conteo_fisico: number
  diferencia: number
  tipo_ajuste: 'Sobrante' | 'Faltante' | 'Sin Diferencia'
  valor_diferencia: number
}

type TomaFisica = {
  id: string
  nro_toma: string
  fecha: string
  bodega_id: string
  bodega_nombre: string
  responsable: string
  estado: 'Pendiente' | 'Procesada'
  lineas: LineaComparacion[]
  total_sobrantes: number
  total_faltantes: number
  valor_neto: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = todayColombia()
const fmt = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function TomaInventarioFisicoPage() {
  const t = useTranslations('pages')
  const tF = useTranslations('fields')
  const tE = useTranslations('empty')
  const tH = useTranslations('headers')
  const tOp = useTranslations('options')
  const tHelp = useTranslations('help')
  const tEs = useTranslations('emptyState')
  const tipoActivo = useTipoInventarioSesion(s => s.tipoActivo)
  const todasBodegas = useBodegasStore(s => s.bodegas)
  const updateBodega = useBodegasStore(s => s.updateBodega)
  const bodegas = todasBodegas.filter(b => b.situacion === 'Activa' && (!tipoActivo || b.tipo_inventario === tipoActivo))
  const todosProductos = useProductosStore(s => s.productos).filter(p => codigoMatchesTipo(p.codigo, tipoActivo || ''))
  const updateProducto = useProductosStore(s => s.updateProducto)

  const [tab, setTab] = useState<'generar' | 'cargar' | 'historial'>('generar')
  const [bodegaId, setBodegaId] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [filtroSubGrupo, setFiltroSubGrupo] = useState('')
  const [opcionCodigo, setOpcionCodigo] = useState<'ninguno' | 'barra' | 'qr'>('ninguno')

  // Valores únicos para filtros
  const productosActivos = todosProductos.filter(p => p.situacion === 'Activo')
  const categorias = [...new Set(productosActivos.map(p => p.categoria).filter(Boolean))].sort()
  const grupos = [...new Set(productosActivos.filter(p => !filtroCategoria || p.categoria === filtroCategoria).map(p => p.grupo).filter(Boolean))].sort()
  const subGrupos = [...new Set(productosActivos.filter(p => (!filtroCategoria || p.categoria === filtroCategoria) && (!filtroGrupo || p.grupo === filtroGrupo)).map(p => p.sub_grupo).filter(Boolean))].sort()
  const [responsable, setResponsable] = useState('')
  const [lineas, setLineas] = useState<LineaComparacion[]>([])
  const [procesado, setProcesado] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [historial, setHistorial] = useState<TomaFisica[]>([])
  const [cargando, setCargando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── PASO 1: Generar Plantilla Excel ──────────────────────────────────────

  const generarPlantilla = () => {
    setErrorMsg('')
    if (!bodegaId) { setErrorMsg('Seleccione una bodega.'); return }
    const bodega = todasBodegas.find(b => b.id === bodegaId)
    if (!bodega) return

    // Función para verificar si un producto pasa los filtros
    const pasaFiltro = (prod: { categoria?: string; grupo?: string; sub_grupo?: string } | undefined) => {
      if (!prod) return true
      if (filtroCategoria && prod.categoria !== filtroCategoria) return false
      if (filtroGrupo && prod.grupo !== filtroGrupo) return false
      if (filtroSubGrupo && prod.sub_grupo !== filtroSubGrupo) return false
      return true
    }

    const saldos = bodega.saldos || []
    const rows: { codigo: string; codigo_barra: string; descripcion: string; categoria: string; grupo: string; sub_grupo: string; unidad: string; existencia_sistema: number; costo_promedio: number; conteo_fisico: string }[] = []

    // Productos con saldo en bodega
    saldos
      .filter(s => s.existencia > 0 || todosProductos.find(p => p.id === s.producto_id)?.situacion === 'Activo')
      .forEach(s => {
        const prod = todosProductos.find(p => p.codigo === s.codigo)
        if (!pasaFiltro(prod)) return
        rows.push({
          codigo: s.codigo,
          codigo_barra: prod?.codigo_barra || prod?.codigo || '',
          descripcion: s.descripcion,
          categoria: prod?.categoria || '',
          grupo: prod?.grupo || '',
          sub_grupo: prod?.sub_grupo || '',
          unidad: s.unidad_medida,
          existencia_sistema: s.existencia,
          costo_promedio: s.costo_promedio,
          conteo_fisico: '',
        })
      })

    // Productos activos que no están en la bodega
    const codigosEnBodega = new Set(saldos.map(s => s.codigo))
    todosProductos
      .filter(p => p.situacion === 'Activo' && !codigosEnBodega.has(p.codigo) && pasaFiltro(p))
      .forEach(p => {
        rows.push({
          codigo: p.codigo,
          codigo_barra: p.codigo_barra || p.codigo,
          descripcion: p.descripcion,
          categoria: p.categoria || '',
          grupo: p.grupo || '',
          sub_grupo: p.sub_grupo || '',
          unidad: p.unidad_medida,
          existencia_sistema: 0,
          costo_promedio: p.costo_promedio || p.ult_costo || 0,
          conteo_fisico: '',
        })
      })

    if (rows.length === 0) { setErrorMsg('No hay productos que coincidan con los filtros seleccionados.'); return }

    const filtroTexto = [
      filtroCategoria ? `Categoría: ${filtroCategoria}` : '',
      filtroGrupo ? `Grupo: ${filtroGrupo}` : '',
      filtroSubGrupo ? `Sub-Grupo: ${filtroSubGrupo}` : '',
    ].filter(Boolean).join(' | ') || 'Todos los productos'

    // ── Si es Ninguno → Excel normal ──
    if (opcionCodigo === 'ninguno') {
      const XLSX = require('xlsx')
      const headers = [tF('codigo'), tF('descripcion'), tF('categoria'), tF('grupo'), tH('subGrupoHyphen'), tF('unidad'), 'Conteo Físico']
      const data = rows.map(r => [r.codigo, r.descripcion, r.categoria, r.grupo, r.sub_grupo, r.unidad, ''])
      const ws = XLSX.utils.aoa_to_sheet([
        [`PLANTILLA TOMA FÍSICA — ${bodega.nombre}`],
        [`Fecha: ${new Date().toLocaleString('es-CO')} | Filtro: ${filtroTexto}`],
        [`Bodega: ${bodega.nombre}`],
        [],
        headers,
        ...data,
      ])
      ws['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 18 }]
      const rowH: { hpt: number }[] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 18 }, { hpt: 10 }, { hpt: 28 }]
      for (let i = 0; i < data.length; i++) rowH.push({ hpt: 30 })
      ws['!rows'] = rowH
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Toma Física')
      XLSX.writeFile(wb, `Toma_Fisica_${bodega.nombre.replace(/\s/g, '_')}.xlsx`)
      setSuccessMsg(`Plantilla Excel generada con ${rows.length} productos.`)
      setTimeout(() => setSuccessMsg(''), 4000)
      return
    }

    // ── Si es Barras o QR → Documento imprimible con códigos reales ──
    const showBarcode = opcionCodigo === 'barra'
    const showQR = opcionCodigo === 'qr'
    const tipoLabel = showBarcode ? 'Código de Barras' : 'Código QR'

    const tableRows = rows.map((r, idx) => `
      <tr>
        <td class="cod-cell">${r.codigo}</td>
        <td class="bc-cell">
          ${showBarcode ? `<svg class="barcode" id="bc${idx}" data-code="${r.codigo_barra}"></svg>` : ''}
          ${showQR ? `<canvas class="qr" id="qr${idx}" data-text="${r.codigo_barra}" width="80" height="80"></canvas>` : ''}
          <div class="bc-text">${r.codigo_barra}</div>
        </td>
        <td>${r.descripcion}</td>
        <td class="center">${r.categoria}</td>
        <td class="center">${r.grupo}</td>
        <td class="center">${r.sub_grupo}</td>
        <td class="center">${r.unidad}</td>
        <td class="conteo"></td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Toma Física — ${bodega.nombre} — Con ${tipoLabel}</title>
    ${showBarcode ? `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>` : ''}
    ${showQR ? `<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>` : ''}
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;padding:20px;color:#111}
      .header{background:#0a1628;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:16px}
      .header h1{font-size:16px;font-weight:700}
      .header p{font-size:11px;color:#93c5fd;margin-top:4px}
      .toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
      .btn-print{background:#1e40af;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer}
      @media print{.btn-print{display:none} .toolbar{margin-bottom:4px}}
      table{width:100%;border-collapse:collapse;font-size:11px}
      thead th{background:#1e3a5f;color:#fff;padding:8px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em}
      tbody tr{border-bottom:1px solid #e5e7eb}
      tbody td{padding:8px 6px;vertical-align:middle}
      .cod-cell{font-family:monospace;font-weight:700;font-size:11px;width:90px}
      .bc-cell{width:180px;text-align:center}
      .bc-cell svg{width:160px;height:45px;display:block;margin:0 auto}
      .bc-cell canvas{display:block;margin:0 auto}
      .bc-text{font-size:8px;color:#6b7280;font-family:monospace;margin-top:2px}
      .center{text-align:center}
      .conteo{width:100px;border:2px solid #1e40af;background:#f0f7ff;min-height:35px}
      @media print{
        body{padding:10px}
        tbody tr{page-break-inside:avoid}
        .conteo{border:2px solid #000;background:#fff}
      }
    </style></head><body>
    <div class="header">
      <h1>PLANTILLA TOMA FÍSICA — ${bodega.nombre}</h1>
      <p>Fecha: ${new Date().toLocaleString('es-CO')} | Filtro: ${filtroTexto} | Incluye: ${tipoLabel}</p>
    </div>
    <div class="toolbar">
      <span style="font-size:12px;color:#64748b">${rows.length} productos</span>
      <button onclick="window.print()" class="btn-print">🖨 Imprimir</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>${tipoLabel}</th>
          <th>Descripción</th>
          <th>Categoría</th>
          <th>Grupo</th>
          <th>Sub-Grupo</th>
          <th>Unidad de Medida</th>
          <th>Cant. Física</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <script>
      window.onload = function() {
        ${showBarcode ? `document.querySelectorAll('.barcode').forEach(function(el) {
          try {
            JsBarcode(el, el.getAttribute('data-code'), {
              format: 'CODE128', width: 1.5, height: 40,
              displayValue: false, margin: 2
            })
          } catch(e) {}
        })` : ''}
        ${showQR ? `document.querySelectorAll('.qr').forEach(function(canvas) {
          try {
            var text = canvas.getAttribute('data-text')
            var qr = qrcode(0, 'M')
            qr.addData(text)
            qr.make()
            var count = qr.getModuleCount()
            var cellSize = 2
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
            for (var row = 0; row < count; row++) {
              for (var col = 0; col < count; col++) {
                if (qr.isDark(row, col)) {
                  ctx.fillRect((col + margin) * cellSize, (row + margin) * cellSize, cellSize, cellSize)
                }
              }
            }
          } catch(e) {}
        })` : ''}
      }
    <\/script>
    </body></html>`

    // Descargar como archivo HTML (sin popups)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Toma_Fisica_${bodega.nombre.replace(/\s/g, '_')}_${showBarcode ? 'BARRAS' : 'QR'}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setSuccessMsg(`Archivo descargado. Ábrelo en el navegador para ver los ${tipoLabel} e imprimir.`)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  // ─── PASO 2: Cargar Excel con Conteos ─────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('')
    setSuccessMsg('')
    setProcesado(false)
    setLineas([])

    const file = e.target.files?.[0]
    if (!file) return
    if (!bodegaId) { setErrorMsg('Seleccione una bodega antes de cargar el archivo.'); return }

    setCargando(true)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown as unknown[][]

      // Buscar la fila de encabezados y la columna de "Conteo"
      let headerIdx = -1
      let conteoColIdx = -1
      for (let i = 0; i < Math.min(rawData.length, 10); i++) {
        const row = rawData[i]
        if (row && Array.isArray(row)) {
          const cells = row.map(c => String(c || '').toLowerCase())
          const joined = cells.join('|')
          if (joined.includes('digo') && joined.includes('conteo')) {
            headerIdx = i
            conteoColIdx = cells.findIndex(c => c.includes('conteo'))
            break
          }
        }
      }

      if (headerIdx < 0 || conteoColIdx < 0) {
        setErrorMsg('No se encontró la fila de encabezados. Asegúrese de que el Excel tiene columnas "Código" y "Conteo Físico".')
        setCargando(false)
        return
      }

      const bodega = todasBodegas.find(b => b.id === bodegaId)
      if (!bodega) { setCargando(false); return }
      const saldos = bodega.saldos || []

      const nuevasLineas: LineaComparacion[] = []
      const dataRows = rawData.slice(headerIdx + 1)

      for (const row of dataRows) {
        if (!Array.isArray(row) || !row[0]) continue
        const codigo = String(row[0]).trim()
        const conteoRaw = row[conteoColIdx] // Columna dinámica de Conteo Físico
        if (conteoRaw === '' || conteoRaw === undefined || conteoRaw === null) continue

        const conteo = Number(conteoRaw)
        if (isNaN(conteo) || conteo < 0) continue

        const prod = todosProductos.find(p => p.codigo === codigo)
        if (!prod) continue

        const saldo = saldos.find(s => s.codigo === codigo)
        const existSistema = saldo?.existencia ?? 0
        const cp = saldo?.costo_promedio ?? prod.costo_promedio ?? prod.ult_costo ?? 0
        const dif = conteo - existSistema

        nuevasLineas.push({
          producto_id: prod.id,
          codigo,
          descripcion: prod.descripcion,
          unidad_medida: prod.unidad_medida,
          costo_promedio: cp,
          existencia_sistema: existSistema,
          conteo_fisico: conteo,
          diferencia: dif,
          tipo_ajuste: dif > 0 ? 'Sobrante' : dif < 0 ? 'Faltante' : 'Sin Diferencia',
          valor_diferencia: Math.round(dif * cp * 100) / 100,
        })
      }

      if (nuevasLineas.length === 0) {
        setErrorMsg('No se encontraron productos con conteos válidos en el archivo.')
        setCargando(false)
        return
      }

      setLineas(nuevasLineas)
      setSuccessMsg(`Se leyeron ${nuevasLineas.length} productos del archivo.`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch {
      setErrorMsg('Error al leer el archivo Excel. Verifique el formato.')
    }
    setCargando(false)
  }

  // ─── PASO 3: Procesar Ajustes ─────────────────────────────────────────────

  const procesarAjustes = () => {
    setErrorMsg('')
    if (!bodegaId) { setErrorMsg('Seleccione una bodega.'); return }
    if (!responsable.trim()) { setErrorMsg('Ingrese el nombre del responsable.'); return }

    const conDiferencia = lineas.filter(l => l.diferencia !== 0)
    if (conDiferencia.length === 0) { setErrorMsg('No hay diferencias que procesar.'); return }

    const bodega = todasBodegas.find(b => b.id === bodegaId)
    if (!bodega) return

    const saldosBodega: SaldoBodega[] = bodega.saldos ? [...bodega.saldos] : []
    const movimientosBodega: MovimientoBodega[] = bodega.movimientos ? [...bodega.movimientos] : []

    const nroToma = `TF-${String(historial.length + 1).padStart(4, '0')}`

    for (const linea of conDiferencia) {
      const prod = todosProductos.find(p => p.id === linea.producto_id)
      if (!prod) continue

      const esSobrante = linea.diferencia > 0
      const delta = linea.diferencia
      const tipoMov = esSobrante ? 'Entrada por Ajuste' : 'Salida por Ajuste' as const

      // ── 1. ACTUALIZAR SALDO EN BODEGA ──
      const idxSal = saldosBodega.findIndex(s => s.codigo === linea.codigo)
      let existAntBodega: number
      let cpAntBodega: number
      let nuevaExistBodega: number
      let nuevoCpBodega: number

      if (idxSal >= 0) {
        const saldo = saldosBodega[idxSal]
        existAntBodega = saldo.existencia
        cpAntBodega = saldo.costo_promedio
        nuevaExistBodega = linea.conteo_fisico // Se iguala al conteo físico

        if (esSobrante) {
          const valorAnt = existAntBodega * cpAntBodega
          const costoEntrada = prod.costo_promedio || prod.ult_costo || 0
          const valorEntrada = linea.diferencia * costoEntrada
          nuevoCpBodega = nuevaExistBodega > 0
            ? Math.round(((valorAnt + valorEntrada) / nuevaExistBodega) * 100) / 100
            : costoEntrada
        } else {
          nuevoCpBodega = cpAntBodega
        }

        saldosBodega[idxSal] = {
          ...saldo,
          existencia: nuevaExistBodega,
          costo_promedio: nuevoCpBodega,
          valor_existencia: Math.round(nuevaExistBodega * nuevoCpBodega * 100) / 100,
        }
      } else if (esSobrante) {
        existAntBodega = 0
        cpAntBodega = 0
        nuevaExistBodega = linea.conteo_fisico
        nuevoCpBodega = prod.costo_promedio || prod.ult_costo || 0
        saldosBodega.push({
          producto_id: prod.id,
          codigo: prod.codigo,
          descripcion: prod.descripcion,
          unidad_medida: prod.unidad_medida,
          existencia: nuevaExistBodega,
          costo_promedio: nuevoCpBodega,
          valor_existencia: Math.round(nuevaExistBodega * nuevoCpBodega * 100) / 100,
        })
      } else {
        continue
      }

      // ── 2. CREAR MOVIMIENTO EN BODEGA ──
      movimientosBodega.push({
        id: crypto.randomUUID(),
        fecha: today,
        tipo: tipoMov,
        documento_origen: nroToma,
        producto_id: prod.id,
        producto_codigo: prod.codigo,
        producto_descripcion: prod.descripcion,
        unidad_medida: prod.unidad_medida,
        cantidad: delta,
        costo_promedio: nuevoCpBodega,
        valor: Math.round(delta * nuevoCpBodega * 100) / 100,
        existencia_anterior: existAntBodega,
        existencia_despues: nuevaExistBodega,
        cp_anterior: cpAntBodega,
        motivo_ajuste: `Toma Física — ${linea.tipo_ajuste}`,
        persona_emite: responsable,
        observaciones: `Toma Física ${nroToma} — Sistema: ${linea.existencia_sistema}, Conteo: ${linea.conteo_fisico}, Dif: ${linea.diferencia > 0 ? '+' : ''}${linea.diferencia}`,
      } as MovimientoBodega)

      // ── 3. ACTUALIZAR MAESTRO DE PRODUCTOS ──
      const existAntProd = prod.existencia || 0
      const nuevaExistProd = existAntProd + delta

      updateProducto(prod.id, {
        existencia: nuevaExistProd,
        costo_promedio: esSobrante ? nuevoCpBodega : (prod.costo_promedio || prod.ult_costo || 0),
        fecha_ult_movimiento: today,
        nro_ult_documento: nroToma,
        tipo_ult_movimiento: 'Toma Física de Inventario',
      })
    }

    // ── 4. GUARDAR BODEGA ACTUALIZADA ──
    updateBodega(bodega.id, {
      saldos: saldosBodega,
      movimientos: movimientosBodega,
    })

    // ── 5. GUARDAR EN HISTORIAL ──
    const sobrantes = conDiferencia.filter(l => l.diferencia > 0)
    const faltantes = conDiferencia.filter(l => l.diferencia < 0)

    const nuevaToma: TomaFisica = {
      id: crypto.randomUUID(),
      nro_toma: nroToma,
      fecha: today,
      bodega_id: bodegaId,
      bodega_nombre: bodega.nombre,
      responsable,
      estado: 'Procesada',
      lineas,
      total_sobrantes: sobrantes.length,
      total_faltantes: faltantes.length,
      valor_neto: Math.round(lineas.reduce((s, l) => s + l.valor_diferencia, 0) * 100) / 100,
    }

    setHistorial(prev => [...prev, nuevaToma])
    setProcesado(true)
    setSuccessMsg(`Toma Física ${nroToma} procesada: ${sobrantes.length} sobrantes, ${faltantes.length} faltantes, ${lineas.filter(l => l.diferencia === 0).length} sin cambio.`)
  }

  // ─── Exportar Acta PDF ────────────────────────────────────────────────────

  const exportarActaPDF = () => {
    const conDiferencia = lineas.filter(l => l.diferencia !== 0)
    const bodega = todasBodegas.find(b => b.id === bodegaId)

    exportToPDF({
      title: 'Acta de Toma Física de Inventario',
      subtitle: `Bodega: ${bodega?.nombre || ''} — Fecha: ${fDate(today)} — Responsable: ${responsable}`,
      filename: `Acta_Toma_Fisica_${bodega?.nombre?.replace(/\s/g, '_')}`,
      columns: [
        { header: 'Código', key: 'codigo', width: 14 },
        { header: 'Descripción', key: 'descripcion', width: 30 },
        { header: 'Unidad', key: 'unidad', width: 10 },
        { header: tH('sistema'), key: 'sistema', width: 10 },
        { header: tH('conteo'), key: 'conteo', width: 10 },
        { header: tH('diferencia'), key: 'diferencia', width: 12 },
        { header: 'Tipo', key: 'tipo', width: 12 },
        { header: tH('valorDif'), key: 'valor', width: 14 },
      ],
      rows: conDiferencia.map(l => ({
        codigo: l.codigo,
        descripcion: l.descripcion,
        unidad: l.unidad_medida,
        sistema: l.existencia_sistema,
        conteo: l.conteo_fisico,
        diferencia: `${l.diferencia > 0 ? '+' : ''}${l.diferencia}`,
        tipo: l.tipo_ajuste,
        valor: fmt(l.valor_diferencia),
      })),
    })
  }

  // ─── Resumen ──────────────────────────────────────────────────────────────

  const sobrantes = lineas.filter(l => l.diferencia > 0)
  const faltantes = lineas.filter(l => l.diferencia < 0)
  const sinDif = lineas.filter(l => l.diferencia === 0)
  const valorSobrantes = sobrantes.reduce((s, l) => s + l.valor_diferencia, 0)
  const valorFaltantes = faltantes.reduce((s, l) => s + l.valor_diferencia, 0)
  const valorNeto = valorSobrantes + valorFaltantes

  // ─── UI ───────────────────────────────────────────────────────────────────

  const labelStyle = { color: '#fff', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 700, marginBottom: 4 }
  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '10px 14px', color: '#fff', width: '100%', fontSize: 14 }
  const btnPrimary = { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }
  const btnSecondary = { background: 'rgba(96,165,250,0.15)', color: '#fff', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, padding: '12px 22px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }

  return (
    <div style={{ padding: 28 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0 }}>📋 {t('tomaInventarioFisico')}</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Generar plantilla, cargar conteos y procesar ajustes automáticamente</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
        {[
          { id: 'generar' as const, label: '1. Generar Plantilla', icon: '📥' },
          { id: 'cargar' as const, label: '2. Cargar y Procesar', icon: '📤' },
          { id: 'historial' as const, label: '3. Historial', icon: '📜' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: tab === t.id ? '#3b82f6' : 'transparent',
              color: tab === t.id ? '#fff' : '#94a3b8',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Mensajes */}
      {errorMsg && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 18px', marginBottom: 16, color: '#fff', fontSize: 13, fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '12px 18px', marginBottom: 16, color: '#fff', fontSize: 13, fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {/* ═══ TAB 1: GENERAR PLANTILLA ═══ */}
      {tab === 'generar' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 28 }}>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t('tomaGenerarPlantilla')}</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
            Se genera un archivo Excel con los productos para conteo físico. La columna &quot;Conteo Físico&quot; queda vacía para que el personal la llene.
          </p>

          {tipoActivo && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 10, background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#fff', fontSize: 12, fontWeight: 700, marginBottom: 20 }}>
              📦 Tipo de Inventario activo: <span style={{ color: '#fff' }}>{tipoActivo}</span>
            </div>
          )}

          {/* Fila 1: Bodega + Filtros */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={labelStyle}>Bodega *</div>
              <select value={bodegaId} onChange={e => setBodegaId(e.target.value)} style={inputStyle}>
                <option value="">{tOp('seleccioneBodega')}</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Categoría</div>
              <select value={filtroCategoria} onChange={e => { setFiltroCategoria(e.target.value); setFiltroGrupo(''); setFiltroSubGrupo('') }} style={inputStyle}>
                <option value="">{tOp('todas')}</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Grupo</div>
              <select value={filtroGrupo} onChange={e => { setFiltroGrupo(e.target.value); setFiltroSubGrupo('') }} style={inputStyle}>
                <option value="">{tOp('todos')}</option>
                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Sub-Grupo</div>
              <select value={filtroSubGrupo} onChange={e => setFiltroSubGrupo(e.target.value)} style={inputStyle}>
                <option value="">{tOp('todos')}</option>
                {subGrupos.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Fila 2: Opción Código Barra/QR */}
          <div style={{ marginBottom: 20 }}>
            <div style={labelStyle}>Incluir columna de identificación</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              {[
                { value: 'ninguno' as const, label: 'Ninguno', desc: 'Solo código del producto' },
                { value: 'barra' as const, label: 'Código de Barras', desc: 'Incluye columna Código de Barras' },
                { value: 'qr' as const, label: 'Código QR', desc: 'Incluye columna Código QR' },
              ].map(op => (
                <button
                  key={op.value}
                  onClick={() => setOpcionCodigo(op.value)}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: opcionCodigo === op.value ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                    border: opcionCodigo === op.value ? '2px solid #3b82f6' : '1px solid rgba(148,163,184,0.15)',
                  }}
                >
                  <div style={{ color: opcionCodigo === op.value ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 700 }}>{op.label}</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{op.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button onClick={generarPlantilla} style={btnPrimary}>
              📥 Descargar Plantilla Excel
            </button>
            {(filtroCategoria || filtroGrupo || filtroSubGrupo) && (
              <button onClick={() => { setFiltroCategoria(''); setFiltroGrupo(''); setFiltroSubGrupo('') }} style={btnSecondary}>
                ✕ Limpiar Filtros
              </button>
            )}
          </div>

          {/* Instrucciones */}
          <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: 20 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Instrucciones:</div>
            <ol style={{ color: '#94a3b8', fontSize: 13, paddingLeft: 20, lineHeight: 2 }}>
              <li>{tHelp('seleccioneBodegaTemplate')}</li>
              <li>{tHelp('imprimaExcel')}</li>
              <li>{tHelp('personalCuenta')}</li>
              <li>Escribe la cantidad contada en la columna <strong style={{ color: '#fff' }}>&quot;Conteo Físico&quot;</strong> (última columna)</li>
              <li>Guarde el archivo y pase a la pestaña <strong style={{ color: '#fff' }}>&quot;2. Cargar y Procesar&quot;</strong></li>
            </ol>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: CARGAR Y PROCESAR ═══ */}
      {tab === 'cargar' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 28 }}>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t('tomaCargarExcel')}</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
            Suba el Excel con los conteos físicos. El sistema compara automáticamente y muestra las diferencias.
          </p>

          {/* Formulario de carga */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <div style={labelStyle}>Bodega *</div>
              <select value={bodegaId} onChange={e => { setBodegaId(e.target.value); setLineas([]); setProcesado(false) }} style={inputStyle}>
                <option value="">{tOp('seleccioneBodega')}</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Responsable del Conteo *</div>
              <input value={responsable} onChange={e => setResponsable(e.target.value)} placeholder="Nombre completo" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Archivo Excel *</div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                style={{ ...inputStyle, padding: '8px 14px' }}
              />
            </div>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontSize: 15, fontWeight: 600 }}>
              Leyendo archivo...
            </div>
          )}

          {/* Resumen de diferencias */}
          {lineas.length > 0 && !cargando && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <div style={{ background: 'rgba(148,163,184,0.1)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Productos</div>
                  <div style={{ color: '#fff', fontSize: 28, fontWeight: 900, marginTop: 4 }}>{lineas.length}</div>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.12)', borderRadius: 10, padding: 16, textAlign: 'center', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <div style={{ color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Sobrantes</div>
                  <div style={{ color: '#22c55e', fontSize: 28, fontWeight: 900, marginTop: 4 }}>{sobrantes.length}</div>
                  <div style={{ color: '#fff', fontSize: 12, marginTop: 2 }}>{fmt(valorSobrantes)}</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.12)', borderRadius: 10, padding: 16, textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div style={{ color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Faltantes</div>
                  <div style={{ color: '#ef4444', fontSize: 28, fontWeight: 900, marginTop: 4 }}>{faltantes.length}</div>
                  <div style={{ color: '#fff', fontSize: 12, marginTop: 2 }}>{fmt(valorFaltantes)}</div>
                </div>
                <div style={{ background: 'rgba(148,163,184,0.1)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                  <div style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Sin Diferencia</div>
                  <div style={{ color: '#fff', fontSize: 28, fontWeight: 900, marginTop: 4 }}>{sinDif.length}</div>
                </div>
              </div>

              {/* Valor neto */}
              <div style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Valor Neto del Ajuste:</span>
                <span style={{ color: valorNeto >= 0 ? '#22c55e' : '#ef4444', fontSize: 22, fontWeight: 900 }}>
                  {valorNeto >= 0 ? '+' : ''}{fmt(valorNeto)}
                </span>
              </div>

              {/* Tabla de comparación */}
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(148,163,184,0.15)', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(30,58,138,0.6)' }}>
                      {[tF('codigo'), tF('descripcion'), tF('unidad'), tH('sistema'), tH('conteo'), tH('diferencia'), tF('tipo'), tH('valorDif')].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#fff', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => (
                      <tr key={l.codigo} style={{
                        background: l.diferencia > 0 ? 'rgba(34,197,94,0.06)' : l.diferencia < 0 ? 'rgba(239,68,68,0.06)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderBottom: '1px solid rgba(148,163,184,0.08)',
                      }}>
                        <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>{l.codigo}</td>
                        <td style={{ padding: '10px 12px', color: '#e2e8f0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descripcion}</td>
                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{l.unidad_medida}</td>
                        <td style={{ padding: '10px 12px', color: '#fff', textAlign: 'right', fontWeight: 600 }}>{l.existencia_sistema}</td>
                        <td style={{ padding: '10px 12px', color: '#fff', textAlign: 'right', fontWeight: 700 }}>{l.conteo_fisico}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: l.diferencia > 0 ? '#22c55e' : l.diferencia < 0 ? '#ef4444' : '#94a3b8' }}>
                          {l.diferencia > 0 ? '+' : ''}{l.diferencia}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                            background: l.tipo_ajuste === 'Sobrante' ? 'rgba(34,197,94,0.2)' : l.tipo_ajuste === 'Faltante' ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.15)',
                            color: l.tipo_ajuste === 'Sobrante' ? '#86efac' : l.tipo_ajuste === 'Faltante' ? '#fca5a5' : '#94a3b8',
                          }}>
                            {l.tipo_ajuste}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: l.valor_diferencia > 0 ? '#22c55e' : l.valor_diferencia < 0 ? '#ef4444' : '#94a3b8' }}>
                          {fmt(l.valor_diferencia)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                {procesado && (
                  <button onClick={exportarActaPDF} style={btnSecondary}>
                    📄 Exportar Acta PDF
                  </button>
                )}
                {!procesado && (
                  <button onClick={procesarAjustes} style={{ ...btnPrimary, background: '#22c55e', padding: '14px 32px', fontSize: 15 }}>
                    ✓ Procesar Ajustes ({lineas.filter(l => l.diferencia !== 0).length} productos)
                  </button>
                )}
                {procesado && (
                  <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '14px 24px', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    ✓ Ajustes procesados exitosamente — Productos, Bodegas y Kardex actualizados
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB 3: HISTORIAL ═══ */}
      {tab === 'historial' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 28 }}>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{t('tomaHistorial')}</h2>

          {historial.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{tE('noTomasFisicas')}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{tEs('tomasProcesadas')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {historial.map(t => (
                <div key={t.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Nro. Toma</div>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>{t.nro_toma}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Fecha</div>
                    <div style={{ color: '#e2e8f0', fontSize: 13 }}>{fDate(t.fecha)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Bodega</div>
                    <div style={{ color: '#e2e8f0', fontSize: 13 }}>{t.bodega_nombre}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Resultado</div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: '#22c55e' }}>{t.total_sobrantes} sobrantes</span> / <span style={{ color: '#ef4444' }}>{t.total_faltantes} faltantes</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Valor Neto</div>
                    <div style={{ color: t.valor_neto >= 0 ? '#22c55e' : '#ef4444', fontSize: 15, fontWeight: 900 }}>{fmt(t.valor_neto)}</div>
                  </div>
                  <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.95)', color: '#fff' }}>
                    {t.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
