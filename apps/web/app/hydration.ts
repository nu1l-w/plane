/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type TDetachedDocumentElement = {
  element: Element;
  nextSibling: Element | null;
};

let detachedDocumentElements: TDetachedDocumentElement[] = [];

/**
 * React Router hydrates the complete document. Browser extensions and embedded
 * browser shells can insert their own elements directly under <html> before
 * hydration starts, which makes React discard the server-rendered document.
 * Temporarily detach those unmanaged elements and restore them after the first
 * client commit.
 */
export function detachUnexpectedDocumentElements(): void {
  const documentElement = document.documentElement;

  detachedDocumentElements = Array.from(documentElement.children)
    .filter((element) => element !== document.head && element !== document.body)
    .map((element) => ({ element, nextSibling: element.nextElementSibling }));

  detachedDocumentElements.forEach(({ element }) => element.remove());
}

export function restoreUnexpectedDocumentElements(): void {
  const documentElement = document.documentElement;

  [...detachedDocumentElements].toReversed().forEach(({ element, nextSibling }) => {
    if (element.isConnected) return;

    const insertionPoint = nextSibling?.parentElement === documentElement ? nextSibling : null;
    documentElement.insertBefore(element, insertionPoint);
  });

  detachedDocumentElements = [];
}
