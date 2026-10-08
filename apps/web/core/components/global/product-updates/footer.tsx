/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BRAND_NAME } from "@plane/constants";

export function ProductUpdatesFooter() {
  return (
    <div className="m-6 mb-4 flex flex-shrink-0 items-center justify-between gap-4">
      <span className="text-13 text-secondary">{`${BRAND_NAME}研发管理平台`}</span>
      <span className="text-13 text-secondary">内部使用</span>
    </div>
  );
}
