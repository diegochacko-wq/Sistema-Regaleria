'use client';

import { useState, useEffect } from 'react';
import { useNegocio } from '@/context/NegocioContext';
import { supabase } from '@/lib/supabase';

export default function SelectorNegocio() {
  const { negocioActual, loginNegocio, crearNegocio, logoutNegocio, loading } = useNegocio();

  const [modo, setModo] = useState<'login' | 'registro' | 'recuperar'>('login');
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [procesando, setProcesando] = useState(false);

  // Estados especiales para cuando viene del link del correo de recuperación
  const [esRecuperacionActiva, setEsRecuperacionActiva] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmaNuevaPassword, setConfirmaNuevaPassword] = useState('');

  // Estados del formulario de login
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');

  // Estados del formulario de registro
  const [nombrePersonal, setNombrePersonal] = useState('');
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [emailRegistro, setEmailRegistro] = useState('');
  const [passwordRegistro, setPasswordRegistro] = useState('');

  // Estado para recuperar contraseña
  const [emailRecuperacion, setEmailRecuperacion] = useState('');

  useEffect(() => {
    const checkRecovery = async () => {
      const hash = window.location.hash;
      if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
        setEsRecuperacionActiva(true);
      }
    };
    checkRecovery();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setEsRecuperacionActiva(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading && !esRecuperacionActiva) {
    return <div className="text-sm text-gray-400 text-center p-6">Cargando datos...</div>;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');
    setProcesando(true);
    const resultado = await loginNegocio(emailLogin, passwordLogin);
    setProcesando(false);
    if (!resultado.ok) setError(resultado.mensaje || 'No se pudo iniciar sesión.');
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombrePersonal.trim() || !nombreNegocio.trim() || !emailRegistro.trim() || !passwordRegistro.trim()) return;

    setError('');
    setMensajeExito('');
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

  const handleRecuperarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecuperacion.trim()) return;

    setError('');
    setMensajeExito('');
    setProcesando(true);

    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperacion, {
      redirectTo: `${window.location.origin}/`,
    });

    setProcesando(false);

    if (error) {
      setError(error.message || 'No se pudo enviar el correo de recuperación.');
    } else {
      setMensajeExito('¡Listo! Te enviamos un enlace de recuperación a tu correo.');
    }
  };

  const handleGuardarNuevaPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');

    if (nuevaPassword !== confirmaNuevaPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (nuevaPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setProcesando(true);
    const { error } = await supabase.auth.updateUser({
      password: nuevaPassword,
    });
    setProcesando(false);

    if (error) {
      setError(error.message || 'No se pudo actualizar la contraseña.');
    } else {
      setMensajeExito('¡Contraseña actualizada con éxito! Ya podés iniciar sesión.');
      setTimeout(() => {
        setEsRecuperacionActiva(false);
        window.location.href = '/';
      }, 2000);
    }
  };

  // PANTALLA DE RECUPERACIÓN DE CONTRASEÑA
  if (esRecuperacionActiva) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#161922] border border-[#222634] rounded-2xl shadow-2xl p-6 sm:p-8 text-white">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black tracking-tight text-amber-500 mb-1 flex items-center justify-center gap-2">
              <span>⚡</span> TONEXOR
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm">Establecé tu nueva contraseña de acceso.</p>
          </div>

          {error && (
            <div className="mb-4 text-xs font-medium text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl p-3">
              {error}
            </div>
          )}

          {mensajeExito && (
            <div className="mb-4 text-xs font-medium text-green-400 bg-green-950/40 border border-green-900/50 rounded-xl p-3">
              {mensajeExito}
            </div>
          )}

          <form onSubmit={handleGuardarNuevaPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Nueva contraseña:</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Confirmar contraseña:</label>
              <input
                type="password"
                placeholder="Repetir contraseña"
                value={confirmaNuevaPassword}
                onChange={(e) => setConfirmaNuevaPassword(e.target.value)}
                className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={procesando}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold p-3 rounded-xl transition-all shadow-lg disabled:opacity-50 mt-2"
            >
              {procesando ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA PRINCIPAL DE LOGIN / REGISTRO
  if (!negocioActual) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#161922] border border-[#222634] rounded-2xl shadow-2xl p-6 sm:p-8 text-white">

          <div className="text-center mb-6">
            <h1 className="text-2xl font-black tracking-tight text-amber-500 mb-1 flex items-center justify-center gap-2">
              <span>⚡</span> TONEXOR
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm">
              Iniciá sesión o registrá tu negocio para acceder al sistema.
            </p>
          </div>

          {/* Selector de Pestañas (Tabs) Estilo Píldora */}
          <div className="flex bg-[#0f1117] p-1 rounded-xl mb-6 border border-[#2a2f42]">
            <button
              type="button"
              onClick={() => { setModo('login'); setError(''); setMensajeExito(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold text-center rounded-lg transition-all ${
                modo === 'login'
                  ? 'bg-[#1e2330] text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setModo('registro'); setError(''); setMensajeExito(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold text-center rounded-lg transition-all ${
                modo === 'registro'
                  ? 'bg-[#1e2330] text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Registrarse
            </button>
          </div>

          {error && (
            <div className="mb-4 text-xs font-medium text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl p-3">
              {error}
            </div>
          )}

          {mensajeExito && (
            <div className="mb-4 text-xs font-medium text-green-400 bg-green-950/40 border border-green-900/50 rounded-xl p-3">
              {mensajeExito}
            </div>
          )}

          {/* VISTA DE LOGIN */}
          {modo === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white">¡Bienvenido de vuelta!</h2>
                <p className="text-gray-400 text-xs">Ingresá tu email y tu contraseña.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email:</label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={emailLogin}
                  onChange={(e) => setEmailLogin(e.target.value)}
                  className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Contraseña:</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordLogin}
                  onChange={(e) => setPasswordLogin(e.target.value)}
                  className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="flex items-center justify-end text-xs pt-1">
                <button
                  type="button"
                  onClick={() => { setModo('recuperar'); setError(''); setMensajeExito(''); }}
                  className="text-amber-400 hover:underline font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={procesando}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold p-3 rounded-xl transition-all shadow-lg mt-2 disabled:opacity-50"
              >
                {procesando ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>
          )}

          {/* VISTA DE REGISTRO */}
          {modo === 'registro' && (
            <form onSubmit={handleRegistro} className="space-y-3.5">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white">Creá tu cuenta</h2>
                <p className="text-gray-400 text-xs">Configurá tus credenciales y datos comerciales.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Tu Nombre y Apellido:</label>
                <input
                  type="text"
                  placeholder="Ej: Diego Gomez"
                  value={nombrePersonal}
                  onChange={(e) => setNombrePersonal(e.target.value)}
                  className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nombre del Negocio:</label>
                <input
                  type="text"
                  placeholder="Ej: El Rincon de Renzi"
                  value={nombreNegocio}
                  onChange={(e) => setNombreNegocio(e.target.value)}
                  className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Email:</label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={emailRegistro}
                  onChange={(e) => setEmailRegistro(e.target.value)}
                  className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Contraseña:</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={passwordRegistro}
                  onChange={(e) => setPasswordRegistro(e.target.value)}
                  className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={procesando}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold p-3 rounded-xl transition-all shadow-lg disabled:opacity-50 mt-2"
              >
                {procesando ? 'Registrando...' : 'Registrar Negocio'}
              </button>
            </form>
          )}

          {/* VISTA DE RECUPERAR CONTRASEÑA */}
          {modo === 'recuperar' && (
            <form onSubmit={handleRecuperarPassword} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white">Recuperar Contraseña</h2>
                <p className="text-gray-400 text-xs">Te enviaremos un enlace para restablecer tu clave.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email registrado:</label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={emailRecuperacion}
                  onChange={(e) => setEmailRecuperacion(e.target.value)}
                  className="w-full p-3 border border-[#2a2f42] rounded-xl text-sm bg-[#0f1117] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={procesando}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold p-3 rounded-xl transition-all shadow-lg disabled:opacity-50"
              >
                {procesando ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setModo('login'); setError(''); setMensajeExito(''); }}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  ← Volver a Iniciar Sesión
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    );
  }

  // Barra superior cuando ya se inició sesión con éxito dentro de la app
  return (
    <div className="flex items-center justify-between bg-[#161922] border border-[#222634] text-white p-3 rounded-2xl shadow-sm gap-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-xs text-gray-400">Admin: <span className="font-medium text-gray-200">{negocioActual.nombre_personal}</span></div>
          <div className="text-sm font-bold text-amber-500">TONEXOR - {negocioActual.nombre_negocio}</div>
        </div>
      </div>

      <button
        onClick={logoutNegocio}
        className="text-xs bg-red-950/50 text-red-400 border border-red-900/40 hover:bg-red-900/50 font-medium px-3 py-2 rounded-xl transition-colors"
      >
        Cerrar Sesión
      </button>
    </div>
  );
}