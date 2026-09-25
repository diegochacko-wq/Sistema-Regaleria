'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNegocio } from '@/context/NegocioContext'
import { useNotificaciones } from '@/components/Notificaciones'

export default function GastosView() {
  const { negocioActual } = useNegocio()
  const { notificar } = useNotificaciones()

  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState('General')
  const [descripcion, setDescripcion] = useState('')
  const [gastos, setGastos] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)

  const negocioId = negocioActual?.id

  useEffect(() => {
    if (negocioId) {
      cargarGastos()
    }
  }, [negocioId])

  const cargarGastos = async () => {
    if (!negocioId) return
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('negocio_id', negocioId)
        .eq('type', 'egreso')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setGastos(data || [])
    } catch (err: any) {
      console.error('Error al cargar historial de gastos:', err)
    }
  }

  const registrarGasto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!negocioId) return

    const montoNum = parseFloat(monto)
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      notificar('aviso', 'Por favor ingresá un monto válido mayor a 0.')
      return
    }

    setCargando(true)

    try {
      // 1. Obtener el turno abierto de la caja actual
      const { data: turno, error: turnoErr } = await supabase
        .from('cash_shifts')
        .select('id')
        .eq('negocio_id', negocioId)
        .eq('status', 'abierta')
        .limit(1)
        .maybeSingle()

      if (turnoErr || !turno?.id) {
        notificar('error', 'No hay ningún turno de caja abierto para registrar egresos.', 'Caja cerrada')
        setCargando(false)
        return
      }

      // 2. Insertar el egreso en cash_movements
      const { error } = await supabase.from('cash_movements').insert([
        {
          negocio_id: negocioId,
          shift_id: turno.id,
          type: 'egreso',
          amount: montoNum,
          description: descripcion.trim() ? `${categoria}: ${descripcion.trim()}` : categoria,
          method: 'efectivo'
        }
      ])

      if (error) throw error

      // Notificación flotante estética
      notificar('exito', 'Gasto registrado con éxito!')

      setMonto('')
      setDescripcion('')
      setCategoria('General')
      await cargarGastos()
    } catch (err: any) {
      notificar('error', err.message || 'No se pudo guardar el gasto.', 'Error')
    } finally {
      setCargando(false)
    }
  }

  if (!negocioActual) {
    return (
      <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-md text-center py-12">
        <p className="text-neutral-400 font-medium">Seleccioná un negocio para ver y registrar gastos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-md">
        <h2 className="text-xl font-black text-white flex items-center gap-2 mb-6">
          <span>💸</span> Registrar Egreso / Gasto
        </h2>

        <form onSubmit={registrarGasto} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-bold uppercase text-neutral-400 mb-1">Monto ($):</label>
            <input
              type="number"
              step="any"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Ej: 20000"
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-rose-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-neutral-400 mb-1">Categoría:</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500"
            >
              <option value="General">General</option>
              <option value="Proveedores">Pago a Proveedores</option>
              <option value="Servicios">Luz / Gas / Internet</option>
              <option value="Sueldos">Adelantos / Sueldos</option>
              <option value="Flete">Flete / Envíos</option>
              <option value="Insumos">Insumos y Limpieza</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-neutral-400 mb-1">Descripción / Motivo:</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle o concepto del gasto (ej: flete mercadería)"
              rows={2}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black rounded-xl transition-all shadow-lg shadow-rose-900/30 disabled:opacity-50 cursor-pointer"
          >
            {cargando ? 'Registrando...' : 'Registrar Salida de Caja'}
          </button>
        </form>
      </div>

      {/* Historial de egresos */}
      <div className="bg-neutral-900/60 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-md">
        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
          <span>📋</span> Historial de Salidas / Gastos
        </h3>

        {gastos.length === 0 ? (
          <p className="text-neutral-500 text-sm">No hay salidas de caja registradas recientemente.</p>
        ) : (
          <div className="divide-y divide-white/5 overflow-x-auto">
            {gastos.map((g) => (
              <div key={g.id} className="py-3 flex justify-between items-center text-sm">
                <div>
                  <p className="font-bold text-neutral-200">{g.description || 'Gasto sin detalle'}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(g.created_at).toLocaleDateString()} {new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="font-black text-rose-400 text-base">
                  -${Number(g.amount).toLocaleString('es-AR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}