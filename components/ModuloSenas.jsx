import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNegocio } from '../context/NegocioContext' // Importamos el contexto del negocio

export default function ModuloSenas() {
  const { negocioActual } = useNegocio() // Obtenemos el negocio activo en la sesión
  const [senas, setSenas] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados para el formulario
  const [nombreCliente, setNombreCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [montoSena, setMontoSena] = useState('')
  const [montoTotal, setMontoTotal] = useState('')
  const [concepto, setConcepto] = useState('')
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [mostrarDropdown, setMostrarDropdown] = useState(false)

  // Fechas automáticas
  const obtenerFechaActual = () => new Date().toISOString().split('T')[0]
  const calcularVencimiento = (fechaBase) => {
    const d = new Date(fechaBase)
    d.setDate(d.getDate() + 15)
    return d.toISOString().split('T')[0]
  }

  const [fechaSena, setFechaSena] = useState(obtenerFechaActual())
  const [fechaVencimiento, setFechaVencimiento] = useState(calcularVencimiento(obtenerFechaActual()))

  const handleCambioFechaSena = (nuevaFecha) => {
    setFechaSena(nuevaFecha)
    setFechaVencimiento(calcularVencimiento(nuevaFecha))
  }

  const fetchData = async () => {
    if (!negocioActual?.id) return
    setLoading(true)

    // Cargar señas filtradas por el negocio actual
    const { data: dataSenas } = await supabase
      .from('senas')
      .select('*')
      .eq('negocio_id', negocioActual.id)
      .order('id', { ascending: false })
    
    setSenas(dataSenas || [])

    // Cargar productos del inventario filtrados por el negocio actual (igual que en el POS)
    const { data: dataProd, error } = await supabase
      .from('products')
      .select('*')
      .eq('negocio_id', negocioActual.id)
      .eq('active', true)
      .order('name')

    if (!error && dataProd) {
      const formateados = dataProd.map((p) => ({
        id: p.id,
        nombre: p.name,
        precio: Number(p.sale_price ?? p.price ?? 0),
        stock: Number(p.stock || 0),
        codigo: p.barcode || p.sku || '',
      }))
      setProductos(formateados)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (negocioActual?.id) {
      fetchData()
    }
  }, [negocioActual?.id])

  // Filtrado de productos basado en la sesión activa del negocio
  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) || 
    (p.codigo && p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase()))
  )

  const handleAgregarSena = async (e) => {
    e.preventDefault()
    if (!nombreCliente || !montoSena || !montoTotal || !concepto) {
      alert('Completa los campos obligatorios')
      return
    }

    if (!negocioActual?.id) {
      alert('No hay un negocio seleccionado.')
      return
    }

    const senaNum = parseFloat(montoSena) || 0
    const totalNum = parseFloat(montoTotal) || 0
    const restaNum = Math.max(0, totalNum - senaNum)

    const { error } = await supabase
      .from('senas')
      .insert([{
        negocio_id: negocioActual.id,
        nombre_cliente: nombreCliente,
        telefono: telefono || '',
        monto_sena: senaNum,
        monto_total: totalNum,
        resta_abonar: restaNum, // Guardamos o calculamos el saldo pendiente
        concepto: concepto,
        fecha_sena: fechaSena,
        fecha_vencimiento: fechaVencimiento,
        estado: 'Pendiente'
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setNombreCliente('')
      setTelefono('')
      setMontoSena('')
      setMontoTotal('')
      setConcepto('')
      setBusquedaProducto('')
      setFechaSena(obtenerFechaActual())
      setFechaVencimiento(calcularVencimiento(obtenerFechaActual()))
      fetchData()
    }
  }

  const actualizarEstadoSena = async (senaId, nuevoEstado) => {
    const { error } = await supabase.from('senas').update({ estado: nuevoEstado }).eq('id', senaId)
    if (error) {
      alert('No se pudo actualizar la seña: ' + error.message)
      return
    }
    fetchData()
  }

  // Cálculo de la resta a abonar en vivo para el formulario
  const calculoRestaForm = Math.max(0, (parseFloat(montoTotal) || 0) - (parseFloat(montoSena) || 0))

  return (
    <div style={{ padding: '16px', background: 'transparent', minHeight: '100vh', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Encabezado del Módulo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#fff' }}>Módulo de Señas</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
            {negocioActual?.name ? `Negocio: ${negocioActual.name}` : 'Gestión de reservas y anticipos'}
          </p>
        </div>
      </div>

      {/* Tarjeta del Formulario */}
      <form onSubmit={handleAgregarSena} style={{ 
        background: '#161922', 
        border: '1px solid #222634', 
        borderRadius: '16px', 
        padding: '16px', 
        marginBottom: '20px', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
        gap: '12px', 
        alignItems: 'end',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Cliente</label>
          <input 
            type="text" 
            placeholder="Nombre del cliente" 
            value={nombreCliente}
            onChange={(e) => setNombreCliente(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Teléfono</label>
          <input 
            type="text" 
            placeholder="Nro de contacto" 
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
        </div>

        {/* Buscador de Catálogo de Productos del Negocio */}
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Concepto / Producto</label>
          <input 
            type="text" 
            placeholder="Buscar en catálogo..." 
            value={busquedaProducto}
            onChange={(e) => {
              setBusquedaProducto(e.target.value)
              setConcepto(e.target.value)
              setMostrarDropdown(true)
            }}
            onFocus={() => setMostrarDropdown(true)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
          {mostrarDropdown && productosFiltrados.length > 0 && (
            <ul style={{ 
              position: 'absolute', top: '100%', left: 0, right: 0, 
              background: '#161922', border: '1px solid #2a2f42', listStyle: 'none', 
              padding: 0, margin: '4px 0 0 0', maxHeight: '180px', overflowY: 'auto', zIndex: 10, borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
            }}>
              {productosFiltrados.map((prod) => (
                <li 
                  key={prod.id}
                  onClick={() => {
                    setConcepto(prod.nombre)
                    setBusquedaProducto(prod.nombre)
                    if (prod.precio) setMontoTotal(prod.precio)
                    setMostrarDropdown(false)
                  }}
                  style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #222634', fontSize: '12px', color: '#e2e8f0', display: 'flex', justifyContent: 'between' }}
                >
                  <span>{prod.nombre}</span>
                  <span style={{ color: '#38bdf8', marginLeft: '8px' }}>(${prod.precio})</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Monto Seña ($)</label>
          <input 
            type="number" 
            placeholder="0.00" 
            value={montoSena}
            onChange={(e) => setMontoSena(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Monto Total ($)</label>
          <input 
            type="number" 
            placeholder="0.00" 
            value={montoTotal}
            onChange={(e) => setMontoTotal(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
        </div>

        {/* Indicador en tiempo real de cuánto resta abonar */}
        <div style={{ background: '#0f1117', padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2f42' }}>
          <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8' }}>Resta Abonar</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f43f5e' }}>${calculoRestaForm.toLocaleString()}</span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Fecha Seña</label>
          <input 
            type="date" 
            value={fechaSena}
            onChange={(e) => handleCambioFechaSena(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Vencimiento (+15d)</label>
          <input 
            type="date" 
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
        </div>

        <div>
          <button type="submit" style={{ 
            width: '100%', 
            padding: '10px', 
            background: 'linear-gradient(135deg, #c07a45 0%, #8b5533 100%)', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: '600',
            fontSize: '13px',
            boxShadow: '0 4px 12px rgba(166, 100, 54, 0.4)'
          }}>
            ➕ Registrar Seña
          </button>
        </div>
      </form>

      {/* Contenedor de la Tabla con Scroll Horizontal y la columna "Resta Abonar" */}
      <div style={{ background: '#161922', border: '1px solid #222634', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Cargando registros...</p>
        ) : senas.length === 0 ? (
          <p style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No hay señas registradas para este negocio actualmente.</p>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1e2330', color: '#94a3b8', borderBottom: '1px solid #2a2f42' }}>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Cliente</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Teléfono</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Concepto</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Seña</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Total</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Resta Abonar</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Fecha</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Vencimiento</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500' }}>Estado</th>
                  <th style={{ padding: '12px 14px', fontWeight: '500', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {senas.map((item) => {
                  const montoTotalItem = Number(item.monto_total || 0)
                  const montoSenaItem = Number(item.monto_sena || 0)
                  const restaAbonarItem = item.resta_abonar !== undefined ? Number(item.resta_abonar) : Math.max(0, montoTotalItem - montoSenaItem)

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #222634', transition: 'background 0.2s' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '500', color: '#fff' }}>{item.nombre_cliente}</td>
                      <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{item.telefono || '-'}</td>
                      <td style={{ padding: '12px 14px', color: '#e2e8f0' }}>{item.concepto}</td>
                      <td style={{ padding: '12px 14px', color: '#efbd86', fontWeight: '600' }}>${montoSenaItem.toLocaleString()}</td>
                      <td style={{ padding: '12px 14px', color: '#cbd5e1' }}>${montoTotalItem.toLocaleString()}</td>
                      <td style={{ padding: '12px 14px', color: '#f43f5e', fontWeight: 'bold' }}>${restaAbonarItem.toLocaleString()}</td>
                      <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{item.fecha_sena || '-'}</td>
                      <td style={{ padding: '12px 14px', color: '#f59e0b' }}>{item.fecha_vencimiento || '-'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '20px', 
                          fontSize: '11px', 
                          fontWeight: '500',
                          background: item.estado === 'Entregada' ? 'rgba(22, 163, 74, 0.15)' : item.estado === 'Cancelada' ? 'rgba(220, 38, 38, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                          color: item.estado === 'Entregada' ? '#4ade80' : item.estado === 'Cancelada' ? '#f87171' : '#facc15'
                        }}>
                          {item.estado}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {item.estado !== 'Entregada' && (
                            <button 
                              onClick={() => actualizarEstadoSena(item.id, 'Entregada')}
                              style={{ padding: '5px 10px', background: '#166534', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '500' }}
                            >
                              Entregar
                            </button>
                          )}
                          {item.estado !== 'Cancelada' && (
                            <button 
                              onClick={() => actualizarEstadoSena(item.id, 'Cancelada')}
                              style={{ padding: '5px 10px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '500' }}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}