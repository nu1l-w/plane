/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EAuthModes } from "@plane/constants";

interface TermsAndConditionsProps {
  authType?: EAuthModes;
}

const MESSAGES = {
  [EAuthModes.SIGN_UP]: "创建账号即表示你同意遵守星轴科技内部系统使用规范。",
  [EAuthModes.SIGN_IN]: "登录即表示你同意遵守星轴科技内部系统使用规范。",
} as const;

export function TermsAndConditions({ authType = EAuthModes.SIGN_IN }: TermsAndConditionsProps) {
  return (
    <div className="flex items-center justify-center">
      <p className="text-center text-13 whitespace-pre-line text-tertiary">{MESSAGES[authType]}</p>
    </div>
  );
}
