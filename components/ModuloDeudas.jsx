import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ModuloDeudas() {
  const [deudas, setDeudas] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados para el formulario de nuevo cliente con deuda
  const [nombreCliente, setNombreCliente] = useState('')
  const [montoInicial, setMontoInicial] = useState('')
  const [deudaSeleccionada, setDeudaSeleccionada] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [mensaje, setMensaje] = useState(null)

  const notificar = (tipo, texto) => setMensaje({ tipo, texto })

  // 1. Cargar las deudas desde Supabase
  const fetchDeudas = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clientes_deuda')
      .select('*')
      .order('id', { ascending: false })

    if (error) console.error('Error al cargar deudas:', error)
    else setDeudas(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchDeudas()
  }, [])

  // 1.1. Función para guardar una nueva deuda
  const handleAgregarDeuda = async (e) => {
    e.preventDefault()
    if (!nombreCliente || !montoInicial) {
      notificar('error', 'Completá el nombre y el monto inicial.')
      return
    }

    const monto = parseFloat(montoInicial)
    const { error } = await supabase
      .from('clientes_deuda')
      .insert([{
        nombre_cliente: nombreCliente,
        monto_inicial_deuda: monto,
        monto_abonado: 0,
        saldo_actual: monto,
        estado: 'Pendiente'
      }])

    if (error) {
      notificar('error', 'No se pudo registrar la deuda: ' + error.message)
    } else {
      notificar('exito', 'Deuda registrada correctamente.')
      setNombreCliente('')
      setMontoInicial('')
      fetchDeudas() // Recargar la lista
    }
  }

  // 2. Función para registrar un pago a una deuda específica
  const registrarPago = async () => {
    if (!deudaSeleccionada) return
    const importe = parseFloat(montoPago)
    if (!Number.isFinite(importe) || importe <= 0) {
      notificar('error', 'Ingresá un monto válido.')
      return
    }
    if (importe > deudaSeleccionada.saldo_actual) {
      notificar('error', 'El pago no puede superar el saldo pendiente.')
      return
    }

    // Registramos el pago
    const { error: errorPago } = await supabase
      .from('pagos_deuda')
      .insert([{ deuda_id: deudaSeleccionada.id, monto_pagado: importe, metodo_pago: metodoPago }])

    if (errorPago) {
      notificar('error', 'No se pudo registrar el pago: ' + errorPago.message)
      return
    }

    // Calculamos los nuevos valores
    // Nota: Si ya usas un trigger en Supabase para esto, puedes omitir este update manual
    const nuevoAbonado = (deudaSeleccionada.monto_abonado || 0) + importe
    const nuevoSaldo = deudaSeleccionada.saldo_actual - importe
    const nuevoEstado = nuevoSaldo <= 0 ? 'Saldada' : 'Parcial'

    const { error: errorUpdate } = await supabase
      .from('clientes_deuda')
      .update({
        saldo_actual: nuevoSaldo > 0 ? nuevoSaldo : 0,
        monto_abonado: nuevoAbonado,
        estado: nuevoEstado
      })
      .eq('id', deudaSeleccionada.id)

    if (errorUpdate) {
      notificar('error', 'El pago se guardó, pero no se actualizó el saldo: ' + errorUpdate.message)
    } else {
      setDeudaSeleccionada(null)
      setMontoPago('')
      setMetodoPago('Efectivo')
      notificar('exito', 'Pago registrado correctamente.')
      fetchDeudas()
    }
  }

  return (
    <section className="space-y-6 px-2 py-1 sm:px-4 sm:py-3">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Cuenta corriente</p>
        <h2 className="text-2xl font-bold tracking-tight text-white">Clientes con deuda</h2>
        <p className="mt-1 text-sm text-slate-400">Registrá saldos pendientes y seguí cada cobro desde un solo lugar.</p>
      </div>

      <form onSubmit={handleAgregarDeuda} className="pos-surface grid grid-cols-1 gap-4 rounded-2xl p-5 sm:grid-cols-3 sm:items-end">
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-slate-400">Cliente</span>
          <input type="text" placeholder="Nombre del cliente" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-slate-400">Deuda inicial ($)</span>
          <input type="number" min="0" placeholder="Ej: 12000" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        </label>
        <button type="submit" className="rounded-xl border border-amber-200/25 bg-amber-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-amber-950/40 transition hover:bg-amber-600 active:scale-[0.98]">+ Agregar deuda</button>
      </form>

      <div className="pos-surface overflow-hidden rounded-2xl">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-400">Cargando deudas...</p>
        ) : deudas.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">No hay clientes con deudas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.05] text-xs font-medium text-slate-400">
                <tr>
                  <th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Fecha inicio</th><th className="px-5 py-4 text-right">Deuda inicial</th><th className="px-5 py-4 text-right">Abonado</th><th className="px-5 py-4 text-right">Saldo actual</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.07]">
                {deudas.map((item) => {
                  const saldada = item.estado === 'Saldada'
                  const estadoClase = saldada ? 'bg-emerald-400/10 text-emerald-300' : item.estado === 'Parcial' ? 'bg-sky-400/10 text-sky-300' : 'bg-amber-400/10 text-amber-200'
                  return (
                    <tr key={item.id} className="transition hover:bg-white/[0.035]">
                      <td className="px-5 py-4 font-semibold text-white">{item.nombre_cliente}</td>
                      <td className="px-5 py-4 text-slate-400">{item.fecha_inicio_deuda || '-'}</td>
                      <td className="px-5 py-4 text-right text-slate-300">${item.monto_inicial_deuda}</td>
                      <td className="px-5 py-4 text-right text-sky-300">${item.monto_abonado || 0}</td>
                      <td className="px-5 py-4 text-right font-bold text-white">${item.saldo_actual}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${estadoClase}`}>{item.estado}</span></td>
                      <td className="px-5 py-4 text-right">
                        {!saldada && <button onClick={() => {
                          setDeudaSeleccionada(item)
                          setMontoPago(String(item.saldo_actual))
                        }} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 active:scale-[0.98]">Registrar pago</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deudaSeleccionada && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-pago">
          <form onSubmit={(e) => { e.preventDefault(); registrarPago() }} className="pos-surface w-full max-w-md rounded-3xl p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Registrar cobro</p>
                <h3 id="titulo-pago" className="mt-1 text-xl font-bold text-white">{deudaSeleccionada.nombre_cliente}</h3>
                <p className="mt-1 text-sm text-slate-400">Saldo pendiente: <strong className="text-white">${deudaSeleccionada.saldo_actual}</strong></p>
              </div>
              <button type="button" onClick={() => setDeudaSeleccionada(null)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="Cerrar">×</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-xs font-medium text-slate-400">Monto a cobrar ($)</span>
                <input autoFocus type="number" min="0.01" max={deudaSeleccionada.saldo_actual} step="0.01" value={montoPago} onChange={(e) => setMontoPago(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-amber-400" />
              </label>
              <label>
                <span className="mb-2 block text-xs font-medium text-slate-400">Medio de pago</span>
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-amber-400">
                  <option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta Débito">Tarjeta Débito</option><option value="Tarjeta Crédito">Tarjeta Crédito</option><option value="Mercado Pago">Mercado Pago</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setDeudaSeleccionada(null)} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5">Cancelar</button>
              <button type="submit" className="flex-1 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-600">Confirmar pago</button>
            </div>
          </form>
        </div>
      )}

      {mensaje && (
        <div className={`fixed bottom-5 right-5 z-[60] flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl ${mensaje.tipo === 'exito' ? 'border-emerald-400/30 bg-emerald-950 text-emerald-100' : 'border-rose-400/30 bg-rose-950 text-rose-100'}`} role="status">
          <span>{mensaje.texto}</span><button onClick={() => setMensaje(null)} className="ml-auto text-lg leading-none opacity-70 hover:opacity-100" aria-label="Cerrar mensaje">×</button>
        </div>
      )}
    </section>
  )
}
