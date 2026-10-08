/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export function MaintenanceMessage() {
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <h1 className="text-left text-18 font-semibold text-primary">系统启动异常</h1>
        <span className="text-left text-14 font-medium text-secondary">{`
          部分服务可能未能正常启动，请检查容器日志并联系本平台管理员。
        `}</span>
      </div>
    </>
  );
}
