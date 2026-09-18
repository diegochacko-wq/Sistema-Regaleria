import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ModuloSenas() {
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
    setLoading(true)
    const { data: dataSenas } = await supabase.from('senas').select('*').order('id', { ascending: false })
    setSenas(dataSenas || [])

    const { data: dataProd } = await supabase.from('productos').select('*')
    setProductos(dataProd || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const productosFiltrados = productos.filter(p => 
    (p.nombre || p.titulo || p.descripcion || '').toLowerCase().includes(busquedaProducto.toLowerCase())
  )

  const handleAgregarSena = async (e) => {
    e.preventDefault()
    if (!nombreCliente || !montoSena || !montoTotal || !concepto) {
      alert('Completa los campos obligatorios')
      return
    }

    const { error } = await supabase
      .from('senas')
      .insert([{
        nombre_cliente: nombreCliente,
        telefono: telefono || '',
        monto_sena: parseFloat(montoSena),
        monto_total: parseFloat(montoTotal),
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

  return (
    <div style={{ padding: '24px', background: 'transparent', minHeight: '100vh', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Encabezado del Módulo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#fff' }}>Módulo de Señas</h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: '4px 0 0 0' }}>Gestión avanzada de reservas y anticipos</p>
        </div>
      </div>

      {/* Tarjeta del Formulario (Estilo Dashboard) */}
      <form onSubmit={handleAgregarSena} style={{ 
        background: '#161922', 
        border: '1px solid #222634', 
        borderRadius: '16px', 
        padding: '20px', 
        marginBottom: '24px', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '16px', 
        alignItems: 'end',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Cliente</label>
          <input 
            type="text" 
            placeholder="Nombre del cliente" 
            value={nombreCliente}
            onChange={(e) => setNombreCliente(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Teléfono</label>
          <input 
            type="text" 
            placeholder="Nro de contacto" 
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
        </div>

        {/* Buscador stock */}
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Concepto / Producto</label>
          <input 
            type="text" 
            placeholder="Buscar en stock..." 
            value={busquedaProducto}
            onChange={(e) => {
              setBusquedaProducto(e.target.value)
              setConcepto(e.target.value)
              setMostrarDropdown(true)
            }}
            onFocus={() => setMostrarDropdown(true)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
          {mostrarDropdown && productosFiltrados.length > 0 && (
            <ul style={{ 
              position: 'absolute', top: '100%', left: 0, right: 0, 
              background: '#161922', border: '1px solid #2a2f42', listStyle: 'none', 
              padding: 0, margin: '4px 0 0 0', maxHeight: '180px', overflowY: 'auto', zIndex: 10, borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
            }}>
              {productosFiltrados.map((prod, idx) => {
                const nombreProd = prod.nombre || prod.titulo || prod.descripcion || 'Producto'
                const precioProd = prod.precio || prod.precio_venta || ''
                return (
                  <li 
                    key={idx}
                    onClick={() => {
                      setConcepto(nombreProd)
                      setBusquedaProducto(nombreProd)
                      if (precioProd) setMontoTotal(precioProd)
                      setMostrarDropdown(false)
                    }}
                    style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #222634', fontSize: '13px', color: '#e2e8f0' }}
                    onMouseEnter={(e) => e.target.style.background = '#222634'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    {nombreProd} {precioProd ? <span style={{ color: '#38bdf8' }}>(${precioProd})</span> : ''}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Monto Seña ($)</label>
          <input 
            type="number" 
            placeholder="0.00" 
            value={montoSena}
            onChange={(e) => setMontoSena(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Monto Total ($)</label>
          <input 
            type="number" 
            placeholder="0.00" 
            value={montoTotal}
            onChange={(e) => setMontoTotal(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Fecha Seña</label>
          <input 
            type="date" 
            value={fechaSena}
            onChange={(e) => handleCambioFechaSena(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Vencimiento (+15d)</label>
          <input 
            type="date" 
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div>
          <button type="submit" style={{ 
            width: '100%', 
            padding: '11px', 
            background: 'linear-gradient(135deg, #c07a45 0%, #8b5533 100%)', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: '600',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(166, 100, 54, 0.4)'
          }}>
            ➕ Registrar Seña
          </button>
        </div>
      </form>

      {/* Contenedor de la Tabla Estilizada */}
      <div style={{ background: '#161922', border: '1px solid #222634', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Cargando registros...</p>
        ) : senas.length === 0 ? (
          <p style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No hay señas registradas actualmente.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#1e2330', color: '#94a3b8', borderBottom: '1px solid #2a2f42' }}>
                <th style={{ padding: '14px 16px', fontWeight: '500' }}>Cliente</th>
                <th style={{ padding: '14px 16px', fontWeight: '500' }}>Teléfono</th>
                <th style={{ padding: '14px 16px', fontWeight: '500' }}>Concepto</th>
                <th style={{ padding: '14px 16px', fontWeight: '500' }}>Seña</th>
                <th style={{ padding: '14px 16px', fontWeight: '500' }}>Total</th>
                <th style={{ padding: '14px 16px', fontWeight: '500' }}>Fecha</th>
                <th style={{ padding: '14px 16px', fontWeight: '500' }}>Vencimiento</th>
                <th style={{ padding: '14px 16px', fontWeight: '500' }}>Estado</th>
                <th style={{ padding: '14px 16px', fontWeight: '500', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {senas.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #222634', transition: 'background 0.2s' }}>
                  <td style={{ padding: '14px 16px', fontWeight: '500', color: '#fff' }}>{item.nombre_cliente}</td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{item.telefono || '-'}</td>
                  <td style={{ padding: '14px 16px', color: '#e2e8f0' }}>{item.concepto}</td>
                  <td style={{ padding: '14px 16px', color: '#efbd86', fontWeight: '600' }}>${item.monto_sena}</td>
                  <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>${item.monto_total}</td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{item.fecha_sena || '-'}</td>
                  <td style={{ padding: '14px 16px', color: '#f59e0b' }}>{item.fecha_vencimiento || '-'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      background: item.estado === 'Entregada' ? 'rgba(22, 163, 74, 0.15)' : item.estado === 'Cancelada' ? 'rgba(220, 38, 38, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: item.estado === 'Entregada' ? '#4ade80' : item.estado === 'Cancelada' ? '#f87171' : '#facc15'
                    }}>
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {item.estado !== 'Entregada' && (
                        <button 
                          onClick={() => actualizarEstadoSena(item.id, 'Entregada')}
                          style={{ padding: '6px 12px', background: '#166534', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                        >
                          Entregar
                        </button>
                      )}
                      {item.estado !== 'Cancelada' && (
                        <button 
                          onClick={() => actualizarEstadoSena(item.id, 'Cancelada')}
                          style={{ padding: '6px 12px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
