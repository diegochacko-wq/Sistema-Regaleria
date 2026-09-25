'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNegocio } from '@/context/NegocioContext'

export default function PosView() {
  const { negocioActual } = useNegocio()
  const [productos, setProductos] = useState<any[]>([])
  const [carrito, setCarrito] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (negocioActual?.id) {
      cargarProductos()
    }
  }, [negocioActual?.id])

  const cargarProductos = async () => {
    if (!negocioActual?.id) return
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('negocio_id', negocioActual.id)
      
      if (error) throw error
      setProductos(data || [])
    } catch (err) {
      console.error('Error al cargar productos:', err)
    } finally {
      setCargando(false)
    }
  }

  const agregarAlCarrito = (producto: any) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id)
      if (existe) {
        return prev.map(item => 
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const totalCarrito = carrito.reduce((acc, item) => acc + (item.price * item.cantidad), 0)

  const productosFiltrados = productos.filter(p => 
    p.name?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      {/* Listado de Productos */}
      <div className="lg:col-span-2 bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-xl">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar productos para la venta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 md:grid-cols-3 gap-3">
          {productosFiltrados.map(prod => (
            <button
              key={prod.id}
              onClick={() => agregarAlCarrito(prod)}
              className="bg-neutral-950/80 hover:bg-white/5 border border-white/5 hover:border-purple-500/50 p-4 rounded-2xl text-left flex flex-col justify-between transition group"
            >
              <div>
                <p className="font-bold text-white text-sm line-clamp-2 group-hover:text-purple-300 transition">{prod.name}</p>
                <span className="text-xs text-neutral-400 mt-1 block">Stock: {prod.stock ?? 0}</span>
              </div>
              <p className="text-emerald-400 font-black mt-3 text-base">${Number(prod.price || 0).toLocaleString()}</p>
            </button>
          ))}
          {productosFiltrados.length === 0 && !cargando && (
            <div className="col-span-full py-12 text-center text-neutral-500 text-sm">
              No se encontraron productos.
            </div>
          )}
        </div>
      </div>

      {/* Carrito / Ticket de Venta */}
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-xl justify-between">
        <div>
          <h3 className="font-black text-white text-lg mb-4">🛒 Ticket Actual</h3>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {carrito.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-neutral-950/60 p-3 rounded-xl border border-white/5">
                <div>
                  <p className="font-bold text-white text-xs">{item.name}</p>
                  <p className="text-neutral-400 text-xs">${item.price} x {item.cantidad}</p>
                </div>
                <p className="font-black text-white text-sm">${item.price * item.cantidad}</p>
              </div>
            ))}
            {carrito.length === 0 && (
              <p className="text-neutral-500 text-xs text-center py-8">El carrito está vacío.</p>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 pt-4 mt-4 space-y-4">
          <div className="flex justify-between items-center text-lg">
            <span className="font-bold text-neutral-300">Total:</span>
            <span className="font-black text-emerald-400 text-2xl">${totalCarrito.toLocaleString()}</span>
          </div>
          <button
            disabled={carrito.length === 0}
            onClick={() => {
              alert('Cobro procesado (conéctalo con tu función de pago actual).')
              setCarrito([])
            }}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-lg transition"
          >
            Cobrar Venta
          </button>
        </div>
      </div>
    </div>
  )
}