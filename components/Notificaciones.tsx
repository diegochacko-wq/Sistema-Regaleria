'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type Toast = {
  id: number
  tipo: 'exito' | 'error' | 'aviso' | 'info'
  titulo?: string
  mensaje: string
}

type OpcionesConfirm = {
  titulo?: string
  textoConfirmar?: string
  textoCancelar?: string
  peligro?: boolean
}

const Ctx = createContext<any>(null)

// Hook para usar en cualquier vista: const { notificar, confirmar } = useNotificaciones()
export const useNotificaciones = () => useContext(Ctx)

const ESTILOS: Record<string, { borde: string, fondo: string, icono: string, colorTitulo: string }> = {
  exito: { borde: 'border-emerald-500/40', fondo: 'from-emerald-500/15', icono: '✓', colorTitulo: 'text-emerald-400' },
  error: { borde: 'border-rose-500/40', fondo: 'from-rose-500/15', icono: '✕', colorTitulo: 'text-rose-400' },
  aviso: { borde: 'border-amber-500/40', fondo: 'from-amber-500/15', icono: '⚠', colorTitulo: 'text-amber-400' },
  info: { borde: 'border-sky-500/40', fondo: 'from-sky-500/15', icono: 'ℹ', colorTitulo: 'text-sky-400' },
}

export default function ProveedorNotificaciones({ children }: { children: any }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmacion, setConfirmacion] = useState<any>(null)

  const cerrarToast = (id: number) => setToasts((t: Toast[]) => t.filter((x) => x.id !== id))

  const notificar = useCallback((tipo: Toast['tipo'], mensaje: string, titulo?: string) => {
    const id = Date.now() + Math.random()
    setToasts((t: Toast[]) => [...t, { id, tipo, mensaje, titulo }])
    // Los errores quedan más tiempo visibles
    setTimeout(() => cerrarToast(id), tipo === 'error' ? 7000 : 4500)
  }, [])

  const confirmar = useCallback((mensaje: string, opciones?: OpcionesConfirm) => {
    return new Promise<boolean>((resolve) => {
      setConfirmacion({ mensaje, ...opciones, resolver: resolve })
    })
  }, [])

  const responder = (valor: boolean) => {
    confirmacion?.resolver(valor)
    setConfirmacion(null)
  }

  return (
    <Ctx.Provider value={{ notificar, confirmar }}>
      {children}

      {/* ===== TOASTS ===== */}
      <div className="fixed top-5 right-5 z-[10000] flex flex-col gap-3 w-[min(92vw,380px)] pointer-events-none">
        {toasts.map((t) => {
          const e = ESTILOS[t.tipo] || ESTILOS.info
          return (
            <div
              key={t.id}
              className={`pointer-events-auto animate-[toastIn_.25s_ease-out] rounded-2xl border ${e.borde} bg-gradient-to-br ${e.fondo} to-neutral-900/90 backdrop-blur-xl p-4 shadow-2xl shadow-black/50 flex gap-3 items-start`}
            >
              <div className={`shrink-0 w-8 h-8 rounded-full bg-neutral-800/80 border ${e.borde} flex items-center justify-center text-sm font-black ${e.colorTitulo}`}>
                {e.icono}
              </div>
              <div className="flex-1 min-w-0">
                {t.titulo && <p className={`text-sm font-bold ${e.colorTitulo}`}>{t.titulo}</p>}
                <p className="text-sm text-neutral-200 break-words">{t.mensaje}</p>
              </div>
              <button
                onClick={() => cerrarToast(t.id)}
                className="text-neutral-500 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* ===== MODAL DE CONFIRMACIÓN ===== */}
      {confirmacion && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-950 p-7 shadow-2xl shadow-black/60 animate-[toastIn_.2s_ease-out]">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 border ${confirmacion.peligro ? 'border-rose-500/40 bg-rose-500/10' : 'border-sky-500/40 bg-sky-500/10'}`}>
              {confirmacion.peligro ? '🗑' : '❓'}
            </div>
            <h3 className="text-lg font-black text-white mb-2">
              {confirmacion.titulo || 'Confirmar acción'}
            </h3>
            <p className="text-sm text-neutral-300 mb-6">{confirmacion.mensaje}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => responder(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-neutral-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                {confirmacion.textoCancelar || 'Cancelar'}
              </button>
              <button
                onClick={() => responder(true)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
                  confirmacion.peligro
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500'
                }`}
              >
                {confirmacion.textoConfirmar || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animación de entrada */}
      <style jsx global>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </Ctx.Provider>
  )
}
