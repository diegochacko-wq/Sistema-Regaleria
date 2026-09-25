'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNegocio } from '@/context/NegocioContext'

// ============================================================
// GastosView — Módulo aislado de Gastos / Egresos de Caja
// Conectado al esquema transaccional: tabla cash_movements (type: 'egreso')
// ============================================================
export default function GastosView() {
  const { negocioActual } = useNegocio()

  const [gastosHistoricos, setGastosHistoricos] = useState<any[]>([])
  const [montoGasto, setMontoGasto] = useState('')
  const [categoriaGasto, setCategoriaGasto] = useState('General')
  const [descripcionGasto, setDescripcionGasto] = useState('')

  useEffect(() => {
    if (negocioActual?.id) cargarGastos()
  }, [negocioActual?.id])

  // Cargar gastos
  const cargarGastos = async () => {
    if (!negocioActual?.id) return
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('business_id', negocioActual.id)
        .eq('type', 'egreso')
        .order('created_at', { ascending: false })
      if (error) throw error
      setGastosHistoricos(data || [])
    } catch (err) {
      console.error('Error cargando gastos:', err)
    }
  }

  // Registrar Gasto
  const registrarGasto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!negocioActual?.id) {
      alert('Selecciona un negocio')
      return
    }
    const monto = parseFloat(montoGasto)
    if (isNaN(monto) || monto <= 0 || !descripcionGasto.trim()) {
      alert('Ingresa una descripción y monto válido.')
      return
    }

    try {
      // Buscar el turno abierto de este negocio (igual que hace el POS)
      const { data: turno } = await supabase
        .from('cash_shifts')
        .select('id')
        .eq('status', 'abierta')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { error } = await supabase.from('cash_movements').insert({
        business_id: negocioActual.id,
        shift_id: turno?.id || null,
        type: 'egreso',
        amount: monto,
        notes: `[${categoriaGasto}] ${descripcionGasto.trim()}`,
      })

      if (error) throw error

      alert('Gasto registrado con éxito!')
      setMontoGasto('')
      setDescripcionGasto('')
      setCategoriaGasto('General')
      cargarGastos()
    } catch (err: any) {
      console.error('Error registrando gasto:', err)
      alert(`Error al registrar gasto: ${err.message || JSON.stringify(err)}`)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl h-fit space-y-4">
        <h3 className="text-xl font-black text-white">💸 Registrar Egreso / Gasto</h3>
        <form onSubmit={registrarGasto} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-neutral-400 block mb-1">Monto ($):</label>
            <input
              type="number"
              step="0.01"
              value={montoGasto}
              onChange={(e) => setMontoGasto(e.target.value)}
              placeholder="0.00"
              className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-400 block mb-1">Categoría:</label>
            <select
              value={categoriaGasto}
              onChange={(e) => setCategoriaGasto(e.target.value)}
              className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm"
            >
              <option value="General">General</option>
              <option value="Proveedores">Pago a Proveedores</option>
              <option value="Servicios">Servicios / Alquiler</option>
              <option value="Sueldos">Sueldos / Retiros</option>
              <option value="Mantenimiento">Mantenimiento</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-400 block mb-1">Descripción / Motivo:</label>
            <textarea
              value={descripcionGasto}
              onChange={(e) => setDescripcionGasto(e.target.value)}
              placeholder="Ej: Pago de flete mercadería"
              className="w-full bg-neutral-950/80 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
              rows={3}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 text-white font-black py-3 rounded-xl shadow-lg shadow-rose-900/30"
          >
            Registrar Salida de Caja
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-xl font-black text-white">Historial de Salidas / Gastos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-neutral-400 text-xs uppercase">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Motivo</th>
                <th className="p-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {gastosHistoricos.map((g) => (
                <tr key={g.id} className="hover:bg-white/5">
                  <td className="p-3 text-xs text-neutral-400">{new Date(g.created_at).toLocaleString('es-AR')}</td>
                  <td className="p-3 text-neutral-200">{g.notes}</td>
                  <td className="p-3 text-right font-black text-rose-400">-${Number(g.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
