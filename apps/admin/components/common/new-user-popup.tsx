/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useTheme as useNextTheme } from "next-themes";
// ui
import { Button, getButtonStyling } from "@plane/propel/button";
import { resolveGeneralTheme } from "@plane/utils";
// hooks
import TakeoffIconDark from "@/app/assets/logos/takeoff-icon-dark.svg?url";
import TakeoffIconLight from "@/app/assets/logos/takeoff-icon-light.svg?url";
import { useTheme } from "@/hooks/store";
// icons

export const NewUserPopup = observer(function NewUserPopup() {
  // hooks
  const { isNewUserPopup, toggleNewUserPopup } = useTheme();
  // theme
  const { resolvedTheme } = useNextTheme();

  if (!isNewUserPopup) return <></>;
  return (
    <div className="shadow-md absolute right-8 bottom-8 w-96 rounded-lg border border-subtle bg-surface-1 p-6">
      <div className="flex gap-4">
        <div className="grow">
          <div className="text-14 font-semibold">创建工作区</div>
          <div className="py-2 text-13 font-medium text-tertiary">
            平台初始化已完成。请创建第一个工作区，开始使用星轴科技研发管理平台。
          </div>
          <div className="flex items-center gap-4 pt-2">
            <Link href="/workspace/create" className={getButtonStyling("primary", "lg")}>
              创建工作区
            </Link>
            <Button variant="secondary" size="lg" onClick={toggleNewUserPopup}>
              关闭
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-center">
          <img
            src={resolveGeneralTheme(resolvedTheme) === "dark" ? TakeoffIconDark : TakeoffIconLight}
            height={80}
            width={80}
            alt=""
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
});
