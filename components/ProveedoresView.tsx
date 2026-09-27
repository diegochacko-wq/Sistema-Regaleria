import React, { useState } from 'react';

interface Producto {
  nombre: string;
  stock: number;
  costo: number;
  precio: number;
}

interface ProveedorData {
  nombre: string;
  totalInvertido: number;
  totalGanancia: number;
  productos: Producto[];
}

interface ProveedoresViewProps {
  proveedoresData?: ProveedorData[]; // Opcional para evitar errores en app/page.tsx
}

export const ProveedoresView: React.FC<ProveedoresViewProps> = ({ proveedoresData = [] }) => {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>('TODOS');
  const [tipoInforme, setTipoInforme] = useState<'completo' | 'rapido'>('completo');

  // Cálculos globales seguros
  const inversionGlobalCosto = proveedoresData.reduce((acc, p) => acc + (p.totalInvertido || 0), 0);
  const valorGlobalVenta = proveedoresData.reduce((acc, p) => acc + ((p.totalInvertido || 0) + (p.totalGanancia || 0)), 0);

  // Función para exportar a Excel (CSV)
  const exportarExcel = () => {
    let contenido = "data:text/csv;charset=utf-8,";
    contenido += "Proveedor,Producto,Cantidad,Costo,Venta,Total Invertido,Total Ganancia\n";
    
    const datosFiltrados = proveedorSeleccionado === 'TODOS' 
      ? proveedoresData 
      : proveedoresData.filter(p => p.nombre === proveedorSeleccionado);

    datosFiltrados.forEach(prov => {
      if (tipoInforme === 'completo') {
        prov.productos?.forEach((prod) => {
          contenido += `"${prov.nombre}","${prod.nombre}",${prod.stock},${prod.costo},${prod.precio},, \n`;
        });
      } else {
        contenido += `"${prov.nombre}","-","-","-","-",${prov.totalInvertido},${prov.totalGanancia}\n`;
      }
    });

    const encodedUri = encodeURI(contenido);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `informe_proveedores_${tipoInforme}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Función para exportar a Word (.doc)
  const exportarWord = () => {
    const datosFiltrados = proveedorSeleccionado === 'TODOS' 
      ? proveedoresData 
      : proveedoresData.filter(p => p.nombre === proveedorSeleccionado);

    let htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/1999/xhtml"><body>`;
    htmlContent += `<h1>Informe de Proveedores - ${tipoInforme === 'completo' ? 'Completo' : 'Rápido'}</h1>`;
    
    datosFiltrados.forEach(prov => {
      htmlContent += `<h2>Proveedor: ${prov.nombre}</h2>`;
      htmlContent += `<p><strong>Total Invertido:</strong> $${prov.totalInvertido} | <strong>Ganancia Esperada:</strong> $${prov.totalGanancia}</p>`;
      
      if (tipoInforme === 'completo') {
        htmlContent += `<table border="1" cellspacing="0" cellpadding="5">`;
        htmlContent += `<tr><th>Producto</th><th>Stock</th><th>Costo</th><th>Venta</th></tr>`;
        prov.productos?.forEach((prod) => {
          htmlContent += `<tr><td>${prod.nombre}</td><td>${prod.stock}</td><td>$${prod.costo}</td><td>$${prod.precio}</td></tr>`;
        });
        htmlContent += `</table><br/>`;
      }
      htmlContent += `<hr/>`;
    });

    htmlContent += `</body></html>`;
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_proveedores_${tipoInforme}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Función para exportar a PDF / Impresión
  const exportarPDF = () => {
    window.print();
  };

  const datosFiltrados = proveedorSeleccionado === 'TODOS' 
    ? proveedoresData 
    : proveedoresData.filter(p => p.nombre === proveedorSeleccionado);

  return (
    <div className="p-6 bg-[#121212] min-h-screen text-white">
      {/* Cabecera y Barra de Filtros / Exportación */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>🚚</span> Resumen y Catálogo por Proveedor
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Totales acumulados de stock, inversión en costo y valor proyectado de venta por proveedor
            </p>
          </div>

          {/* Botones de Exportación */}
          <div className="flex gap-2">
            <button onClick={exportarExcel} className="bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
              Excel
            </button>
            <button onClick={exportarWord} className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
              Word
            </button>
            <button onClick={exportarPDF} className="bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
              PDF
            </button>
          </div>
        </div>

        {/* Tarjeta Global con Filtros */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5 mb-6 shadow-lg grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Filtrar Proveedor:</label>
            <select 
              value={proveedorSeleccionado} 
              onChange={(e) => setProveedorSeleccionado(e.target.value)}
              className="w-full bg-[#262626] border border-gray-700 text-white rounded-xl p-2.5 text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="TODOS">Todos los proveedores</option>
              {proveedoresData.map((p, idx) => (
                <option key={idx} value={p.nombre}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Inversión Global (Costo):</span>
            <span className="text-xl font-bold text-amber-400">
              ${inversionGlobalCosto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor Global (Venta):</span>
            <span className="text-xl font-bold text-emerald-400">
              ${valorGlobalVenta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Listado de Proveedores en Estilo Tarjeta Oscura */}
      <div className="max-w-4xl mx-auto space-y-6">
        {datosFiltrados.map((prov, index) => {
          const stockTotalProv = prov.productos?.reduce((acc, p) => acc + (p.stock || 0), 0) || 0;
          const valorVentaProv = prov.productos?.reduce((acc, p) => acc + ((p.precio || 0) * (p.stock || 0)), 0) || prov.totalInvertido + prov.totalGanancia;

          return (
            <div key={index} className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 shadow-xl">
              {/* Cabecera de Proveedor */}
              <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-4">
                <h2 className="text-xl font-black tracking-wide text-white uppercase">{prov.nombre}</h2>
                <span className="bg-[#2A2235] text-purple-300 border border-purple-900/50 text-xs font-bold px-3 py-1 rounded-full">
                  {prov.productos?.length || 0} artículos
                </span>
              </div>

              {/* Grid de Métricas del Proveedor */}
              <div className="grid grid-cols-2 gap-4 bg-[#212121] p-4 rounded-xl border border-gray-800/60 mb-6">
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Stock Total:</span>
                  <span className="text-base font-bold text-white">{stockTotalProv} un.</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Ganancia Proy.:</span>
                  <span className="text-base font-bold text-emerald-400">
                    ${(prov.totalGanancia || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Inversión (Costo):</span>
                  <span className="text-base font-bold text-white">
                    ${(prov.totalInvertido || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Valor de Venta:</span>
                  <span className="text-base font-bold text-emerald-400">
                    ${valorVentaProv.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Detalle de Productos */}
              {prov.productos && prov.productos.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Detalle de Productos:</h3>
                  <div className="space-y-2">
                    {prov.productos.map((prod, pIdx) => (
                      <div key={pIdx} className="bg-[#212121] border border-gray-800/50 p-3 rounded-xl flex justify-between items-center text-sm">
                        <div>
                          <p className="font-semibold text-white">{prod.nombre}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Costo: ${prod.costo} <span className="text-gray-600">|</span> Venta: ${prod.precio}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${prod.stock > 0 ? 'bg-[#1E2923] text-emerald-400 border border-emerald-900/30' : 'bg-[#2E1F23] text-rose-400 border border-rose-900/30'}`}>
                          {prod.stock} un.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProveedoresView;