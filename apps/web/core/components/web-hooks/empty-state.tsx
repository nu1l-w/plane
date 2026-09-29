/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ui
import { Button } from "@plane/propel/button";
// assets
import EmptyWebhook from "@/app/assets/empty-state/web-hook.svg?url";

type Props = {
  onClick: () => void;
};

export function WebhooksEmptyState(props: Props) {
  const { onClick } = props;
  return (
    <div
      className={`mx-auto flex w-full items-center justify-center rounded-xs border border-subtle bg-surface-2 px-16 py-10 lg:w-3/4`}
    >
      <div className="flex w-full flex-col items-center text-center">
        <img src={EmptyWebhook} className="w-52 object-cover sm:w-60" alt="暂无 Webhook" />
        <h6 className="mt-6 mb-3 text-18 font-semibold sm:mt-8">暂无 Webhook</h6>
        <p className="mb-7 text-tertiary sm:mb-8">创建 Webhook 以接收实时更新并自动执行操作</p>
        <Button className="flex items-center gap-1.5" onClick={onClick}>
          添加 Webhook
        </Button>
      </div>
    </div>
  );
}
