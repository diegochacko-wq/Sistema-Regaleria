'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNegocio } from '@/context/NegocioContext'
import { useNotificaciones } from '@/components/Notificaciones'

export function PedidosView() {
  const { negocioActual } = useNegocio()
  const { notificar } = useNotificaciones()

  const [productos, setProductos] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [carritoPedidos, setCarritoPedidos] = useState<{ [key: string]: number }>({})

  const negocioNombre = (negocioActual as any)?.name || (negocioActual as any)?.nombre || 'Local'

  useEffect(() => {
    if (negocioActual?.id) {
      cargarDatos()
    }
  }, [negocioActual?.id])

  const cargarDatos = async () => {
    if (!negocioActual?.id) return
    setCargando(true)
    try {
      const [resProd, resProv] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('negocio_id', negocioActual.id)
          .order('name'),
        supabase
          .from('suppliers')
          .select('*')
          .order('name')
      ])

      if (resProd.error) throw resProd.error
      if (resProv.error) throw resProv.error

      setProductos(resProd.data || [])
      setProveedores(resProv.data || [])
    } catch (err: any) {
      notificar('error', `Error al cargar datos de pedidos: ${err.message}`, 'Pedidos')
    } finally {
      setCargando(false)
    }
  }

  // Filtrar productos con stock bajo o faltante (stock <= min_stock)
  const productosReposicion = productos.filter((p) => {
    const stock = Number(p.stock || 0)
    const minStock = Number(p.min_stock || 1)
    const cumpleStockBajo = stock <= minStock

    const matchProveedor =
      proveedorSeleccionado === 'TODOS' ||
      (p.supplier && p.supplier.toLowerCase() === proveedorSeleccionado.toLowerCase())

    const matchBusqueda =
      p.name.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.barcode && p.barcode.includes(busqueda))

    return cumpleStockBajo && matchProveedor && matchBusqueda
  })

  const cambiarCantidadPedido = (id: string, cantidad: number) => {
    setCarritoPedidos((prev) => {
      const nuevo = { ...prev }
      if (cantidad <= 0) {
        delete nuevo[id]
      } else {
        nuevo[id] = cantidad
      }
      return nuevo
    })
  }

  const agregarAlPedido = (p: any) => {
    const stock = Number(p.stock || 0)
    const minStock = Number(p.min_stock || 1)
    const sugerido = Math.max(1, minStock - stock + 2)
    const actual = carritoPedidos[p.id] || 0
    cambiarCantidadPedido(p.id, actual > 0 ? actual + 1 : sugerido)
  }

  const vaciarCarrito = () => {
    setCarritoPedidos({})
    notificar('exito', 'Se ha vaciado el pedido actual', 'Pedidos')
  }

  const exportarPedido = (formato: 'excel' | 'word' | 'email' | 'whatsapp') => {
    const itemsAPedir = productos.filter((p) => (carritoPedidos[p.id] || 0) > 0)

    if (itemsAPedir.length === 0) {
      notificar('error', 'No hay productos seleccionados para el pedido.', 'Pedidos')
      return
    }

    if (formato === 'whatsapp') {
      let texto = `*PEDIDO DE REPOSICIÓN - ${negocioNombre}*\n\n`
      itemsAPedir.forEach((p, idx) => {
        texto += `${idx + 1}. *${p.name}* - Cantidad: *${carritoPedidos[p.id]} u.*\n`
      })
      texto += `\nEnviado desde el sistema de gestión.`
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`
      window.open(url, '_blank')
      return
    }

    if (formato === 'email') {
      let asunto = encodeURIComponent(`Pedido de Reposición - ${negocioNombre}`)
      let cuerpo = `Hola,%0D%0A%0D%0AAdjunto el detalle del pedido de reposición:%0D%0A%0D%0A`
      itemsAPedir.forEach((p, idx) => {
        cuerpo += `${idx + 1}. ${p.name} - Cantidad: ${carritoPedidos[p.id]} u.%0D%0A`
      })
      window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`
      return
    }

    if (formato === 'excel' || formato === 'word') {
      let contenidoHtml = `
        <html>
          <head>
            <meta charset="utf-8">
            <title>Pedido de Reposición</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              h2 { color: #6d28d9; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f3f4f6; }
            </style>
          </head>
          <body>
            <h2>Pedido de Reposición - ${negocioNombre}</h2>
            <p>Fecha: ${new Date().toLocaleDateString('es-AR')}</p>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th>Stock Actual</th>
                  <th>Cantidad a Pedir</th>
                </tr>
              </thead>
              <tbody>
                ${itemsAPedir
                  .map(
                    (p) => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.supplier || 'General'}</td>
                    <td>${p.stock}</td>
                    <td><b>${carritoPedidos[p.id]}</b></td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </body>
        </html>
      `

      const blobType = formato === 'excel' ? 'application/vnd.ms-excel' : 'application/msword'
      const extension = formato === 'excel' ? 'xls' : 'doc'
      const blob = new Blob([contenidoHtml], { type: blobType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Pedido_Reposicion_${new Date().toISOString().slice(0, 10)}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notificar('exito', `Pedido exportado correctamente a ${formato.toUpperCase()}`, 'Pedidos')
    }
  }

  // Agrupar items del carrito por proveedor para mostrarlos abajo
  const itemsEnCarrito = productos.filter((p) => (carritoPedidos[p.id] || 0) > 0)
  const carritoPorProveedor: { [prov: string]: any[] } = {}
  itemsEnCarrito.forEach((p) => {
    const prov = p.supplier || 'General'
    if (!carritoPorProveedor[prov]) carritoPorProveedor[prov] = []
    carritoPorProveedor[prov].push(p)
  })

  return (
    <div className="space-y-6 pb-64">
      {/* HEADER DE LA SECCIÓN */}
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <span>📦</span> Reposición / Pedidos
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            {productosReposicion.length} producto(s) con stock bajo o faltante
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={cargarDatos}
            className="bg-white/5 hover:bg-white/10 text-neutral-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-white/10 transition cursor-pointer flex items-center gap-1.5"
          >
            <span>🔄</span> Actualizar Stock
          </button>
        </div>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar producto a reponer..."
            className="w-full bg-neutral-900/80 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:border-purple-500 shadow-inner"
          />
        </div>

        <div>
          <select
            value={proveedorSeleccionado}
            onChange={(e) => setProveedorSeleccionado(e.target.value)}
            className="w-full bg-neutral-900/80 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-bold focus:border-purple-500 shadow-inner"
          >
            <option value="TODOS">Todos los proveedores</option>
            {proveedores.map((prov) => (
              <option key={prov.id} value={prov.name}>
                {prov.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE PRODUCTOS A REPONER */}
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-white/5 text-neutral-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Producto</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Mínimo</th>
                <th className="p-4">Sugerido</th>
                <th className="p-4">Proveedor</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400">
                    Cargando productos para reposición...
                  </td>
                </tr>
              ) : productosReposicion.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400">
                    ¡Excelente! No hay productos por debajo del stock mínimo con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                productosReposicion.map((p) => {
                  const stock = Number(p.stock || 0)
                  const minStock = Number(p.min_stock || 1)
                  const sugerido = Math.max(1, minStock - stock + 2)
                  const enPedido = (carritoPedidos[p.id] || 0) > 0

                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition">
                      <td className="p-4">
                        <p className="font-bold text-white">{p.name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          Costo: ${Number(p.cost_price || p.cost || 0).toLocaleString('es-AR')}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-black">
                          {stock}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-300 font-bold">{minStock}</td>
                      <td className="p-4 text-emerald-400 font-black">{sugerido}</td>
                      <td className="p-4 text-xs text-neutral-300 font-bold">{p.supplier || 'General'}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => agregarAlPedido(p)}
                          className={`text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ml-auto ${
                            enPedido
                              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {enPedido ? `✓ En pedido (${carritoPedidos[p.id]})` : '+ Agregar'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PANEL FLOTANTE INFERIOR DEL CARRITO DE PEDIDOS */}
      {itemsEnCarrito.length > 0 && (
        <div className="fixed bottom-16 md:bottom-4 left-4 right-4 bg-neutral-900/95 backdrop-blur-2xl border border-purple-500/40 rounded-3xl p-4 shadow-2xl z-40 max-w-6xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-5">
          {/* BOTONERA DE ACCIÓN / EXPORTACIÓN */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <p className="text-sm font-black text-white flex items-center gap-2">
              <span>🛒</span> Carrito de Pedidos <span className="text-purple-400">({itemsEnCarrito.length} ítems)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => exportarPedido('whatsapp')}
                className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-lg shadow-green-900/40 cursor-pointer flex items-center gap-1"
              >
                <span>💬</span> WhatsApp
              </button>
              <button
                onClick={() => exportarPedido('email')}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <span>✉️</span> Email
              </button>
              <button
                onClick={() => exportarPedido('excel')}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <span>📊</span> Excel
              </button>
              <button
                onClick={() => exportarPedido('word')}
                className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <span>📝</span> Word
              </button>
              <button
                onClick={vaciarCarrito}
                className="bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <span>🗑️</span> Vaciar
              </button>
            </div>
          </div>

          {/* LISTADO DE ITEMS AGRUPADOS POR PROVEEDOR EN EL CARRITO */}
          <div className="max-h-56 overflow-y-auto space-y-3 pr-2">
            {Object.entries(carritoPorProveedor).map(([proveedor, items]) => (
              <div key={proveedor} className="bg-neutral-950/60 border border-white/10 rounded-2xl p-3 space-y-2">
                <p className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏷️</span> {proveedor}
                </p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 bg-white/5 px-3 py-2 rounded-xl">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-neutral-400">Stock: {item.stock} / Mín: {item.min_stock || 1}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={carritoPedidos[item.id] || 1}
                          onChange={(e) => cambiarCantidadPedido(item.id, parseInt(e.target.value) || 0)}
                          className="w-16 bg-neutral-950 border border-white/10 rounded-xl px-2.5 py-1 text-white text-center font-bold text-xs"
                        />
                        <button
                          onClick={() => cambiarCantidadPedido(item.id, 0)}
                          className="text-neutral-400 hover:text-red-400 text-sm font-bold px-2 py-1 transition cursor-pointer"
                          title="Quitar del pedido"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}