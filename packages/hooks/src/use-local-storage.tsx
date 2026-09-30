/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect, useCallback } from "react";

export const getValueFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (_error) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage itself may be inaccessible, not just contain invalid JSON.
    }
    return defaultValue;
  }
};

export const setValueIntoLocalStorage = (key: string, value: unknown) => {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_error) {
    return false;
  }
};

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T | null>(() => getValueFromLocalStorage(key, initialValue));

  const setValue = useCallback(
    (value: T) => {
      const persisted = setValueIntoLocalStorage(key, value);
      setStoredValue(value);
      if (persisted) window.dispatchEvent(new Event(`local-storage:${key}`));
    },
    [key]
  );

  const clearValue = useCallback(() => {
    setStoredValue(null);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
      window.dispatchEvent(new Event(`local-storage:${key}`));
    } catch {
      // Keep the in-memory value usable when browser storage is unavailable.
    }
  }, [key]);

  const reHydrate = useCallback(() => {
    const data = getValueFromLocalStorage(key, initialValue);
    setStoredValue(data);
  }, [key, initialValue]);

  useEffect(() => {
    window.addEventListener(`local-storage:${key}`, reHydrate);
    return () => {
      window.removeEventListener(`local-storage:${key}`, reHydrate);
    };
  }, [key, reHydrate]);

  return { storedValue, setValue, clearValue } as const;
};
