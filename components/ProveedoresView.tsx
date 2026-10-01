'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useNegocio } from '@/context/NegocioContext'
import { useNotificaciones } from '@/components/Notificaciones'

export function ProveedoresView({ productosPlana }: { productosPlana: any[] }) {
  const { negocioActual } = useNegocio()
  const { notificar } = useNotificaciones()

  const [proveedoresDB, setProveedoresDB] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>('TODOS')
  
  // Control de modales y campos del formulario
  const [mostrarModal, setMostrarModal] = useState(false)
  const [mostrarModalExportar, setMostrarModalExportar] = useState(false)
  const [proveedorEditando, setProveedorEditando] = useState<any | null>(null)
  const [nombre, setNombre] = useState('')
  const [origen, setOrigen] = useState('')
  const [contacto, setContacto] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarProveedores()
  }, [])

  const cargarProveedores = async () => {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name')

      if (error) {
        console.warn('Usando fallback de productos:', error)
        extraerDesdeProductos()
      } else {
        setProveedoresDB(data || [])
      }
    } catch (err) {
      console.error('Error:', err)
      extraerDesdeProductos()
    } finally {
      setCargando(false)
    }
  }

  const extraerDesdeProductos = () => {
    const unicos = Array.from(new Set(productosPlana.map(p => p.supplier || p.proveedor || 'General'))).sort()
    const formateados = unicos.map((nombreProv, idx) => ({
      id: `fallback-${idx}`,
      name: nombreProv
    }))
    setProveedoresDB(formateados)
  }

  const abrirModalNuevo = () => {
    setProveedorEditando(null)
    setNombre('')
    setOrigen('')
    setContacto('')
    setTelefono('')
    setEmail('')
    setObservaciones('')
    setMostrarModal(true)
  }

  const abrirModalEditar = (prov: any) => {
    setProveedorEditando(prov)
    setNombre(prov.name || '')
    setOrigen(prov.address || '')
    setContacto(prov.contact_person || '')
    setTelefono(prov.phone || '')
    setEmail(prov.email || '')
    setObservaciones(prov.notes || '')
    setMostrarModal(true)
  }

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) {
      notificar('error', 'El nombre del proveedor es obligatorio', 'Proveedores')
      return
    }

    setGuardando(true)
    try {
      const payload = {
        name: nombre.trim(),
        address: origen.trim() || null,
        contact_person: contacto.trim() || null,
        phone: telefono.trim() || null,
        email: email.trim() || null,
        notes: observaciones.trim() || null
      }

      if (proveedorEditando && !String(proveedorEditando.id).startsWith('fallback-') && !String(proveedorEditando.id).startsWith('prod-')) {
        const { error } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', proveedorEditando.id)

        if (error) throw error
        notificar('exito', `Proveedor "${nombre}" actualizado con éxito!`, 'Proveedores')
      } else {
        const { error } = await supabase.from('suppliers').insert(payload)

        if (error) throw error
        notificar('exito', `Proveedor "${nombre}" guardado con éxito!`, 'Proveedores')
      }

      setMostrarModal(false)
      await cargarProveedores()
    } catch (err: any) {
      notificar('error', `Error al guardar: ${err.message}`, 'Error')
    } finally {
      setGuardando(false)
    }
  }

  // Funciones de Exportación por Formato
  const exportarInforme = (formato: 'excel' | 'pdf' | 'word') => {
    if (productosDelProveedor.length === 0) {
      notificar('error', 'No hay datos para exportar', 'Exportar')
      return
    }

    setMostrarModalExportar(false)
    const nombreArchivo = `informe_proveedor_${proveedorSeleccionado.toLowerCase().replace(/\s+/g, '_')}`

    if (formato === 'excel') {
      const headers = ['Producto', 'Proveedor', 'Stock', 'Costo Unitario', 'Precio Venta', 'Inversion Costo', 'Valor Venta']
      const filas = productosDelProveedor.map(p => {
        const stock = Number(p.stock) || 0
        const costo = Number(p.costo || p.cost_price) || 0
        const venta = Number(p.precio || p.sale_price) || 0
        return [
          `"${(p.nombre || '').replace(/"/g, '""')}"`,
          `"${(p.supplier || p.proveedor || 'General').replace(/"/g, '""')}"`,
          stock,
          costo,
          venta,
          stock * costo,
          stock * venta
        ].join(';')
      })

      const csvContent = '\uFEFF' + [headers.join(';'), ...filas].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `${nombreArchivo}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      notificar('exito', 'Informe exportado en Excel (CSV) con éxito', 'Exportar')
    } else if (formato === 'word') {
      let contenidoHtml = `<html><head><meta charset="utf-8"><title>Informe</title></head><body>`
      contenidoHtml += `<h1>Informe de Proveedor: ${proveedorSeleccionado}</h1>`
      contenidoHtml += `<p>Artículos totales: ${productosDelProveedor.length}</p>`
      contenidoHtml += `<table border="1"><tr><th>Producto</th><th>Stock</th><th>Costo</th><th>Venta</th></tr>`
      productosDelProveedor.forEach(p => {
        contenidoHtml += `<tr><td>${p.nombre || ''}</td><td>${p.stock || 0}</td><td>$${p.costo || p.cost_price || 0}</td><td>$${p.precio || p.sale_price || 0}</td></tr>`
      })
      contenidoHtml += `</table></body></html>`

      const blob = new Blob(['\ufeff' + contenidoHtml], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `${nombreArchivo}.doc`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      notificar('exito', 'Informe exportado en Word con éxito', 'Exportar')
    } else if (formato === 'pdf') {
      // Generación de ventana de impresión optimizada para PDF
      const ventanaImpresion = window.open('', '_blank')
      if (!ventanaImpresion) {
        notificar('error', 'Por favor permite las ventanas emergentes (popups) para imprimir', 'Exportar')
        return
      }

      const filasHtml = productosDelProveedor.map(p => {
        const stock = Number(p.stock) || 0
        const costo = Number(p.costo || p.cost_price) || 0
        const venta = Number(p.precio || p.sale_price) || 0
        const inversion = stock * costo
        const valorVenta = stock * venta

        return `
          <tr>
            <td>${p.nombre || 'Sin nombre'}</td>
            <td style="text-align: center;">${stock} un.</td>
            <td style="text-align: right;">$${costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right;">$${venta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right;">$${inversion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right;">$${valorVenta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          </tr>
        `
      }).join('')

      const nombreNegocioStr = (negocioActual as any)?.name || (negocioActual as any)?.nombre || 'General'

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Informe - ${proveedorSeleccionado}</title>
            <style>
              body { font-family: Arial, sans-serif; color: #111; padding: 20px; margin: 0; }
              h1 { font-size: 20px; margin-bottom: 5px; text-transform: uppercase; color: #1e3a8a; }
              .sub { font-size: 12px; color: #555; margin-bottom: 20px; }
              .cards { display: flex; gap: 15px; margin-bottom: 20px; }
              .card { border: 1px solid #ddd; padding: 12px; border-radius: 6px; flex: 1; background: #f9fafb; }
              .card p { margin: 0; font-size: 11px; color: #555; font-weight: bold; }
              .card h3 { margin: 5px 0 0 0; font-size: 15px; color: #111; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
              th, td { border: 1px solid #d1d5db; padding: 8px 10px; }
              th { background-color: #f3f4f6; color: #111; text-align: left; }
            </style>
          </head>
          <body>
            <h1>Informe de Proveedor: ${proveedorSeleccionado}</h1>
            <div class="sub">Negocio: ${nombreNegocioStr} | Fecha: ${new Date().toLocaleDateString('es-AR')} | Total Artículos: ${productosDelProveedor.length}</div>
            
            <div class="cards">
              <div class="card">
                <p>STOCK TOTAL / ARTÍCULOS</p>
                <h3>${stockTotalProv} un. <span style="font-size: 11px; font-weight: normal; color: #555;">(${productosDelProveedor.length} art.)</span></h3>
              </div>
              <div class="card">
                <p>INVERSIÓN TOTAL (COSTO)</p>
                <h3>$${inversionProv.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div class="card">
                <p>VALOR DE VENTA</p>
                <h3>$${ventaProv.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div class="card">
                <p>GANANCIA PROYECTADA</p>
                <h3 style="color: #059669;">$${gananciaProv.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style="text-align: center;">Stock</th>
                  <th style="text-align: right;">Costo U.</th>
                  <th style="text-align: right;">Venta U.</th>
                  <th style="text-align: right;">Inversión Total</th>
                  <th style="text-align: right;">Valor Venta Total</th>
                </tr>
              </thead>
              <tbody>
                ${filasHtml}
              </tbody>
            </table>
            
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `

      ventanaImpresion.document.write(htmlContent)
      ventanaImpresion.document.close()
      notificar('exito', 'Generando documento PDF del informe', 'Exportar')
    }
  }

  // Combinar proveedores de la DB con los de los productos
  const nombresProveedoresMap = new Map()
  proveedoresDB.forEach(p => nombresProveedoresMap.set(p.name.toLowerCase(), p))
  productosPlana.forEach(p => {
    const sp = p.supplier || p.proveedor || 'General'
    if (!nombresProveedoresMap.has(sp.toLowerCase())) {
      nombresProveedoresMap.set(sp.toLowerCase(), { id: `prod-${sp}`, name: sp })
    }
  })

  const listaProveedoresTotal = Array.from(nombresProveedoresMap.values())

  // Filtrar productos según la selección
  const productosDelProveedor = proveedorSeleccionado === 'TODOS'
    ? productosPlana
    : productosPlana.filter(
        p => (p.supplier || p.proveedor || 'General').toLowerCase() === proveedorSeleccionado.toLowerCase()
      )

  // Totales globales
  const inversionTotalGlobal = productosPlana.reduce((acc, p) => acc + (Number(p.stock) || 0) * (Number(p.costo || p.cost_price) || 0), 0)
  const gananciaTotalGlobal = productosPlana.reduce((acc, p) => {
    const stock = Number(p.stock) || 0
    const costo = Number(p.costo || p.cost_price) || 0
    const venta = Number(p.precio || p.sale_price) || 0
    return acc + (stock * (venta - costo))
  }, 0)

  // Métricas del filtro actual
  const stockTotalProv = productosDelProveedor.reduce((acc, p) => acc + (Number(p.stock) || 0), 0)
  const inversionProv = productosDelProveedor.reduce((acc, p) => acc + (Number(p.stock) || 0) * (Number(p.costo || p.cost_price) || 0), 0)
  const ventaProv = productosDelProveedor.reduce((acc, p) => acc + (Number(p.stock) || 0) * (Number(p.precio || p.sale_price) || 0), 0)
  const gananciaProv = ventaProv - inversionProv

  const proveedorObjActual = listaProveedoresTotal.find((p: any) => p.name.toLowerCase() === proveedorSeleccionado.toLowerCase())

  return (
    <div className="space-y-6">
      {/* Cabecera y Botón Nuevo Proveedor */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 backdrop-blur-md rounded-2xl p-5 border border-blue-500/30">
        <div>
          <h2 className="text-2xl font-black text-white">🚚 Gestión de Proveedores</h2>
          <p className="text-blue-200/80 text-sm mt-1">Administrá el stock, costos y ganancias de tus proveedores.</p>
        </div>
        <button
          onClick={abrirModalNuevo}
          className="bg-blue-600 hover:bg-blue-500 text-white font-black px-5 py-3 rounded-xl text-sm transition shadow-lg shadow-blue-900/40 cursor-pointer flex items-center gap-2"
        >
          ➕ Nuevo Proveedor
        </button>
      </div>

      {/* Modal de Registro / Edición */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-black text-white text-lg">
                {proveedorEditando ? '✏️ Editar Proveedor' : '➕ Registrar Nuevo Proveedor'}
              </h3>
              <button
                onClick={() => setMostrarModal(false)}
                className="text-neutral-400 hover:text-white font-bold text-lg px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={guardarProveedor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-400">Nombre / Empresa *</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: MARISOL"
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mt-1 focus:outline-none focus:border-blue-500"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400">Ciudad / Origen (Address)</label>
                  <input
                    type="text"
                    value={origen}
                    onChange={(e) => setOrigen(e.target.value)}
                    placeholder="Ej: PERICO, JUJUY"
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-400">Nombre de Contacto</label>
                  <input
                    type="text"
                    value={contacto}
                    onChange={(e) => setContacto(e.target.value)}
                    placeholder="Ej: MARISOL RAMIREZ"
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="11 2345-6789"
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mt-1 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@proveedor.com"
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mt-1 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Días de visita, horarios, notas..."
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mt-1 resize-none h-20 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="w-1/2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold py-3 rounded-xl text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm transition shadow-lg shadow-blue-900/30 cursor-pointer"
                >
                  {guardando ? 'Guardando...' : proveedorEditando ? '💾 Actualizar' : '💾 Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Selección de Formato de Exportación */}
      {mostrarModalExportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-black text-white text-base">📥 Seleccionar Formato</h3>
              <button
                onClick={() => setMostrarModalExportar(false)}
                className="text-neutral-400 hover:text-white font-bold text-lg px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Elegí el formato en el que deseás descargar el informe de <span className="text-white font-bold">{proveedorSeleccionado}</span>:
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => exportarInforme('excel')}
                className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 p-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📊</span> Excel / CSV (.csv)
              </button>
              <button
                onClick={() => exportarInforme('word')}
                className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 p-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📄</span> Word (.doc)
              </button>
              <button
                onClick={() => exportarInforme('pdf')}
                className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 p-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📑</span> PDF (Generar Informe)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sección de Selección y Tarjeta Global */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Selector Desplegable */}
        <div className="lg:col-span-1 bg-neutral-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="font-black text-white text-lg">📋 Seleccionar Proveedor</h3>
            <p className="text-xs text-neutral-400 mt-1">Elegí uno en particular o visualizá a todos juntos.</p>
          </div>
          <select
            value={proveedorSeleccionado}
            onChange={(e) => setProveedorSeleccionado(e.target.value)}
            className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="TODOS">📋 Todos los Proveedores</option>
            {listaProveedoresTotal.map((p: any) => (
              <option key={p.id} value={p.name}>
                🏷️ {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tarjeta Global con Totales de Costo y Ganancias */}
        <div className="lg:col-span-2 bg-gradient-to-r from-neutral-900/80 to-blue-950/40 backdrop-blur-md rounded-2xl border border-blue-500/20 p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-black text-white text-lg flex items-center gap-2">
              📊 Resumen Global (Todos los Proveedores)
            </h3>
            <p className="text-xs text-neutral-400 mt-1">Suma acumulada de inventario de toda la red de proveedores.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/10">
            <div>
              <p className="text-xs text-neutral-400 font-bold">Inversión Total (Costo):</p>
              <p className="text-xl font-black text-white mt-0.5">
                ${inversionTotalGlobal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 font-bold">Ganancia Total Proyectada:</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">
                ${gananciaTotalGlobal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detalle y Estadísticas del Proveedor Seleccionado o Todos */}
      <div className="bg-neutral-900/60 backdrop-blur-md rounded-3xl border border-white/10 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-2xl font-black text-white">
                {proveedorSeleccionado === 'TODOS' ? '🌐 Todos los Proveedores' : proveedorSeleccionado}
              </h3>
              
              <div className="flex items-center gap-2">
                {proveedorSeleccionado !== 'TODOS' && proveedorObjActual && (
                  <button
                    onClick={() => abrirModalEditar(proveedorObjActual)}
                    className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <span>✏️</span> Editar Proveedor
                  </button>
                )}
                <button
                  onClick={() => setMostrarModalExportar(true)}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>📥</span> Exportar Informe
                </button>
              </div>
            </div>
            <p className="text-xs text-neutral-400 mt-1">Resumen financiero y stock de los artículos filtrados</p>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 text-blue-300 px-4 py-1.5 rounded-xl text-xs font-black">
            {productosDelProveedor.length} artículos
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-950/60 p-4 rounded-2xl border border-white/5">
            <p className="text-xs text-neutral-400 font-bold">Stock Total / Artículos:</p>
            <p className="text-xl font-black text-white mt-1">{stockTotalProv} un. <span className="text-xs text-neutral-400 font-normal">({productosDelProveedor.length} art.)</span></p>
          </div>
          <div className="bg-neutral-950/60 p-4 rounded-2xl border border-white/5">
            <p className="text-xs text-neutral-400 font-bold">Inversión (Costo):</p>
            <p className="text-xl font-black text-neutral-200 mt-1">${inversionProv.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-neutral-950/60 p-4 rounded-2xl border border-white/5">
            <p className="text-xs text-neutral-400 font-bold">Valor de Venta:</p>
            <p className="text-xl font-black text-emerald-400 mt-1">${ventaProv.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-neutral-950/60 p-4 rounded-2xl border border-white/5">
            <p className="text-xs text-neutral-400 font-bold">Ganancia Proy.:</p>
            <p className="text-xl font-black text-emerald-400 mt-1">${gananciaProv.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-black text-neutral-400 uppercase tracking-wider">Detalle de Productos:</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {productosDelProveedor.map((prod: any) => (
              <div key={prod.id} className="bg-neutral-950/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white text-sm truncate">{prod.nombre}</p>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-bold uppercase shrink-0">
                      {prod.supplier || prod.proveedor || 'General'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Costo: ${Number(prod.costo || prod.cost_price || 0).toLocaleString('es-AR')} • Venta: <span className="text-emerald-400 font-bold">${Number(prod.precio || prod.sale_price || 0).toLocaleString('es-AR')}</span>
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-black text-white shrink-0">
                  {prod.stock} un.
                </div>
              </div>
            ))}
            {productosDelProveedor.length === 0 && (
              <p className="text-neutral-500 text-sm text-center py-6">No hay productos asociados.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}