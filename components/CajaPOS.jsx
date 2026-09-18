import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ModuloCajaPOS() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [carrito, setCarrito] = useState([])
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [cliente, setCliente] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchProductos = async () => {
    const { data } = await supabase.from('productos').select('*')
    setProductos(data || [])
  }

  useEffect(() => {
    fetchProductos()
  }, [])

  const productosFiltrados = productos.filter(p =>
    (p.nombre || p.titulo || p.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const agregarAlCarrito = (producto) => {
    const nombreProd = producto.nombre || producto.titulo || producto.descripcion || 'Producto'
    const precioProd = parseFloat(producto.precio || producto.precio_venta || 0)

    const existe = carrito.find(item => item.id === producto.id)
    if (existe) {
      setCarrito(carrito.map(item => 
        item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
      ))
    } else {
      setCarrito([...carrito, { ...producto, nombreVisual: nombreProd, precioUnitario: precioProd, cantidad: 1 }])
    }
    setBusqueda('')
    setMostrarDropdown(false)
  }

  const cambiarCantidad = (id, delta) => {
    setCarrito(carrito.map(item => {
      if (item.id === id) {
        const nuevaCantidad = item.cantidad + delta
        return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null
      }
      return item
    }).filter(Boolean))
  }

  const eliminarDelCarrito = (id) => {
    setCarrito(carrito.filter(item => item.id !== id))
  }

  const calcularTotal = () => {
    return carrito.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0)
  }

  const procesarVenta = async () => {
    if (carrito.length === 0) {
      alert('El carrito está vacío')
      return
    }

    setLoading(true)
    const totalVenta = calcularTotal()

    // Guardar la venta en Supabase (asegúrate de tener la tabla 'ventas' o ajústala según tu esquema)
    const { error } = await supabase.from('ventas').insert([{
      cliente: cliente || 'Consumidor Final',
      total: totalVenta,
      metodo_pago: metodoPago,
      items: carrito,
      fecha: new Date().toISOString()
    }])

    if (error) {
      alert('Error al registrar la venta: ' + error.message)
    } else {
      alert('¡Venta registrada con éxito!')
      setCarrito([])
      setCliente('')
      setMetodoPago('Efectivo')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '24px', background: '#0f1117', minHeight: '100vh', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#fff' }}>Caja / POS</h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: '4px 0 0 0' }}>Punto de venta y facturación rápida</p>
        </div>
      </div>

      {/* Grid Principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        
        {/* Columna Izquierda: Buscador y Listado de Ítems */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Tarjeta de Búsqueda */}
          <div style={{ background: '#161922', border: '1px solid #222634', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Buscar Producto en Stock</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Escribe el nombre del producto..." 
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setMostrarDropdown(true)
                }}
                onFocus={() => setMostrarDropdown(true)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
              />
              {mostrarDropdown && productosFiltrados.length > 0 && (
                <ul style={{ 
                  position: 'absolute', top: '100%', left: 0, right: 0, 
                  background: '#161922', border: '1px solid #2a2f42', listStyle: 'none', 
                  padding: 0, margin: '6px 0 0 0', maxHeight: '220px', overflowY: 'auto', zIndex: 10, borderRadius: '10px',
                  boxShadow: '0 10px 20px -3px rgba(0,0,0,0.5)'
                }}>
                  {productosFiltrados.map((prod, idx) => {
                    const nombreProd = prod.nombre || prod.titulo || prod.descripcion || 'Producto'
                    const precioProd = prod.precio || prod.precio_venta || 0
                    return (
                      <li 
                        key={idx}
                        onClick={() => agregarAlCarrito(prod)}
                        style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #222634', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#222634'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '500' }}>{nombreProd}</span>
                        <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '600' }}>${precioProd}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Tarjeta de Detalle del Carrito (Tabla) */}
          <div style={{ background: '#161922', border: '1px solid #222634', borderRadius: '16px', overflow: 'hidden', flex: 1, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #222634', fontSize: '15px', fontWeight: '600', color: '#fff' }}>
              Productos en la Venta
            </div>
            {carrito.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                No hay productos agregados a la venta actual.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#1e2330', color: '#94a3b8', borderBottom: '1px solid #2a2f42' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Producto</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Precio U.</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'center' }}>Cantidad</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Subtotal</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #222634' }}>
                      <td style={{ padding: '14px 16px', color: '#fff', fontWeight: '500' }}>{item.nombreVisual}</td>
                      <td style={{ padding: '14px 16px', color: '#94a3b8' }}>${item.precioUnitario}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#0f1117', border: '1px solid #2a2f42', borderRadius: '6px', overflow: 'hidden' }}>
                          <button onClick={() => cambiarCantidad(item.id, -1)} style={{ padding: '4px 10px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}>-</button>
                          <span style={{ padding: '0 8px', fontSize: '13px', color: '#fff', fontWeight: '600' }}>{item.cantidad}</span>
                          <button onClick={() => cambiarCantidad(item.id, 1)} style={{ padding: '4px 10px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: '600' }}>${item.precioUnitario * item.cantidad}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button 
                          onClick={() => eliminarDelCarrito(item.id)}
                          style={{ padding: '6px 10px', background: 'rgba(220, 38, 38, 0.15)', color: '#f87171', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

        {/* Columna Derecha: Resumen de Cobro y Checkout */}
        <div style={{ background: '#161922', border: '1px solid #222634', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
          
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '20px', borderBottom: '1px solid #222634', paddingBottom: '12px' }}>
              Resumen de Cobro
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Cliente</label>
              <input 
                type="text" 
                placeholder="Nombre del cliente (opcional)" 
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Método de Pago</label>
              <select 
                value={metodoPago} 
                onChange={(e) => setMetodoPago(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2a2f42', background: '#0f1117', color: '#fff', fontSize: '14px', outline: 'none' }}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta (POS)</option>
                <option value="Cuenta Corriente">Cuenta Corriente</option>
              </select>
            </div>
          </div>

          <div>
            <div style={{ background: '#0f1117', border: '1px solid #2a2f42', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                <span>Subtotal</span>
                <span>${calcularTotal()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #222634', color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                <span>Total a Pagar</span>
                <span style={{ color: '#38bdf8' }}>${calcularTotal()}</span>
              </div>
            </div>

            <button 
              onClick={procesarVenta}
              disabled={loading || carrito.length === 0}
              style={{ 
                width: '100%', 
                padding: '14px', 
                background: carrito.length === 0 ? '#1e2330' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
                color: carrito.length === 0 ? '#64748b' : '#fff', 
                border: 'none', 
                borderRadius: '10px', 
                cursor: carrito.length === 0 ? 'not-allowed' : 'pointer', 
                fontWeight: '600',
                fontSize: '15px',
                boxShadow: carrito.length === 0 ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.4)'
              }}
            >
              {loading ? 'Procesando...' : '💳 Cobrar y Finalizar Venta'}
            </button>
          </div>

        </div>

      </div>

    </div>
  )
}