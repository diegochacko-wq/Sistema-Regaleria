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
  proveedoresData: ProveedorData[];
}

export const ProveedoresView: React.FC<ProveedoresViewProps> = ({ proveedoresData }) => {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>('TODOS');
  const [tipoInforme, setTipoInforme] = useState<'completo' | 'rapido'>('completo');

  // Función para exportar a Excel (CSV)
  const exportarExcel = () => {
    let contenido = "data:text/csv;charset=utf-8,";
    contenido += "Proveedor,Producto,Cantidad,Costo,Venta,Total Invertido,Total Ganancia\n";
    
    const datosFiltrados = proveedorSeleccionado === 'TODOS' 
      ? proveedoresData 
      : proveedoresData.filter(p => p.nombre === proveedorSeleccionado);

    datosFiltrados.forEach(prov => {
      if (tipoInforme === 'completo') {
        prov.productos.forEach((prod) => {
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
        prov.productos.forEach((prod) => {
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

  // Función para exportar a PDF (Impresión directa del navegador)
  const exportarPDF = () => {
    window.print();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Gestión de Proveedores e Informes</h1>

      {/* Controles de selección y exportación */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-white rounded-lg shadow items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">PROVEEDOR:</label>
            <select 
              value={proveedorSeleccionado} 
              onChange={(e) => setProveedorSeleccionado(e.target.value)}
              className="border border-gray-300 rounded p-2 text-sm bg-white"
            >
              <option value="TODOS">Todos los proveedores</option>
              {proveedoresData.map((p, idx) => (
                <option key={idx} value={p.nombre}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">TIPO DE INFORME:</label>
            <select 
              value={tipoInforme} 
              onChange={(e) => setTipoInforme(e.target.value as 'completo' | 'rapido')}
              className="border border-gray-300 rounded p-2 text-sm bg-white"
            >
              <option value="completo">Informe Completo (con artículos)</option>
              <option value="rapido">Informe Rápido (solo totales)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4 md:mt-0">
          <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 transition">
            Exportar Excel
          </button>
          <button onClick={exportarWord} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition">
            Exportar Word
          </button>
          <button onClick={exportarPDF} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 transition">
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Visualización de los datos en pantalla */}
      <div className="grid gap-6">
        {(proveedorSeleccionado === 'TODOS' 
          ? proveedoresData 
          : proveedoresData.filter(p => p.nombre === proveedorSeleccionado)
        ).map((prov, index) => (
          <div key={index} className="bg-white p-5 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3 mb-3">
              <h2 className="text-lg font-bold text-gray-800">{prov.nombre}</h2>
              <div className="text-right text-sm">
                <span className="mr-4 text-gray-600">Invertido: <strong className="text-gray-900">${prov.totalInvertido}</strong></span>
                <span className="text-green-600">Ganancia Esperada: <strong>${prov.totalGanancia}</strong></span>
              </div>
            </div>

            {tipoInforme === 'completo' && prov.productos && prov.productos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                    <tr>
                      <th className="p-2">Producto</th>
                      <th className="p-2">Stock</th>
                      <th className="p-2">Costo</th>
                      <th className="p-2">Precio Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prov.productos.map((prod, pIdx) => (
                      <tr key={pIdx} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium text-gray-900">{prod.nombre}</td>
                        <td className="p-2">{prod.stock}</td>
                        <td className="p-2">${prod.costo}</td>
                        <td className="p-2">${prod.precio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};