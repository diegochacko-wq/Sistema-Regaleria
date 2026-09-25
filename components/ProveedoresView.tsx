'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNegocio } from '@/context/NegocioContext'

// ============================================================
// ProveedoresView — Módulo aislado de Resumen y Catálogo por Proveedor
// Muestra métricas acumuladas de stock, inversión en costo y
// valor proyectado de venta por cada proveedor.
// ============================================================
export default function ProveedoresView() {
  const { negocioActual } = useNegocio()
  const [productos, setProductos] = useState<any[]>([])
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
        .select('id, name, stock, min_stock, supplier, sale_price, cost_price, active')
        .eq('business_id', negocioActual.id)
        .order('name')

      if (error) throw error

      const adaptados = (data || []).map((p: any) => ({
        ...p,
        nombre: p.name,
        proveedor: p.supplier || 'General'
      }))
      setProductos(adaptados)
    } catch (err: any) {
      console.error('Error cargando productos para proveedores:', err)
    } finally {
      setCargando(false)
    }
  }

  // Agrupación y acumulados por proveedor (Costo y Venta)
  const proveedoresResumen = productos.reduce((acc: any, p: any) => {
    const prov = p.proveedor || p.supplier || 'General'
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
    const costo = Number(p.cost_price ?? p.costo ?? p.precio_costo ?? 0)
    const venta = Number(p.sale_price ?? p.precio ?? 0)
    const stock = Number(p.stock ?? 0)

    acc[prov].cantidadProductos += 1
    acc[prov].stockTotal += stock
    acc[prov].inversionCosto += costo * stock
    acc[prov].valorVenta += venta * stock
    acc[prov].productosLista.push(p)
    return acc
  }, {})

  const listaProveedoresResumen: any[] = Object.values(proveedoresResumen)

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-white">🚚 Resumen y Catálogo por Proveedor</h3>
            <p className="text-xs text-neutral-400">Totales acumulados de stock, inversión en costo y valor proyectado de venta por proveedor</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs bg-white/5 px-4 py-2.5 rounded-2xl border border-white/10">
            <div>
              <span className="text-neutral-400 block">Proveedores:</span>
              <strong className="text-white text-sm">{listaProveedoresResumen.length}</strong>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-neutral-400 block">Inversión Global (Costo):</span>
              <strong className="text-amber-400 text-sm">
                ${listaProveedoresResumen.reduce((acc: number, p: any) => acc + p.inversionCosto, 0).toLocaleString('es-AR')}
              </strong>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-neutral-400 block">Valor Global (Venta):</span>
              <strong className="text-emerald-400 text-sm">
                ${listaProveedoresResumen.reduce((acc: number, p: any) => acc + p.valorVenta, 0).toLocaleString('es-AR')}
              </strong>
            </div>
          </div>
        </div>

        {cargando ? (
          <div className="p-8 text-center text-sm text-neutral-400">Cargando catálogo por proveedor...</div>
        ) : listaProveedoresResumen.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-400">No hay productos registrados en este negocio.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listaProveedoresResumen.map((prov: any) => {
              const gananciaEstimada = prov.valorVenta - prov.inversionCosto
              return (
                <div key={prov.proveedor} className="bg-neutral-950/70 border border-white/10 rounded-2xl p-5 space-y-4 hover:border-purple-500/40 transition shadow-lg">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <h4 className="font-black text-purple-400 text-lg">{prov.proveedor}</h4>
                    <span className="text-xs bg-purple-500/10 text-purple-300 font-semibold px-2.5 py-1 rounded-lg border border-purple-500/20">
                      {prov.cantidadProductos} {prov.cantidadProductos === 1 ? 'artículo' : 'artículos'}
                    </span>
                  </div>

                  {/* Métricas acumuladas */}
                  <div className="grid grid-cols-2 gap-3 bg-white/[0.03] p-3 rounded-xl border border-white/5 text-xs">
                    <div>
                      <span className="text-neutral-400 block">Stock Total:</span>
                      <strong className="text-white text-sm">{prov.stockTotal} un.</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">Ganancia Proy.:</span>
                      <strong className={`text-sm ${gananciaEstimada >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${gananciaEstimada.toLocaleString('es-AR')}
                      </strong>
                    </div>
                    <div className="pt-1 border-t border-white/5">
                      <span className="text-neutral-400 block">Inversión (Costo):</span>
                      <strong className="text-neutral-200 text-sm">${prov.inversionCosto.toLocaleString('es-AR')}</strong>
                    </div>
                    <div className="pt-1 border-t border-white/5">
                      <span className="text-neutral-400 block">Valor de Venta:</span>
                      <strong className="text-emerald-400 text-sm">${prov.valorVenta.toLocaleString('es-AR')}</strong>
                    </div>
                  </div>

                  {/* Lista de productos bajo este proveedor */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">Detalle de productos:</span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {prov.productosLista.map((p: any) => {
                        const pCosto = Number(p.cost_price ?? p.costo ?? p.precio_costo ?? 0)
                        const pVenta = Number(p.sale_price ?? p.precio ?? 0)
                        return (
                          <div key={p.id} className="flex justify-between items-center text-xs bg-white/[0.02] p-2 rounded-lg border border-white/5">
                            <div className="min-w-0 pr-2">
                              <p className="text-neutral-200 font-medium truncate">{p.nombre}</p>
                              <p className="text-[10px] text-neutral-400">
                                Costo: ${pCosto.toLocaleString('es-AR')} \vert{} Venta:${pVenta.toLocaleString('es-AR')}
                              </p>
                            </div>
                            <span className={`font-bold px-2 py-0.5 rounded text-[11px] shrink-0 ${p.stock <= p.min_stock ? 'bg-rose-500/20 text-rose-300' : 'bg-white/5 text-neutral-300'}`}>
                              {p.stock} un.
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}