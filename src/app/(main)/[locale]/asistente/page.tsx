'use client'

import { useLocale, useTranslations } from 'next-intl'

import { useState, useRef, useCallback } from 'react'
import { useProductosStore } from '@/features/productos/store/productos-store'
import { useOrdenesStore } from '@/features/ordenes-compra/store/ordenes-store'
import { useTareasStore } from '@/features/tareas/store/tareas-store'
import { useProveedoresStore } from '@/features/proveedores/store/proveedores-store'
import { useBodegasStore } from '@/features/bodegas/store/bodegas-store'
import { usePersonalEmpresaStore } from '@/features/personal-empresa/store/personal-empresa-store'

type Mensaje = {
  id: string
  tipo: 'pregunta' | 'respuesta'
  texto: string
  timestamp: string
}

export default function AsistentePage() {
  const locale = useLocale()
  const isEn = locale === 'en'
  const t = useTranslations('pages')
  const tBtn = useTranslations('buttons')
  const tAsi = useTranslations('asistente')

  const fmt = (n: number) => n.toLocaleString(isEn ? 'en-US' : 'es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const preguntas = [
    { label: tAsi('quickInventario'), icon: '📦', key: 'inventario' },
    { label: tAsi('quickOrdenes'), icon: '🛒', key: 'ordenes' },
    { label: tAsi('quickTareas'), icon: '📝', key: 'tareas' },
  ]
  const productos = useProductosStore(s => s.productos)
  const ordenes = useOrdenesStore(s => s.ordenes)
  const tareas = useTareasStore(s => s.tareas)
  const proveedores = useProveedoresStore(s => s.proveedores)
  const bodegas = useBodegasStore(s => s.bodegas)
  const personal = usePersonalEmpresaStore(s => s.personal)

  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [hablando, setHablando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [preguntaCustom, setPreguntaCustom] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const recognitionRef = useRef<any>(null)

  const hablar = useCallback((texto: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(texto)
    const speechLang = isEn ? 'en-US' : 'es-ES'
    const langPrefix = isEn ? 'en' : 'es'
    utt.lang = speechLang
    utt.rate = 0.95
    utt.pitch = 1
    // Buscar voz en el idioma seleccionado
    const voces = window.speechSynthesis.getVoices()
    const voz = voces.find(v => v.lang.startsWith(langPrefix)) || voces[0]
    if (voz) utt.voice = voz
    utt.onstart = () => setHablando(true)
    utt.onend = () => setHablando(false)
    utt.onerror = () => setHablando(false)
    synthRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [isEn])

  const iniciarEscucha = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert(tAsi('browserNoSupport')); return }
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; setEscuchando(false); return }
    const recognition = new SpeechRecognition()
    recognition.lang = isEn ? 'en-US' : 'es-ES'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onstart = () => setEscuchando(true)
    recognition.onresult = (event: any) => {
      const texto = event.results[0][0].transcript
      setPreguntaCustom(texto)
      // Auto-enviar la pregunta
      agregarMensaje('pregunta', texto)
      const respuesta = calcularRespuesta(texto)
      setTimeout(() => { agregarMensaje('respuesta', respuesta); hablar(respuesta) }, 500)
    }
    recognition.onend = () => { setEscuchando(false); recognitionRef.current = null }
    recognition.onerror = () => { setEscuchando(false); recognitionRef.current = null }
    recognitionRef.current = recognition
    recognition.start()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hablar, isEn])

  const detenerVoz = () => {
    window.speechSynthesis?.cancel()
    setHablando(false)
  }

  const agregarMensaje = (tipo: Mensaje['tipo'], texto: string) => {
    const msg: Mensaje = {
      id: crypto.randomUUID(),
      tipo,
      texto,
      timestamp: new Date().toLocaleTimeString(isEn ? 'en-US' : 'es-CO', { hour: '2-digit', minute: '2-digit' }),
    }
    setMensajes(prev => [...prev, msg])
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 100)
    return msg
  }

  const calcularRespuesta = (key: string): string => {
    switch (key) {
      case 'inventario': {
        const activos = productos.filter(p => p.situacion === 'Activo')
        const totalItems = activos.reduce((sum, p) => sum + (p.existencia || 0), 0)
        const valorTotal = activos.reduce((sum, p) => sum + ((p.existencia || 0) * (p.ult_costo || 0)), 0)
        const productosSinStock = activos.filter(p => (p.existencia || 0) === 0).length
        const productosConStock = activos.filter(p => (p.existencia || 0) > 0).length

        if (activos.length === 0) {
          return isEn
            ? 'No products registered in the system. Inventory is empty.'
            : 'No hay productos registrados en el sistema. El inventario está vacío.'
        }

        if (isEn) {
          return `Current inventory has ${activos.length} active products. ` +
            `Total inventory value is ${fmt(valorTotal)} Pesos with ${totalItems} units in total. ` +
            `${productosConStock} products have stock available and ${productosSinStock} are out of stock.`
        }
        return `El inventario actual tiene ${activos.length} productos activos. ` +
          `El valor total del inventario es de ${fmt(valorTotal)} Pesos con ${totalItems} unidades en total. ` +
          `${productosConStock} productos tienen stock disponible y ${productosSinStock} están sin existencia.`
      }

      case 'ordenes': {
        const pendientes = ordenes.filter(o => o.situacion === 'Pendiente')
        const cantidad = pendientes.length

        if (cantidad === 0) {
          return isEn
            ? 'No pending purchase orders at the moment. All orders have been processed.'
            : 'No hay órdenes de compra pendientes en este momento. Todas las órdenes han sido procesadas.'
        }

        const valorTotal = pendientes.reduce((sum, o) => {
          const subtotal = (o.detalles || []).reduce((s, d) => s + (d.subtotal || 0), 0)
          const impuesto = subtotal * ((o.pct_impuesto || 0) / 100)
          return sum + subtotal + impuesto
        }, 0)

        const proveedoresSet = [...new Set(pendientes.map(o => o.proveedor))].filter(Boolean)

        if (isEn) {
          return `There ${cantidad === 1 ? 'is' : 'are'} ${cantidad} pending purchase ${cantidad === 1 ? 'order' : 'orders'} ` +
            `for a total value of ${fmt(valorTotal)} Pesos. ` +
            `${proveedoresSet.length > 0 ? `Suppliers involved: ${proveedoresSet.join(', ')}.` : ''}`
        }
        return `Hay ${cantidad} ${cantidad === 1 ? 'orden' : 'órdenes'} de compra pendientes ` +
          `por un valor total de ${fmt(valorTotal)} Pesos. ` +
          `${proveedoresSet.length > 0 ? `Los proveedores involucrados son: ${proveedoresSet.join(', ')}.` : ''}`
      }

      case 'tareas': {
        if (tareas.length === 0) {
          return isEn ? 'No tasks registered in the system.' : 'No hay tareas registradas en el sistema.'
        }

        const porSituacion: Record<string, number> = {}
        tareas.forEach(tsk => {
          const sit = tsk.situacion || (isEn ? 'No status' : 'Sin estado')
          porSituacion[sit] = (porSituacion[sit] || 0) + 1
        })

        const detalle = Object.entries(porSituacion)
          .map(([sit, cant]) => `${cant} ${sit.toLowerCase()}`)
          .join(', ')

        if (isEn) {
          return `There are ${tareas.length} tasks in total. Distribution by status: ${detalle}.`
        }
        return `Hay ${tareas.length} tareas en total. Distribución por situación: ${detalle}.`
      }

      default: {
        // Pregunta personalizada: intentar buscar en datos
        return procesarPreguntaLibre(key)
      }
    }
  }

  const procesarPreguntaLibre = (pregunta: string): string => {
    const q = pregunta.toLowerCase()

    if (q.includes('inventario') || q.includes('stock') || q.includes('existencia') || q.includes('inventory')) {
      return calcularRespuesta('inventario')
    }
    if (q.includes('orden') || q.includes('compra') || q.includes('pendiente') || q.includes('order') || q.includes('purchase') || q.includes('pending')) {
      return calcularRespuesta('ordenes')
    }
    if (q.includes('tarea') || q.includes('asignada') || q.includes('task') || q.includes('assigned')) {
      return calcularRespuesta('tareas')
    }
    if ((q.includes('producto') || q.includes('product')) && (q.includes('cuanto') || q.includes('cuánto') || q.includes('total') || q.includes('how many'))) {
      const activos = productos.filter(p => p.situacion === 'Activo').length
      if (isEn) {
        return `There are ${productos.length} products registered in the system, of which ${activos} are active.`
      }
      return `Hay ${productos.length} productos registrados en el sistema, de los cuales ${activos} están activos.`
    }

    // Proveedores / Suppliers
    if (q.includes('proveedor') || q.includes('supplier')) {
      const activos = proveedores.filter(p => p.situacion === 'Activo')
      if (activos.length === 0) {
        return isEn ? 'No suppliers registered in the system.' : 'No hay proveedores registrados en el sistema.'
      }

      // Por ciudad / by city
      if (q.includes('ciudad') || q.includes('city')) {
        const porCiudad: Record<string, number> = {}
        activos.forEach(p => {
          const ciudad = p.ciudad || (isEn ? 'No city' : 'Sin ciudad')
          porCiudad[ciudad] = (porCiudad[ciudad] || 0) + 1
        })
        const detalle = Object.entries(porCiudad).map(([c, n]) => isEn ? `${n} in ${c}` : `${n} en ${c}`).join(', ')
        return isEn
          ? `There are ${activos.length} active suppliers distributed by city: ${detalle}.`
          : `Hay ${activos.length} proveedores activos distribuidos por ciudad: ${detalle}.`
      }
      // Por actividad / by activity
      if (q.includes('actividad') || q.includes('tipo') || q.includes('activity') || q.includes('type')) {
        const porActividad: Record<string, number> = {}
        activos.forEach(p => {
          const act = p.actividad || (isEn ? 'No activity' : 'Sin actividad')
          porActividad[act] = (porActividad[act] || 0) + 1
        })
        const detalle = Object.entries(porActividad).map(([a, n]) => isEn ? `${n} of ${a}` : `${n} de ${a}`).join(', ')
        return isEn
          ? `There are ${activos.length} active suppliers by activity: ${detalle}.`
          : `Hay ${activos.length} proveedores activos por actividad: ${detalle}.`
      }
      // Por país / by country
      if (q.includes('pais') || q.includes('país') || q.includes('country')) {
        const porPais: Record<string, number> = {}
        activos.forEach(p => {
          const pais = p.pais || (isEn ? 'No country' : 'Sin país')
          porPais[pais] = (porPais[pais] || 0) + 1
        })
        const detalle = Object.entries(porPais).map(([p, n]) => isEn ? `${n} in ${p}` : `${n} en ${p}`).join(', ')
        return isEn
          ? `There are ${activos.length} active suppliers by country: ${detalle}.`
          : `Hay ${activos.length} proveedores activos por país: ${detalle}.`
      }
      // General
      const ciudades = [...new Set(activos.map(p => p.ciudad).filter(Boolean))]
      if (isEn) {
        return `There are ${activos.length} active suppliers in ${ciudades.length} ${ciudades.length === 1 ? 'city' : 'cities'}: ${ciudades.join(', ') || 'no city registered'}.`
      }
      return `Hay ${activos.length} proveedores activos en ${ciudades.length} ${ciudades.length === 1 ? 'ciudad' : 'ciudades'}: ${ciudades.join(', ') || 'sin ciudad registrada'}.`
    }

    // Bodegas / warehouses
    if (q.includes('bodega') || q.includes('almacen') || q.includes('almacén') || q.includes('warehouse') || q.includes('storage')) {
      const activas = bodegas.filter(b => b.situacion === 'Activa')
      if (activas.length === 0) {
        return isEn ? 'No warehouses registered in the system.' : 'No hay bodegas registradas en el sistema.'
      }
      const nombres = activas.map(b => b.nombre).join(', ')
      return isEn
        ? `There are ${activas.length} active warehouses: ${nombres}.`
        : `Hay ${activas.length} bodegas activas: ${nombres}.`
    }

    // Personal / staff
    if (q.includes('personal') || q.includes('empleado') || q.includes('trabajador') || q.includes('staff') || q.includes('employee') || q.includes('worker')) {
      const activos = personal.filter(p => p.situacion === 'Activo')
      if (activos.length === 0) {
        return isEn ? 'No staff registered in the system.' : 'No hay personal registrado en el sistema.'
      }
      return isEn
        ? `There are ${activos.length} active people in the company.`
        : `Hay ${activos.length} personas activas en la empresa.`
    }

    // Situación (genérico) / status generic
    if (q.includes('situacion') || q.includes('situación') || q.includes('estado') || q.includes('status')) {
      return calcularRespuesta('tareas')
    }

    // Acceder / abrir CRM Comercial
    if ((q.includes('crm') || q.includes('comercial')) && (q.includes('abre') || q.includes('abrir') || q.includes('accede') || q.includes('acceder') || q.includes('ir') || q.includes('lleva') || q.includes('llevame') || q.includes('llévame') || q.includes('open') || q.includes('go to'))) {
      try {
        const ret = encodeURIComponent(window.location.origin + '/dashboard')
        window.open(`https://crmspin.vercel.app/?from=inventario&returnUrl=${ret}`, '_blank', 'noopener,noreferrer')
      } catch { /* */ }
      return isEn
        ? 'Opening the CRM Comercial in a new tab. You will be redirected to crmspin.vercel.app.'
        : 'Abriendo el CRM Comercial en una nueva pestaña. Te dirigí a crmspin.vercel.app.'
    }

    if (isEn) {
      return `I understand your question: "${pregunta}". ` +
        `I can answer about: inventory, purchase orders, tasks, suppliers (by city, activity, country), warehouses and staff. ` +
        `Try questions like: "how many suppliers do I have by city" or "how many active warehouses are there".`
    }
    return `Entiendo tu pregunta: "${pregunta}". ` +
      `Puedo responder sobre: inventario, órdenes de compra, tareas, proveedores (por ciudad, actividad, país), bodegas y personal. ` +
      `Prueba con preguntas como: "cuántos proveedores tengo por ciudad" o "cuántas bodegas activas hay".`
  }

  const hacerPregunta = (key: string, label: string) => {
    agregarMensaje('pregunta', label)
    const respuesta = calcularRespuesta(key)
    setTimeout(() => {
      agregarMensaje('respuesta', respuesta)
      hablar(respuesta)
    }, 500)
  }

  const enviarPreguntaCustom = () => {
    if (!preguntaCustom.trim()) return
    const q = preguntaCustom.trim()
    setPreguntaCustom('')
    agregarMensaje('pregunta', q)
    const respuesta = calcularRespuesta(q)
    setTimeout(() => {
      agregarMensaje('respuesta', respuesta)
      hablar(respuesta)
    }, 500)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>
              🤖
            </span>
            {t('asistente')}
          </h1>
          <p className="text-white/50 text-sm mt-1">{tAsi('subtitle')}</p>
        </div>
        {hablando && (
          <button
            onClick={detenerVoz}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white animate-pulse"
            style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(185,28,28,1)' }}
          >
            🔊 {tAsi('detenerVoz')}
          </button>
        )}
      </div>

      {/* Chat */}
      <div
        className="rounded-2xl border overflow-hidden flex flex-col"
        style={{
          background: 'rgba(0,0,0,0.2)',
          borderColor: 'rgba(255,255,255,0.08)',
          height: 'calc(100vh - 280px)',
          minHeight: '400px',
        }}
      >
        {/* Mensajes */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {mensajes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <span className="text-4xl">🤖</span>
              </div>
              <p className="text-white/40 text-sm font-medium">{tAsi('empty1')}</p>
              <p className="text-white/20 text-xs mt-2">{tAsi('empty2')}</p>
            </div>
          )}
          {mensajes.map(msg => (
            <div key={msg.id} className={`flex ${msg.tipo === 'pregunta' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] px-4 py-3 rounded-2xl"
                style={msg.tipo === 'pregunta' ? {
                  background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
                  borderBottomRightRadius: '4px',
                } : {
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderBottomLeftRadius: '4px',
                }}
              >
                {msg.tipo === 'respuesta' && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs">🤖</span>
                    <span className="text-[10px] text-white/40 font-semibold uppercase">{tAsi('badge')}</span>
                    <button
                      onClick={() => hablar(msg.texto)}
                      className="text-[10px] text-blue-300/60 hover:text-blue-300 ml-auto transition-colors"
                      title={tAsi('repetirTitle')}
                    >
                      🔊 {tAsi('repetir')}
                    </button>
                  </div>
                )}
                <p className="text-sm text-white/90 leading-relaxed">{msg.texto}</p>
                <p className="text-[10px] text-white/20 mt-1 text-right">{msg.timestamp}</p>
              </div>
            </div>
          ))}
          {hablando && (
            <div className="flex items-center gap-2 px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-blue-300/60">{tAsi('hablando')}</span>
            </div>
          )}
        </div>

        {/* Botones de Consulta Rápida + Input */}
        <div className="p-4 border-t space-y-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex gap-2 flex-wrap">
            {preguntas.map(p => (
              <button
                key={p.key}
                onClick={() => hacerPregunta(p.key, p.label)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white/80 hover:text-white transition-all hover:scale-[1.03]"
                style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)' }}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); enviarPreguntaCustom() }} className="flex gap-3">
            <input
              type="text"
              value={preguntaCustom}
              onChange={e => setPreguntaCustom(e.target.value)}
              placeholder={tAsi('placeholder')}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              type="button"
              onClick={iniciarEscucha}
              className={`px-3 py-2.5 rounded-xl text-lg transition-all hover:scale-110 ${escuchando ? 'animate-pulse' : ''}`}
              style={escuchando
                ? { background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(185,28,28,1)' }
                : { background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }
              }
              title={escuchando ? tAsi('btnDetener') : tAsi('btnHablar')}
            >
              🎙️
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}
            >
              {tBtn('send')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
