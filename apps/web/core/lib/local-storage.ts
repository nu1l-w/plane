/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const storage = {
  set: (key: string, value: object | string | boolean): void => {
    if (typeof window === "undefined" || !key) return;
    try {
      const serializedValue = typeof value === "string" ? value : JSON.stringify(value);
      window.localStorage.setItem(key, serializedValue);
    } catch {
      // Preferences must remain optional when storage is blocked or full.
    }
  },

  get: (key: string): string | undefined => {
    if (typeof window === "undefined") return undefined;
    try {
      return window.localStorage.getItem(key) ?? undefined;
    } catch {
      return undefined;
    }
  },

  remove: (key: string): void => {
    if (typeof window === "undefined" || !key) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // A blocked storage backend must not interrupt the caller.
    }
  },
};
