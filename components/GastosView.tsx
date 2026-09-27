'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNegocio } from '@/context/NegocioContext'
import { useNotificaciones } from '@/components/Notificaciones'

export default function GastosView() {
  const { negocioActual } = useNegocio()
  const { notificar } = useNotificaciones()

  const [gastos, setGastos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState('General')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (negocioActual?.id) {
      cargarGastos()
    }
  }, [negocioActual?.id])

  const cargarGastos = async () => {
    if (!negocioActual?.id) return
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('negocio_id', negocioActual.id)
        .eq('type', 'egreso')
        .order('created_at', { ascending: false })

      if (error) throw error
      setGastos(data || [])
    } catch (err: any) {
      console.error('Error al cargar gastos:', err)
      notificar('error', 'No se pudieron cargar los gastos', 'Error')
    } finally {
      setCargando(false)
    }
  }

  const registrarGasto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!negocioActual?.id) return

    const montoNum = parseFloat(monto)
    if (!descripcion.trim() || isNaN(montoNum) || montoNum <= 0) {
      notificar('error', 'Ingresá una descripción y un monto válido', 'Gastos')
      return
    }

    setGuardando(true)
    try {
      const { error } = await supabase.from('cash_movements').insert({
        negocio_id: negocioActual.id,
        type: 'egreso',
        amount: montoNum,
        description: descripcion.trim(),
        category: categoria,
        created_at: new Date().toISOString()
      })

      if (error) throw error

      notificar('exito', 'Gasto registrado correctamente', 'Gastos')
      setDescripcion('')
      setMonto('')
      cargarGastos()
    } catch (err: any) {
      console.error('Error al registrar gasto:', err)
      notificar('error', err.message || 'Error al registrar el gasto', 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-rose-600/20 to-orange-600/20 backdrop-blur-md rounded-2xl p-5 border border-rose-500/30">
        <h2 className="text-2xl font-black text-white">💸 Control de Gastos y Egreso</h2>
        <p className="text-rose-200/80 text-sm mt-1">Registrá salidas de dinero y pagos operativos del negocio.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="bg-neutral-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-5 h-fit">
          <h3 className="text-lg font-black text-white mb-4">➕ Nuevo Gasto</h3>
          <form onSubmit={registrarGasto} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1">Descripción *</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Pago de Luz, Insumos..."
                className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1">Monto ($) *</label>
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-bold text-rose-400"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm"
              >
                <option value="General">General</option>
                <option value="Servicios">Servicios (Luz, Internet, etc.)</option>
                <option value="Proveedores">Pago Mercadería</option>
                <option value="Alquiler">Alquiler</option>
                <option value="Varios">Varios</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3 rounded-xl text-sm transition shadow-lg shadow-rose-900/30 cursor-pointer"
            >
              {guardando ? 'Registrando...' : 'Registrar Gasto'}
            </button>
          </form>
        </div>

        {/* Listado */}
        <div className="lg:col-span-2 bg-neutral-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-5 overflow-hidden">
          <h3 className="text-lg font-black text-white mb-4">📋 Historial de Gastos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 text-neutral-400 text-xs uppercase">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {gastos.map((g) => (
                  <tr key={g.id} className="hover:bg-white/5">
                    <td className="p-3 text-xs text-neutral-400">
                      {new Date(g.created_at).toLocaleDateString('es-AR')} {new Date(g.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-bold text-white">{g.description}</td>
                    <td className="p-3 text-xs text-neutral-300">{g.category || 'General'}</td>
                    <td className="p-3 text-right font-black text-rose-400">${Number(g.amount).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
                {gastos.length === 0 && !cargando && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-neutral-500">No hay gastos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}