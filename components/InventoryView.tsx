'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useNotificaciones } from '@/components/Notificaciones'

export default function InventoryView({
  productosInventario,
  productosStockBajo,
  productoAEditar,
  busquedaInventario,
  setBusquedaInventario,
  guardandoProducto,
  guardarProducto,
  eliminarProducto,
  cargarProductoEnFormulario,
  resetFormularioProducto,
  abrirEtiqueta,
  fetchProductos,
  nombreProd, setNombreProd,
  precioProd, setPrecioProd,
  costoProd, setCostoProd,
  stockProd, setStockProd,
  minStockProd, setMinStockProd,
  codigoProd, setCodigoProd,
  proveedorProd, setProveedorProd,
  categoriaProd, setCategoriaProd,
  categoriasDB,
  categoriaNuevaInput, setCategoriaNuevaInput,
  crearCategoriaRapida,
  generarCodigoAutomatico,
  setMostrarModalPedido
}: any) {
  const { notificar, confirmar } = useNotificaciones()

  const [camaraActiva, setCamaraActiva] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  // Estado del flujo inteligente de escaneo: 'idle' | 'actualizar' | 'crear'
  const [modoEscaneo, setModoEscaneo] = useState<'idle' | 'actualizar' | 'crear'>('idle')
  const [mensajeAlerta, setMensajeAlerta] = useState<string | null>(null)
  const [cantidadASumar, setCantidadASumar] = useState<string>('')

  // Estados para el autocompletado en el input de nombre
  const [mostrarSugerenciasNombre, setMostrarSugerenciasNombre] = useState(false)
  const containerNombreRef = useRef<HTMLDivElement>(null)

  // Referencias para auto-foco rápido sin usar el mouse
  const inputNombreRef = useRef<HTMLInputElement>(null)
  const inputStockRef = useRef<HTMLInputElement>(null)
  const inputPrecioRef = useRef<HTMLInputElement>(null)
  const inputSkuRef = useRef<HTMLInputElement>(null)

  // Mantener una referencia actualizada de camaraActiva para el atajo de teclado
  const camaraActivaRef = useRef(camaraActiva)
  useEffect(() => {
    camaraActivaRef.current = camaraActiva
  }, [camaraActiva])

  // Foco inicial en el SKU
  useEffect(() => {
    if (inputSkuRef.current) {
      inputSkuRef.current.focus()
    }
  }, [])

  // Cerrar sugerencias de nombre al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerNombreRef.current && !containerNombreRef.current.contains(e.target as Node)) {
        setMostrarSugerenciasNombre(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Atajo de teclado global único (Alt + C)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        if (camaraActivaRef.current) {
          detenerCamara()
        } else {
          iniciarCamara()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [])

  // Sincronizar modo si el usuario cancela la edición desde el botón del formulario
  useEffect(() => {
    if (!productoAEditar && modoEscaneo !== 'idle') {
      setModoEscaneo('idle')
      setMensajeAlerta(null)
      setCantidadASumar('')
    }
  }, [productoAEditar])

  // Sonido de confirmación con Web Audio API
  const emitirBeepConfirmacion = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, audioCtx.currentTime)
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.12)
    } catch {
      // Audio no permitido o silenciado
    }
  }

  // Lógica principal: procesar código escaneado o ingresado
  const procesarCodigoEscaneado = (codigoLimpio: string) => {
    if (!codigoLimpio) return

    emitirBeepConfirmacion()

    const productoExistente = productosInventario.find(
      (p: any) =>
        (p.barcode && p.barcode.trim().toLowerCase() === codigoLimpio.toLowerCase()) ||
        (p.sku && p.sku.trim().toLowerCase() === codigoLimpio.toLowerCase())
    )

    if (productoExistente) {
      cargarProductoEnFormulario(productoExistente)
      setModoEscaneo('actualizar')
      setMensajeAlerta(`Producto encontrado: "${productoExistente.name}". Modo actualización rápido activado.`)
      setCantidadASumar('')

      setTimeout(() => {
        if (inputStockRef.current) {
          inputStockRef.current.focus()
          inputStockRef.current.select()
        }
      }, 80)
    } else {
      resetFormularioProducto()
      setCodigoProd(codigoLimpio)
      setModoEscaneo('crear')
      setMensajeAlerta(`Código nuevo: "${codigoLimpio}". Modo creación activado.`)
      setCantidadASumar('')

      setTimeout(() => {
        if (inputNombreRef.current) {
          inputNombreRef.current.focus()
        }
      }, 80)
    }
  }

  const handleKeyDownSku = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const codigo = codigoProd.trim()
      if (codigo) {
        procesarCodigoEscaneado(codigo)
      }
    }
  }

  const aplicarSumaStock = () => {
    const num = parseInt(cantidadASumar, 10)
    if (!isNaN(num) && num !== 0) {
      const stockActualNum = parseInt(stockProd, 10) || 0
      const nuevoStock = Math.max(0, stockActualNum + num)
      setStockProd(nuevoStock.toString())
      setCantidadASumar('')
      if (inputPrecioRef.current) {
        inputPrecioRef.current.focus()
      }
    }
  }

  const iniciarCamara = async () => {
    try {
      setCamaraActiva(true)

      setTimeout(async () => {
        try {
          const scanner = new Html5Qrcode('reader-container-inv')
          scannerRef.current = scanner

          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 15,
              qrbox: { width: 280, height: 140 }
            },
            (decodedText) => {
              const codigo = decodedText.trim()
              if (codigo) {
                detenerCamara()
                setCodigoProd(codigo)
                procesarCodigoEscaneado(codigo)
              }
            },
            () => {}
          )
        } catch (err) {
          console.error('Error al iniciar html5-qrcode en inventario:', err)
          detenerCamara()
          notificar('error', 'No se pudo acceder a la cámara.', 'Cámara')
        }
      }, 150)
    } catch (err) {
      console.error(err)
      setCamaraActiva(false)
      notificar('error', 'Error al solicitar permisos de cámara.', 'Cámara')
    }
  }

  const detenerCamara = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (err) {
        console.error('Error deteniendo cámara:', err)
      }
      scannerRef.current = null
    }
    setCamaraActiva(false)
  }

  const cancelarEdicionYReset = () => {
    resetFormularioProducto()
    setModoEscaneo('idle')
    setMensajeAlerta(null)
    setCantidadASumar('')
    if (inputSkuRef.current) {
      inputSkuRef.current.focus()
    }
  }

  // Filtrar productos para el autocompletado del nombre
  const productosFiltradosPorNombre = nombreProd && nombreProd.trim().length > 0 && productosInventario
    ? productosInventario.filter((p: any) => 
        p.name && p.name.toLowerCase().includes(nombreProd.trim().toLowerCase())
      ).slice(0, 5)
    : []

  const seleccionarProductoDeSugerencia = (prod: any) => {
    cargarProductoEnFormulario(prod)
    setModoEscaneo('actualizar')
    setMensajeAlerta(`Editando producto seleccionado: "${prod.name}".`)
    setMostrarSugerenciasNombre(false)
    if (inputStockRef.current) {
      inputStockRef.current.focus()
    }
  }

  return (
    <div className="space-y-6">
      {/* MODAL DEL ESCÁNER DE CÁMARA */}
      {camaraActiva && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-white text-lg flex items-center gap-2">
                <span>📷</span> Escanear Código para Producto
              </h3>
              <button
                onClick={detenerCamara}
                className="w-8 h-8 rounded-full bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Apuntá con la cámara al código de barras o QR del producto.
            </p>

            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video flex items-center justify-center">
              <div id="reader-container-inv" className="w-full h-full"></div>
            </div>

            <button
              onClick={detenerCamara}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
            >
              Cerrar Cámara
            </button>
          </div>
        </div>
      )}

      {/* FORMULARIO DE PRODUCTO CON FLUJO INTELIGENTE */}
      <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>✨</span>
              {productoAEditar ? 'Editar Producto Existente' : 'Cargar Nuevo Producto'}
            </h2>
            <p className="text-xs text-neutral-400">
              Buscá por nombre o escaneá el código para evitar duplicados y actualizar al instante.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={camaraActiva ? detenerCamara : iniciarCamara}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all border ${
                camaraActiva
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-200 border-white/10'
              }`}
              title="Atajo: Alt + C"
            >
              <span>📷</span>
              {camaraActiva ? 'Cerrar Cámara' : 'Escanear (Alt+C)'}
            </button>
          </div>
        </div>

        {/* ALERTA VISUAL DE MODO INTELIGENTE */}
        {mensajeAlerta && (
          <div
            className={`p-4 rounded-2xl border mb-5 text-sm flex items-center justify-between animate-fadeIn transition-all ${
              modoEscaneo === 'actualizar'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{modoEscaneo === 'actualizar' ? '🔄' : '✨'}</span>
              <div>
                <p className="font-black text-xs uppercase tracking-wider">
                  {modoEscaneo === 'actualizar' ? 'Modo Actualización de Producto' : 'Modo Creación de Producto'}
                </p>
                <p className="text-xs opacity-90">{mensajeAlerta}</p>
              </div>
            </div>
            <button
              onClick={() => setMensajeAlerta(null)}
              className="text-xs opacity-60 hover:opacity-100 font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* CÓDIGO DE BARRAS / SKU */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Código de Barras / SKU *
              </label>
              <span className="text-[10px] text-neutral-500">Enter para buscar</span>
            </div>
            <div className="flex gap-2">
              <input
                ref={inputSkuRef}
                type="text"
                placeholder="Escaneá o ingresá código..."
                value={codigoProd}
                onChange={(e) => setCodigoProd(e.target.value)}
                onKeyDown={handleKeyDownSku}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 font-mono"
              />
              <button
                type="button"
                onClick={generarCodigoAutomatico}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 rounded-xl text-xs font-bold transition-all shrink-0"
                title="Generar código automático"
              >
                🎲 Auto
              </button>
            </div>
          </div>

          {/* NOMBRE CON BUSCADOR / AUTOCOMPLETE INTEGRADO */}
          <div className="space-y-1 relative" ref={containerNombreRef}>
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Nombre del Producto *
              </label>
              <span className="text-[10px] text-violet-400 font-bold">Buscá para evitar duplicados</span>
            </div>
            <input
              ref={inputNombreRef}
              type="text"
              placeholder="Ej: Remera Lisa Oversize..."
              value={nombreProd}
              onChange={(e) => {
                setNombreProd(e.target.value)
                setMostrarSugerenciasNombre(true)
              }}
              onFocus={() => setMostrarSugerenciasNombre(true)}
              className="w-full bg-neutral-950 border border-violet-500/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-400 shadow-lg shadow-violet-950/20"
              required
            />

            {/* DROPDOWN DE SUGERENCIAS DE PRODUCTOS EXISTENTES */}
            {mostrarSugerenciasNombre && productosFiltradosPorNombre.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-neutral-900 border border-violet-500/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
                <div className="p-2.5 bg-violet-600/20 border-b border-white/10 text-[10px] font-black text-violet-300 uppercase tracking-wider flex items-center justify-between">
                  <span>⚡ Coincidencias en Inventario</span>
                  <span>Clic para editar</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
                  {productosFiltradosPorNombre.map((prod: any) => (
                    <div
                      key={prod.id}
                      onClick={() => seleccionarProductoDeSugerencia(prod)}
                      className="p-3 hover:bg-violet-600/10 cursor-pointer flex items-center justify-between transition-colors group"
                    >
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors">
                          {prod.name}
                        </p>
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          SKU: {prod.barcode || prod.sku || 'S/C'} • Stock: <span className="text-emerald-400 font-bold">{prod.stock} u.</span> • <span className="text-violet-400">${Number(prod.sale_price || 0).toLocaleString('es-AR')}</span>
                        </p>
                      </div>
                      <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2.5 py-1 rounded-lg font-black tracking-wide">
                        Editar ✏️
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PRECIO DE VENTA */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Precio de Venta ($) *
            </label>
            <input
              ref={inputPrecioRef}
              type="number"
              step="any"
              placeholder="0.00"
              value={precioProd}
              onChange={(e) => setPrecioProd(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-violet-500"
              required
            />
          </div>

          {/* COSTO DE COMPRA */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Costo de Compra ($)
            </label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={costoProd}
              onChange={(e) => setCostoProd(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* STOCK ACTUAL + SUMADOR RÁPIDO */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Stock Actual
              </label>
              {modoEscaneo === 'actualizar' && (
                <span className="text-[10px] text-emerald-400 font-bold">Sumar stock</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={inputStockRef}
                type="number"
                placeholder="0"
                value={stockProd}
                onChange={(e) => setStockProd(e.target.value)}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-violet-500"
              />
              {modoEscaneo === 'actualizar' && (
                <div className="flex gap-1 shrink-0">
                  <input
                    type="number"
                    placeholder="+cant"
                    value={cantidadASumar}
                    onChange={(e) => setCantidadASumar(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        aplicarSumaStock()
                      }
                    }}
                    className="w-16 bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-2 py-1 text-xs text-emerald-300 font-bold text-center focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={aplicarSumaStock}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* STOCK MÍNIMO */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Stock Mínimo (Alerta)
            </label>
            <input
              type="number"
              placeholder="0"
              value={minStockProd}
              onChange={(e) => setMinStockProd(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* PROVEEDOR */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Proveedor
            </label>
            <input
              type="text"
              placeholder="Ej: Distribuidora Norte..."
              value={proveedorProd}
              onChange={(e) => setProveedorProd(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* CATEGORÍA */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Categoría
            </label>
            <select
              value={categoriaProd}
              onChange={(e) => setCategoriaProd(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="GENERAL">General</option>
              {categoriasDB &&
                categoriasDB.map((cat: any) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>

          {/* NUEVA CATEGORÍA RÁPIDA */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Nueva Categoría Rápida
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Crear categoría..."
                value={categoriaNuevaInput}
                onChange={(e) => setCategoriaNuevaInput(e.target.value)}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={crearCategoriaRapida}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 rounded-xl text-xs font-bold transition-all shrink-0"
              >
                + Crear
              </button>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="md:col-span-3 flex justify-end items-center gap-3 pt-2">
            {productoAEditar && (
              <button
                type="button"
                onClick={cancelarEdicionYReset}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 text-xs font-bold transition-all"
              >
                Cancelar Edición
              </button>
            )}

            <button
              type="submit"
              disabled={guardandoProducto}
              className="px-8 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-black text-xs rounded-xl shadow-lg shadow-violet-900/40 transition-all disabled:opacity-50"
            >
              {guardandoProducto
                ? 'Guardando...'
                : productoAEditar
                ? 'Actualizar Producto'
                : 'Guardar Producto'}
            </button>
          </div>
        </form>
      </div>

      {/* LISTADO DE ARTÍCULOS */}
      <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>📋</span> Listado de Artículos
            </h3>
            <p className="text-xs text-neutral-400">
              Podés editar stock o precio directamente haciendo clic en los valores.
            </p>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="🔍 Buscar en inventario..."
              value={busquedaInventario}
              onChange={(e) => setBusquedaInventario(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {productosInventario && productosInventario.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-xs">
            No se encontraron productos en el inventario.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/5 text-[10px] text-neutral-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3">Proveedor</th>
                  <th className="py-3 px-3">Costo</th>
                  <th className="py-3 px-3">Precio</th>
                  <th className="py-3 px-3">Stock</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {productosInventario &&
                  productosInventario.map((p: any) => {
                    const esBajo = p.min_stock && p.stock <= p.min_stock
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 font-mono text-neutral-400">
                          {p.barcode || p.sku || '-'}
                        </td>
                        <td className="py-3 px-3 font-bold text-white">{p.name}</td>
                        <td className="py-3 px-3 text-neutral-400">
                          {p.product_categories?.name || p.category || 'General'}
                        </td>
                        <td className="py-3 px-3 text-neutral-400">{p.supplier || '-'}</td>
                        <td className="py-3 px-3 text-neutral-400">
                          ${Number(p.cost_price || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-400">
                          ${Number(p.sale_price || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              esBajo
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-neutral-800 text-neutral-200'
                            }`}
                          >
                            {p.stock} u.
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => abrirEtiqueta && abrirEtiqueta(p)}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-lg text-[10px] font-bold border border-white/5 transition-all"
                            title="Imprimir Código de Barras"
                          >
                            🏷️ Etiqueta
                          </button>
                          <button
                            type="button"
                            onClick={() => cargarProductoEnFormulario(p)}
                            className="px-2.5 py-1 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 rounded-lg text-[10px] font-bold border border-violet-500/20 transition-all"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!eliminarProducto) return
                              const ok = await confirmar(`¿Seguro que deseás eliminar "${p.name}"?`, {
                                titulo: 'Eliminar producto',
                                peligro: true,
                                textoConfirmar: 'Sí, eliminar'
                              })
                              if (ok) eliminarProducto(p.id)
                            }}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-[10px] font-bold border border-rose-500/20 transition-all"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}