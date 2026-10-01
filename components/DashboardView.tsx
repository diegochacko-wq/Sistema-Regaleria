'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export function DashboardView() {
  const [cargando, setCargando] = useState(true);
  const [ventas, setVentas] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'mes' | 'hoy' | 'todos'>('mes');

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (salesError) {
        console.error('⚠️️ Error al consultar sales:', salesError.message);
      } else {
        setVentas(salesData || []);
      }

      const { data: cashData, error: cashError } = await supabase
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: false });

      if (cashError) {
        console.error('⚠️ Error al consultar cash_movements:', cashError.message);
      } else {
        const egresos = (cashData || []).filter((m: any) =>
          ['egreso', 'gasto', 'retiro'].includes(String(m.type || '').toLowerCase())
        );
        setGastos(egresos);
      }
    } catch (err: any) {
      console.error('Error general cargando dashboard:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const obtenerMontoVenta = (v: any): number => {
    return Number(v.total_amount ?? v.total ?? v.final_amount ?? v.monto ?? 0);
  };

  const obtenerMontoGasto = (g: any): number => {
    return Number(g.amount ?? g.monto ?? 0);
  };

  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();
  const hoyStr = ahora.toISOString().split('T')[0];

  const metricasMes = useMemo(() => {
    const ventasMes = ventas.filter((v) => {
      if (!v.created_at) return false;
      const f = new Date(v.created_at);
      return f.getMonth() === mesActual && f.getFullYear() === anioActual;
    });

    const gastosMes = gastos.filter((g) => {
      if (!g.created_at) return false;
      const f = new Date(g.created_at);
      return f.getMonth() === mesActual && f.getFullYear() === anioActual;
    });

    const totalVentas = ventasMes.reduce((acc, v) => acc + obtenerMontoVenta(v), 0);
    const totalGastos = gastosMes.reduce((acc, g) => acc + obtenerMontoGasto(g), 0);

    return {
      totalVentas,
      totalGastos,
      balanceNeto: totalVentas - totalGastos,
      cantidadVentas: ventasMes.length,
      cantidadGastos: gastosMes.length,
    };
  }, [ventas, gastos, mesActual, anioActual]);

  const metricasHoy = useMemo(() => {
    const ventasHoy = ventas.filter((v) => v.created_at && v.created_at.startsWith(hoyStr));
    const gastosHoy = gastos.filter((g) => g.created_at && g.created_at.startsWith(hoyStr));

    const totalVentas = ventasHoy.reduce((acc, v) => acc + obtenerMontoVenta(v), 0);
    const totalGastos = gastosHoy.reduce((acc, g) => acc + obtenerMontoGasto(g), 0);

    return {
      totalVentas,
      totalGastos,
      balanceNeto: totalVentas - totalGastos,
      cantidadVentas: ventasHoy.length,
    };
  }, [ventas, gastos, hoyStr]);

  const ventasFiltradas = useMemo(() => {
    if (filtroPeriodo === 'hoy') {
      return ventas.filter((v) => v.created_at && v.created_at.startsWith(hoyStr));
    }
    if (filtroPeriodo === 'mes') {
      return ventas.filter((v) => {
        if (!v.created_at) return false;
        const f = new Date(v.created_at);
        return f.getMonth() === mesActual && f.getFullYear() === anioActual;
      });
    }
    return ventas;
  }, [ventas, filtroPeriodo, hoyStr, mesActual, anioActual]);

  // Funciones de Exportación para Dashboard
  const exportarExcelDashboard = () => {
    let csvContent = "data:text/csv;charset=utf-8,Fecha;ID;Monto\n";
    ventasFiltradas.forEach((v) => {
      csvContent += `${v.created_at};${v.id};${obtenerMontoVenta(v)}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ventas_dashboard_${filtroPeriodo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarWordDashboard = () => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Reporte Dashboard</title></head>
      <body style="font-family: Arial;">
        <h2>Reporte de Dashboard y Balances</h2>
        <p><strong>Total Ingresos del Mes:</strong> $${metricasMes.totalVentas.toLocaleString('es-AR')}</p>
        <p><strong>Total Gastos del Mes:</strong> $${metricasMes.totalGastos.toLocaleString('es-AR')}</p>
        <p><strong>Balance Neto del Mes:</strong> $${metricasMes.balanceNeto.toLocaleString('es-AR')}</p>
        <h3>Listado de Ventas (${filtroPeriodo})</h3>
        <table border="1" cellspacing="0" cellpadding="5">
          <tr><th>Fecha</th><th>ID</th><th>Monto</th></tr>
          ${ventasFiltradas.slice(0, 100).map(v => `<tr><td>${v.created_at}</td><td>${v.id}</td><td>$${obtenerMontoVenta(v)}</td></tr>`).join('')}
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_dashboard_${filtroPeriodo}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const imprimirDashboard = () => {
    window.print();
  };

  const nombreMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(ahora);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 backdrop-blur-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span>📊</span> Dashboard y Balances
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Período actual: <strong className="text-zinc-200 capitalize">{nombreMes}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportarExcelDashboard}
            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-xl transition border border-emerald-500/30"
          >
            📊 Excel
          </button>
          <button
            onClick={exportarWordDashboard}
            className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-xl transition border border-indigo-500/30"
          >
            📄 Word
          </button>
          <button
            onClick={imprimirDashboard}
            className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold rounded-xl transition border border-purple-500/30"
          >
            🖨️ Imprimir / PDF
          </button>
          <button
            onClick={cargarDatos}
            disabled={cargando}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition border border-zinc-700/60 disabled:opacity-50"
          >
            {cargando ? 'Actualizando...' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-950/40 via-zinc-900/80 to-zinc-900/80 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗓️</span>
            <h3 className="font-semibold text-indigo-300 text-base uppercase tracking-wider">
              Balance Mensual ({nombreMes})
            </h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
            {metricasMes.cantidadVentas} ventas · {metricasMes.cantidadGastos} gastos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-400">Total Ingresos del Mes</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              ${metricasMes.totalVentas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Suma bruta de ventas facturadas</p>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-400">Total Gastos del Mes</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">
              ${metricasMes.totalGastos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Egresos y compras de caja</p>
          </div>

          <div className="bg-zinc-900/70 border border-indigo-500/40 rounded-xl p-4">
            <p className="text-xs font-medium text-indigo-300">Balance Neto del Mes</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                metricasMes.balanceNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ${metricasMes.balanceNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              {metricasMes.balanceNeto >= 0 ? '▲ Superávit acumulado' : '▼ Saldo negativo mensual'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Ventas de Hoy</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            ${metricasHoy.totalVentas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-zinc-500">{metricasHoy.cantidadVentas} operaciones hoy</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Gastos de Hoy</p>
          <p className="text-xl font-bold text-rose-400 mt-1">
            ${metricasHoy.totalGastos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-zinc-500">Egresos registrados hoy</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400">Balance de Hoy</p>
          <p
            className={`text-xl font-bold mt-1 ${
              metricasHoy.balanceNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ${metricasHoy.balanceNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-zinc-500">Ingresos menos gastos hoy</span>
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
            <span>🧾</span> Historial de Ventas ({ventasFiltradas.length})
          </h3>

          <div className="flex items-center gap-1 bg-zinc-800/80 p-1 rounded-xl border border-zinc-700/60 text-xs">
            <button
              onClick={() => setFiltroPeriodo('hoy')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filtroPeriodo === 'hoy'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setFiltroPeriodo('mes')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filtroPeriodo === 'mes'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setFiltroPeriodo('todos')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filtroPeriodo === 'todos'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Histórico ({ventas.length})
            </button>
          </div>
        </div>

        {cargando ? (
          <div className="py-12 text-center text-zinc-500 text-sm">Cargando registros...</div>
        ) : ventasFiltradas.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm">
            {ventas.length === 0
              ? 'No se encontraron ventas registradas en la base de datos.'
              : 'No hay ventas en el período seleccionado. Podés hacer clic en "Histórico" para ver todas.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="text-xs uppercase bg-zinc-800/50 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Referencia / ID</th>
                  <th className="py-3 px-4 text-right">Monto Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {ventasFiltradas.slice(0, 50).map((v) => {
                  const monto = obtenerMontoVenta(v);
                  const fecha = v.created_at
                    ? new Date(v.created_at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Sin fecha';

                  return (
                    <tr key={v.id} className="hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 text-xs text-zinc-400">{fecha}</td>
                      <td className="py-3 px-4 text-xs font-mono text-zinc-500">
                        {String(v.id).slice(0, 8)}...
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                        ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardView;