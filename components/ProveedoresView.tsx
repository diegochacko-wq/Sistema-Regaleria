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
  // Estado local para permitir registrar datos si el componente padre no los pasa
  const [listaProveedores, setListaProveedores] = useState<ProveedorData[]>(
    proveedoresData.length > 0 ? proveedoresData : [
      {
        nombre: "MATI",
        totalInvertido: 1214165.64,
        totalGanancia: 1226334.36,
        productos: [
          { nombre: "0087 FRAZADA ESTAMPADA 160...", stock: 3, costo: 7650.4, precio: 16000 },
          { nombre: "1 Erba Pura", stock: 0, costo: 28474, precio: 50000 }
        ]
      }
    ]
  );

  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>('TODOS');
  const [tipoInforme, setTipoInforme] = useState<'completo' | 'rapido'>('completo');
  
  // Estado para el formulario de nuevo proveedor
  const [mostrarModal, setMostrarModal] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoInvertido, setNuevoInvertido] = useState('');
  const [nuevaGanancia, setNuevaGanancia] = useState('');

  const agregarProveedor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre) return;

    const nuevoProv: ProveedorData = {
      nombre: nuevoNombre.toUpperCase(),
      totalInvertido: Number(nuevoInvertido) || 0,
      totalGanancia: Number(nuevaGanancia) || 0,
      productos: []
    };

    setListaProveedores([...listaProveedores, nuevoProv]);
    setNuevoNombre('');
    setNuevoInvertido('');
    setNuevaGanancia('');
    setMostrarModal(false);
  };

  // Cálculos globales
  const inversionGlobalCosto = listaProveedores.reduce((acc, p) => acc + (p.totalInvertido || 0), 0);
  const valorGlobalVenta = listaProveedores.reduce((acc, p) => acc + ((p.totalInvertido || 0) + (p.totalGanancia || 0)), 0);

  // Funciones de exportación
  const exportarExcel = () => {
    let contenido = "data:text/csv;charset=utf-8,";
    contenido += "Proveedor,Producto,Cantidad,Costo,Venta,Total Invertido,Total Ganancia\n";
    
    const datosFiltrados = proveedorSeleccionado === 'TODOS' 
      ? listaProveedores 
      : listaProveedores.filter(p => p.nombre === proveedorSeleccionado);

    datosFiltrados.forEach(prov => {
      if (tipoInforme === 'completo' && prov.productos && prov.productos.length > 0) {
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
    link.setAttribute("download", `informe_proveedores.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarWord = () => {
    const datosFiltrados = proveedorSeleccionado === 'TODOS' 
      ? listaProveedores 
      : listaProveedores.filter(p => p.nombre === proveedorSeleccionado);

    let htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/1999/xhtml"><body>`;
    htmlContent += `<h1>Informe de Proveedores</h1>`;
    
    datosFiltrados.forEach(prov => {
      htmlContent += `<h2>Proveedor: ${prov.nombre}</h2>`;
      htmlContent += `<p><strong>Total Invertido:</strong> $${prov.totalInvertido} | <strong>Ganancia:</strong> $${prov.totalGanancia}</p><hr/>`;
    });

    htmlContent += `</body></html>`;
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_proveedores.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarPDF = () => {
    window.print();
  };

  const datosFiltrados = proveedorSeleccionado === 'TODOS' 
    ? listaProveedores 
    : listaProveedores.filter(p => p.nombre === proveedorSeleccionado);

  return (
    <div className="p-6 bg-[#121212] min-h-screen text-white">
      {/* Cabecera y Botones */}
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

          {/* Acciones */}
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={() => setMostrarModal(true)} 
              className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              + Nuevo Proveedor
            </button>
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
              <option value="TODOS">Todos los proveedores ({listaProveedores.length})</option>
              {listaProveedores.map((p, idx) => (
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

      {/* Modal para Cargar Proveedor */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-white">Registrar Nuevo Proveedor</h3>
            <form onSubmit={agregarProveedor} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre del Proveedor:</label>
                <input 
                  type="text" 
                  value={nuevoNombre} 
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: MATI"
                  required
                  className="w-full bg-[#262626] border border-gray-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Total Invertido (Costo):</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={nuevoInvertido} 
                  onChange={(e) => setNuevoInvertido(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#262626] border border-gray-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ganancia Proyectada:</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={nuevaGanancia} 
                  onChange={(e) => setNuevaGanancia(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#262626] border border-gray-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setMostrarModal(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Listado de Proveedores en Estilo Tarjeta Oscura */}
      <div className="max-w-4xl mx-auto space-y-6">
        {datosFiltrados.map((prov, index) => {
          const stockTotalProv = prov.productos?.reduce((acc, p) => acc + (p.stock || 0), 0) || 0;
          const valorVentaProv = prov.productos?.reduce((acc, p) => acc + ((p.precio || 0) * (p.stock || 0)), 0) || (prov.totalInvertido + prov.totalGanancia);

          return (
            <div key={index} className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-4">
                <h2 className="text-xl font-black tracking-wide text-white uppercase">{prov.nombre}</h2>
                <span className="bg-[#2A2235] text-purple-300 border border-purple-900/50 text-xs font-bold px-3 py-1 rounded-full">
                  {prov.productos?.length || 0} artículos
                </span>
              </div>

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