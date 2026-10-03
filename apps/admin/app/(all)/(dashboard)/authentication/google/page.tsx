/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { setPromiseToast } from "@plane/propel/toast";
import { Loader, ToggleSwitch } from "@plane/ui";
// assets
import GoogleLogo from "@/app/assets/logos/google-logo.svg?url";
// components
import { AuthenticationMethodCard } from "@/components/authentication/authentication-method-card";
import { PageWrapper } from "@/components/common/page-wrapper";
// hooks
import { useInstance } from "@/hooks/store";
// types
import type { Route } from "./+types/page";
// local
import { InstanceGoogleConfigForm } from "./form";

const InstanceGoogleAuthenticationPage = observer(function InstanceGoogleAuthenticationPage(
  _props: Route.ComponentProps
) {
  // store
  const { fetchInstanceConfigurations, formattedConfig, updateInstanceConfigurations } = useInstance();
  // state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // config
  const enableGoogleConfig = formattedConfig?.IS_GOOGLE_ENABLED ?? "";

  useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const updateConfig = async (key: "IS_GOOGLE_ENABLED", value: string) => {
    setIsSubmitting(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: "正在保存配置…",
      success: {
        title: "配置已保存",
        message: () => `Google 登录${value === "1" ? "已启用" : "已停用"}。`,
      },
      error: {
        title: "保存失败",
        message: () => "无法保存配置，请重试。",
      },
    });

    try {
      await updateConfigPromise;
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <PageWrapper
      customHeader={
        <AuthenticationMethodCard
          name="Google"
          description="允许成员使用 Google 账号登录或注册 Plane。"
          icon={<img src={GoogleLogo} height={24} width={24} alt="Google 标志" />}
          config={
            <ToggleSwitch
              value={Boolean(parseInt(enableGoogleConfig))}
              onChange={() => {
                if (Boolean(parseInt(enableGoogleConfig)) === true) {
                  updateConfig("IS_GOOGLE_ENABLED", "0");
                } else {
                  updateConfig("IS_GOOGLE_ENABLED", "1");
                }
              }}
              size="sm"
              disabled={isSubmitting || !formattedConfig}
            />
          }
          disabled={isSubmitting || !formattedConfig}
          withBorder={false}
        />
      }
    >
      {formattedConfig ? (
        <InstanceGoogleConfigForm config={formattedConfig} />
      ) : (
        <Loader className="space-y-8">
          <Loader.Item height="50px" width="25%" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" width="50%" />
        </Loader>
      )}
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: "Google 身份验证 - 实例管理" }];

export default InstanceGoogleAuthenticationPage;
