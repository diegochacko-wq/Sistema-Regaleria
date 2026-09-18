'use client'

import ModuloDeudas from '../components/ModuloDeudas'
import ModuloSenas from '../components/ModuloSenas'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import jsQR from 'jsqr'
import JsBarcode from 'jsbarcode'

export default function POS() {
  // Estado para la navegación entre pestañas ('pos', 'deudas', 'senas')
  const [vistaActiva, setVistaActiva] = useState<'pos' | 'deudas' | 'senas'>('pos')
  const [montado, setMontado] = useState(false)
  const [productos, setProductos] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('TODAS')
  const [carrito, setCarrito] = useState<any[]>([])
  const [procesandoVenta, setProcesandoVenta] = useState(false)

  // Estados de Caja y Turnos
  const [turnoAbierto, setTurnoAbierto] = useState<any>(null)
  const [montoInicialInput, setMontoInicialInput] = useState('')
  const [cargandoTurno, setCargandoTurno] = useState(true)
  const [vistaActual, setVistaActual] = useState<'pos' | 'inventario' | 'gastos' | 'proveedores' | 'arqueo' | 'dashboard' | 'deudas' | 'senas'>('pos')

  // Datos para Dashboard y Gastos
  const [ventasHistoricas, setVentasHistoricas] = useState<any[]>([])
  const [gastosHistoricos, setGastosHistoricos] = useState<any[]>([])

  // Estados para nuevo producto / carga
  const [nombreProd, setNombreProd] = useState('')
  const [precioProd, setPrecioProd] = useState('')
  const [costoProd, setCostoProd] = useState('')
  const [stockProd, setStockProd] = useState('')
  const [codigoProd, setCodigoProd] = useState('')
  const [categoriaProd, setCategoriaProd] = useState('General')
  const [proveedorProd, setProveedorProd] = useState('')

  // Estado para buscador rápido de actualización en inventario
  const [busquedaActualizacion, setBusquedaActualizacion] = useState('')
  const [productoAEditar, setProductoAEditar] = useState<any | null>(null)

  // Estado para escáner rápido en inventario
  const [busquedaInventario, setBusquedaInventario] = useState('')

  // Estados para nuevo gasto
  const [descGasto, setDescGasto] = useState('')
  const [montoGasto, setMontoGasto] = useState('')
  const [categoriaGasto, setCategoriaGasto] = useState('General')

  // Estado para el panel de pagos múltiples (Split Payment)
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  const [pagosParciales, setPagosParciales] = useState<{ metodo: string; monto: number }[]>([])
  const [metodoSeleccionado, setMetodoSeleccionado] = useState('Efectivo')
  const [montoIngresado, setMontoIngresado] = useState('')

  // Estado para el ticket impreso de venta
  const [ultimoTicket, setUltimoTicket] = useState<{
    productos: any[]
    total: number
    pagos: { metodo: string; monto: number }[]
    fecha: string
  } | null>(null)

  // Estado para etiqueta individual a imprimir
  const [etiquetaSeleccionada, setEtiquetaSeleccionada] = useState<any | null>(null)
  const barcodeRef = useRef<SVGSVGElement | null>(null)

  // Referencias para inputs de cámara
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputInventarioRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setMontado(true)
    fetchProductos()
    verificarTurnoActivo()
    fetchVentasHistoricas()
    fetchGastosHistoricos()
  }, [])

  useEffect(() => {
    if (etiquetaSeleccionada && barcodeRef.current && etiquetaSeleccionada.codigo_barras) {
      try {
        JsBarcode(barcodeRef.current, etiquetaSeleccionada.codigo_barras, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true
        })
      } catch (e) {
        console.error('Error al generar código de barras:', e)
      }
    }
  }, [etiquetaSeleccionada])

  async function fetchProductos() {
    const { data, error } = await supabase.from('productos').select('*').order('nombre', { ascending: true })
    if (error) console.error('Error al cargar productos:', error.message)
    else setProductos(data || [])
  }

  async function verificarTurnoActivo() {
    setCargandoTurno(true)
    const { data } = await supabase
      .from('turnos_caja')
      .select('*')
      .eq('estado', 'ABIERTO')
      .order('fecha_apertura', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      setTurnoAbierto(data)
    } else {
      setTurnoAbierto(null)
    }
    setCargandoTurno(false)
  }

  async function fetchVentasHistoricas() {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false })

    if (!error) setVentasHistoricas(data || [])
  }

  async function fetchGastosHistoricos() {
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false })

    if (!error) setGastosHistoricos(data || [])
  }

  const generarCodigoAleatorio = () => {
    const codigoAleatorio = Math.floor(100000000000 + Math.random() * 900000000000).toString()
    setCodigoProd(codigoAleatorio)
  }

  const procesarCodigoInventario = (codigo: string) => {
    const codigoLimpiado = codigo.trim()
    const prodExistente = productos.find(p => p.codigo_barras === codigoLimpiado)

    if (prodExistente) {
      setCodigoProd(prodExistente.codigo_barras)
      setNombreProd(prodExistente.nombre)
      setPrecioProd(prodExistente.precio.toString())
      setCostoProd((prodExistente.precio_costo ?? '').toString()) // [Corregido TS2345]
      setStockProd(prodExistente.stock.toString())
      setCategoriaProd(prodExistente.categoria || 'General')
      setProveedorProd(prodExistente.proveedor || 'General')
      alert(`📦 Producto encontrado: "${prodExistente.nombre}". Los datos se cargaron en el formulario para actualizar o sumar stock.`)
    } else {
      setCodigoProd(codigoLimpiado)
      alert(`✨ Código nuevo detectado (${codigoLimpiado}). Completa los datos para darlo de alta.`)
    }
    setBusquedaInventario('')
  }

  const seleccionarProductoParaEditarDirecto = (prod: any) => {
    setProductoAEditar(prod)
    setNombreProd(prod.nombre)
    setPrecioProd(prod.precio.toString())
    setCostoProd((prod.precio_costo ?? '').toString()) // [Corregido TS2345]
    setStockProd(prod.stock.toString())
    setCodigoProd(prod.codigo_barras || '')
    setCategoriaProd(prod.categoria || 'General')
    setProveedorProd(prod.proveedor || 'General')
    setBusquedaActualizacion('')
  }

  const guardarEdicionDirecta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productoAEditar) return
    if (!nombreProd.trim() || !precioProd || stockProd === '') {
      return alert('Por favor completa el nombre, precio y stock.')
    }

    const { error } = await supabase
      .from('productos')
      .update({
        nombre: nombreProd.trim(),
        precio: parseFloat(precioProd),
        precio_costo: costoProd ? parseFloat(costoProd) : 0,
        stock: parseInt(stockProd),
        codigo_barras: codigoProd.trim() || productoAEditar.codigo_barras,
        categoria: categoriaProd,
        proveedor: proveedorProd.trim() || 'General'
      })
      .eq('id', productoAEditar.id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      alert('¡Producto actualizado con éxito!')
      setProductoAEditar(null)
      limpiarFormularioProducto()
      fetchProductos()
    }
  }

  const manejarImagenInventario = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = img.width
        canvas.height = img.height
        context.drawImage(img, 0, 0, img.width, img.height)

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code) {
          procesarCodigoInventario(code.data)
        } else {
          alert('No se pudo detectar ningún código de barras en la imagen.')
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombreProd.trim() || !precioProd || !stockProd) {
      return alert('Por favor completa el nombre, precio de venta y stock.')
    }

    const codigoFinal = codigoProd.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString()
    const prodConMismoCodigo = productos.find(p => p.codigo_barras === codigoFinal)

    if (prodConMismoCodigo) {
      const stockNuevoSumado = prodConMismoCodigo.stock + parseInt(stockProd)
      const { error } = await supabase
        .from('productos')
        .update({
          nombre: nombreProd.trim(),
          precio: parseFloat(precioProd),
          precio_costo: costoProd ? parseFloat(costoProd) : 0,
          stock: stockNuevoSumado,
          categoria: categoriaProd,
          proveedor: proveedorProd.trim() || 'General'
        })
        .eq('id', prodConMismoCodigo.id)

      if (error) {
        alert('Error al actualizar producto: ' + error.message)
      } else {
        alert(`¡El producto con código ${codigoFinal} ya existía! Se actualizó su información y se sumaron ${stockProd} unidades al stock (Total: ${stockNuevoSumado}).`)
        limpiarFormularioProducto()
        fetchProductos()
      }
    } else {
      const { error } = await supabase
        .from('productos')
        .insert([{
          nombre: nombreProd.trim(),
          precio: parseFloat(precioProd),
          precio_costo: costoProd ? parseFloat(costoProd) : 0,
          stock: parseInt(stockProd),
          codigo_barras: codigoFinal,
          categoria: categoriaProd,
          proveedor: proveedorProd.trim() || 'General'
        }])

      if (error) {
        alert('Error al guardar producto: ' + error.message)
      } else {
        alert('¡Producto cargado con éxito!')
        limpiarFormularioProducto()
        fetchProductos()
      }
    }
  }

  const limpiarFormularioProducto = () => {
    setNombreProd('')
    setPrecioProd('')
    setCostoProd('')
    setStockProd('')
    setCodigoProd('')
    setProveedorProd('')
    setCategoriaProd('General')
    setProductoAEditar(null)
  }

  const actualizarStockRapido = async (id: string, stockActual: number, cambio: number) => {
    const nuevoStock = stockActual + cambio
    if (nuevoStock < 0) return alert('El stock no puede ser menor a 0')

    const { error } = await supabase
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('id', id)

    if (error) {
      alert('Error al actualizar stock: ' + error.message)
    } else {
      fetchProductos()
    }
  }

  const abrirCaja = async () => {
    const monto = parseFloat(montoInicialInput)
    if (isNaN(monto) || monto < 0) return alert('Ingresa un monto inicial válido')

    const { data, error } = await supabase
      .from('turnos_caja')
      .insert([{ monto_inicial: monto, estado: 'ABIERTO' }])
      .select()
      .single()

    if (error) {
      alert('Error al abrir la caja: ' + error.message)
    } else {
      setTurnoAbierto(data)
      setMontoInicialInput('')
      alert('¡Caja abierta con éxito!')
    }
  }

  const cerrarCajaTurno = async () => {
    if (!turnoAbierto) return // [Guard TS18047]
    if (!confirm('¿Estás seguro de realizar el arqueo y cerrar la caja de este turno?')) return

    const ventasDelTurno = ventasHistoricas.filter(v => v.turno_id === turnoAbierto.id)
    let efectivoTotalTurno = 0
    let otrosTotalTurno = 0

    ventasDelTurno.forEach(v => {
      v.pagos.forEach((p: any) => {
        if (p.metodo === 'Efectivo') {
          efectivoTotalTurno += p.monto
        } else {
          otrosTotalTurno += p.monto
        }
      })
    })

    const montoFinalEsperadoInCash = turnoAbierto.monto_inicial + efectivoTotalTurno

    const { error } = await supabase
      .from('turnos_caja')
      .update({
        estado: 'CERRADO',
        monto_final: montoFinalEsperadoInCash,
        total_ventas_efectivo: efectivoTotalTurno,
        total_ventas_otros: otrosTotalTurno,
        fecha_cierre: new Date().toISOString()
      })
      .eq('id', turnoAbierto.id)

    if (error) {
      alert('Error al cerrar caja: ' + error.message)
    } else {
      alert(`Turno cerrado correctamente.\nEfectivo esperado en caja: $${montoFinalEsperadoInCash}`)
      setTurnoAbierto(null)
      fetchVentasHistoricas()
    }
  }

  const registrarGasto = async (e: React.FormEvent) => {
    e.preventDefault()
    const monto = parseFloat(montoGasto)
    if (!descGasto.trim() || isNaN(monto) || monto <= 0) {
      return alert('Por favor, completa una descripción y un monto válido.')
    }

    const { error } = await supabase
      .from('gastos')
      .insert([{ descripcion: descGasto, monto, categoria: categoriaGasto }])

    if (error) {
      alert('Error al registrar gasto: ' + error.message)
    } else {
      alert('¡Gasto registrado con éxito!')
      setDescGasto('')
      setMontoGasto('')
      setCategoriaGasto('General')
      fetchGastosHistoricos()
    }
  }

  const procesarCodigoDetectadoPOS = (codigo: string) => {
    const codigoLimpiado = codigo.trim()
    const productoEncontrado = productos.find(p => p.codigo_barras === codigoLimpiado)
    
    if (productoEncontrado) {
      agregarAlCarrito(productoEncontrado)
      setBusqueda('')
      return true
    } else {
      alert(`No se encontró ningún producto con el código: ${codigoLimpiado}`)
      return false
    }
  }

  const manejarImagenPOS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = img.width
        canvas.height = img.height
        context.drawImage(img, 0, 0, img.width, img.height)

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code) {
          procesarCodigoDetectadoPOS(code.data)
        } else {
          alert('No se pudo detectar ningún código de barras en la imagen.')
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  if (!montado) return null

  const categoriasDisponibles = ['TODAS', ...Array.from(new Set(productos.map(p => p.categoria || 'General')))]

  const productosFiltrados = productos.filter((p: any) => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.codigo_barras && p.codigo_barras.includes(busqueda))
    const coincideCategoria = categoriaSeleccionada === 'TODAS' || (p.categoria || 'General') === categoriaSeleccionada
    return coincideBusqueda && coincideCategoria
  })

  // Resultados para el Buscador de Actualización en Inventario
  const productosSugeridosActualizar = busquedaActualizacion.trim() === '' ? [] : productos.filter((p: any) => 
    p.nombre.toLowerCase().includes(busquedaActualizacion.toLowerCase()) ||
    (p.codigo_barras && p.codigo_barras.includes(busquedaActualizacion))
  )

  // Agrupación de datos para el reporte por Proveedor
  const proveedoresResumen = productos.reduce((acc: any, p: any) => {
    const prov = (p.proveedor && p.proveedor.trim() !== '') ? p.proveedor.trim() : 'General'
    if (!acc[prov]) {
      acc[prov] = {
        proveedor: prov,
        cantidadProductos: 0,
        stockTotal: 0,
        inversionCosto: 0,
        valorVenta: 0,
        productosLista: []
      }
    }
    acc[prov].cantidadProductos += 1
    acc[prov].stockTotal += (p.stock || 0)
    acc[prov].inversionCosto += (p.precio_costo || 0) * (p.stock || 0)
    acc[prov].valorVenta += (p.precio || 0) * (p.stock || 0)
    acc[prov].productosLista.push(p)
    return acc
  }, {})
  const listaProveedoresResumen = Object.values(proveedoresResumen)

  const agregarAlCarrito = (producto: any) => {
    setCarrito((prev: any) => {
      const existe = prev.find((item: any) => item.id === producto.id)
      if (existe) {
        if (existe.cantidad + 1 > producto.stock) {
          alert('No hay suficiente stock disponible.')
          return prev
        }
        return prev.map((item: any) => 
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const quitarDelCarrito = (id: string) => {
    setCarrito((prev: any) => {
      return prev.map((item: any) => {
        if (item.id === id) {
          return { ...item, cantidad: item.cantidad - 1 }
        }
        return item
      }).filter((item: any) => item.cantidad > 0)
    })
  }

  const totalVenta = carrito.reduce((acc: number, item: any) => acc + (item.precio * item.cantidad), 0)

  const abrirModalCobro = () => {
    if (carrito.length === 0) return alert('El carrito está vacío')
    setPagosParciales([{ metodo: 'Efectivo', monto: totalVenta }])
    setMontoIngresado(totalVenta.toString())
    setMetodoSeleccionado('Efectivo')
    setMostrarModalPago(true)
  }

  const agregarPagoParcial = () => {
    const monto = parseFloat(montoIngresado)
    if (isNaN(monto) || monto <= 0) return alert('Ingresa un monto válido')

    const totalPagadoActual = pagosParciales.reduce((acc, p) => acc + p.monto, 0)
    const pendiente = totalVenta - totalPagadoActual

    if (monto > pendiente) {
      return alert(`El monto ingresado supera el saldo pendiente ($${pendiente})`)
    }

    setPagosParciales(prev => [...prev, { metodo: metodoSeleccionado, monto }])
    setMontoIngresado('')
  }

  const quitarPagoParcial = (index: number) => {
    setPagosParciales(prev => prev.filter((_, i) => i !== index))
  }

  const totalPagado = pagosParciales.reduce((acc, p) => acc + p.monto, 0)
  const saldoPendiente = totalVenta - totalPagado

  const confirmarVentaMultiplesPagos = async () => {
    if (!turnoAbierto) return alert('No hay un turno abierto.') // [Guard TS18047]
    if (saldoPendiente > 0) {
      return alert(`Faltan cubrir $${saldoPendiente} para completar el total.`)
    }

    setProcesandoVenta(true)

    try {
      for (const item of carrito) {
        const { data: prodActual, error: errorFetch } = await supabase
          .from('productos')
          .select('stock')
          .eq('id', item.id)
          .single()

        if (errorFetch) throw errorFetch

        const nuevoStock = prodActual.stock - item.cantidad
        if (nuevoStock < 0) throw new Error(`Stock insuficiente para: ${item.nombre}`)

        const { error: errorUpdate } = await supabase
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', item.id)

        if (errorUpdate) throw errorUpdate
      }

      const { error: errorVenta } = await supabase
        .from('ventas')
        .insert([{
          turno_id: turnoAbierto.id,
          total: totalVenta,
          pagos: pagosParciales,
          productos: carrito
        }])

      if (errorVenta) throw errorVenta

      setUltimoTicket({
        productos: [...carrito],
        total: totalVenta,
        pagos: [...pagosParciales],
        fecha: new Date().toLocaleString()
      })

      alert('¡Venta realizada con éxito!')
      setCarrito([])
      setMostrarModalPago(false)
      await fetchProductos()
      await fetchVentasHistoricas()

      setTimeout(() => { window.print() }, 300)

    } catch (error: any) {
      console.error('Error al procesar la venta:', error)
      alert('Hubo un error al procesar la venta: ' + (error.message || error))
    } finally {
      setProcesandoVenta(false)
    }
  }

  const imprimirEtiqueta = (producto: any) => {
    setEtiquetaSeleccionada(producto)
    setTimeout(() => {
      window.print()
      setTimeout(() => setEtiquetaSeleccionada(null), 500)
    }, 200)
  }

  const ventasPorDia = ventasHistoricas.reduce((acc: any, v: any) => {
    const fechaStr = new Date(v.fecha).toLocaleDateString()
    if (!acc[fechaStr]) acc[fechaStr] = { fecha: fechaStr, total: 0, cantidadVentas: 0 }
    acc[fechaStr].total += v.total
    acc[fechaStr].cantidadVentas += 1
    return acc
  }, {})
  const listaVentasPorDia = Object.values(ventasPorDia)

  const ventasPorMes = ventasHistoricas.reduce((acc: any, v: any) => {
    const fechaObj = new Date(v.fecha)
    const mesAnio = `${fechaObj.toLocaleString('default', { month: 'long' })} ${fechaObj.getFullYear()}`
    if (!acc[mesAnio]) acc[mesAnio] = { mes: mesAnio, total: 0, cantidadVentas: 0 }
    acc[mesAnio].total += v.total
    acc[mesAnio].cantidadVentas += 1
    return acc
  }, {})
  const listaVentasPorMes = Object.values(ventasPorMes)

  const totalGastosHistoricos = gastosHistoricos.reduce((acc, g) => acc + g.monto, 0)
  const totalFacturacionHistorica = ventasHistoricas.reduce((acc, v) => acc + v.total, 0)

  if (cargandoTurno) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center font-bold text-lg text-purple-400">Verificando estado de caja...</div>
  }

  if (!turnoAbierto) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-neutral-900/50 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-8 rounded-3xl shadow-2xl shadow-black/60 max-w-md w-full text-center">
          <h1 className="text-2xl font-black text-purple-400 mb-2">🔐 Apertura de Turno</h1>
          <p className="text-sm text-neutral-400 mb-6">Ingresa el dinero inicial de cambio en caja para operar.</p>
          <div className="mb-4 text-left">
            <label className="block text-xs font-bold text-neutral-300 mb-1">Monto Inicial en Efectivo ($):</label>
            <input 
              type="number"
              value={montoInicialInput}
              onChange={(e) => setMontoInicialInput(e.target.value)}
              placeholder="Ej: 15000"
              className="w-full p-3 border border-white/10 rounded-xl text-white font-bold text-lg bg-neutral-900/80 backdrop-blur-md focus:outline-none focus:border-purple-500 shadow-inner"
            />
          </div>
          <button 
            onClick={abrirCaja}
            className="w-full bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-purple-900/40 border-t border-white/30 active:scale-95 transition text-lg"
          >
            Abrir Caja y Comenzar Turno
          </button>
        </div>
      </main>
    )
  }

  const ventasDelTurnoActual = ventasHistoricas.filter(v => v.turno_id === turnoAbierto.id)
  const totalEfectivoTurno = ventasDelTurnoActual.reduce((acc, v) => {
    const ef = v.pagos.find((p: any) => p.metodo === 'Efectivo')
    return acc + (ef ? ef.monto : 0)
  }, 0)
  const totalOtrosTurno = ventasDelTurnoActual.reduce((acc, v) => {
    const otros = v.pagos.filter((p: any) => p.metodo !== 'Efectivo')
    return acc + otros.reduce((sub: any, p: any) => sub + p.monto, 0)
  }, 0)

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 flex flex-col gap-6 relative selection:bg-purple-500 selection:text-white">
      <header className="bg-neutral-900/40 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-4 rounded-2xl shadow-xl shadow-black/40 flex flex-wrap justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold text-purple-400 tracking-wide">🎁 El Rincón de Renzi</h1>
          <span className="text-xs bg-emerald-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 font-bold px-3 py-1 rounded-full shadow-inner">
            ● Caja Abierta (Inicial: ${turnoAbierto?.monto_inicial ?? 0}) {/* [Corregido TS18047] */}
          </span>
        </div>

        <div className="flex gap-2 mt-2 sm:mt-0 flex-wrap">
          <button 
            onClick={() => setVistaActual('pos')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === 'pos' ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
          >
            🛒 Caja / POS
          </button>
          <button 
            onClick={() => setVistaActual('inventario')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === 'inventario' ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
          >         
            📦 Inventario y Carga
          </button>
          <button 
            onClick={() => setVistaActual('proveedores')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === 'proveedores' ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
          >
            🚚 Proveedores
          </button>
          <button 
            onClick={() => setVistaActual('gastos')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === 'gastos' ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
          >
            💸 Gastos
          </button>
          <button 
            onClick={() => setVistaActual('arqueo')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === 'arqueo' ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
          >
            📊 Arqueo
          </button>
          <button 
            onClick={() => setVistaActual('dashboard')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === 'dashboard' ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
          >
            📈 Dashboard
          </button>
          <button 
            onClick={() => setVistaActual('deudas')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === 'deudas' ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
          >
            📋 Clientes con Deuda
          </button>
          <button 
            onClick={() => setVistaActual('senas')}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === 'senas' ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
          >
            💰 Módulo de Señas
          </button>
        </div>
      </header>

      {/* VISTA 1: POS / CAJA */}
      {vistaActual === 'pos' && (
        <div className="flex flex-col md:flex-row gap-6 print:hidden">
          <div className="flex-1">
            <div className="mb-6 flex flex-col sm:flex-row gap-3">
              <input 
                type="text"
                placeholder="Escribe nombre o escanea con pistola..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && busqueda.trim() !== '') {
                    procesarCodigoDetectadoPOS(busqueda)
                  }
                }}
                className="flex-1 p-4 border border-white/10 rounded-xl shadow-inner text-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 bg-neutral-900/60 backdrop-blur-md"
                autoFocus
              />

              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRef} 
                onChange={manejarImagenPOS} 
                className="hidden" 
              />

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 text-white px-5 py-4 rounded-xl font-bold shadow-lg shadow-purple-900/30 border-t border-white/30 active:scale-95 transition flex items-center justify-center gap-2 text-sm whitespace-nowrap"
              >
                📷 Cámara Celular
              </button>

              <select 
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                className="p-4 border border-white/10 rounded-xl shadow-inner text-sm font-bold text-neutral-200 bg-neutral-900/60 backdrop-blur-md focus:outline-none focus:border-purple-500"
              >
                {categoriasDisponibles.map((cat: any) => (
                  <option key={cat} value={cat} className="bg-neutral-900">Categoría: {cat}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {productosFiltrados.map((prod: any) => (
                <div key={prod.id} className="bg-neutral-900/40 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-4 rounded-2xl shadow-xl shadow-black/40 flex flex-col justify-between hover:border-white/30 transition">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="font-bold text-white text-sm line-clamp-2">{prod.nombre}</h3>
                      <span className="text-xs font-mono text-neutral-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded shrink-0">{prod.codigo_barras || 'S/C'}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xl font-black text-purple-400">${prod.precio}</span>
                      <span className="text-xs text-neutral-400">Costo: <strong className="text-neutral-300">${prod.precio_costo ?? 0}</strong></span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">Proveedor: <strong className="text-neutral-300">{prod.proveedor || 'General'}</strong></p>
                    <p className={`text-xs font-semibold mt-2 ${prod.stock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Stock disponible: {prod.stock} un.
                    </p>
                  </div>
                  <button 
                    onClick={() => agregarAlCarrito(prod)}
                    disabled={prod.stock <= 0}
                    className={`mt-4 w-full py-2.5 rounded-xl font-bold transition text-sm shadow-md border-t ${
                      prod.stock > 0 
                        ? 'bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 text-white border-white/30 shadow-purple-900/40 active:scale-95' 
                        : 'bg-white/5 text-neutral-500 cursor-not-allowed border-white/5'
                    }`}
                  >
                    {prod.stock > 0 ? 'Agregar 🛒' : 'Sin Stock'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-96 bg-neutral-900/40 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-6 rounded-3xl shadow-2xl shadow-black/50 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold mb-4 text-white border-b border-white/10 pb-3 flex items-center gap-2">🛒 Carrito de Venta</h2>
              {carrito.length === 0 ? (
                <p className="text-neutral-500 text-center py-12 text-sm">No hay productos agregados.</p>
              ) : (
                <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                  {carrito.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center border-b border-white/10 pb-3">
                      <div>
                        <p className="font-bold text-white text-sm">{item.nombre}</p>
                        <p className="text-xs text-neutral-400">${item.precio} x {item.cantidad}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-purple-400 text-sm">${item.precio * item.cantidad}</p>
                        <button 
                          onClick={() => quitarDelCarrito(item.id)}
                          className="text-rose-400 hover:text-rose-300 font-bold px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition text-xs border border-white/10"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold text-neutral-300">TOTAL:</span>
                <span className="text-2xl font-black text-white">${totalVenta}</span>
              </div>
              <button 
                onClick={abrirModalCobro}
                disabled={carrito.length === 0 || procesandoVenta}
                className={`w-full py-4 rounded-2xl font-bold text-lg text-white transition shadow-xl border-t ${
                  carrito.length > 0 && !procesandoVenta 
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 shadow-emerald-950/50 border-white/30 active:scale-95' 
                    : 'bg-white/5 text-neutral-600 cursor-not-allowed border-white/5'
                }`}
              >
                {procesandoVenta ? 'Procesando...' : 'Cobrar Venta 💵'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: INVENTARIO Y CARGA */}
      {vistaActual === 'inventario' && (
        <div className="bg-neutral-900/40 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-6 rounded-3xl shadow-2xl shadow-black/50 w-full print:hidden space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">📦 Gestión de Inventario y Carga de Productos</h2>
            <p className="text-sm text-neutral-400">Da de alta nuevos productos, edita existentes o gestiona el stock de forma rápida.</p>
          </div>

          <div className="bg-neutral-950/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-inner space-y-4">
            <div className="relative">
              <label className="block text-xs font-bold text-neutral-300 mb-1">Buscar producto para actualizar stock o precio directamente:</label>
              <input 
                type="text"
                placeholder="Escribe el nombre o código para edición rápida..."
                value={busquedaActualizacion}
                onChange={(e) => setBusquedaActualizacion(e.target.value)}
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-medium focus:outline-none focus:border-purple-500 shadow-inner"
              />
              {productosSugeridosActualizar.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-neutral-900/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl z-20 max-h-60 overflow-y-auto divide-y divide-white/10">
                  {productosSugeridosActualizar.map((prod: any) => (
                    <div 
                      key={prod.id} 
                      onClick={() => seleccionarProductoParaEditarDirecto(prod)}
                      className="p-3 hover:bg-white/5 cursor-pointer flex justify-between items-center transition"
                    >
                      <div>
                        <p className="font-bold text-white text-sm">{prod.nombre}</p>
                        <p className="text-xs text-neutral-400">Código: {prod.codigo_barras || 'S/C'} • Stock: <strong className="text-emerald-400">{prod.stock}</strong></p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-purple-400 text-sm">${prod.precio}</p>
                        <span className="text-[10px] bg-purple-950/80 backdrop-blur-md text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">Seleccionar ✏️</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-neutral-950/80 to-purple-950/40 backdrop-blur-md p-4 rounded-2xl shadow-inner border border-white/10 flex flex-col sm:flex-row gap-3 items-center">
              <span className="text-purple-300 font-bold text-sm whitespace-nowrap">🔍 Escanear para cargar:</span>
              <input 
                type="text"
                placeholder="Pasa la pistola o escribe el código de barras aquí..."
                value={busquedaInventario}
                onChange={(e) => setBusquedaInventario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && busquedaInventario.trim() !== '') {
                    procesarCodigoInventario(busquedaInventario)
                  }
                }}
                className="flex-1 p-3 rounded-xl border border-white/10 text-white font-bold bg-neutral-900/80 backdrop-blur-md focus:outline-none focus:border-purple-500 shadow-inner"
              />
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputInventarioRef} 
                onChange={manejarImagenInventario} 
                className="hidden" 
              />
              <button 
                type="button"
                onClick={() => fileInputInventarioRef.current?.click()}
                className="bg-white/5 hover:bg-white/10 backdrop-blur-md text-purple-300 border border-white/15 px-4 py-3 rounded-xl font-bold text-xs whitespace-nowrap transition active:scale-95 shadow-md"
              >
                📷 Cámara Celular
              </button>
            </div>
          </div>

          <form onSubmit={productoAEditar ? guardarEdicionDirecta : guardarProducto} className="bg-neutral-950/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-inner">
            <div className="sm:col-span-2 flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-purple-400 text-base">{productoAEditar ? `Editando Producto: ${productoAEditar.nombre}` : '✨ Carga de Nuevo Producto'}</h3>
              {productoAEditar && (
                <button 
                  type="button" 
                  onClick={limpiarFormularioProducto}
                  className="text-xs bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 px-3 py-1.5 rounded-xl font-bold transition"
                >
                  Cancelar Edición
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Nombre del Producto:</label>
              <input 
                type="text"
                value={nombreProd}
                onChange={(e) => setNombreProd(e.target.value)}
                placeholder="Ej: Alfajor Triple..."
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-medium focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Categoría:</label>
              <input 
                type="text"
                value={categoriaProd}
                onChange={(e) => setCategoriaProd(e.target.value)}
                placeholder="Ej: Kiosco, Bebidas, etc."
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-medium focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Precio de Venta ($):</label>
              <input 
                type="number"
                step="0.01"
                value={precioProd}
                onChange={(e) => setPrecioProd(e.target.value)}
                placeholder="Ej: 350"
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-bold focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Precio de Costo ($):</label>
              <input 
                type="number"
                step="0.01"
                value={costoProd}
                onChange={(e) => setCostoProd(e.target.value)}
                placeholder="Ej: 250"
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-bold focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">{productoAEditar ? 'Stock Actual:' : 'Stock a Sumar / Inicial:'}</label>
              <input 
                type="number"
                value={stockProd}
                onChange={(e) => setStockProd(e.target.value)}
                placeholder="Ej: 15"
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-bold focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Proveedor:</label>
              <input 
                type="text"
                value={proveedorProd}
                onChange={(e) => setProveedorProd(e.target.value)}
                placeholder="Ej: Distribuidora Norte"
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-medium focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-neutral-300 mb-1">Código de Barras:</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={codigoProd}
                  onChange={(e) => setCodigoProd(e.target.value)}
                  placeholder="Escanea o autogenera..."
                  className="flex-1 p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-mono text-sm focus:outline-none focus:border-purple-500 shadow-inner"
                />
                <button 
                  type="button"
                  onClick={generarCodigoAleatorio}
                  className="bg-white/5 hover:bg-white/10 backdrop-blur-md text-purple-300 border border-white/15 px-4 py-3 rounded-xl font-bold text-xs whitespace-nowrap transition active:scale-95 shadow-md"
                >
                  ⚡ Generar Código
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <button 
                type="submit"
                className="w-full bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-purple-900/40 border-t border-white/30 active:scale-95 transition text-base"
              >
                {productoAEditar ? 'Guardar Cambios de Producto 💾' : 'Guardar y Registrar Producto 🚀'}
              </button>
            </div>
          </form>

          <div className="bg-neutral-950/60 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 bg-neutral-900/80">
              <h3 className="font-bold text-white text-base">Lista General de Productos ({productos.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900/50 text-neutral-400 uppercase text-xs border-b border-white/10">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Costo</th>
                    <th className="p-3">Precio</th>
                    <th className="p-3 text-center">Stock</th>
                    <th className="p-3 text-center">Acciones Etiqueta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {productos.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-neutral-500">No hay productos cargados.</td></tr>
                  ) : (
                    productos.map((p: any) => (
                      <tr key={p.id} className="hover:bg-white/5 transition">
                        <td className="p-3 font-mono text-xs text-neutral-400">{p.codigo_barras || 'S/C'}</td>
                        <td className="p-3 font-bold text-white">{p.nombre}</td>
                        <td className="p-3 text-neutral-300">{p.categoria || 'General'}</td>
                        <td className="p-3 text-neutral-300">{p.proveedor || 'General'}</td>
                        <td className="p-3 text-neutral-400">${p.precio_costo ?? 0}</td>
                        <td className="p-3 font-black text-purple-400">${p.precio}</td>
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-2 bg-neutral-900/80 border border-white/10 px-2.5 py-1 rounded-xl">
                            <button 
                              onClick={() => actualizarStockRapido(p.id, p.stock, -1)}
                              className="px-2 py-0.5 bg-white/5 hover:bg-rose-950/85 rounded-lg font-bold text-rose-400 transition active:scale-95"
                              title="Restar 1"
                            >
                              -
                            </button>
                            <span className="font-black text-xs text-white">{p.stock}</span>
                            <button 
                              onClick={() => actualizarStockRapido(p.id, p.stock, 1)}
                              className="px-2 py-0.5 bg-white/5 hover:bg-emerald-950/80 rounded-lg font-bold text-emerald-400 transition active:scale-95"
                              title="Sumar 1"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => imprimirEtiqueta(p)}
                            className="bg-gradient-to-b from-sky-500 to-sky-700 hover:from-sky-400 hover:to-sky-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-sky-950/50 border-t border-white/30 active:scale-95 transition"
                          >
                            🏷️ Imprimir Etiqueta
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: REPORTE POR PROVEEDORES */}
      {vistaActual === 'proveedores' && (
        <div className="bg-neutral-900/40 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-6 rounded-3xl shadow-2xl shadow-black/50 w-full print:hidden space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">🚚 Reporte y Control por Proveedor</h2>
            <p className="text-sm text-neutral-400">Métricas de stock, inversión y valor de venta agrupadas por distribuidor o marca.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {listaProveedoresResumen.map((item: any, idx: number) => (
              <div key={idx} className="bg-neutral-950/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl flex flex-col justify-between hover:border-white/25 transition">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-black text-purple-300">📦 {item.proveedor}</span>
                    <span className="text-xs font-bold bg-purple-950/80 backdrop-blur-md text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full shadow-inner">
                      {item.cantidadProductos} {item.cantidadProductos === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-neutral-300 mb-6 border-t border-white/10 pt-3">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Stock Total:</span>
                      <strong className="text-white">{item.stockTotal} un.</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Inversión (Costo):</span>
                      <strong className="text-neutral-200">${item.inversionCosto.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Valor de Venta Est.:</span>
                      <strong className="text-purple-400 font-bold">${item.valorVenta.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-xs font-bold text-purple-300 hover:text-purple-200 bg-white/5 hover:bg-white/10 p-2.5 rounded-xl text-center transition border border-white/10">
                    Ver productos asociados 📋
                  </summary>
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1 text-xs divide-y divide-white/5">
                    {item.productosLista.map((p: any) => (
                      <div key={p.id} className="pt-2 flex justify-between items-center text-neutral-300">
                        <span>{p.nombre} ({p.stock} un.)</span>
                        <span className="font-bold text-purple-400">${p.precio}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTA 4: GASTOS */}
      {vistaActual === 'gastos' && (
        <div className="bg-neutral-900/40 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-6 rounded-3xl shadow-2xl shadow-black/50 max-w-4xl mx-auto w-full print:hidden space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">💸 Control de Gastos y Egresos</h2>
            <p className="text-sm text-neutral-400">Registra los pagos a proveedores, servicios o compras del local.</p>
          </div>

          <form onSubmit={registrarGasto} className="bg-neutral-950/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end shadow-inner">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-neutral-300 mb-1">Descripción:</label>
              <input 
                type="text"
                value={descGasto}
                onChange={(e) => setDescGasto(e.target.value)}
                placeholder="Ej: Compra a Proveedor X..."
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-medium focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Categoría:</label>
              <select 
                value={categoriaGasto}
                onChange={(e) => setCategoriaGasto(e.target.value)}
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-medium focus:outline-none focus:border-purple-500 shadow-inner"
              >
                <option value="General" className="bg-neutral-900">General</option>
                <option value="Mercadería" className="bg-neutral-900">Mercadería</option>
                <option value="Servicios" className="bg-neutral-900">Servicios</option>
                <option value="Proveedores" className="bg-neutral-900">Proveedores</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Monto ($):</label>
              <input 
                type="number"
                step="0.01"
                value={montoGasto}
                onChange={(e) => setMontoGasto(e.target.value)}
                placeholder="Ej: 5000"
                className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-bold focus:outline-none focus:border-purple-500 shadow-inner"
              />
            </div>

            <div className="sm:col-span-4">
              <button 
                type="submit"
                className="w-full bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-purple-900/40 border-t border-white/30 active:scale-95 transition"
              >
                Registrar Gasto 💸
              </button>
            </div>
          </form>

          <div className="bg-neutral-950/60 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 bg-neutral-900/80 flex justify-between items-center">
              <h3 className="font-bold text-white text-base">Historial de Gastos</h3>
              <span className="text-xs font-bold text-rose-400 bg-rose-950/80 border border-rose-500/30 px-3 py-1 rounded-full">
                Total Gastos: ${totalGastosHistoricos.toLocaleString()}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900/50 text-neutral-400 uppercase text-xs border-b border-white/10">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {gastosHistoricos.length === 0 ? (
                    <tr><td colSpan={4} className="p-6 text-center text-neutral-500">Sin gastos registrados.</td></tr>
                  ) : (
                    gastosHistoricos.map((g: any) => (
                      <tr key={g.id} className="hover:bg-white/5 transition">
                        <td className="p-3 text-neutral-400">{new Date(g.fecha).toLocaleString()}</td>
                        <td className="p-3 font-bold text-white">{g.descripcion}</td>
                        <td className="p-3 text-neutral-300">{g.categoria}</td>
                        <td className="p-3 text-right font-black text-rose-400">${g.monto}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 5: ARQUEO DE CAJA */}
      {vistaActual === 'arqueo' && turnoAbierto && (
        <div className="bg-neutral-900/40 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-6 rounded-3xl shadow-2xl shadow-black/50 max-w-lg mx-auto w-full print:hidden space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">📊 Arqueo y Cierre de Turno</h2>
            <p className="text-sm text-neutral-400">Resumen de ingresos de caja para el turno actual.</p>
          </div>

          <div className="bg-neutral-950/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 space-y-4 shadow-inner">
            <div className="flex justify-between text-neutral-300">
              <span className="font-medium">Monto Inicial en Caja:</span>
              <span className="font-bold text-white">${turnoAbierto.monto_inicial}</span>
            </div>
            <div className="flex justify-between text-neutral-300">
              <span className="font-medium">Ventas en Efectivo:</span>
              <span className="font-bold text-emerald-400">+ ${totalEfectivoTurno}</span>
            </div>
            <div className="flex justify-between text-neutral-300 border-b border-white/10 pb-3">
              <span className="font-medium">Ventas otros medios (QR, Tarjetas):</span>
              <span className="font-bold text-sky-400">+ ${totalOtrosTurno}</span>
            </div>
            <div className="flex justify-between text-lg font-black text-white pt-2">
              <span>Efectivo Total Esperado en Caja:</span>
              <span className="text-purple-400">${turnoAbierto.monto_inicial + totalEfectivoTurno}</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setVistaActual('pos')}
              className="flex-1 bg-white/5 hover:bg-white/10 backdrop-blur-md text-neutral-200 py-3 rounded-xl font-bold transition border border-white/10 active:scale-95 shadow-md"
            >
              Volver al POS
            </button>
            <button 
              onClick={cerrarCajaTurno}
              className="flex-1 bg-gradient-to-b from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-950/50 border-t border-white/30 active:scale-95 transition"
            >
              Cerrar Turno / Arqueo Final
            </button>
          </div>
        </div>
      )}

      {/* VISTA 6: DASHBOARD GENERAL */}
      {vistaActual === 'dashboard' && (
        <div className="bg-neutral-900/40 backdrop-blur-xl border-t border-white/20 border-x border-white/10 p-6 rounded-3xl shadow-2xl shadow-black/50 w-full print:hidden space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">📈 Dashboard General y Finanzas</h2>
            <p className="text-sm text-neutral-400">Resumen consolidado de ingresos, egresos y balance general.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-neutral-950/60 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Facturación Total Histórica</p>
              <p className="text-2xl font-black text-emerald-400">${totalFacturacionHistorica.toLocaleString()}</p>
            </div>
            <div className="bg-neutral-950/60 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Total Gastos Históricos</p>
              <p className="text-2xl font-black text-rose-400">${totalGastosHistoricos.toLocaleString()}</p>
            </div>
            <div className="bg-neutral-950/60 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Balance General</p>
              <p className={`text-2xl font-black ${totalFacturacionHistorica - totalGastosHistoricos >= 0 ? 'text-purple-400' : 'text-rose-400'}`}>
                ${(totalFacturacionHistorica - totalGastosHistoricos).toLocaleString()}
              </p>
            </div>
            <div className="bg-neutral-950/60 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-xl">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Total Tickets Emitidos</p>
              <p className="text-2xl font-black text-sky-400">{ventasHistoricas.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-bold text-white text-lg">Ventas por Día</h3>
              <div className="overflow-hidden border border-white/10 rounded-2xl bg-neutral-950/60 backdrop-blur-md shadow-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-900/80 text-neutral-400 uppercase text-xs border-b border-white/10">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Tickets</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {listaVentasPorDia.length === 0 ? (
                      <tr><td colSpan={3} className="p-6 text-center text-neutral-500">Sin registros.</td></tr>
                    ) : (
                      listaVentasPorDia.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/5 transition">
                          <td className="p-3 font-semibold text-white">{item.fecha}</td>
                          <td className="p-3 text-neutral-400">{item.cantidadVentas} ventas</td>
                          <td className="p-3 text-right font-black text-emerald-400">${item.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-white text-lg">Ventas por Mes</h3>
              <div className="overflow-hidden border border-white/10 rounded-2xl bg-neutral-950/60 backdrop-blur-md shadow-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-900/80 text-neutral-400 uppercase text-xs border-b border-white/10">
                    <tr>
                      <th className="p-3">Mes y Año</th>
                      <th className="p-3">Cantidad de Tickets</th>
                      <th className="p-3 text-right">Total Facturado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {listaVentasPorMes.length === 0 ? (
                      <tr><td colSpan={3} className="p-6 text-center text-neutral-500">Sin registros.</td></tr>
                    ) : (
                      listaVentasPorMes.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/5 transition">
                          <td className="p-3 font-semibold text-white capitalize">{item.mes}</td>
                          <td className="p-3 text-neutral-400">{item.cantidadVentas} ventas</td>
                          <td className="p-3 text-right font-black text-emerald-400">${item.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 7: CLIENTES CON DEUDA */}
      {vistaActual === 'deudas' && (
        <div className="print:hidden">
          <ModuloDeudas />
        </div>
      )}

      {/* VISTA 8: MÓDULO DE SEÑAS */}
      {vistaActual === 'senas' && (
        <div className="print:hidden">
          <ModuloSenas />
        </div>
      )}

      {/* MODAL DE PAGOS */}
      {mostrarModalPago && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-neutral-900/80 backdrop-blur-2xl rounded-3xl max-w-md w-full border border-white/20 p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-xl font-black text-white">💳 Cobro de Venta (Múltiples Pagos)</h3>
              <button 
                onClick={() => setMostrarModalPago(false)}
                className="text-neutral-400 hover:text-white font-bold p-1 bg-white/5 hover:bg-white/10 rounded-xl transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-neutral-950/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-2 shadow-inner">
              <div className="flex justify-between text-sm text-neutral-300">
                <span>Total de la Venta:</span>
                <span className="font-bold text-white">${totalVenta}</span>
              </div>
              <div className="flex justify-between text-sm text-neutral-300">
                <span>Total Pagado:</span>
                <span className="font-bold text-emerald-400">${totalPagado}</span>
              </div>
              <div className="flex justify-between text-base font-black text-white border-t border-white/10 pt-2">
                <span>Saldo Pendiente:</span>
                <span className={saldoPendiente > 0 ? 'text-rose-400' : 'text-emerald-400'}>${saldoPendiente}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-300">Método de Pago:</label>
                <select 
                  value={metodoSeleccionado}
                  onChange={(e) => setMetodoSeleccionado(e.target.value)}
                  className="w-full p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-bold focus:outline-none focus:border-purple-500 shadow-inner"
                >
                  <option value="Efectivo" className="bg-neutral-900">Efectivo</option>
                  <option value="Mercado Pago / QR" className="bg-neutral-900">Mercado Pago / QR</option>
                  <option value="Tarjeta Débito" className="bg-neutral-900">Tarjeta Débito</option>
                  <option value="Tarjeta Crédito" className="bg-neutral-900">Tarjeta Crédito</option>
                  <option value="Transferencia" className="bg-neutral-900">Transferencia</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-300">Monto ($):</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    step="0.01"
                    value={montoIngresado}
                    onChange={(e) => setMontoIngresado(e.target.value)}
                    placeholder="Ej: 1000"
                    className="flex-1 p-3 border border-white/10 rounded-xl text-white bg-neutral-900/80 backdrop-blur-md font-bold focus:outline-none focus:border-purple-500 shadow-inner"
                  />
                  <button 
                    onClick={agregarPagoParcial}
                    className="bg-white/5 hover:bg-white/10 backdrop-blur-md text-purple-300 border border-white/15 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition active:scale-95 shadow-md"
                  >
                    Agregar ➕
                  </button>
                </div>
              </div>
            </div>

            {pagosParciales.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Pagos Agregados:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                  {pagosParciales.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-neutral-950/40 border border-white/10 p-2.5 rounded-xl text-sm">
                      <span className="font-semibold text-neutral-200">{p.metodo}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-emerald-400">${p.monto}</span>
                        <button 
                          onClick={() => quitarPagoParcial(idx)}
                          className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2 py-0.5 bg-white/5 rounded transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setMostrarModalPago(false)}
                className="flex-1 bg-white/5 hover:bg-white/15 backdrop-blur-md text-neutral-200 py-3 rounded-xl font-bold transition border border-white/10 active:scale-95 shadow-md"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarVentaMultiplesPagos}
                disabled={saldoPendiente > 0 || procesandoVenta}
                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition shadow-xl ${
                  saldoPendiente === 0 && !procesandoVenta 
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 shadow-emerald-950/50 border-t border-white/30 active:scale-95' 
                    : 'bg-white/5 text-neutral-600 cursor-not-allowed border-white/5'
                }`}
              >
                {procesandoVenta ? 'Procesando...' : 'Confirmar Venta 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORMATO DE IMPRESIÓN DE TICKET DE VENTA */}
      {ultimoTicket && (
        <div className="hidden print:block p-4 max-w-[80mm] mx-auto text-black font-mono text-xs">
          <div className="text-center mb-4">
            <h2 className="text-sm font-black">EL RINCÓN DE RENZI</h2>
            <p className="text-[10px]">Kiosco & Almacén</p>
            <p className="text-[10px] mt-1">{ultimoTicket.fecha}</p>
          </div>
          <div className="border-b border-dashed border-black mb-2"></div>
          <div className="space-y-1 mb-2">
            {ultimoTicket.productos.map((item: any, i: number) => (
              <div key={i} className="flex justify-between">
                <span>{item.cantidad}x {item.nombre}</span>
                <span>${item.precio * item.cantidad}</span>
              </div>
            ))}
          </div>
          <div className="border-b border-dashed border-black mb-2"></div>
          <div className="flex justify-between font-bold text-sm mb-2">
            <span>TOTAL:</span>
            <span>${ultimoTicket.total}</span>
          </div>
          <div className="space-y-1 mb-4 text-[10px]">
            {ultimoTicket.pagos.map((p: any, i: number) => (
              <div key={i} className="flex justify-between">
                <span>{p.metodo}:</span>
                <span>${p.monto}</span>
              </div>
            ))}
          </div>
          <div className="text-center text-[10px] mt-6">
            <p>¡Gracias por su compra!</p>
          </div>
        </div>
      )}

      {/* FORMATO DE IMPRESIÓN DE ETIQUETA DE PRODUCTO */}
      {etiquetaSeleccionada && (
        <div className="hidden print:block p-2 max-w-[50mm] mx-auto text-black text-center font-sans">
          <p className="text-xs font-bold truncate">{etiquetaSeleccionada.nombre}</p>
          <p className="text-xl font-black my-1">${etiquetaSeleccionada.precio}</p>
          <div className="my-1 flex justify-center">
            <svg ref={barcodeRef}></svg>
          </div>
          <p className="text-[9px] text-gray-600 font-mono">Cod: {etiquetaSeleccionada.codigo_barras}</p>
        </div>
      )}
    </main>
  )
}