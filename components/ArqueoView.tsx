'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNegocio } from '@/context/NegocioContext';

interface ArqueoViewProps {
  turnoPadre?: any;
  onTurnoCerrado?: () => void;
  onVolverPos?: () => void;
}

export function ArqueoView({ turnoPadre, onTurnoCerrado, onVolverPos }: ArqueoViewProps) {
  const { negocioActual } = useNegocio();
  const [cargando, setCargando] = useState(true);
  const [turno, setTurno] = useState<any>(turnoPadre || null);
  const [totalFacturado, setTotalFacturado] = useState<number>(0);
  const [totalEgresos, setTotalEgresos] = useState<number>(0);
  const [pagosPorMetodo, setPagosPorMetodo] = useState<Record<string, number>>({});
  const [montoContado, setMontoContado] = useState<string>('');
  const [cerrando, setCerrando] = useState(false);
  
  // Estados para el Modal de Ticket de Cierre / Arqueo
  const [datosTicketCierre, setDatosTicketCierre] = useState<any | null>(null);
  const [mostrarModalTicket, setMostrarModalTicket] = useState(false);

  const [resultadoCierre, setResultadoCierre] = useState<{
    esperado?: number;
    contado?: number;
    diferencia?: number;
    mensaje?: string;
  } | null>(null);

  // 1. Cargar turno abierto, sus métricas y desglose real por medio de pago por separado
  const cargarTurnoYMovimientos = async () => {
    setCargando(true);
    try {
      let shift = turnoPadre;

      if (!shift) {
        const { data, error } = await supabase
         .from('cash_shifts')
         .select('*')
         .eq('status', 'abierta')
         .order('opened_at', { ascending: false })
         .limit(1)
         .maybeSingle();

        if (error) throw error;
        shift = data;
        setTurno(data);
      } else {
        setTurno(shift);
      }

      if (shift?.id) {
        const { data: ventasData, error: errorVentas } = await supabase
          .from('sales')
          .select('*')
          .gte('created_at', shift.opened_at);

        if (errorVentas) {
          console.error('Error al consultar ventas:', errorVentas);
        }

        const ventas = ventasData || [];
        const sumaVentas = ventas.reduce(
          (acc: number, v: any) => acc + (Number(v.total_amount ?? v.total ?? v.subtotal) || 0),
          0
        );
        setTotalFacturado(sumaVentas);

        const ventaIds = ventas.map((v: any) => v.id).filter(Boolean);
        const desglose: Record<string, number> = {};

        if (ventaIds.length > 0) {
          const { data: pagosData } = await supabase
            .from('sale_payments')
            .select('method, amount, sale_id')
            .in('sale_id', ventaIds);

          if (pagosData && pagosData.length > 0) {
            pagosData.forEach((p: any) => {
              const metodo = String(p.method || 'efectivo').toLowerCase();
              desglose[metodo] = (desglose[metodo] || 0) + Number(p.amount || 0);
            });
          }
        }

        const totalConMetodos = Object.values(desglose).reduce((a, b) => a + b, 0);
        if (totalConMetodos < sumaVentas) {
          const diferencia = sumaVentas - totalConMetodos;
          desglose['efectivo'] = (desglose['efectivo'] || 0) + diferencia;
        }

        setPagosPorMetodo(desglose);

        const { data: gastosData } = await supabase
          .from('cash_movements')
          .select('amount, type')
          .gte('created_at', shift.opened_at);

        const sumaGastos = (gastosData || [])
          .filter((m: any) => ['egreso', 'gasto', 'retiro'].includes(String(m.type || '').toLowerCase()))
          .reduce((acc: number, g: any) => acc + (Number(g.amount) || 0), 0);
        
        setTotalEgresos(sumaGastos);
      }
    } catch (err: any) {
      console.error('Error cargando datos de arqueo:', err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTurnoYMovimientos();
  }, [turnoPadre]);

  const imprimirTicketImpresora = () => {
    window.print();
  };

  // 2. Ejecutar Arqueo Ciego y Cierre de Turno
  const ejecutarArqueoCiego = async () => {
    if (!turno?.id) return;
    const monto = parseFloat(montoContado);
    if (isNaN(monto) || monto < 0) {
      alert('Ingresá el efectivo físico total contado en la caja.');
      return;
    }

    if (!confirm('¿Confirmás el arqueo y el cierre de este turno de caja?')) return;

    setCerrando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let nombreNegocioTicket = 'Comercio';

      if (user) {
        const { data: negocioData } = await supabase
          .from('negocios')
          .select('*')
          .eq(negocioActual?.id ? 'id' : 'user_id', negocioActual?.id || user.id);

        if (negocioData && negocioData.length > 0) {
          const n = negocioData[0];
          nombreNegocioTicket = n.name || n.nombre || n.nombre_negocio || n.title || 'Comercio';
        }
      }

      // Cálculo correcto del efectivo esperado (Saldo inicial + Efectivo cobrado - Egresos)
      const montoInicial = Number(turno.opening_amount || 0);
      const efectivoCobrado = Number(pagosPorMetodo['efectivo'] || 0);
      const esperadoCalculado = montoInicial + efectivoCobrado - totalEgresos;

      const { data, error } = await supabase.rpc('fn_close_shift', {
        p_shift_id: turno.id,
        p_counted_amount: monto,
        p_notes: 'Cierre desde sistema POS',
      });

      if (error) throw error;

      const res = typeof data === 'object' && data !== null ? data : {};
      
      // Forzamos el cálculo correcto en base al efectivo real de caja si el RPC devolvía el total general
      const esperadoFinal = esperadoCalculado;
      const dif = monto - esperadoFinal;

      const textoDif =
        dif > 0
          ? `Sobrante: +$${dif.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
          : dif < 0
          ? `Faltante: -$${Math.abs(dif).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
          : 'Caja exacta sin diferencias.';

      setResultadoCierre({
        esperado: esperadoFinal,
        contado: monto,
        diferencia: dif,
        mensaje: textoDif,
      });

      // Preparar datos para el ticket de arqueo/cierre
      setDatosTicketCierre({
        negocio: nombreNegocioTicket,
        fechaCierre: new Date().toLocaleString(),
        montoInicial,
        totalFacturado,
        totalEgresos,
        pagosPorMetodo,
        esperado: esperadoFinal,
        contado: monto,
        diferencia: dif,
        mensajeDif: textoDif
      });
      setMostrarModalTicket(true);

      setTurno(null);
      if (onTurnoCerrado) onTurnoCerrado();
    } catch (err: any) {
      alert('Error al cerrar turno: ' + err.message);
    } finally {
      setCerrando(false);
    }
  };

  return (
    <div className="bg-neutral-900/40 border border-white/10 p-6 rounded-3xl shadow-2xl max-w-lg mx-auto space-y-6">
      {/* Modal para Imprimir Ticket de Arqueo / Cierre */}
      {mostrarModalTicket && datosTicketCierre && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-purple-500/40 p-6 rounded-3xl flex flex-col items-center relative shadow-2xl w-full max-w-sm">
            <h3 className="text-base font-black text-white mb-1">¡Cierre Exitoso! 📊</h3>
            <p className="text-xs text-neutral-400 mb-4">¿Deseás imprimir el informe de arqueo?</p>

            {/* Vista Previa del Ticket de Arqueo */}
            <div id="ticket-impresion" className="w-full bg-white text-black p-4 rounded-xl font-mono text-xs space-y-2 shadow-inner">
              <div className="text-center font-bold border-b border-dashed border-neutral-400 pb-2">
                <p className="text-sm uppercase">{datosTicketCierre.negocio}</p>
                <p className="text-[10px] text-neutral-600">ARQUEO Y CIERRE DE CAJA</p>
                <p className="text-[9px] text-neutral-500">{datosTicketCierre.fechaCierre}</p>
              </div>

              <div className="space-y-1 py-1 border-b border-dashed border-neutral-400 text-[11px]">
                <div className="flex justify-between">
                  <span>Monto Inicial:</span>
                  <span>${datosTicketCierre.montoInicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Facturado:</span>
                  <span>+${datosTicketCierre.totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Egresos / Retiros:</span>
                  <span>-${datosTicketCierre.totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Desglose de pagos */}
              <div className="py-1 border-b border-dashed border-neutral-400 text-[10px] space-y-1">
                <p className="font-bold">Desglose de Medios:</p>
                {Object.entries(datosTicketCierre.pagosPorMetodo).map(([metodo, monto]: [string, any]) => (
                  <div key={metodo} className="flex justify-between">
                    <span className="capitalize">{metodo.replace('_', ' ')}:</span>
                    <span>${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1 text-[11px] font-bold">
                <div className="flex justify-between">
                  <span>Efectivo Esperado:</span>
                  <span>${datosTicketCierre.esperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Efectivo Contado:</span>
                  <span>${datosTicketCierre.contado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-neutral-300 text-xs">
                  <span>Diferencia:</span>
                  <span className={datosTicketCierre.diferencia >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                    {datosTicketCierre.mensajeDif}
                  </span>
                </div>
              </div>

              <div className="text-center pt-3 text-[10px] text-neutral-500 border-t border-dashed border-neutral-400">
                Fin de Arqueo de Caja
              </div>
            </div>

            <div className="flex gap-2 w-full mt-5">
              <button
                onClick={imprimirTicketImpresora}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-2xl text-xs transition shadow-lg cursor-pointer"
              >
                🖨️ Imprimir Ticket
              </button>
              <button
                onClick={() => {
                  setMostrarModalTicket(false);
                  setResultadoCierre(null);
                  if (onVolverPos) onVolverPos();
                }}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 rounded-2xl text-xs transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <span>📊</span> Arqueo y Control de Turno
        </h2>
        <p className="text-sm text-neutral-400">Resumen y arqueo ciego del turno de caja.</p>
      </div>

      {cargando ? (
        <div className="p-8 text-center text-neutral-400 text-sm">Cargando estado del turno...</div>
      ) : resultadoCierre ? (
        /* Pantalla de Confirmación de Cierre */
        <div className="bg-neutral-950/70 p-6 rounded-2xl border border-white/10 space-y-4 text-center">
          <div className="text-4xl">✅</div>
          <h3 className="text-lg font-bold text-white">Turno Cerrado Correctamente</h3>
          <div className="bg-neutral-900/80 p-4 rounded-xl border border-white/5 space-y-2 text-sm text-left">
            <div className="flex justify-between text-neutral-400">
              <span>Efectivo Contado:</span>
              <strong className="text-white">${resultadoCierre.contado?.toLocaleString('es-AR')}</strong>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Resultado:</span>
              <strong
                className={
                  (resultadoCierre.diferencia || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }
              >
                {resultadoCierre.mensaje}
              </strong>
            </div>
          </div>

          <button
            onClick={() => {
              setResultadoCierre(null);
              if (onVolverPos) onVolverPos();
            }}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold text-sm transition"
          >
            Volver al POS
          </button>
        </div>
      ) : turno ? (
        /* Formulario de Arqueo Ciego con Desglose */
        <div className="bg-neutral-950/60 p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex justify-between text-sm text-neutral-300">
            <span>Monto Inicial de Caja:</span>
            <strong className="text-white">
              ${Number(turno.opening_amount || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </strong>
          </div>

          <div className="flex justify-between text-sm text-neutral-300 border-b border-white/10 pb-2">
            <span>Total Facturado:</span>
            <strong className="text-emerald-400">
              +${totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </strong>
          </div>

          {/* Desglose por Medio de Pago */}
          <div className="space-y-1.5 bg-white/5 p-3 rounded-xl border border-white/5 text-xs">
            <span className="text-neutral-400 font-bold uppercase tracking-wider block mb-1">Desglose por Medio de Pago:</span>
            {Object.keys(pagosPorMetodo).length > 0 ? (
              Object.entries(pagosPorMetodo).map(([metodo, monto]) => (
                <div key={metodo} className="flex justify-between text-neutral-300">
                  <span className="capitalize">{metodo.replace('_', ' ')}:</span>
                  <strong className="text-white">${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                </div>
              ))
            ) : (
              <p className="text-neutral-500 italic">No hay pagos registrados aún en este turno.</p>
            )}
          </div>

          <div className="flex justify-between text-sm text-neutral-300 border-b border-white/10 pb-3 pt-1">
            <span>Egresos del Turno:</span>
            <strong className="text-rose-400">
              -${totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </strong>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              Efectivo Físico Contado ($):
            </label>
            <input
              type="number"
              step="0.01"
              value={montoContado}
              onChange={(e) => setMontoContado(e.target.value)}
              placeholder="Ingresá el total en billetes..."
              className="w-full p-3 border border-white/10 rounded-xl text-white font-bold bg-neutral-900 text-center text-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            {onVolverPos && (
              <button
                type="button"
                onClick={onVolverPos}
                className="flex-1 bg-white/5 hover:bg-white/10 text-neutral-300 py-3 rounded-xl font-bold text-sm transition"
              >
                Volver al POS
              </button>
            )}
            <button
              type="button"
              onClick={ejecutarArqueoCiego}
              disabled={cerrando}
              className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition"
            >
              {cerrando ? 'Cerrando...' : 'Cerrar Turno'}
            </button>
          </div>
        </div>
      ) : (
        /* Sin Turno Abierto */
        <div className="bg-neutral-950/60 p-6 rounded-2xl border border-white/10 text-center space-y-3">
          <p className="text-neutral-400">No hay ningún turno de caja abierto en este momento.</p>
          {onVolverPos && (
            <button
              onClick={onVolverPos}
              className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-purple-500 transition"
            >
              Ir a Abrir Caja
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ArqueoView;