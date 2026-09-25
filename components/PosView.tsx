'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useNegocio } from '@/context/NegocioContext'
import { Html5Qrcode } from 'html5-qrcode'

export default function PosView({ 
  turnoAbierto, 
  onVentaCompletada, 
  cambiarAInventario 
}: { 
  turnoAbierto: any; 
  onVentaCompletada: Function; 
  cambiarAInventario?: (codigoSugerido?: string) => void 
}) {
  const { negocioActual } = useNegocio()
  const [productos, setProductos] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<any[]>([])
  const [procesando, setProcesando] = useState(false)
  
  // Modificaciones para Descuentos, Recargos y Pagos Mixtos
  const [tipoDescuento, setTipoDescuento] = useState<'monto' | 'porcentaje'>('porcentaje')
  const [valorDescuento, setValorDescuento] = useState<number>(0)
  
  // Estado para alertas personalizadas en pantalla (reemplaza alert nativo)
  const [mensajeAlerta, setMensajeAlerta] = useState<string | null>(null)
  
  // Lista de pagos parciales/múltiples
  const [pagosParciales, setPagosParciales] = useState<Array<{ metodo: string; monto: number }>>([
    { metodo: 'efectivo', monto: 0 }
  ])

  // Estado para el ticket de la última venta realizada (para imprimir)
  const [ultimaVenta, setUltimaVenta] = useState<any | null>(null)
  const [mostrarModalTicket, setMostrarModalTicket] = useState(false)

  // Estado para alertar producto no encontrado
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string | null>(null)

  // Estados para la cámara
  const [camaraActiva, setCamaraActiva] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (negocioActual?.id) {
      cargarProductosPos()
    }
    return () => {
      detenerCamara()
    }
  }, [negocioActual?.id])

  const mostrarAvisoTemporal = (msg: string) => {
    setMensajeAlerta(msg)
    setTimeout(() => {
      setMensajeAlerta(null)
    }, 3500)
  }

  const cargarProductosPos = async () => {
    if (!negocioActual?.id) return
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('negocio_id', negocioActual.id)
      .eq('active', true)
      .order('name')

    if (!error && data) {
      const formateados = data.map((p: any) => ({
        id: p.id,
        nombre: p.name,
        precio: Number(p.sale_price ?? p.price ?? 0),
        stock: Number(p.stock || 0),
        codigo: p.barcode || p.sku || '',
      }))
      setProductos(formateados)
    }
  }

  const verificarYProcesarCodigo = (codigoBuscado: string) => {
    const query = codigoBuscado.trim()
    if (!query) return

    const productoMatch = productos.find(p => p.codigo.trim().toLowerCase() === query.toLowerCase())
    
    if (productoMatch) {
      setCodigoNoEncontrado(null)
      agregarAlCarrito(productoMatch)
    } else {
      const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(query.toLowerCase()) || 
        (p.codigo && p.codigo.toLowerCase().includes(query.toLowerCase()))
      )

      if (filtrados.length === 0) {
        setCodigoNoEncontrado(query)
      }
    }
  }

  const iniciarCamara = async () => {
    setCamaraActiva(true)
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('reader-container')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 140 },
          },
          (decodedText) => {
            setBusqueda(decodedText)
            detenerCamara()
            verificarYProcesarCodigo(decodedText)
          },
          () => {}
        )
      } catch (err) {
        console.error('Error al iniciar el escáner:', err)
        mostrarAvisoTemporal('No se pudo acceder a la cámara.')
        setCamaraActiva(false)
      }
    }, 150)
  }

  const detenerCamara = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (e) {
        console.error('Error al detener la cámara:', e)
      }
      scannerRef.current = null
    }
    setCamaraActiva(false)
  }

  const productosFiltrados = productos.filter((p) => {
    const query = busqueda.toLowerCase().trim()
    if (!query) return false
    const coincideNombre = p.nombre.toLowerCase().includes(query)
    const coincideCodigo = p.codigo && p.codigo.toLowerCase().includes(query)
    return coincideNombre || coincideCodigo
  })

  const agregarAlCarrito = (producto: any) => {
    if (producto.stock <= 0) {
      mostrarAvisoTemporal('⚠️ Este producto no tiene stock disponible.')
      return
    }
    setCarrito((prev) => {
      const index = prev.findIndex((item) => item.id === producto.id)
      if (index >= 0) {
        const nuevo = [...prev]
        if (nuevo[index].cantidad + 1 > producto.stock) {
          mostrarAvisoTemporal('No podés agregar más cantidad que el stock disponible.')
          return prev
        }
        nuevo[index].cantidad += 1
        return nuevo
      } else {
        return [...prev, { ...producto, cantidad: 1 }]
      }
    })
    setBusqueda('')
    setCodigoNoEncontrado(null)
  }

  const cambiarCantidadItem = (id: string, delta: number) => {
    setCarrito((prev) => {
      return prev
        .map((item) => {
          if (item.id === id) {
            const nuevaCantidad = item.cantidad + delta
            if (nuevaCantidad <= 0) return null
            return { ...item, cantidad: nuevaCantidad }
          }
          return item
        })
        .filter(Boolean)
    })
  }

  const subtotalCarrito = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0)

  const montoDescuento = tipoDescuento === 'porcentaje' 
    ? (subtotalCarrito * (valorDescuento || 0)) / 100 
    : (valorDescuento || 0)

  const totalConDescuento = Math.max(0, subtotalCarrito - montoDescuento)

  const calcularRecargoMetodo = (metodo: string, montoBase: number) => {
    if (metodo === 'tarjeta_debito' || metodo === 'debito') return montoBase * 0.02; 
    if (metodo === 'tarjeta_credito' || metodo === 'credito') return montoBase * 0.06; 
    return 0;
  }

  const totalFinalConRecargos = pagosParciales.reduce((acc, p) => {
    const recargo = calcularRecargoMetodo(p.metodo, p.monto);
    return acc + p.monto + recargo;
  }, 0);

  const totalSumaPagos = pagosParciales.reduce((acc, p) => acc + p.monto, 0)
  const restaParaCompletar = totalConDescuento - totalSumaPagos

  useEffect(() => {
    if (pagosParciales.length === 1) {
      setPagosParciales([{ ...pagosParciales[0], monto: totalConDescuento }])
    }
  }, [totalConDescuento])

  const agregarFilaPago = () => {
    const pendiente = Math.max(0, totalConDescuento - totalSumaPagos)
    setPagosParciales([...pagosParciales, { metodo: 'efectivo', monto: pendiente }])
  }

  const actualizarFilaPago = (index: number, campo: 'metodo' | 'monto', valor: any) => {
    const nuevos = [...pagosParciales]
    if (campo === 'monto') {
      nuevos[index].monto = Number(valor) || 0
    } else {
      nuevos[index].metodo = valor
    }
    setPagosParciales(nuevos)
  }

  const eliminarFilaPago = (index: number) => {
    if (pagosParciales.length === 1) return
    setPagosParciales(pagosParciales.filter((_, i) => i !== index))
  }

  const imprimirTicketImpresora = () => {
    window.print()
  }

  const finalizarVenta = async () => {
    if (carrito.length === 0) return
    if (!turnoAbierto?.id) {
      mostrarAvisoTemporal('No hay un turno de caja abierto.')
      return
    }

    if (Math.abs(totalSumaPagos - totalConDescuento) > 1) {
      mostrarAvisoTemporal('⚠️ La suma de los pagos parciales no coincide con el total de la venta.')
      return
    }

    setProcesando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        mostrarAvisoTemporal('No hay una sesión de usuario activa.')
        setProcesando(false)
        return
      }

      let nombreNegocioTicket = 'Comercio'
      const { data: negocioData } = await supabase
        .from('negocios')
        .select('*')
        .eq(negocioActual?.id ? 'id' : 'user_id', negocioActual?.id || user.id)

      if (negocioData && negocioData.length > 0) {
        const n = negocioData[0]
        nombreNegocioTicket = n.name || n.nombre || n.nombre_negocio || n.title || 'Comercio'
      }

      const negocioIdParaVenta = negocioActual?.id || (negocioData && negocioData.length > 0 ? negocioData[0].id : null)

      const { data: ventaData, error: ventaError } = await supabase
        .from('sales')
        .insert({
          negocio_id: negocioIdParaVenta,
          shift_id: turnoAbierto.id,
          user_id: user.id,
          total: totalFinalConRecargos,
          subtotal: subtotalCarrito,
          discount: montoDescuento,
          status: 'completada', 
        })
        .select()
        .single()

      if (ventaError) throw ventaError
      const ventaId = ventaData.id

      const itemsParaGuardar = []
      for (const item of carrito) {
        await supabase.from('sale_items').insert({
          sale_id: ventaId,
          product_id: item.id,
          quantity: item.cantidad,
          unit_price: item.precio,
          subtotal: item.precio * item.cantidad,
        })
        itemsParaGuardar.push(item)

        const prodOriginal = productos.find((p) => p.id === item.id)
        if (prodOriginal) {
          const nuevoStock = Math.max(0, prodOriginal.stock - item.cantidad)
          await supabase
            .from('products')
            .update({ stock: nuevoStock })
            .eq('id', item.id)
        }
      }

      const pagosParaGuardar = []
      for (const pagoItem of pagosParciales) {
        const recargoItem = calcularRecargoMetodo(pagoItem.metodo, pagoItem.monto);
        await supabase.from('sale_payments').insert({
          sale_id: ventaId,
          method: pagoItem.metodo,
          amount: pagoItem.monto + recargoItem,
        })
        pagosParaGuardar.push({ ...pagoItem, montoFinal: pagoItem.monto + recargoItem })
      }

      setUltimaVenta({
        id: ventaId,
        fecha: new Date().toLocaleString(),
        negocio: nombreNegocioTicket,
        items: itemsParaGuardar,
        subtotal: subtotalCarrito,
        descuento: montoDescuento,
        total: totalFinalConRecargos,
        pagos: pagosParaGuardar
      })
      setMostrarModalTicket(true)

      setCarrito([])
      setBusqueda('')
      setValorDescuento(0)
      setPagosParciales([{ metodo: 'efectivo', monto: 0 }])
      cargarProductosPos()
      onVentaCompletada()
    } catch (err: any) {
      mostrarAvisoTemporal(`Error al procesar la venta: ${err.message}`)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="space-y-4 relative">
      {/* Notificación flotante estética en lugar de alert nativo */}
      {mensajeAlerta && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-neutral-900 border border-purple-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-base">🔔</span>
          <p className="text-xs font-bold">{mensajeAlerta}</p>
        </div>
      )}

      {/* Modal para Imprimir Ticket */}
      {mostrarModalTicket && ultimaVenta && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-purple-500/40 p-6 rounded-3xl flex flex-col items-center relative shadow-2xl w-full max-w-sm">
            <h3 className="text-base font-black text-white mb-1">¡Venta Exitosa! 🎉</h3>
            <p className="text-xs text-neutral-400 mb-4">¿Deseás imprimir el comprobante?</p>

            <div id="ticket-impresion" className="w-full bg-white text-black p-4 rounded-xl font-mono text-xs space-y-2 shadow-inner">
              <div className="text-center font-bold border-b border-dashed border-neutral-400 pb-2">
                <p className="text-sm uppercase">{ultimaVenta.negocio}</p>
                <p className="text-[10px] text-neutral-600">Ticket de Venta</p>
                <p className="text-[9px] text-neutral-500">{ultimaVenta.fecha}</p>
              </div>

              <div className="space-y-1 py-2 border-b border-dashed border-neutral-400">
                {ultimaVenta.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.cantidad}x {item.nombre}</span>
                    <span>${(item.precio * item.cantidad).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 py-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${ultimaVenta.subtotal.toLocaleString()}</span>
                </div>
                {ultimaVenta.descuento > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento:</span>
                    <span>-${ultimaVenta.descuento.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-neutral-300">
                  <span>TOTAL:</span>
                  <span>${ultimaVenta.total.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-neutral-400 text-[10px] text-neutral-600">
                <p className="font-bold">Pagos:</p>
                {ultimaVenta.pagos.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="capitalize">{p.metodo.replace('_', ' ')}:</span>
                    <span>${p.montoFinal.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="text-center pt-3 text-[10px] text-neutral-500">
                ¡Gracias por su compra!
              </div>
            </div>

            <div className="flex gap-2 w-full mt-5">
              <button
                onClick={imprimirTicketImpresora}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-2xl text-xs transition shadow-lg cursor-pointer"
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => setMostrarModalTicket(false)}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-2xl text-xs transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Visor de la Cámara */}
      {camaraActiva && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-purple-500/40 p-6 rounded-3xl flex flex-col items-center relative shadow-2xl w-full max-w-md">
            <h3 className="text-sm font-black text-white mb-1">Escanear para Venta (POS)</h3>
            <p className="text-xs text-purple-300 font-medium mb-4 text-center">Apunta la cámara hacia el código de barras.</p>
            
            <div id="reader-container" className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black"></div>

            <button 
              onClick={detenerCamara}
              className="mt-5 w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-2xl text-xs transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel Izquierdo: Buscador y Grilla */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setCodigoNoEncontrado(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  verificarYProcesarCodigo(busqueda)
                }
              }}
              placeholder="🔍 Escribí el nombre o escaneá un código..."
              className="w-full bg-neutral-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:border-purple-500 outline-none font-mono"
            />
            <button
              onClick={iniciarCamara}
              className="bg-purple-600 hover:bg-purple-500 text-white px-5 rounded-2xl text-xs font-black shadow-lg shadow-purple-900/30 transition flex items-center gap-2 cursor-pointer shrink-0"
              title="Abrir Cámara para escanear"
            >
              📷 Escanear
            </button>
            <button
              onClick={cargarProductosPos}
              className="bg-white/5 hover:bg-white/10 text-neutral-300 px-4 rounded-2xl text-xs font-bold border border-white/10 shrink-0"
              title="Recargar productos"
            >
              🔄
            </button>
          </div>

          {codigoNoEncontrado && (
            <div className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
              <div>
                <p className="text-xs font-bold text-amber-200">⚠️ Producto no encontrado</p>
                <p className="text-[11px] text-neutral-400 font-mono mt-0.5">Código escaneado: {codigoNoEncontrado}</p>
              </div>
              {cambiarAInventario && (
                <button
                  onClick={() => cambiarAInventario(codigoNoEncontrado)}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md whitespace-nowrap cursor-pointer"
                >
                  ➕ Cargar en Inventario
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1">
            {busqueda.trim() !== '' && productosFiltrados.map((p) => (
              <div
                key={p.id}
                onClick={() => agregarAlCarrito(p)}
                className="bg-neutral-900/70 border border-white/10 hover:border-purple-500/50 p-4 rounded-2xl flex flex-col justify-between cursor-pointer transition transform active:scale-95 shadow-md backdrop-blur-md"
              >
                <div>
                  <p className="font-bold text-white text-sm line-clamp-2">{p.nombre}</p>
                  <p className="text-[11px] text-neutral-400 font-mono mt-1">{p.codigo || 'Sin código'}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-emerald-400 font-black text-base">${p.precio.toLocaleString()}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.stock > 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    Stock: {p.stock}
                  </span>
                </div>
              </div>
            ))}

            {busqueda.trim() === '' && (
              <div className="col-span-full py-16 text-center text-neutral-500 text-sm bg-neutral-900/30 rounded-3xl border border-white/5">
                ⌨️ Escribí en el buscador o usá el botón de la cámara para encontrar productos.
              </div>
            )}

            {busqueda.trim() !== '' && productosFiltrados.length === 0 && !codigoNoEncontrado && (
              <div className="col-span-full py-12 text-center text-neutral-500 text-sm bg-neutral-900/30 rounded-3xl border border-white/5">
                No se encontraron productos que coincidan con &quot;{busqueda}&quot;.
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho: Carrito y Pagos */}
        <div className="bg-neutral-900/80 border border-white/10 rounded-3xl p-5 flex flex-col justify-between backdrop-blur-xl shadow-2xl">
          <div>
            <h3 className="text-lg font-black text-white border-b border-white/10 pb-3 mb-3">🛒 Ticket Actual</h3>
            <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
              {carrito.map((item) => (
                <div key={item.id} className="bg-neutral-950/60 p-3 rounded-2xl border border-white/5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-xs truncate">{item.nombre}</p>
                    <p className="text-xs text-emerald-400 font-bold">${(item.precio * item.cantidad).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => cambiarCantidadItem(item.id, -1)} className="w-7 h-7 bg-white/10 rounded-xl font-bold text-white flex items-center justify-center">-</button>
                    <span className="text-xs font-bold w-5 text-center">{item.cantidad}</span>
                    <button onClick={() => cambiarCantidadItem(item.id, 1)} className="w-7 h-7 bg-white/10 rounded-xl font-bold text-white flex items-center justify-center">+</button>
                  </div>
                </div>
              ))}
              {carrito.length === 0 && (
                <p className="text-neutral-500 text-xs text-center py-8">El carrito está vacío.</p>
              )}
            </div>

            {/* SECCIÓN DESCUENTOS */}
            {carrito.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-400">
                  <span>Descuento:</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => setTipoDescuento('porcentaje')} 
                      className={`px-2 py-0.5 rounded ${tipoDescuento === 'porcentaje' ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      %
                    </button>
                    <button 
                      onClick={() => setTipoDescuento('monto')} 
                      className={`px-2 py-0.5 rounded ${tipoDescuento === 'monto' ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      $
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={valorDescuento || ''}
                  onChange={(e) => setValorDescuento(Number(e.target.value))}
                  placeholder={tipoDescuento === 'porcentaje' ? 'Ej. 10 (%)' : 'Ej. 500 ($)'}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs"
                />
              </div>
            )}

            {/* SECCIÓN PAGOS PARCIALES */}
            {carrito.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-400">
                  <span>Medios de Pago (Mixto):</span>
                  <button onClick={agregarFilaPago} className="text-purple-400 hover:text-purple-300 text-[11px]">
                    + Agregar otro medio
                  </button>
                </div>

                <div className="space-y-2 max-h-[22vh] overflow-y-auto pr-1">
                  {pagosParciales.map((pago, index) => {
                    return (
                      <div key={index} className="flex items-center gap-2 bg-neutral-950/40 p-2 rounded-xl border border-white/5">
                        <select
                          value={pago.metodo}
                          onChange={(e) => actualizarFilaPago(index, 'metodo', e.target.value)}
                          className="bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-white text-[11px] font-bold w-36"
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta_debito">Débito (+2%)</option>
                          <option value="tarjeta_credito">Crédito (+6%)</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="qr">QR</option>
                        </select>

                        <input
                          type="number"
                          value={pago.monto || ''}
                          onChange={(e) => actualizarFilaPago(index, 'monto', e.target.value)}
                          className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-mono"
                          placeholder="Monto"
                        />

                        {pagosParciales.length > 1 && (
                          <button 
                            onClick={() => eliminarFilaPago(index)}
                            className="text-rose-400 hover:text-rose-300 text-xs px-1 font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {Math.abs(restaParaCompletar) > 1 && (
                  <p className="text-[10px] text-amber-400 font-medium">
                    ⚠️ Restan cubrir: ${restaParaCompletar.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
            <div className="flex justify-between items-center text-sm text-neutral-300">
              <span>Subtotal:</span>
              <span>${subtotalCarrito.toLocaleString()}</span>
            </div>
            {montoDescuento > 0 && (
              <div className="flex justify-between items-center text-sm text-rose-400">
                <span>Descuento:</span>
                <span>-${montoDescuento.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-black text-white">
              <span>Total Final:</span>
              <span className="text-emerald-400">${totalFinalConRecargos.toLocaleString()}</span>
            </div>

            <button
              onClick={finalizarVenta}
              disabled={carrito.length === 0 || procesando || Math.abs(restaParaCompletar) > 1}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-emerald-900/30 transition transform active:scale-95 text-sm cursor-pointer"
            >
              {procesando ? 'Procesando...' : '💰 Cobrar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}