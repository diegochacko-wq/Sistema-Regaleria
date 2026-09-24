'use client'

export default function InventoryView({
  productosInventario,
  productosStockBajo,
  productoAEditar,
  busquedaInventario,
  setBusquedaInventario,
  guardandoProducto,
  guardarProducto,
  eliminarProducto,
  cargarProductoEnFormulario,
  resetFormularioProducto,
  abrirEtiqueta,
  fetchProductos,
  nombreProd, setNombreProd,
  precioProd, setPrecioProd,
  costoProd, setCostoProd,
  stockProd, setStockProd,
  minStockProd, setMinStockProd,
  codigoProd, setCodigoProd,
  proveedorProd, setProveedorProd,
  categoriaProd, setCategoriaProd,
  categoriasDB,
  categoriaNuevaInput, setCategoriaNuevaInput,
  crearCategoriaRapida,
  generarCodigoAutomatico,
  setMostrarModalPedido
}: any) {
  return (
    <div className="space-y-6">
      {/* FORMULARIO DE ALTA / EDICIÓN */}
      <div className="bg-neutral-900/60 p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-black text-white">
            {productoAEditar ? `✏️ Editando: ${productoAEditar.nombre}` : '➕ Nuevo Producto'}
          </h2>
          {productoAEditar && (
            <button onClick={resetFormularioProducto} className="text-xs font-bold text-neutral-400 hover:text-white">
              Cancelar edición ✕
            </button>
          )}
        </div>
        <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-neutral-400">Nombre *</label>
            <input type="text" value={nombreProd} onChange={(e) => setNombreProd(e.target.value)} placeholder="Ej: Resma A4" className="w-full p-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm" required />
          </div>
          <div>
            <label className="text-xs text-neutral-400">SKU / Código de barras</label>
            <div className="flex gap-2">
              <input type="text" value={codigoProd} onChange={(e) => setCodigoProd(e.target.value)} placeholder="Ej: 7791234567890" className="w-full p-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm" />
              <button type="button" onClick={generarCodigoAutomatico} title="Generar código automático" className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 rounded-xl text-xs font-bold text-neutral-300 whitespace-nowrap">
                🎲
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400">Precio de Costo</label>
            <input type="number" step="0.01" value={costoProd} onChange={(e) => setCostoProd(e.target.value)} placeholder="0.00" className="w-full p-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-neutral-400">Precio de Venta *</label>
            <input type="number" step="0.01" value={precioProd} onChange={(e) => setPrecioProd(e.target.value)} placeholder="0.00" className="w-full p-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm" required />
          </div>
          <div>
            <label className="text-xs text-neutral-400">Stock actual</label>
            <input type="number" value={stockProd} onChange={(e) => setStockProd(e.target.value)} placeholder="0" className="w-full p-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-neutral-400">Stock mínimo (alerta)</label>
            <input type="number" value={minStockProd} onChange={(e) => setMinStockProd(e.target.value)} placeholder="0" className="w-full p-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-neutral-400">Proveedor</label>
            <input type="text" value={proveedorProd} onChange={(e) => setProveedorProd(e.target.value)} placeholder="Ej: General" className="w-full p-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-neutral-400">Categoría</label>
            <div className="flex gap-2">
              <select value={categoriaProd} onChange={(e) => setCategoriaProd(e.target.value)} className="w-full p-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm">
                <option value="">Sin categoría</option>
                {categoriasDB.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" value={categoriaNuevaInput} onChange={(e) => setCategoriaNuevaInput(e.target.value)} placeholder="Crear categoría nueva..." className="w-full p-2 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs" />
              <button type="button" onClick={crearCategoriaRapida} className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 rounded-xl text-xs font-bold text-neutral-300 whitespace-nowrap">
                + Agregar
              </button>
            </div>
          </div>
          <div className="md:col-span-3">
            <button type="submit" disabled={guardandoProducto} className="w-full bg-gradient-to-b from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl shadow-lg transition">
              {guardandoProducto ? 'Guardando...' : productoAEditar ? '💾 Guardar Cambios' : '➕ Cargar Producto'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex justify-between items-center gap-3">
        <h2 className="text-xl font-bold text-white">📦 Catálogo de Productos</h2>
        <div className="flex gap-2 flex-1 max-w-sm">
          <input
            type="text"
            placeholder="🔍 Buscar en inventario..."
            value={busquedaInventario}
            onChange={(e) => setBusquedaInventario(e.target.value)}
            className="w-full p-2 rounded-xl bg-neutral-900/80 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
        <button onClick={() => fetchProductos()} className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-neutral-300 whitespace-nowrap">
          🔄 Recargar
        </button>
      </div>

      {productosStockBajo.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-3">
          <p className="text-sm text-amber-300 font-bold">
            ⚠️ {productosStockBajo.length} producto{productosStockBajo.length > 1 ? 's' : ''} con stock igual o por debajo del mínimo.
          </p>
          <button onClick={() => setMostrarModalPedido(true)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg whitespace-nowrap">
            📋 Generar lista de pedido
          </button>
        </div>
      )}

      <div className="bg-neutral-900/60 p-4 rounded-2xl border border-white/10 overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-300">
          <thead className="text-xs uppercase bg-white/5 text-neutral-400">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">SKU / Código</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Proveedor</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Costo</th>
              <th className="p-3">Venta</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {productosInventario.map((p: any) => (
              <tr key={p.id} className={`hover:bg-white/5 ${p.active === false ? 'opacity-40' : ''}`}>
                <td className="p-3 font-bold text-white">{p.nombre}{p.active === false ? ' (baja)' : ''}</td>
                <td className="p-3">{p.codigo_barras || '-'}</td>
                <td className="p-3">{p.categoria}</td>
                <td className="p-3">{p.proveedor}</td>
                <td className={`p-3 font-bold ${p.stock <= p.min_stock ? 'text-rose-400' : 'text-neutral-200'}`}>{p.stock}</td>
                <td className="p-3">${p.precio_costo.toLocaleString()}</td>
                <td className="p-3 font-bold text-purple-400">${p.precio.toLocaleString()}</td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => abrirEtiqueta(p)} className="text-neutral-300 hover:text-white font-bold text-xs">
                    🏷️ Etiqueta
                  </button>
                  <button onClick={() => cargarProductoEnFormulario(p)} className="text-purple-400 hover:text-purple-300 font-bold text-xs">
                    Editar
                  </button>
                  {p.active !== false && (
                    <button onClick={() => eliminarProducto(p)} className="text-rose-400 hover:text-rose-300 font-bold text-xs">
                      Dar de baja
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}