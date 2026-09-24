import { useState, useEffect } from 'react';
import { useNegocio } from '@/context/NegocioContext';

export function useLocalStorageNegocio<T>(key: string, valorInicial: T): [T, (valor: T | ((val: T) => T)) => void] {
  const { negocioActual } = useNegocio();

  // Si hay un negocio activo, creamos una llave única (ej: "productos_1718293849")
  const storageKey = negocioActual ? `${key}_${negocioActual.id}` : `${key}_default`;

  const obtenerValor = (): T => {
    if (typeof window === 'undefined') return valorInicial;
    try {
      const item = window.localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : valorInicial;
    } catch (error) {
      console.error(`Error al leer ${storageKey}:`, error);
      return valorInicial;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(obtenerValor);

  useEffect(() => {
    setStoredValue(obtenerValor());
  }, [negocioActual?.id]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error al guardar ${storageKey}:`, error);
    }
  };

  return [storedValue, setValue];
}