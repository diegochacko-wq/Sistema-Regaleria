'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Negocio {
  id: string;
  user_id: string;
  nombre_personal: string;
  nombre_negocio: string;
  logo: string | null;
}

interface NegocioContextType {
  negocioActual: Negocio | null;
  usuario: User | null;
  setNegocioActual: (negocio: Negocio | null) => void;
  crearNegocio: (datos: { email: string; password: string; nombrePersonal: string; nombreNegocio: string }) => Promise<{ ok: boolean; mensaje?: string }>;
  loginNegocio: (email: string, password: string) => Promise<{ ok: boolean; mensaje?: string }>;
  logoutNegocio: () => Promise<void>;
  loading: boolean;
}

const NegocioContext = createContext<NegocioContextType | undefined>(undefined);

export function NegocioProvider({ children }: { children: React.ReactNode }) {
  const [negocioActual, setNegocioActual] = useState<Negocio | null>(null);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Trae la fila de "negocios" asociada al usuario logueado.
  // Devuelve true/false según si encontró un negocio, para que quien la llama pueda avisar al usuario.
  const cargarNegocioDelUsuario = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('negocios')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error al cargar el negocio del usuario:', error.message);
      await supabase.auth.signOut();
      setUsuario(null);
      setNegocioActual(null);
      return false;
    }

    if (!data) {
      // Sesión válida pero sin negocio asociado: no es un estado utilizable, cerramos sesión.
      await supabase.auth.signOut();
      setUsuario(null);
      setNegocioActual(null);
      return false;
    }

    setNegocioActual(data);
    return true;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUsuario(session.user);
        await cargarNegocioDelUsuario(session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUsuario(session.user);
        await cargarNegocioDelUsuario(session.user.id);
      } else {
        setUsuario(null);
        setNegocioActual(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const crearNegocio = async (datos: {
    email: string;
    password: string;
    nombrePersonal: string;
    nombreNegocio: string;
  }): Promise<{ ok: boolean; mensaje?: string }> => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: datos.email,
      password: datos.password,
    });

    if (authError) {
      return { ok: false, mensaje: authError.message };
    }
    if (!authData.user) {
      return { ok: false, mensaje: 'No se pudo crear el usuario. Intentá de nuevo.' };
    }

    if (!authData.session) {
      return {
        ok: false,
        mensaje: 'Te enviamos un email de confirmación. Confirmá tu cuenta y después iniciá sesión.',
      };
    }

    const { data: negocioCreado, error: negocioError } = await supabase
      .from('negocios')
      .insert([{
        user_id: authData.user.id,
        nombre_negocio: datos.nombreNegocio.trim(),
        nombre_personal: datos.nombrePersonal.trim(),
      }])
      .select()
      .single();

    if (negocioError) {
      return { ok: false, mensaje: 'Error al crear el negocio: ' + negocioError.message };
    }

    setUsuario(authData.user);
    setNegocioActual(negocioCreado);
    return { ok: true };
  };

  const loginNegocio = async (email: string, password: string): Promise<{ ok: boolean; mensaje?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { ok: false, mensaje: 'Email o contraseña incorrectos.' };
    }
    if (!data.user) {
      return { ok: false, mensaje: 'No se pudo iniciar sesión. Intentá de nuevo.' };
    }

    setUsuario(data.user);
    const encontroNegocio = await cargarNegocioDelUsuario(data.user.id);

    if (!encontroNegocio) {
      return {
        ok: false,
        mensaje: 'Tu cuenta existe pero no tiene un negocio asociado. Probá registrarte de nuevo.',
      };
    }

    return { ok: true };
  };

  const logoutNegocio = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setNegocioActual(null);
  };

  return (
    <NegocioContext.Provider
      value={{ negocioActual, usuario, setNegocioActual, crearNegocio, loginNegocio, logoutNegocio, loading }}
    >
      {children}
    </NegocioContext.Provider>
  );
}

export function useNegocio() {
  const context = useContext(NegocioContext);
  if (!context) {
    throw new Error('useNegocio debe usarse dentro de un NegocioProvider');
  }
  return context;
}
