/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// assets
import UserLoggedInImage from "@/app/assets/user-logged-in.svg?url";
// components
import { PoweredBy } from "@/components/common/powered-by";
import { UserAvatar } from "@/components/issues/navbar/user-avatar";
// hooks
import { useUser } from "@/hooks/store/use-user";

export const UserLoggedIn = observer(function UserLoggedIn() {
  // store hooks
  const { data: user } = useUser();

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="relative flex w-full items-center justify-between gap-4 border-b border-subtle px-6 py-5">
        <span className="text-18 font-semibold text-primary">星轴科技</span>
        <UserAvatar />
      </div>

      <div className="grid size-full place-items-center p-6">
        <div className="text-center">
          <div className="mx-auto grid size-32 place-items-center rounded-full bg-layer-1 md:size-52">
            <div className="grid size-16 place-items-center md:size-32">
              <img src={UserLoggedInImage} alt="用户已登录" className="h-full w-full object-cover" />
            </div>
          </div>
          <h1 className="mt-8 text-18 font-semibold md:mt-12 md:text-24">登录成功，还差最后一步</h1>
          <p className="mt-2 text-13 md:mt-4 md:text-14">请在浏览器地址栏中输入要访问的公开视图或页面链接。</p>
        </div>
      </div>
      <PoweredBy />
    </div>
  );
});
