'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminUsuariosView() {
  const [negocios, setNegocios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [esAdmin, EsAdmin] = useState(false)
  const [emailLogueado, setEmailLogueado] = useState<string | null>(null)

  useEffect(() => {
    verificarYcargar()
  }, [])

  const verificarYcargar = async () => {
    setCargando(true)
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email || null
    setEmailLogueado(email)

    if (email === 'diegochacko@gmail.com') {
      EsAdmin(true)
      await cargarNegocios()
    } else {
      EsAdmin(false)
    }
    setCargando(false)
  }

  const cargarNegocios = async () => {
    try {
      const { data, error } = await supabase
        .from('negocios')
        .select('*')

      if (error) {
        console.warn('No se pudo leer la tabla negocios:', error.message)
        setNegocios([])
      } else {
        setNegocios(data || [])
      }
    } catch (err) {
      console.error('Error cargando negocios:', err)
    }
  }

  const darDeBajaNegocio = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar/dar de baja el negocio "${nombre}"?`)) return

    try {
      const { error } = await supabase.rpc('eliminar_negocio_completo', {
        negocio_id_input: id
      })

      if (error) throw error

      alert('Negocio dado de baja correctamente.')
      await cargarNegocios()
    } catch (err: any) {
      alert(`Error al dar de baja: ${err.message}`)
    }
  }

  if (cargando) {
    return <div className="p-8 text-center text-neutral-400">Verificando permisos de acceso…</div>
  }

  if (!esAdmin) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 text-center max-w-lg mx-auto my-12 space-y-3">
        <div className="text-3xl">🚫</div>
        <h2 className="text-xl font-black text-rose-400">Acceso Denegado</h2>
        <p className="text-sm text-neutral-300">
          No tenés permisos de administrador para ver este panel. Tu usuario actual es: <span className="font-bold text-white">{emailLogueado || 'Anónimo'}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30">
        <h2 className="text-2xl font-black text-white">🛠️ Panel de Administración</h2>
        <p className="text-purple-200/80 text-sm mt-1">Gestión exclusiva para diegochacko@gmail.com</p>
      </div>

      <div className="bg-neutral-900/60 backdrop-blur-xl rounded-3xl border border-white/10 p-6 overflow-hidden shadow-2xl">
        <h3 className="text-lg font-black text-white mb-4">Lista de Negocios Registrados</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-neutral-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3">Nombre del Negocio</th>
                <th className="p-3">Responsable</th>
                <th className="p-3">ID de Negocio (UUID)</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {negocios.map((n) => (
                <tr key={n.id} className="hover:bg-white/5 transition">
                  <td className="p-3 font-bold text-white">{n.nombre_negocio || 'Sin nombre'}</td>
                  <td className="p-3 text-neutral-300">{n.nombre_personal || 'N/A'}</td>
                  <td className="p-3 font-mono text-xs text-neutral-400">{n.id}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => darDeBajaNegocio(n.id, n.nombre_negocio)}
                      className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs px-3 py-1.5 rounded-xl border border-rose-500/30 font-bold transition cursor-pointer"
                    >
                      🗑️ Dar de baja
                    </button>
                  </td>
                </tr>
              ))}
              {negocios.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-neutral-500">
                    No se encontraron registros en la tabla de negocios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}