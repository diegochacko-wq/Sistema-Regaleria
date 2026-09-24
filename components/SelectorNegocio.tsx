'use client';

import { useState } from 'react';
import { useNegocio } from '@/context/NegocioContext';

export default function SelectorNegocio() {
  const { negocioActual, loginNegocio, crearNegocio, logoutNegocio, loading } = useNegocio();

  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  // Estados del formulario de login
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');

  // Estados del formulario de registro
  const [nombrePersonal, setNombrePersonal] = useState('');
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [emailRegistro, setEmailRegistro] = useState('');
  const [passwordRegistro, setPasswordRegistro] = useState('');

  if (loading) {
    return <div className="text-sm text-gray-400 text-center p-6">Cargando datos...</div>;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcesando(true);
    const resultado = await loginNegocio(emailLogin, passwordLogin);
    setProcesando(false);
    if (!resultado.ok) setError(resultado.mensaje || 'No se pudo iniciar sesión.');
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombrePersonal.trim() || !nombreNegocio.trim() || !emailRegistro.trim() || !passwordRegistro.trim()) return;

    setError('');
    setProcesando(true);
    const resultado = await crearNegocio({
      email: emailRegistro,
      password: passwordRegistro,
      nombrePersonal,
      nombreNegocio,
    });
    setProcesando(false);

    if (!resultado.ok) {
      setError(resultado.mensaje || 'No se pudo completar el registro.');
    }
  };

  if (!negocioActual) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#1a1a1a] border border-[#262626] rounded-2xl shadow-2xl p-8 text-white">

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-amber-500 mb-2 flex items-center justify-center gap-2">
              <span>⚡</span> TONEXOR
            </h1>
            <p className="text-gray-400 text-sm">
              Iniciá sesión o registrá tu negocio para acceder al sistema.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 text-black shadow-inner">
            <div className="flex border-b mb-6">
              <button
                type="button"
                onClick={() => { setModo('login'); setError(''); }}
                className={`flex-1 pb-2 text-sm font-semibold text-center transition-colors ${modo === 'login' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => { setModo('registro'); setError(''); }}
                className={`flex-1 pb-2 text-sm font-semibold text-center transition-colors ${modo === 'registro' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Registrar Nuevo Negocio
              </button>
            </div>

            {error && (
              <div className="mb-4 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                {error}
              </div>
            )}

            {/* VISTA DE LOGIN */}
            {modo === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-gray-800">Iniciar Sesión</h2>
                  <p className="text-gray-500 text-xs">Ingresá tu email y tu contraseña.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email:</label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña:</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordLogin}
                    onChange={(e) => setPasswordLogin(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={procesando}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg font-medium transition-colors shadow-md mt-2 disabled:opacity-50"
                >
                  {procesando ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>
            ) : (
              /* VISTA DE REGISTRO */
              <form onSubmit={handleRegistro} className="space-y-3">
                <div className="text-center mb-3">
                  <h2 className="text-lg font-bold text-gray-800">Registro de Nuevo Negocio</h2>
                  <p className="text-gray-500 text-xs">Creá tus credenciales de acceso y datos comerciales.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tu Nombre y Apellido:</label>
                  <input
                    type="text"
                    placeholder="Ej: Diego Gomez"
                    value={nombrePersonal}
                    onChange={(e) => setNombrePersonal(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del Negocio:</label>
                  <input
                    type="text"
                    placeholder="Ej: El Rincon de Renzi"
                    value={nombreNegocio}
                    onChange={(e) => setNombreNegocio(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email:</label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={emailRegistro}
                    onChange={(e) => setEmailRegistro(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña:</label>
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={passwordRegistro}
                    onChange={(e) => setPasswordRegistro(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={procesando}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg font-medium transition-colors shadow-md disabled:opacity-50 mt-2"
                >
                  {procesando ? 'Registrando...' : 'Registrar y Acceder'}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    );
  }

  // Barra superior cuando ya se inició sesión con éxito dentro de la app
  return (
    <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#262626] text-white p-3 rounded-xl shadow-sm gap-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-xs text-gray-400">Admin: <span className="font-medium text-gray-200">{negocioActual.nombre_personal}</span></div>
          <div className="text-sm font-bold text-amber-400">TONEXOR - {negocioActual.nombre_negocio}</div>
        </div>
      </div>

      <button
        onClick={logoutNegocio}
        className="text-xs bg-red-950/60 text-red-400 border border-red-900/50 hover:bg-red-900/50 font-medium px-3 py-1.5 rounded-md transition-colors"
      >
        Cerrar Sesión / Bloquear
      </button>
    </div>
  );
}
