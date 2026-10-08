/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** User-visible product name. Keep package names, URLs and API identifiers unchanged. */
export const BRAND_NAME = "联序 & 星轴";

/** Apply branding to translated text without changing translation keys or links. */
export function brandText(text: string): string {
  return text.replace(/https?:\/\/[^\s<>"']+|星轴科技|星轴|(?<![\w@/-])plane(?![\w./-])/gi, (match) =>
    /^https?:\/\//.test(match) ? match : BRAND_NAME
  );
}

export function brandTranslations<T>(value: T): T {
  if (typeof value === "string") return brandText(value) as T;
  if (Array.isArray(value)) return value.map(brandTranslations) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, brandTranslations(entry)])) as T;
  }
  return value;
}
