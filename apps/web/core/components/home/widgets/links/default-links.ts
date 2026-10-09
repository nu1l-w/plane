/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const DEFAULT_QUICK_LINKS = [
  { title: "iKF Hub（内测）", url: "https://3d98e00e76138d28ad.ikeepfun.com" },
  { title: "iKF Hub", url: "https://hub.ikeepfun.com" },
  { title: "KNA HUB", url: "https://hub.kna-audio.com" },
] as const;

const normalizedLinkUrl = (url: string): string => {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return `${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
};

export const getVisibleDefaultQuickLinks = (userLinks: { url: string }[]) => {
  const userUrls = new Set(userLinks.map((link) => normalizedLinkUrl(link.url)));
  return DEFAULT_QUICK_LINKS.filter((link) => !userUrls.has(normalizedLinkUrl(link.url)));
};
