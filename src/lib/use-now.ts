"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

// Redondeado al segundo: el snapshot es estable entre llamadas dentro del mismo tick
const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const getServerSnapshot = () => null;

/**
 * Hora actual que se actualiza cada segundo. Devuelve `null` en el servidor y durante
 * la hidratación, así el HTML del servidor y el primer render del cliente coinciden.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noop = () => () => {};

/**
 * `false` en el servidor y durante la hidratación, `true` después. Para contenido que depende
 * de la zona horaria del navegador (el servidor corre en UTC): se renderiza solo en el cliente.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
