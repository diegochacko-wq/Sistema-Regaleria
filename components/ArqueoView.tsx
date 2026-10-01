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
  
  const [datosTicketCierre, setDatosTicketCierre] = useState<any | null>(null);
  const [mostrarModalTicket, setMostrarModalTicket] = useState(false);

  const [resultadoCierre, setResultadoCierre] = useState<{
    esperado?: number;
    contado?: number;
    diferencia?: number;
    mensaje?: string;
  } | null>(null);

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

  // Funciones de Exportación para Arqueo
  const exportarExcelArqueo = () => {
    if (!turno) return;
    let csvContent = "data:text/csv;charset=utf-8,Concepto;Valor\n";
    csvContent += `Monto Inicial;${turno.opening_amount || 0}\n`;
    csvContent += `Total Facturado;${totalFacturado}\n`;
    csvContent += `Total Egresos;${totalEgresos}\n`;
    Object.entries(pagosPorMetodo).forEach(([metodo, monto]) => {
      csvContent += `Metodo ${metodo};${monto}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `arqueo_turno_${turno.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarWordArqueo = () => {
    if (!turno) return;
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Arqueo de Caja</title></head>
      <body style="font-family: Arial;">
        <h2>Informe de Arqueo y Cierre de Turno</h2>
        <p><strong>Apertura:</strong> ${turno.opened_at}</p>
        <hr/>
        <p><strong>Monto Inicial:</strong> $${Number(turno.opening_amount || 0).toLocaleString('es-AR')}</p>
        <p><strong>Total Facturado:</strong> $${totalFacturado.toLocaleString('es-AR')}</p>
        <p><strong>Total Egresos:</strong> $${totalEgresos.toLocaleString('es-AR')}</p>
        <h3>Desglose por Medio de Pago:</h3>
        <ul>
          ${Object.entries(pagosPorMetodo).map(([m, val]) => `<li>${m}:$${Number(val).toLocaleString('es-AR')}</li>`).join('')}
        </ul>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arqueo_turno_${turno.id}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportarPdfArqueo = () => {
    if (!turno) return;
    const ventanaPdf = window.open('', '_blank');
    if (!ventanaPdf) {
      alert('Por favor, permití las ventanas emergentes para descargar el PDF.');
      return;
    }

    const nombreNegocio = 
      (negocioActual as any)?.name || 
      (negocioActual as any)?.nombre || 
      (negocioActual as any)?.nombre_negocio || 
      'Comercio';

    const htmlPdf = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset='utf-8'>
        <title>Arqueo de Turno - ${turno.id}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 40px; 
            color: #2d3748; 
            background-color: #f7fafc;
            margin: 0;
          }
          .invoice-box {
            max-width: 800px;
            margin: auto;
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
            border-top: 6px solid #4a5568;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #edf2f7;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .company-name {
            font-size: 22px;
            font-weight: 800;
            color: #1a202c;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .report-title {
            font-size: 14px;
            color: #718096;
            font-weight: 600;
            margin-top: 4px;
          }
          .meta-info {
            text-align: right;
            font-size: 13px;
            color: #4a5568;
          }
          .meta-info span {
            font-weight: bold;
            color: #2d3748;
          }
          h3 {
            font-size: 15px;
            color: #2d3748;
            margin-top: 30px;
            margin-bottom: 10px;
            border-left: 4px solid #4a5568;
            padding-left: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
          }
          th, td { 
            padding: 12px 16px; 
            text-align: left; 
            font-size: 13px; 
          }
          th { 
            background-color: #f8fafc; 
            color: #4a5568;
            font-weight: 700;
            border-bottom: 2px solid #e2e8f0;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          tr:not(:last-child) td {
            border-bottom: 1px solid #edf2f7;
          }
          .text-right {
            text-align: right;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #a0aec0;
            border-top: 1px solid #edf2f7;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div>
              <div class="company-name">${nombreNegocio}</div>
              <div class="report-title">Informe de Arqueo y Control de Turno</div>
            </div>
            <div class="meta-info">
              <p>Turno ID: <span>#${turno.id.slice(0, 8)}</span></p>
              <p>Fecha Apertura: <span>${new Date(turno.opened_at).toLocaleString()}</span></p>
            </div>
          </div>

          <h3>Resumen General de Caja</h3>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th class="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monto Inicial de Caja</td>
                <td class="text-right" style="font-weight: 600;">$${Number(turno.opening_amount || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>Total Facturado</td>
                <td class="text-right" style="font-weight: 600; color: #2f855a;">+$${totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>Egresos del Turno</td>
                <td class="text-right" style="font-weight: 600; color: #c53030;">-$${totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          
          <h3>Desglose por Medio de Pago</h3>
          <table>
            <thead>
              <tr>
                <th>Medio de Pago</th>
                <th class="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(pagosPorMetodo).length > 0 
                ? Object.entries(pagosPorMetodo).map(([m, val]) => `
                    <tr>
                      <td style="text-transform: capitalize;">${m.replace('_', ' ')}</td>                       <td class="text-right" style="font-weight: 600;">$${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="2" style="text-align: center; color: #a0aec0; font-style: italic;">No hay pagos registrados</td></tr>`
              }
            </tbody>
          </table>

          <div class="footer">
            Reporte generado automáticamente por el sistema de gestión POS • ${new Date().toLocaleString()}
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    ventanaPdf.document.write(htmlPdf);
    ventanaPdf.document.close();
  };

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
          const n: any = negocioData[0];
          nombreNegocioTicket = n.name || n.nombre || n.nombre_negocio || n.title || 'Comercio';
        }
      }

      const montoInicial = Number(turno.opening_amount || 0);
      const efectivoCobrado = Number(pagosPorMetodo['efectivo'] || 0);
      const esperadoCalculado = montoInicial + efectivoCobrado - totalEgresos;

      const { data, error } = await supabase.rpc('fn_close_shift', {
        p_shift_id: turno.id,
        p_counted_amount: monto,
        p_notes: 'Cierre desde sistema POS',
      });

      if (error) throw error;

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
      {mostrarModalTicket && datosTicketCierre && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-purple-500/40 p-6 rounded-3xl flex flex-col items-center relative shadow-2xl w-full max-w-sm">
            <h3 className="text-base font-black text-white mb-1">¡Cierre Exitoso! 📊</h3>
            <p className="text-xs text-neutral-400 mb-4">¿Deseás imprimir el informe de arqueo?</p>

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

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <span>📊</span> Arqueo y Control de Turno
          </h2>
          <p className="text-sm text-neutral-400">Resumen y arqueo ciego del turno de caja.</p>
        </div>
        {turno && (
          <div className="flex gap-1.5">
            <button onClick={exportarExcelArqueo} title="Exportar a Excel" className="p-2 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 rounded-xl text-xs font-bold transition border border-white/5">
              📊 Excel
            </button>
            <button onClick={exportarWordArqueo} title="Exportar a Word" className="p-2 bg-neutral-800 hover:bg-neutral-700 text-indigo-400 rounded-xl text-xs font-bold transition border border-white/5">
              📄 Word
            </button>
            <button onClick={exportarPdfArqueo} title="Exportar a PDF" className="p-2 bg-neutral-800 hover:bg-neutral-700 text-rose-400 rounded-xl text-xs font-bold transition border border-white/5">
              📑 PDF
            </button>
          </div>
        )}
      </div>

      {cargando ? (
        <div className="p-8 text-center text-neutral-400 text-sm">Cargando estado del turno...</div>
      ) : resultadoCierre ? (
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