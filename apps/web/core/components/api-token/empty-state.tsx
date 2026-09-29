/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ui
import { Button } from "@plane/propel/button";
// assets
import emptyApiTokens from "@/app/assets/empty-state/api-token.svg?url";

type Props = {
  onClick: () => void;
};

export function ApiTokenEmptyState(props: Props) {
  const { onClick } = props;

  return (
    <div
      className={`mx-auto flex w-full items-center justify-center rounded-xs border border-subtle bg-surface-2 px-16 py-10 lg:w-3/4`}
    >
      <div className="flex w-full flex-col items-center text-center">
        <img src={emptyApiTokens} className="w-52 object-contain sm:w-60" alt="" aria-hidden="true" />
        <h6 className="mt-6 mb-3 text-18 font-semibold sm:mt-8">暂无 API Token</h6>
        <p className="mb-7 text-tertiary sm:mb-8">创建 API Token，在保持访问可控和安全的前提下与外部应用交换数据。</p>
        <Button className="flex items-center gap-1.5" onClick={onClick}>
          添加 Token
        </Button>
      </div>
    </div>
  );
}
