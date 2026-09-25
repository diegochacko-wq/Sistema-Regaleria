'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import jsQR from 'jsqr'
import JsBarcode from 'jsbarcode'
import { useNegocio } from '@/context/NegocioContext'
import SelectorNegocio from "@/components/SelectorNegocio"
import ModuloDeudas from '../components/ModuloDeudas'
import ModuloSenas from '../components/ModuloSenas'
import GastosView from '@/components/GastosView'
import ProveedoresView from '@/components/ProveedoresView'
import DashboardView from '@/components/DashboardView'
import ArqueoView from '@/components/ArqueoView'
import PosView from '@/components/PosView'

// ============= MÓDULO DE REPOSICIÓN / PEDIDOS (integrado) =============
function ModuloReposicion() {
  const { negocioActual } = useNegocio()
  const [productos, setProductos] = useState<any[]>([])
  const [busquedaRepo, setBusquedaRepo] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('TODOS')
  const [carritoRepo, setCarritoRepo] = useState<Record<string, number>>({})
  const [cargandoRepo, setCargandoRepo] = useState(true)

  useEffect(() => {
    if (negocioActual?.id) cargarProductosRepo()
  }, [negocioActual?.id])

  const cargarProductosRepo = async () => {
    if (!negocioActual) return
    setCargandoRepo(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, stock, min_stock, supplier, sale_price, cost_price, active')
      .eq('negocio_id', negocioActual.id)
      .order('name')
    setProductos(data || [])
    setCargandoRepo(false)
  }

  const faltantes = productos.filter((p: any) => p.active !== false && p.stock <= p.min_stock)
  const proveedoresLista = Array.from(new Set(faltantes.map((p: any) => p.supplier || 'General'))).sort()

  const faltantesFiltrados = faltantes
    .filter((p: any) => filtroProveedor === 'TODOS' || (p.supplier || 'General') === filtroProveedor)
    .filter((p: any) => p.name.toLowerCase().includes(busquedaRepo.toLowerCase()))

  const sugerido = (p: any) => Math.max((p.min_stock || 0) * 2 - p.stock, 1)

  const agregarAlCarrito = (p: any) => {
    setCarritoRepo((prev) => ({ ...prev, [p.id]: (prev[p.id] || 0) + sugerido(p) }))
  }
  const quitarDelCarrito = (id: string) => {
    setCarritoRepo((prev) => {
      const n = { ...prev }
      delete n[id]
      return n
    })
  }
  const cambiarCantidad = (id: string, cant: number) => {
    if (cant <= 0) return quitarDelCarrito(id)
    setCarritoRepo((prev) => ({ ...prev, [id]: cant }))
  }

  const productosCarrito = Object.entries(carritoRepo)
    .map(([id, cant]) => {
      const p = productos.find((x: any) => x.id === id)
      return p ? { ...p, cantPedir: cant } : null
    })
    .filter(Boolean) as any[]

  const porProveedor: Record<string, any[]> = {}
  productosCarrito.forEach((p) => {
    const prov = p.supplier || 'General'
    if (!porProveedor[prov]) porProveedor[prov] = []
    porProveedor[prov].push(p)
  })

  const fechaHoy = new Date().toLocaleDateString('es-AR')

  const textoPlano = (prov?: string) => {
    const grupos = prov ? { [prov]: porProveedor[prov] } : porProveedor
    let t = `📦 Pedido de Reposición - ${fechaHoy}\n`
    Object.entries(grupos).forEach(([pr, items]: any) => {
      t += `\nSupplier: ${pr}\n`
      items.forEach((p: any) => {
        t += `- ${p.name}: pedir ${p.cantPedir} (stock actual ${p.stock} / mínimo ${p.min_stock})\n`
      })
    })
    return t
  }

  const exportarWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(textoPlano())}`, '_blank')
  }
  const exportarEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent('Pedido de Reposición - ' + fechaHoy)}&body=${encodeURIComponent(textoPlano())}`
  }
  const exportarExcel = () => {
    const filas = [['Proveedor', 'Producto', 'Cantidad a pedir', 'Stock actual', 'Stock mínimo']]
    productosCarrito.forEach((p) => filas.push([p.supplier || 'General', p.name, String(p.cantPedir), String(p.stock), String(p.min_stock)]))
    const csv = '\uFEFF' + filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    descargarArchivo(csv, `pedido-${Date.now()}.csv`, 'text/csv;charset=utf-8')
  }
  const exportarWord = () => {
    let html = `<html><head><meta charset="utf-8"></head><body><h2>📦 Pedido de Reposición - ${fechaHoy}</h2>`
    Object.entries(porProveedor).forEach(([pr, items]: any) => {
      html += `<h3>${pr}</h3><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Producto</th><th>Cantidad</th><th>Stock actual</th><th>Mínimo</th></tr>`
      items.forEach((p: any) => {
        html += `<tr><td>${p.name}</td><td>${p.cantPedir}</td><td>${p.stock}</td><td>${p.min_stock}</td></tr>`
      })
      html += '</table>'
    })
    html += '</body></html>'
    descargarArchivo(html, `pedido-${Date.now()}.doc`, 'application/msword')
  }
  const descargarArchivo = (contenido: string, nombre: string, tipo: string) => {
    const blob = new Blob([contenido], { type: tipo })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 backdrop-blur-md rounded-2xl p-5 border border-amber-500/30">
        <h2 className="text-2xl font-black text-white">📦 Reposición / Pedidos</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
          <p className="text-amber-200/80 text-sm">
            {cargandoRepo ? 'Cargando…' : `${faltantes.length} producto(s) con stock bajo o faltante`}
          </p>
          {productosCarrito.length > 0 && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-xl text-xs font-bold">
              🛒 Pedido activo: {productosCarrito.length} producto(s) ({productosCarrito.reduce((acc: number, x: any) => acc + x.cantPedir, 0)} u.)
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={busquedaRepo}
          onChange={(e) => setBusquedaRepo(e.target.value)}
          placeholder="🔍 Buscar producto…"
          className="flex-1 bg-neutral-900/70 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500"
        />
        <select
          value={filtroProveedor}
          onChange={(e) => setFiltroProveedor(e.target.value)}
          className="bg-neutral-900/70 border border-white/10 rounded-xl px-4 py-3 text-white"
        >
          <option value="TODOS">Todos los proveedores</option>
          {proveedoresLista.map((pr) => (
            <option key={pr} value={pr}>{pr}</option>
          ))}
        </select>
        <button onClick={cargarProductosRepo} className="bg-white/5 hover:bg-white/10 text-neutral-300 px-4 py-3 rounded-xl font-bold text-sm">🔄 Actualizar</button>
      </div>

      <div className="bg-neutral-900/50 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-neutral-400">
            <tr>
              <th className="p-3 text-left">Producto</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-right">Mínimo</th>
              <th className="p-3 text-center">Sugerido</th>
              <th className="p-3 text-right">Proveedor</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {faltantesFiltrados.map((p: any) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="p-3 font-bold text-white">{p.name}</td>
                <td className={`p-3 text-right font-black ${p.stock === 0 ? 'text-rose-400' : 'text-amber-400'}`}>{p.stock}</td>
                <td className="p-3 text-right text-neutral-400">{p.min_stock}</td>
                <td className="p-3 text-center text-emerald-400 font-bold">{sugerido(p)}</td>
                <td className="p-3 text-right text-neutral-300">{p.supplier || 'General'}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => agregarAlCarrito(p)}
                    className={`${(carritoRepo[p.id] || 0) > 0 ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-purple-600 hover:bg-purple-500'} text-white px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-sm`}
                  >
                    {(carritoRepo[p.id] || 0) > 0 ? `✓ En pedido (${carritoRepo[p.id]})` : '🛒 Agregar'}
                  </button>
                </td>
              </tr>
            ))}
            {faltantesFiltrados.length === 0 && !cargandoRepo && (
              <tr><td colSpan={6} className="p-6 text-center text-neutral-500">✅ No hay productos con stock bajo en este filtro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {productosCarrito.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={exportarWhatsApp} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm">💬 WhatsApp</button>
            <button onClick={exportarEmail} className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm">✉️ Email</button>
            <button onClick={exportarExcel} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm">📊 Excel</button>
            <button onClick={exportarWord} className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm">📄 Word</button>
            <button onClick={() => setCarritoRepo({})} className="bg-white/5 hover:bg-white/10 text-neutral-300 px-4 py-2.5 rounded-xl font-bold text-sm">🗑️ Vaciar</button>
          </div>

          {Object.entries(porProveedor).map(([prov, items]: any) => (
            <div key={prov} className="bg-neutral-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-4">
              <h3 className="font-black text-white mb-3">🏷️ {prov}</h3>
              <div className="space-y-2">
                {items.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-neutral-950/50 rounded-xl px-4 py-2.5 border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{p.name}</p>
                      <p className="text-xs text-neutral-500">Stock {p.stock} / mín {p.min_stock}</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={p.cantPedir}
                      onChange={(e) => cambiarCantidad(p.id, Number(e.target.value))}
                      className="w-20 bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-white text-right font-bold mx-3"
                    />
                    <button onClick={() => quitarDelCarrito(p.id)} className="text-rose-400 hover:text-rose-300 font-bold px-2">✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function POS() {
  const { negocioActual, loading: cargandoNegocio } = useNegocio()

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
  const [vistaActual, setVistaActual] = useState<
    'pos' | 'inventario' | 'proveedores' | 'gastos' | 'arqueo' | 'dashboard' | 'deudas' | 'senas' | 'reposicion' | 'cajaPos'
  >('pos')

  // Datos para Dashboard y Gastos
  const [ventasHistoricas, setVentasHistoricas] = useState<any[]>([])
  const [gastosHistoricos, setGastosHistoricos] = useState<any[]>([])
  const [montoGasto, setMontoGasto] = useState('')
  const [descripcionGasto, setDescripcionGasto] = useState('')
  const [categoriaGasto, setCategoriaGasto] = useState('General')

  // Arqueo de caja
  const [montoContado, setMontoContado] = useState('')

  // Estados para nuevo producto / carga
  const [nombreProd, setNombreProd] = useState('')
  const [precioProd, setPrecioProd] = useState('')
  const [costoProd, setCostoProd] = useState('')
  const [stockProd, setStockProd] = useState('')
  const [codigoProd, setCodigoProd] = useState('')
  const [categoriaProd, setCategoriaProd] = useState('')
  const [proveedorProd, setProveedorProd] = useState('')

  // Buscador rápido de actualización en inventario
  const [productoAEditar, setProductoAEditar] = useState<any | null>(null)
  const [busquedaInventario, setBusquedaInventario] = useState('')
  const [minStockProd, setMinStockProd] = useState('')
  const [guardandoProducto, setGuardandoProducto] = useState(false)

  // Categorías de productos
  const [categoriasDB, setCategoriasDB] = useState<any[]>([])
  const [categoriaNuevaInput, setCategoriaNuevaInput] = useState('')

  // Estados para Modal de Múltiples Pagos
  const [mostrarModalPago, setMostrarModalPago] = useState(false)
  const [pagosTemp, setPagosTemp] = useState<{ method: string; amount: number }[]>([])
  const [metodoPagoActual, setMetodoPagoActual] = useState('efectivo')
  const [montoPagoActual, setMontoPagoActual] = useState('')
  const [efectivoRecibido, setEfectivoRecibido] = useState('')

  // Estados para Ticket / Impresión
  const [ticketVenta, setTicketVenta] = useState<any | null>(null)
  const barcodeTicketRef = useRef<SVGSVGElement | null>(null)

  // Estados para Etiquetas (impresión de precio + código de barras)
  const [etiquetaProducto, setEtiquetaProducto] = useState<any | null>(null)
  const [cantidadEtiquetas, setCantidadEtiquetas] = useState('1')
  const etiquetasContenedorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMontado(true)
  }, [])

  // Referencias para escaneo por cámara
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [escaneando, setEscaneando] = useState(false)

  useEffect(() => {
    if (negocioActual?.id) {
      cargarProductos()
      verificarTurnoAbierto()
      cargarCategorias()
      cargarVentasDashboard()
      cargarGastos()
    }
  }, [negocioActual?.id])

  useEffect(() => {
    if (!negocioActual?.id) return
    if (vistaActual === 'gastos') {
      cargarGastos()
    } else if (vistaActual === 'dashboard') {
      cargarVentasDashboard()
      cargarGastos()
    }
  }, [vistaActual, turnoAbierto, negocioActual?.id])

  // Generar código de barras en el ticket
  useEffect(() => {
    if (ticketVenta && barcodeTicketRef.current) {
      try {
        const codigo = ticketVenta.id ? String(ticketVenta.id).substring(0, 8).toUpperCase() : '000000'
        JsBarcode(barcodeTicketRef.current, codigo, {
          format: 'CODE128',
          width: 1.5,
          height: 35,
          displayValue: false,
          margin: 0,
        })
      } catch (err) {
        console.error('Error generando barcode de ticket:', err)
      }
    }
  }, [ticketVenta])

  // Cargar categorías existentes
  const cargarCategorias = async () => {
    if (!negocioActual?.id) return
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('negocio_id', negocioActual.id)
        .order('name')
      if (error) throw error
      setCategoriasDB(data || [])
    } catch (err) {
      console.error('Error al cargar categorías:', err)
    }
  }

  // Cargar productos del negocio actual
  const cargarProductos = async () => {
    if (!negocioActual?.id) return
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('negocio_id', negocioActual.id)
        .order('name')

      if (error) throw error

      const formateados = (data || []).map((p: any) => ({
        id: p.id,
        nombre: p.name,
        precio: Number(p.sale_price ?? p.price ?? 0),
        costo: Number(p.cost_price ?? p.cost ?? 0),
        stock: Number(p.stock || 0),
        codigo: p.barcode || p.sku || '',
        barcode: p.barcode || '',
        sku: p.sku || '',
        categoria: p.category_id || '',
        min_stock: Number(p.min_stock || 0),
        active: p.active !== false,
        proveedor: p.supplier || 'General',
        supplier: p.supplier || 'General',
      }))
      setProductos(formateados)
    } catch (err) {
      console.error('Error al cargar productos:', err)
    }
  }

  const verificarTurnoAbierto = async () => {
    if (!negocioActual?.id) return
    setCargandoTurno(true)
    try {
      const { data, error } = await supabase
        .from('cash_shifts')
        .select('*')
        .eq('negocio_id', negocioActual.id)
        .eq('status', 'abierta')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        setTurnoAbierto(null)
      } else {
        setTurnoAbierto(data)
      }
    } catch (err: any) {
      setTurnoAbierto(null)
    } finally {
      setCargandoTurno(false)
    }
  }

  // Cargar gastos
  const cargarGastos = async () => {
    if (!negocioActual?.id) return
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('negocio_id', negocioActual.id)
        .eq('type', 'egreso')
        .order('created_at', { ascending: false })
      if (error) throw error
      setGastosHistoricos(data || [])
    } catch (err) {
      console.error('Error cargando gastos:', err)
    }
  }

  // Cargar ventas para dashboard
  const cargarVentasDashboard = async () => {
    if (!negocioActual?.id) return
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('id, total, subtotal, discount, status, created_at, sale_payments(method, amount)')
        .eq('negocio_id', negocioActual.id)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) {
        const { data: fallbackData } = await supabase
          .from('sales')
          .select('id, total, subtotal, discount, status, created_at')
          .eq('negocio_id', negocioActual.id)
          .order('created_at', { ascending: false })
          .limit(500)

        const adaptadas = (fallbackData || []).map((s: any) => ({
          ...s,
          total_amount: Number(s.total ?? s.subtotal ?? 0)
        }))
        setVentasHistoricas(adaptadas)
        return
      }

      const adaptadas = (data || []).map((s: any) => ({
        ...s,
        total_amount: Number(s.total ?? s.subtotal ?? 0)
      }))
      setVentasHistoricas(adaptadas)
    } catch (err: any) {
      console.error('Error al cargar ventas:', err)
    }
  }

  // Abrir Turno de Caja
  const abrirTurno = async () => {
    if (!negocioActual?.id) {
      alert('Debes seleccionar un negocio primero')
      return
    }
    const monto = parseFloat(montoInicialInput)
    if (isNaN(monto) || monto < 0) {
      alert('Por favor ingresa un monto inicial válido.')
      return
    }

    try {
      let { data: caja } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('negocio_id', negocioActual.id)
        .limit(1)
        .maybeSingle()

      let cajaId = caja?.id

      if (!cajaId) {
        const { data: nuevaCaja, error: errorCaja } = await supabase
          .from('cash_registers')
          .insert({ name: 'Caja Principal', negocio_id: negocioActual.id })
          .select()
          .single()
        if (errorCaja) throw errorCaja
        cajaId = nuevaCaja.id
      }

      const { data: shiftId, error } = await supabase.rpc('fn_open_shift', {
        p_register_id: cajaId,
        p_opening_amount: monto,
      })

      if (error) throw error

      alert('Caja abierta con éxito!')
      setMontoInicialInput('')
      await verificarTurnoAbierto()
    } catch (err: any) {
      alert(`Error al abrir caja: ${err.message || 'Error desconocido'}`)
    }
  }

  const limpiarFormularioProducto = () => {
    setNombreProd('')
    setPrecioProd('')
    setCostoProd('')
    setStockProd('')
    setCodigoProd('')
    setCategoriaProd('')
    setProveedorProd('')
    setMinStockProd('')
    setProductoAEditar(null)
  }

  const seleccionarProductoParaEditar = (p: any) => {
    setProductoAEditar(p)
    setNombreProd(p.nombre || '')
    setPrecioProd(String(p.precio ?? ''))
    setCostoProd(String(p.costo ?? ''))
    setStockProd(String(p.stock ?? ''))
    setCodigoProd(p.codigo || p.barcode || '')
    setCategoriaProd(p.categoria || '')
    setProveedorProd(p.proveedor || p.supplier || '')
    setMinStockProd(String(p.min_stock ?? ''))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const generarCodigoAutomatico = () => {
    const nuevoCodigo = Date.now().toString().slice(-9) + Math.floor(10 + Math.random() * 90)
    setCodigoProd(nuevoCodigo)
  }

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!negocioActual?.id) return

    const nombre = nombreProd.trim()
    const precio = parseFloat(precioProd)
    const costo = parseFloat(costoProd) || 0
    const stock = parseInt(stockProd, 10) || 0
    const minStock = parseInt(minStockProd, 10) || 0

    if (!nombre || isNaN(precio) || precio < 0) {
      alert('El producto debe tener al menos un nombre y un precio de venta válido.')
      return
    }

    setGuardandoProducto(true)
    try {
      const payload: any = {
        name: nombre,
        sale_price: precio,
        cost_price: costo,
        stock: stock,
        min_stock: isNaN(minStock) ? 0 : minStock,
        barcode: codigoProd.trim() || null,
        sku: codigoProd.trim() || null,
        category_id: categoriaProd || null,
        supplier: proveedorProd.trim() || 'General',
        active: true,
        negocio_id: negocioActual.id,
      }

      if (productoAEditar) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productoAEditar.id)
          .eq('negocio_id', negocioActual.id)

        if (error) throw error
        alert(`Producto "${nombre}" actualizado con éxito!`)
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        alert(`Producto "${nombre}" creado con éxito!`)
      }

      limpiarFormularioProducto()
      await cargarProductos()
    } catch (err: any) {
      alert(`Error al guardar producto: ${err.message}`)
    } finally {
      setGuardandoProducto(false)
    }
  }

  const crearCategoriaRapida = async () => {
    if (!negocioActual?.id) return
    const nombre = (categoriaNuevaInput || '').trim()
    if (!nombre) return

    try {
      const { data, error } = await supabase
        .from('product_categories')
        .insert({ name: nombre, negocio_id: negocioActual.id })
        .select('*')
        .single()

      if (error) throw error
      setCategoriaNuevaInput('')
      await cargarCategorias()
      if (data?.id) setCategoriaProd(data.id)
    } catch (err: any) {
      alert(`Error creando categoría: ${err.message}`)
    }
  }

  const guardarEdicionDirecta = async (id: string, campo: 'stock' | 'price', valor: number) => {
    if (isNaN(valor) || valor < 0) return
    if (!negocioActual?.id) return
    try {
      const campoDb = campo === 'price' ? 'sale_price' : 'stock'
      const { error } = await supabase
        .from('products')
        .update({ [campoDb]: valor })
        .eq('id', id)
        .eq('negocio_id', negocioActual.id)

      if (error) throw error

      setProductos(prev =>
        prev.map(p => (p.id === id ? { ...p, [campo === 'price' ? 'precio' : 'stock']: valor } : p))
      )
    } catch (err: any) {
      alert(`Error al actualizar: ${err.message}`)
      cargarProductos()
    }
  }

  const agregarAlCarrito = (producto: any) => {
    if (producto.stock <= 0) {
      alert('Producto sin stock disponible.')
      return
    }

    const existe = carrito.find((item) => item.id === producto.id)
    if (existe) {
      if (existe.cantidad >= producto.stock) {
        alert('No hay más stock disponible de este producto.')
        return
      }
      setCarrito(
        carrito.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      )
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }])
    }
  }

  const cambiarCantidad = (id: string, delta: number) => {
    const item = carrito.find((i) => i.id === id)
    if (!item) return

    const prodOriginal = productos.find((p) => p.id === id)
    const nuevoTotal = item.cantidad + delta

    if (nuevoTotal > (prodOriginal?.stock || 0)) {
      alert('Supera el stock disponible.')
      return
    }

    if (nuevoTotal <= 0) {
      setCarrito(carrito.filter((i) => i.id !== id))
    } else {
      setCarrito(
        carrito.map((i) => (i.id === id ? { ...i, cantidad: nuevoTotal } : i))
      )
    }
  }

  const totalCarrito = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0)

  const abrirModalCobro = () => {
    setEfectivoRecibido('')
    if (!turnoAbierto) {
      alert('No puedes cobrar si la caja está cerrada. Abre un turno primero.')
      return
    }
    if (carrito.length === 0) return

    setPagosTemp([{ method: 'efectivo', amount: totalCarrito }])
    setMetodoPagoActual('efectivo')
    setMontoPagoActual('')
    setMostrarModalPago(true)
  }

  const cambiarMetodoPagoSelect = (nuevoMetodo: string) => {
    setMetodoPagoActual(nuevoMetodo)
    setPagosTemp(prev => {
      if (prev.length === 1) {
        return [{ ...prev[0], method: nuevoMetodo }]
      }
      return prev
    })
  }

  const agregarPago = () => {
    const monto = parseFloat(montoPagoActual)
    if (isNaN(monto) || monto <= 0) return
    setPagosTemp([...pagosTemp, { method: metodoPagoActual, amount: monto }])
    setMontoPagoActual('')
  }

  const eliminarPago = (index: number) => {
    setPagosTemp(pagosTemp.filter((_, i) => i !== index))
  }

  const totalPagado = pagosTemp.reduce((acc, p) => acc + p.amount, 0)
  const restaPagar = Math.max(0, totalCarrito - totalPagado)

  const confirmarVentaMultiplesPagos = async () => {
    if (!turnoAbierto) {
      alert('No hay un turno de caja abierto.')
      return
    }

    if (totalPagado < totalCarrito) {
      alert(`Falta cubrir $${(totalCarrito - totalPagado).toLocaleString()} del total.`)
      return
    }

    setProcesandoVenta(true)
    try {
      const itemsPayload = carrito.map(item => ({
        product_id: item.id,
        quantity: item.cantidad,
        unit_price: item.precio
      }))

      const paymentsPayload = pagosTemp.map(p => {
        let metodoLimpio = String(p.method || 'efectivo').toLowerCase()
        if (metodoLimpio === 'mercado_pago' || metodoLimpio === 'mercadopago') {
          metodoLimpio = 'transferencia'
        }
        return {
          method: metodoLimpio,
          amount: p.amount
        }
      })

      const { data, error } = await supabase.rpc('fn_process_sale', {
        p_cash_shift_id: turnoAbierto.id,
        p_client_id: null,
        p_items: itemsPayload,
        p_payments: paymentsPayload,
        p_discount: 0
      })

      if (error) throw error

      const saleId = typeof data === 'string' ? data : (data?.sale_id || data?.id)

      setTicketVenta({
        id: saleId || 'N/A',
        fecha: new Date().toLocaleString('es-AR'),
        items: [...carrito],
        total: totalCarrito,
        pagos: [...pagosTemp],
        turnoId: turnoAbierto.id
      })

      setCarrito([])
      setPagosTemp([])
      setMostrarModalPago(false)
      await cargarProductos()
      await cargarVentasDashboard()
    } catch (err: any) {
      alert(`Error al procesar la venta: ${err.message}`)
    } finally {
      setProcesandoVenta(false)
    }
  }

  const iniciarEscaner = async () => {
    setEscaneando(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        requestAnimationFrame(escanearFrame)
      }
    } catch (err) {
      alert('No se pudo acceder a la cámara.')
      setEscaneando(false)
    }
  }

  const detenerEscaner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setEscaneando(false)
  }

  const escanearFrame = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code) {
            const encontrado = productos.find((p) => p.codigo === code.data)
            if (encontrado) {
              agregarAlCarrito(encontrado)
              detenerEscaner()
              return
            }
          }
        }
      }
    }
    if (escaneando) {
      requestAnimationFrame(escanearFrame)
    }
  }

  const categoriasUnicas = ['TODAS', ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean)))]

  const productosFiltrados = productos.filter((p) => {
    const coincideTexto =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.codigo && p.codigo.toLowerCase().includes(busqueda.toLowerCase()))
    const coincideCat = categoriaSeleccionada === 'TODAS' || p.categoria === categoriaSeleccionada
    return coincideTexto && coincideCat
  })

  const imprimirTicket = () => window.print()
  const imprimirEtiquetas = () => window.print()

  const prepararEtiquetas = (producto: any) => {
    setEtiquetaProducto(producto)
    setCantidadEtiquetas('1')
  }

  useEffect(() => {
    if (etiquetaProducto && etiquetasContenedorRef.current) {
      const svgs = etiquetasContenedorRef.current.querySelectorAll('.barcode-svg')
      svgs.forEach((svg) => {
        try {
          JsBarcode(svg, etiquetaProducto.codigo || '000000', {
            format: 'CODE128',
            width: 1.5,
            height: 40,
            displayValue: true,
            fontSize: 12,
            margin: 0,
          })
        } catch (e) {
          console.error(e)
        }
      })
    }
  }, [etiquetaProducto, cantidadEtiquetas])

  if (!montado) return null

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-purple-500 selection:text-white pb-24 md:pb-6">
      {/* HEADER PRINCIPAL */}
      <header className="sticky top-0 z-40 bg-neutral-900/60 backdrop-blur-xl border-b border-white/10 px-6 py-3 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <span className="text-xl">🏪</span>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wider text-white">TONEXOR</h1>
              <p className="text-xs text-neutral-400">Control Comercial y Caja Transaccional</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SelectorNegocio />
            {turnoAbierto ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-400">Caja Abierta</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
                <span className="h-2 w-2 rounded-full bg-rose-400"></span>
                <span className="text-xs font-bold text-rose-400">Caja Cerrada</span>
              </div>
            )}
          </div>
        </div>

        {/* BARRA DE NAVEGACIÓN COMPLETA (Solo PC/Tablet) */}
        <div className="hidden md:flex max-w-7xl mx-auto gap-2 mt-4 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'pos', label: '🛒 POS / Ventas' },
            { id: 'inventario', label: '📦 Inventario' },
            { id: 'proveedores', label: '🚚 Proveedores' },
            { id: 'gastos', label: '💸 Gastos' },            
            { id: 'arqueo', label: '🔒 Arqueo Ciego' },
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'deudas', label: '👥 Deudas' },
            { id: 'senas', label: '🔖 Señas' },
            { id: 'reposicion', label: '📦 Reposición / Pedidos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVistaActual(tab.id as any)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition shadow-md border-t ${vistaActual === tab.id ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white border-white/30 shadow-purple-900/40' : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10 backdrop-blur-md'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* 📱 BARRA DE NAVEGACIÓN INFERIOR (Solo visible en celulares) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-xl border-t border-white/10 flex justify-around items-center p-2.5 z-50 shadow-2xl print:hidden">
        <button
          onClick={() => setVistaActual('pos')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${vistaActual === 'pos' ? 'text-purple-400' : 'text-neutral-400'}`}
        >
          <span className="text-lg">🛒</span>
          POS
        </button>
        <button
          onClick={() => setVistaActual('inventario')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${vistaActual === 'inventario' ? 'text-purple-400' : 'text-neutral-400'}`}
        >
          <span className="text-lg">📦</span>
          Inventario
        </button>
        <button
          onClick={() => setVistaActual('gastos')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${vistaActual === 'gastos' ? 'text-purple-400' : 'text-neutral-400'}`}
        >
          <span className="text-lg">💸</span>
          Gastos
        </button>
        <button
          onClick={() => setVistaActual('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${vistaActual === 'dashboard' ? 'text-purple-400' : 'text-neutral-400'}`}
        >
          <span className="text-lg">📊</span>
          Dashboard
        </button>
        <button
          onClick={() => setVistaActual('reposicion')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${vistaActual === 'reposicion' ? 'text-purple-400' : 'text-neutral-400'}`}
        >
          <span className="text-lg">📦</span>
          Pedidos
        </button>
      </nav>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="space-y-6">
          {/* PANTALLA DE CAJA CERRADA */}
          {!cargandoTurno && !turnoAbierto && vistaActual === 'pos' && (
            <div className="max-w-md mx-auto my-12 bg-neutral-900/70 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 bg-purple-600/20 text-purple-400 rounded-full flex items-center justify-center mx-auto text-3xl">
                🔒
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Turno Cerrado</h2>
                <p className="text-sm text-neutral-400 mt-1">Ingresa el monto inicial en efectivo para abrir la caja y comenzar a registrar ventas.</p>
              </div>
              <div className="space-y-3 text-left">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">Fondo Inicial ($):</label>
                <input
                  type="number"
                  value={montoInicialInput}
                  onChange={(e) => setMontoInicialInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-neutral-950/80 border border-white/10 rounded-2xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={abrirTurno}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-900/30 transition transform active:scale-95"
              >
                Abrir Turno de Caja
              </button>
            </div>
          )}

          {/* VISTA: POS / VENTAS */}
          {vistaActual === 'pos' && turnoAbierto && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="🔍 Buscar producto por nombre o código de barra..."
                    className="flex-1 bg-neutral-900/60 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={escaneando ? detenerEscaner : iniciarEscaner}
                    className={`px-4 py-3 rounded-2xl font-bold flex items-center gap-2 border transition ${escaneando ? 'bg-rose-600/30 text-rose-300 border-rose-500' : 'bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30'}`}
                  >
                    📷 {escaneando ? 'Cerrar' : 'Cámara'}
                  </button>
                </div>

                {escaneando && (
                  <div className="relative bg-black rounded-3xl overflow-hidden border border-purple-500/30 p-2">
                    <video ref={videoRef} className="w-full h-48 object-cover rounded-2xl" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 border-2 border-purple-500/50 pointer-events-none rounded-3xl animate-pulse"></div>
                  </div>
                )}

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {categoriasUnicas.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoriaSeleccionada(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${categoriaSeleccionada === cat ? 'bg-white/20 text-white border-white/40' : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'}`}
                    >
                      {cat === 'TODAS' ? 'Todas las categorías' : (categoriasDB.find(c => c.id === cat)?.name || 'Categoría')}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                  {productosFiltrados.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => agregarAlCarrito(p)}
                      className="group bg-neutral-900/50 hover:bg-neutral-800/80 border border-white/5 hover:border-purple-500/40 p-3.5 rounded-2xl text-left transition flex flex-col justify-between shadow-lg"
                    >
                      <div>
                        <div className="flex justify-end items-center mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${p.stock <= p.min_stock ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-neutral-300'}`}>
                            Stock: {p.stock}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition line-clamp-2 mt-1">{p.nombre}</h4>
                      </div>
                      <div className="mt-3">
                        <p className="text-base font-black text-white">${p.precio.toLocaleString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CARRITO Y COBRO */}
              <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col justify-between shadow-2xl h-[75vh]">
                <div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
                    <h3 className="font-black text-base text-white">Carrito de Compra</h3>
                    <button onClick={() => setCarrito([])} className="text-xs text-rose-400 hover:text-rose-300 font-bold">Vaciar</button>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[45vh] pr-1">
                    {carrito.map((item) => (
                      <div key={item.id} className="bg-neutral-950/60 border border-white/5 rounded-2xl p-3 flex justify-between items-center">
                        <div className="flex-1 pr-2">
                          <p className="text-xs font-bold text-white truncate">{item.nombre}</p>
                          <p className="text-[11px] text-neutral-400">${item.precio.toLocaleString()} c/u</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-white/5 rounded-xl border border-white/10">
                            <button onClick={() => cambiarCantidad(item.id, -1)} className="px-2 py-1 text-xs text-neutral-300 hover:text-white">-</button>
                            <span className="px-2 text-xs font-bold text-white">{item.cantidad}</span>
                            <button onClick={() => cambiarCantidad(item.id, 1)} className="px-2 py-1 text-xs text-neutral-300 hover:text-white">+</button>
                          </div>
                          <p className="text-xs font-bold text-white w-14 text-right">${(item.precio * item.cantidad).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {carrito.length === 0 && (
                      <p className="text-center text-xs text-neutral-500 py-10">No hay productos en el carrito</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-400 font-bold">TOTAL:</span>
                    <span className="text-2xl font-black text-white">${totalCarrito.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={abrirModalCobro}
                    disabled={carrito.length === 0}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-950/40 transition transform active:scale-95"
                  >
                    Cobrar Venta
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA: INVENTARIO */}
          {vistaActual === 'inventario' && (
            <div className="space-y-8">
              <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-white">
                      {productoAEditar ? `✏️ Editando: ${productoAEditar.nombre}` : '✨ Cargar Nuevo Producto'}
                    </h3>
                    <p className="text-xs text-neutral-400">Ingresá los datos del artículo para tu catálogo comercial</p>
                  </div>
                  {productoAEditar && (
                    <button onClick={limpiarFormularioProducto} className="bg-white/5 hover:bg-white/10 text-neutral-300 text-xs px-3 py-1.5 rounded-xl border border-white/10">
                      ✕ Cancelar Edición
                    </button>
                  )}
                </div>

                <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Nombre del Producto *</label>
                    <input
                      type="text"
                      value={nombreProd}
                      onChange={(e) => setNombreProd(e.target.value)}
                      placeholder="Ej: Remera Algodón Talle M"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Código de Barras / SKU</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={codigoProd}
                        onChange={(e) => setCodigoProd(e.target.value)}
                        placeholder="779123456789"
                        className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={generarCodigoAutomatico}
                        title="Generar código aleatorio"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 rounded-xl text-sm font-bold text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        🎲 Auto
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Precio de Venta ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={precioProd}
                      onChange={(e) => setPrecioProd(e.target.value)}
                      placeholder="15000"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-bold text-emerald-400 focus:border-purple-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Costo de Compra ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={costoProd}
                      onChange={(e) => setCostoProd(e.target.value)}
                      placeholder="8000"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Stock Actual</label>
                    <input
                      type="number"
                      value={stockProd}
                      onChange={(e) => setStockProd(e.target.value)}
                      placeholder="10"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Stock Mínimo (Alerta)</label>
                    <input
                      type="number"
                      value={minStockProd}
                      onChange={(e) => setMinStockProd(e.target.value)}
                      placeholder="3"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Proveedor</label>
                    <input
                      type="text"
                      value={proveedorProd}
                      onChange={(e) => setProveedorProd(e.target.value)}
                      placeholder="Ej: Distribuidora Norte"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Categoría</label>
                    <select
                      value={categoriaProd}
                      onChange={(e) => setCategoriaProd(e.target.value)}
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500"
                    >
                      <option value="">Sin categoría asignada</option>
                      {categoriasDB.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-neutral-400">Nueva Categoría Rápida</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={categoriaNuevaInput}
                        onChange={(e) => setCategoriaNuevaInput(e.target.value)}
                        placeholder="Crear categoría..."
                        className="flex-1 bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={crearCategoriaRapida}
                        className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold"
                      >
                        + Crear
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-4 flex justify-end gap-3 mt-4">
                    <button
                      type="submit"
                      disabled={guardandoProducto}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black px-8 py-3 rounded-2xl shadow-xl shadow-purple-900/30 transition transform active:scale-95"
                    >
                      {guardandoProducto ? 'Guardando...' : productoAEditar ? '💾 Guardar Cambios' : '➕ Registrar Producto'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-white">Listado de Artículos</h3>
                    <p className="text-xs text-neutral-400">Podés editar stock o precio directamente haciendo clic en los valores</p>
                  </div>
                  <input
                    type="text"
                    value={busquedaInventario}
                    onChange={(e) => setBusquedaInventario(e.target.value)}
                    placeholder="🔍 Buscar en inventario..."
                    className="bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2 text-white text-sm w-full sm:w-72"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-neutral-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Artículo</th>
                        <th className="p-3">Código</th>
                        <th className="p-3">Proveedor</th>
                        <th className="p-3">Stock</th>
                        <th className="p-3">Precio Venta</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {productos
                        .filter(p => p.nombre.toLowerCase().includes(busquedaInventario.toLowerCase()) || (p.codigo && p.codigo.includes(busquedaInventario)))
                        .map((p) => (
                          <tr key={p.id} className="hover:bg-white/5 transition">
                            <td className="p-3 font-bold text-white">{p.nombre}</td>
                            <td className="p-3 text-xs text-neutral-400 font-mono">{p.codigo || '-'}</td>
                            <td className="p-3 text-xs text-neutral-300">{p.proveedor}</td>
                            <td className="p-3">
                              <input
                                type="number"
                                defaultValue={p.stock}
                                onBlur={(e) => guardarEdicionDirecta(p.id, 'stock', parseInt(e.target.value, 10))}
                                className="w-16 bg-neutral-950/60 border border-white/10 rounded-lg px-2 py-1 text-white font-bold"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={p.precio}
                                onBlur={(e) => guardarEdicionDirecta(p.id, 'price', parseFloat(e.target.value))}
                                className="w-24 bg-neutral-950/60 border border-white/10 rounded-lg px-2 py-1 text-emerald-400 font-bold"
                              />
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => seleccionarProductoParaEditar(p)}
                                className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs px-2.5 py-1.5 rounded-lg border border-purple-500/20"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => prepararEtiquetas(p)}
                                className="bg-white/5 hover:bg-white/10 text-neutral-300 text-xs px-2.5 py-1.5 rounded-lg border border-white/10"
                              >
                                🏷️ Etiqueta
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* OTRAS VISTAS INTEGRADAS */}
          {vistaActual === 'proveedores' && <ProveedoresView />}
          {vistaActual === 'gastos' && <GastosView />}          
          {vistaActual === 'arqueo' && (
            <ArqueoView
              turnoPadre={turnoAbierto}
              onTurnoCerrado={async () => {
                setTurnoAbierto(null)
                await verificarTurnoAbierto()
              }}
              onVolverPos={() => setVistaActual('pos')}
            />
          )}
          {vistaActual === 'dashboard' && <DashboardView />}
          {vistaActual === 'deudas' && <div className="print:hidden"><ModuloDeudas /></div>}
          {vistaActual === 'senas' && <div className="print:hidden"><ModuloSenas /></div>}
          {vistaActual === 'reposicion' && <div className="print:hidden"><ModuloReposicion /></div>}
        </div>

        {/* MODAL DE PAGOS MÚLTIPLES */}
        {mostrarModalPago && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-50 print:hidden">
            <div className="bg-neutral-900/90 backdrop-blur-2xl rounded-3xl max-w-md w-full border border-white/20 p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h3 className="text-xl font-black text-white">💳 Cobro de Venta</h3>
                <button onClick={() => setMostrarModalPago(false)} className="text-neutral-400 hover:text-white font-bold p-1 bg-white/5 rounded-xl">✕</button>
              </div>

              <div className="bg-neutral-950/60 p-4 rounded-2xl border border-white/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total a Pagar:</span>
                  <span className="font-black text-white">${totalCarrito.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total Cubierto:</span>
                  <span className="font-bold text-emerald-400">${totalPagado.toLocaleString()}</span>
                </div>
                {restaPagar > 0 && (
                  <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                    <span className="text-rose-400 font-bold">Falta Cubrir:</span>
                    <span className="font-black text-rose-400">${restaPagar.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {metodoPagoActual === 'efectivo' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl space-y-3">
                  <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">
                    💵 Dinero recibido en efectivo
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="1"
                      value={efectivoRecibido}
                      onChange={(e) => setEfectivoRecibido(e.target.value)}
                      placeholder="¿Con cuánto abona?"
                      className="flex-1 bg-neutral-950 border border-emerald-500/30 rounded-xl px-3 py-2 text-white text-base font-black"
                    />
                    <button
                      type="button"
                      onClick={() => setEfectivoRecibido(String(montoPagoActual || restaPagar))}
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold"
                    >
                      Exacto
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Agregar Pago</label>
                <div className="flex gap-2">
                  <select
                    value={metodoPagoActual}
                    onChange={(e) => cambiarMetodoPagoSelect(e.target.value)}
                    className="bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta_debito">Débito</option>
                    <option value="tarjeta_credito">Crédito</option>
                    <option value="mercado_pago">Mercado Pago</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={montoPagoActual}
                    onChange={(e) => setMontoPagoActual(e.target.value)}
                    placeholder={restaPagar > 0 ? String(restaPagar) : 'Monto'}
                    className="flex-1 bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold"
                  />
                  <button
                    onClick={agregarPago}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-36 overflow-y-auto">
                {pagosTemp.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-xl text-xs">
                    <span className="font-bold text-neutral-200 capitalize">{p.method.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-emerald-400">${p.amount.toLocaleString()}</span>
                      <button onClick={() => eliminarPago(idx)} className="text-rose-400 hover:text-rose-300 font-bold">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={confirmarVentaMultiplesPagos}
                disabled={procesandoVenta || restaPagar > 0}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-950/40 disabled:opacity-30 transition transform active:scale-95"
              >
                {procesandoVenta ? 'Procesando Venta...' : 'Completar Venta y Cobro'}
              </button>
            </div>
          </div>
        )}

        {/* TICKET DE VENTA */}
        {ticketVenta && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-50 print:p-0 print:static print:bg-transparent">
            <div className="bg-white text-black p-6 rounded-3xl max-w-sm w-full font-mono text-xs shadow-2xl print:shadow-none print:w-full print:p-0">
              <div className="text-center space-y-1 border-b border-black/20 pb-4 mb-4">
                <h2 className="text-base font-black uppercase">{negocioActual?.nombre_negocio || 'MI COMERCIO'}</h2>
                <p className="text-[10px] text-neutral-600">Comprobante No Válido como Factura</p>
                <p className="text-[10px] text-neutral-600">{ticketVenta.fecha}</p>
                <p className="text-[10px] text-neutral-600 font-bold">Ticket #{ticketVenta.id.substring(0, 8)}</p>
              </div>

              <div className="border-b border-black/20 pb-3 mb-3 space-y-2">
                {ticketVenta.items.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>{i.cantidad}x {i.nombre}</span>
                    <span className="font-bold">${(i.precio * i.cantidad).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-b border-black/20 pb-3 mb-3">
                <div className="flex justify-between font-black text-sm">
                  <span>TOTAL:</span>
                  <span>${ticketVenta.total.toLocaleString()}</span>
                </div>
                {ticketVenta.pagos.map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px] text-neutral-700">
                    <span className="capitalize">{p.method.replace('_', ' ')}:</span>
                    <span>${p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-center my-3">
                <svg ref={barcodeTicketRef} className="w-full max-h-12"></svg>
              </div>

              <p className="text-center text-[10px] text-neutral-500 mb-4">¡Gracias por su compra!</p>

              <div className="flex gap-2 print:hidden">
                <button
                  onClick={imprimirTicket}
                  className="flex-1 bg-black text-white font-bold py-2.5 rounded-xl text-xs hover:bg-neutral-800"
                >
                  🖨️ Imprimir
                </button>
                <button
                  onClick={() => setTicketVenta(null)}
                  className="flex-1 bg-neutral-200 text-black font-bold py-2.5 rounded-xl text-xs hover:bg-neutral-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ETIQUETAS DE CÓDIGO DE BARRAS */}
        {etiquetaProducto && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-50 print:p-0 print:static print:bg-transparent">
            <div className="bg-neutral-900 border border-white/20 p-6 rounded-3xl max-w-md w-full shadow-2xl print:bg-white print:border-none print:w-full print:p-0 space-y-4">
              <div className="flex justify-between items-center print:hidden border-b border-white/10 pb-3">
                <h3 className="font-black text-white text-base">🏷️ Imprimir Etiquetas</h3>
                <button onClick={() => setEtiquetaProducto(null)} className="text-neutral-400 font-bold">✕</button>
              </div>

              <div className="flex items-center gap-3 print:hidden">
                <label className="text-xs text-neutral-300 font-bold">Cantidad de Copias:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={cantidadEtiquetas}
                  onChange={(e) => setCantidadEtiquetas(e.target.value)}
                  className="w-20 bg-neutral-950 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-bold"
                />
              </div>

              <div ref={etiquetasContenedorRef} className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2 print:overflow-visible print:p-0">
                {Array.from({ length: Math.max(1, parseInt(cantidadEtiquetas, 10) || 1) }).map((_, i) => (
                  <div key={i} className="bg-white text-black p-3 rounded-2xl border border-neutral-300 flex flex-col items-center justify-between text-center font-mono">
                    <p className="font-bold text-xs truncate w-full">{etiquetaProducto.nombre}</p>
                    <p className="text-base font-black my-1">${etiquetaProducto.precio.toLocaleString()}</p>
                    <svg className="barcode-svg w-full max-h-10"></svg>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 print:hidden">
                <button
                  onClick={imprimirEtiquetas}
                  className="flex-1 bg-purple-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-purple-500"
                >
                  🖨️ Imprimir Etiquetas
                </button>
                <button
                  onClick={() => setEtiquetaProducto(null)}
                  className="flex-1 bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}