'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const [esRecuperacion, setEsRecuperacion] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Escuchamos si Supabase detecta que el usuario entró por un enlace de recuperación
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setEsRecuperacion(true)
      }
    })

    // Como reaseguro por si el evento ya pasó antes de registrar el listener
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      setEsRecuperacion(true)
    }

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMensajeExito('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    // Actualizamos la contraseña del usuario actualmente autenticado por el link
    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    setLoading(false)

    if (error) {
      setError(error.message || 'No se pudo actualizar la contraseña.')
    } else {
      setMensajeExito('¡Contraseña actualizada con éxito! Redirigiendo al sistema...')
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-[#262626] rounded-2xl shadow-2xl p-8 text-white">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-amber-500 mb-2">
            ⚡ TONEXOR
          </h1>
          <p className="text-gray-400 text-sm">
            Establecé tu nueva contraseña.
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 text-black shadow-inner">
          <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">Cambiar Contraseña</h2>

          {error && (
            <div className="mb-4 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              {error}
            </div>
          )}

          {mensajeExito && (
            <div className="mb-4 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5">
              {mensajeExito}
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nueva contraseña:</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmar nueva contraseña:</label>
              <input
                type="password"
                placeholder="Repetir contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg font-medium transition-colors shadow-md disabled:opacity-50 mt-2"
            >
              {loading ? 'Actualizando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}