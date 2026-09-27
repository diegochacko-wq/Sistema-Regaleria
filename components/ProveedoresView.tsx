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
  proveedoresData?: ProveedorData[];
}

export const ProveedoresView: React.FC<ProveedoresViewProps> = ({ proveedoresData = [] }) => {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>('TODOS');
  const [tipoInforme, setTipoInforme] = useState<'completo' | 'rapido'>('completo');

  const datosFiltrados =
    proveedorSeleccionado === 'TODOS'
      ? proveedoresData
      : proveedoresData.filter((p) => p.nombre === proveedorSeleccionado);

  const escaparHTML = (valor: unknown) =>
    String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const generarHTMLInforme = () => {
    let htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Informe de Proveedores</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; color: #222; }
            h1 { margin-bottom: 6px; }
            h2 { margin-top: 28px; margin-bottom: 8px; }
            p { margin: 5px 0 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #999; padding: 7px; text-align: left; }
            th { background: #eeeeee; }
            .totales { margin: 10px 0 14px; font-weight: bold; }
            .separador { margin: 25px 0; border-top: 1px solid #bbb; }
          </style>
        </head>
        <body>
          <h1>Informe de Proveedores - ${tipoInforme === 'completo' ? 'Completo' : 'Rápido'}</h1>
          <p>Proveedor: <strong>${escaparHTML(proveedorSeleccionado === 'TODOS' ? 'Todos los proveedores' : proveedorSeleccionado)}</strong></p>
    `;

    datosFiltrados.forEach((prov) => {
      htmlContent += `
        <h2>${escaparHTML(prov.nombre)}</h2>
        <div class="totales">
          Total invertido: $${Number(prov.totalInvertido || 0).toFixed(2)}
          &nbsp;&nbsp;|&nbsp;&nbsp;
          Ganancia esperada: $${Number(prov.totalGanancia || 0).toFixed(2)}
        </div>
      `;

      if (tipoInforme === 'completo') {
        htmlContent += `
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio de costo</th>
                <th>Precio de venta</th>
              </tr>
            </thead>
            <tbody>
        `;

        prov.productos.forEach((prod) => {
          htmlContent += `
            <tr>
              <td>${escaparHTML(prod.nombre)}</td>
              <td>${prod.stock}</td>
              <td>$${Number(prod.costo || 0).toFixed(2)}</td>
              <td>$${Number(prod.precio || 0).toFixed(2)}</td>
            </tr>
          `;
        });

        htmlContent += `
            </tbody>
          </table>
        `;
      }

      htmlContent += `<div class="separador"></div>`;
    });

    if (datosFiltrados.length === 0) {
      htmlContent += `<p>No hay datos disponibles para el proveedor seleccionado.</p>`;
    }

    htmlContent += `</body></html>`;
    return htmlContent;
  };

  // Exportación compatible con Excel (.xls).
  // No requiere instalar librerías adicionales en el proyecto.
  const exportarExcel = () => {
    const htmlContent = generarHTMLInforme();
    const blob = new Blob([htmlContent], {
      type: 'application/vnd.ms-excel;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_proveedor_${proveedorSeleccionado}_${tipoInforme}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exportación a Word (.doc).
  const exportarWord = () => {
    const htmlContent = generarHTMLInforme();
    const blob = new Blob(['\ufeff' + htmlContent], {
      type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_proveedor_${proveedorSeleccionado}_${tipoInforme}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Genera una ventana exclusiva para el informe seleccionado y desde allí permite
  // guardarlo como PDF, evitando imprimir toda la aplicación.
  const exportarPDF = () => {
    const ventana = window.open('', '_blank', 'width=1000,height=800');

    if (!ventana) {
      alert('El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes para exportar el PDF.');
      return;
    }

    ventana.document.open();
    ventana.document.write(generarHTMLInforme());
    ventana.document.close();

    ventana.onload = () => {
      ventana.focus();
      ventana.print();
    };
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