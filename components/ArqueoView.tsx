'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ArqueoViewProps {
  turnoPadre?: any;
  onTurnoCerrado?: () => void;
  onVolverPos?: () => void;
}

export function ArqueoView({ turnoPadre, onTurnoCerrado, onVolverPos }: ArqueoViewProps) {
  const [cargando, setCargando] = useState(true);
  const [turno, setTurno] = useState<any>(turnoPadre || null);
  const [totalFacturado, setTotalFacturado] = useState<number>(0);
  const [totalEgresos, setTotalEgresos] = useState<number>(0);
  const [pagosPorMetodo, setPagosPorMetodo] = useState<Record<string, number>>({});
  const [montoContado, setMontoContado] = useState<string>('');
  const [cerrando, setCerrando] = useState(false);
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
        // Consultar ventas a partir de la apertura del turno de forma limpia
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

        // Obtener los IDs de las ventas para consultar sus métodos de pago de forma segura
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

        // Si alguna venta no se registró en sale_payments, se asigna al total general como efectivo por respaldo
        const totalConMetodos = Object.values(desglose).reduce((a, b) => a + b, 0);
        if (totalConMetodos < sumaVentas) {
          const diferencia = sumaVentas - totalConMetodos;
          desglose['efectivo'] = (desglose['efectivo'] || 0) + diferencia;
        }

        setPagosPorMetodo(desglose);

        // Consultar egresos del turno a partir de la apertura
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
      const { data, error } = await supabase.rpc('fn_close_shift', {
        p_shift_id: turno.id,
        p_counted_amount: monto,
        p_notes: 'Cierre desde sistema POS',
      });

      if (error) throw error;

      const res = typeof data === 'object' && data !== null ? data : {};
      const dif = Number(res.difference_amount ?? 0);
      const esperado = Number(res.expected_amount ?? (Number(turno.opening_amount || 0) + totalFacturado - totalEgresos));

      const textoDif =
        dif > 0
          ? `Sobrante: +$${dif.toLocaleString('es-AR')}`
          : dif < 0
          ? `Faltante: -$${Math.abs(dif).toLocaleString('es-AR')}`
          : 'Caja exacta sin diferencias.';

      setResultadoCierre({
        esperado,
        contado: monto,
        diferencia: dif,
        mensaje: textoDif,
      });

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