import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ModuloDeudas() {
  const [deudas, setDeudas] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados para el formulario de nuevo cliente con deuda
  const [nombreCliente, setNombreCliente] = useState('')
  const [montoInicial, setMontoInicial] = useState('')
  const [motivoInicial, setMotivoInicial] = useState('')
  const [fechaDeuda, setFechaDeuda] = useState(new Date().toISOString().split('T')[0])
  
  // Modales
  const [deudaSeleccionada, setDeudaSeleccionada] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('Efectivo')

  // Estado para editar / sumar deuda a cliente existente
  const [deudaEditar, setDeudaEditar] = useState(null)
  const [montoSumar, setMontoSumar] = useState('')
  const [motivoSumar, setMotivoSumar] = useState('')

  // Estado para el modal de vista previa del informe en celulares y PC
  const [informeModal, setInformeModal] = useState(null)

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
    const motivoTexto = `[${fechaDeuda}] ${motivoInicial || 'Deuda inicial'} (+$${monto})`

    const { error } = await supabase
      .from('clientes_deuda')
      .insert([{
        nombre_cliente: nombreCliente.trim(),
        monto_inicial_deuda: monto,
        monto_abonado: 0,
        saldo_actual: monto,
        estado: 'Pendiente',
        motivo: motivoTexto,
        fecha_inicio_deuda: fechaDeuda
      }])

    if (error) {
      notificar('error', 'No se pudo registrar la deuda: ' + error.message)
    } else {
      notificar('exito', 'Deuda registrada correctamente.')
      setNombreCliente('')
      setMontoInicial('')
      setMotivoInicial('')
      fetchDeudas()
    }
  }

  // 1.2. Función para sumar/editar deuda a un cliente existente
  const handleSumarDeuda = async () => {
    if (!deudaEditar) return
    const importe = parseFloat(montoSumar)
    if (!Number.isFinite(importe) || importe <= 0) {
      notificar('error', 'Ingresá un monto válido para sumar.')
      return
    }

    const fechaHoy = new Date().toISOString().split('T')[0]
    const nuevoSaldo = (deudaEditar.saldo_actual || 0) + importe
    const nuevoInicial = (deudaEditar.monto_inicial_deuda || 0) + importe
    const nuevoEstado = nuevoSaldo > (deudaEditar.monto_abonado || 0) ? (deudaEditar.monto_abonado > 0 ? 'Parcial' : 'Pendiente') : 'Saldada'
    
    const nuevoCargoStr = `[${fechaHoy}] ${motivoSumar || 'Nuevo cargo'} (+$${importe})`
    const motivoActualizado = deudaEditar.motivo 
      ? `${deudaEditar.motivo} <br> ${nuevoCargoStr}` 
      : nuevoCargoStr;

    const { error } = await supabase
      .from('clientes_deuda')
      .update({
        monto_inicial_deuda: nuevoInicial,
        saldo_actual: nuevoSaldo,
        estado: nuevoEstado,
        motivo: motivoActualizado
      })
      .eq('id', deudaEditar.id)

    if (error) {
      notificar('error', 'No se pudo actualizar la deuda: ' + error.message)
    } else {
      notificar('exito', 'Deuda sumada correctamente.')
      setDeudaEditar(null)
      setMontoSumar('')
      setMotivoSumar('')
      fetchDeudas()
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

    const { error: errorPago } = await supabase
      .from('pagos_deuda')
      .insert([{ deuda_id: deudaSeleccionada.id, monto_pagado: importe, metodo_pago: metodoPago }])

    if (errorPago) {
      notificar('error', 'No se pudo registrar el pago: ' + errorPago.message)
      return
    }

    const nuevoAbonado = (deudaSeleccionada.monto_abonado || 0) + importe
    const nuevoSaldo = deudaSeleccionada.saldo_actual - importe
    const nuevoEstado = nuevoSaldo <= 0 ? 'Saldada' : 'Parcial'

    const fechaHoy = new Date().toISOString().split('T')[0]
    const pagoStr = `[${fechaHoy}] Pago recibido (${metodoPago}): -$${importe}`
    const motivoActualizado = deudaSeleccionada.motivo 
      ? `${deudaSeleccionada.motivo} <br> ${pagoStr}` 
      : pagoStr;

    const { error: errorUpdate } = await supabase
      .from('clientes_deuda')
      .update({
        saldo_actual: nuevoSaldo > 0 ? nuevoSaldo : 0,
        monto_abonado: nuevoAbonado,
        estado: nuevoEstado,
        motivo: motivoActualizado
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

  // 3. Función para eliminar deuda saldada
  const eliminarDeuda = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro de deuda?')) return
    const { error } = await supabase.from('clientes_deuda').delete().eq('id', id)
    if (error) {
      notificar('error', 'No se pudo eliminar: ' + error.message)
    } else {
      notificar('exito', 'Registro eliminado correctamente.')
      fetchDeudas()
    }
  }

  // 4. Imprimir en Impresora Térmica (57mm)
  const imprimirInformeTermico = (item) => {
    const ventanaImpresion = window.open('', '_blank', 'width=300,height=600');
    if (!ventanaImpresion) {
      notificar('error', 'Habilita las ventanas emergentes para imprimir.');
      return;
    }

    const motivosLimpios = (item.motivo || 'Sin especificar').replace(/<br>/g, '\n- ');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket - ${item.nombre_cliente}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 52mm; margin: 0 auto; padding: 5px; color: #000; font-size: 11px; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
            .flex-between { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .mt-2 { margin-top: 8px; }
            .historial { white-space: pre-line; font-size: 10px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="text-center font-bold" style="font-size: 13px;">EL RINCON DE RENZI</div>
          <div class="text-center" style="font-size: 10px;">TICKET CUENTA CORRIENTE</div>
          <div class="border-bottom mt-2"></div>
          <div><span class="font-bold">Cliente:</span> ${item.nombre_cliente}</div>
          <div><span class="font-bold">Fecha Ini:</span> ${item.fecha_inicio_deuda || '-'}</div>
          <div class="mt-2"><span class="font-bold">Detalle / Historial:</span></div>
          <div class="historial">- ${motivosLimpios}</div>
          <div class="border-bottom mt-2"></div>
          <div class="flex-between"><span>Deuda Inicial:</span> <span>$${item.monto_inicial_deuda}</span></div>
          <div class="flex-between"><span>Total Abonado:</span> <span>$${item.monto_abonado || 0}</span></div>
          <div class="flex-between font-bold" style="font-size: 12px; margin-top: 5px;">
            <span>SALDO ACTUAL:</span> <span>$${item.saldo_actual}</span>
          </div>
          <div class="flex-between"><span>Estado:</span> <span class="font-bold">${item.estado}</span></div>
          <div class="border-bottom mt-2"></div>
          <div class="text-center" style="font-size: 9px; margin-top: 10px;">¡Gracias por su preferencia!</div>
        </body>
      </html>
    `;

    ventanaImpresion.document.write(htmlContent);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    setTimeout(() => {
      ventanaImpresion.print();
      ventanaImpresion.close();
    }, 300);
  }

  return (
    <section className="space-y-6 px-2 py-1 sm:px-4 sm:py-3 text-white">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Cuenta corriente</p>
        <h2 className="text-2xl font-bold tracking-tight text-white">Clientes con deuda</h2>
        <p className="mt-1 text-sm text-slate-400">Registrá saldos pendientes, motivos, fechas y exportá informes o tickets térmicos desde un solo lugar.</p>
      </div>

      {/* Formulario Nueva Deuda */}
      <form onSubmit={handleAgregarDeuda} className="pos-surface grid grid-cols-1 gap-4 rounded-2xl p-5 sm:grid-cols-4 sm:items-end bg-[#18181b] border border-white/10">
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-slate-400">Cliente</span>
          <input type="text" placeholder="Nombre del cliente" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-slate-400">Deuda inicial ($)</span>
          <input type="number" min="0" placeholder="Ej: 12000" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-slate-400">Motivo / Concepto y Fecha</span>
          <input type="text" placeholder="Ej: Compra mercadería" value={motivoInicial} onChange={(e) => setMotivoInicial(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400 mb-2" />
          <input type="date" value={fechaDeuda} onChange={(e) => setFechaDeuda(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-xs text-slate-300 outline-none focus:border-amber-400" />
        </label>
        <button type="submit" className="rounded-xl border border-amber-200/25 bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-amber-500 active:scale-[0.98]">+ Agregar deuda</button>
      </form>

      {/* Tabla de Deudas */}
      <div className="pos-surface overflow-hidden rounded-2xl bg-[#18181b] border border-white/10">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-400">Cargando deudas...</p>
        ) : deudas.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">No hay clientes con deudas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.05] text-xs font-medium text-slate-400">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha / Motivo</th>
                  <th className="px-4 py-3 text-right">Inicial</th>
                  <th className="px-4 py-3 text-right">Abonado</th>
                  <th className="px-4 py-3 text-right">Saldo actual</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.07]">
                {deudas.map((item) => {
                  const saldada = item.estado === 'Saldada'
                  const estadoClase = saldada ? 'bg-emerald-400/10 text-emerald-300' : item.estado === 'Parcial' ? 'bg-sky-400/10 text-sky-300' : 'bg-amber-400/10 text-amber-200'
                  return (
                    <tr key={item.id} className="transition hover:bg-white/[0.035]">
                      <td className="px-4 py-3 font-semibold text-white">{item.nombre_cliente}</td>
                      <td className="px-4 py-3 text-xs text-slate-300 max-w-[220px]">
                        <span className="block text-slate-400">{item.fecha_inicio_deuda || '-'}</span>
                        <span className="font-medium text-white line-clamp-2" dangerouslySetInnerHTML={{ __html: item.motivo || 'Sin motivo' }}></span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">${item.monto_inicial_deuda}</td>
                      <td className="px-4 py-3 text-right text-sky-300">${item.monto_abonado || 0}</td>
                      <td className="px-4 py-3 text-right font-bold text-white">${item.saldo_actual}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${estadoClase}`}>{item.estado}</span></td>
                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        {/* Botón Sumar Deuda */}
                        <button onClick={() => { setDeudaEditar(item); setMontoSumar(''); setMotivoSumar(''); }} className="rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500" title="Sumar deuda">
                          + Sumar
                        </button>
                        
                        {/* Botón Cobrar */}
                        {!saldada && (
                          <button onClick={() => { setDeudaSeleccionada(item); setMontoPago(String(item.saldo_actual)) }} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500">
                            Cobrar
                          </button>
                        )}

                        {/* Botón Térmico 57mm */}
                        <button onClick={() => imprimirInformeTermico(item)} className="rounded-lg bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500" title="Imprimir ticket 57mm">
                          🖨️ Térmico
                        </button>

                        {/* Botón Informe en Modal (Compatible con Celular) */}
                        <button onClick={() => setInformeModal(item)} className="rounded-lg bg-purple-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-500" title="Ver informe detallado">
                          📄 PDF
                        </button>

                        {/* Botón Eliminar si está saldada */}
                        {saldada && (
                          <button onClick={() => eliminarDeuda(item.id)} className="rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500" title="Eliminar deuda saldada">
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Vista Previa Informe (Ajustado para Móvil) */}
      {informeModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto" role="dialog">
          <div className="bg-white text-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative my-auto">
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">EL RINCON DE RENZI</h3>
                <p className="text-xs text-slate-500">Informe Detallado de Cuenta Corriente</p>
              </div>
              <button 
                onClick={() => setInformeModal(null)} 
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-full w-8 h-8 font-bold flex items-center justify-center transition"
                aria-label="Cerrar informe"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-slate-600">Cliente:</span>
                <span className="font-bold text-slate-900">{informeModal.nombre_cliente}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-slate-600">Fecha de Registro:</span>
                <span>{informeModal.fecha_inicio_deuda || '-'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-slate-600">Estado Actual:</span>
                <span className="font-bold">{informeModal.estado}</span>
              </div>

              <div>
                <span className="font-semibold text-slate-600 block mb-1">Historial de Movimientos:</span>
                <div className="bg-slate-100 p-3 rounded-xl text-xs space-y-1 max-h-40 overflow-y-auto border" dangerouslySetInnerHTML={{ __html: informeModal.motivo || 'Sin registros detallados' }}></div>
              </div>

              <div className="border-t pt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Deuda Inicial:</span>
                  <span className="font-semibold">${informeModal.monto_inicial_deuda}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Abonado:</span>
                  <span className="font-semibold text-sky-600">${informeModal.monto_abonado || 0}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex justify-between items-center font-bold text-amber-900 text-base mt-2">
                <span>SALDO PENDIENTE:</span>
                <span>${informeModal.saldo_actual}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => setInformeModal(null)} 
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-3 rounded-xl font-semibold text-sm transition"
              >
                Cerrar
              </button>
              <button 
                onClick={() => { window.print(); }} 
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition"
              >
                🖨️ Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago */}
      {deudaSeleccionada && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog">
          <form onSubmit={(e) => { e.preventDefault(); registrarPago() }} className="pos-surface w-full max-w-md rounded-3xl p-6 bg-[#18181b] border border-white/10">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Registrar cobro</p>
                <h3 className="mt-1 text-xl font-bold text-white">{deudaSeleccionada.nombre_cliente}</h3>
                <p className="mt-1 text-sm text-slate-400">Saldo pendiente: <strong className="text-white">${deudaSeleccionada.saldo_actual}</strong></p>
              </div>
              <button type="button" onClick={() => setDeudaSeleccionada(null)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white">×</button>
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
              <button type="submit" className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-500">Confirmar pago</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Sumar / Editar Deuda */}
      {deudaEditar && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog">
          <form onSubmit={(e) => { e.preventDefault(); handleSumarDeuda(); }} className="pos-surface w-full max-w-md rounded-3xl p-6 bg-[#18181b] border border-white/10">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Actualizar cuenta</p>
                <h3 className="mt-1 text-xl font-bold text-white">{deudaEditar.nombre_cliente}</h3>
                <p className="mt-1 text-sm text-slate-400">Saldo actual: <strong className="text-white">${deudaEditar.saldo_actual}</strong></p>
              </div>
              <button type="button" onClick={() => setDeudaEditar(null)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white">×</button>
            </div>
            <div className="grid gap-4">
              <label>
                <span className="mb-2 block text-xs font-medium text-slate-400">Monto a sumar ($)</span>
                <input autoFocus type="number" min="0.01" step="0.01" placeholder="Ej: 5000" value={montoSumar} onChange={(e) => setMontoSumar(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-blue-400" />
              </label>
              <label>
                <span className="mb-2 block text-xs font-medium text-slate-400">Motivo de este nuevo cargo</span>
                <input type="text" placeholder="Ej: Nueva compra fiada" value={motivoSumar} onChange={(e) => setMotivoSumar(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-blue-400" />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setDeudaEditar(null)} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5">Cancelar</button>
              <button type="submit" className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500">Sumar a la deuda</button>
            </div>
          </form>
        </div>
      )}

      {/* Notificaciones Toast */}
      {mensaje && (
        <div className={`fixed bottom-5 right-5 z-[60] flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl ${mensaje.tipo === 'exito' ? 'border-emerald-400/30 bg-emerald-950 text-emerald-100' : 'border-rose-400/30 bg-rose-950 text-rose-100'}`} role="status">
          <span>{mensaje.texto}</span><button onClick={() => setMensaje(null)} className="ml-auto text-lg leading-none opacity-70 hover:opacity-100">×</button>
        </div>
      )}
    </section>
  )
}