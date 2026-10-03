/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Controller, useForm } from "react-hook-form";
import { Lightbulb } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceAIConfigurationKeys } from "@plane/types";
import { CustomSelect } from "@plane/ui";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
// hooks
import { useInstance } from "@/hooks/store";

type IInstanceAIForm = {
  config: IFormattedInstanceConfiguration;
};

type AIFormValues = Record<TInstanceAIConfigurationKeys, string>;

const AI_PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
};

export function InstanceAIForm(props: IInstanceAIForm) {
  const { config } = props;
  // store
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AIFormValues>({
    defaultValues: {
      LLM_API_KEY: config["LLM_API_KEY"],
      LLM_MODEL: config["LLM_MODEL"],
      LLM_PROVIDER: config["LLM_PROVIDER"] || "openai",
    },
  });

  const selectedProvider = watch("LLM_PROVIDER") || "openai";
  const isDeepSeek = selectedProvider === "deepseek";

  const aiFormFields: TControllerInputFormField[] = [
    {
      key: "LLM_MODEL",
      type: "text",
      label: "语言模型",
      description: (
        <>
          {isDeepSeek ? "DeepSeek 可用模型：deepseek-flash、deepseek-v4-pro。" : "选择 OpenAI 模型。"}{" "}
          <a
            href={
              isDeepSeek
                ? "https://api-docs.deepseek.com/quick_start/pricing"
                : "https://platform.openai.com/docs/models/overview"
            }
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
            aria-label={`${AI_PROVIDER_NAMES[selectedProvider] ?? "AI"} 模型文档`}
          >
            查看模型文档
          </a>
        </>
      ),
      placeholder: isDeepSeek ? "deepseek-flash" : "gpt-4o-mini",
      error: Boolean(errors.LLM_MODEL),
      required: false,
    },
    {
      key: "LLM_API_KEY",
      type: "password",
      label: "API 密钥",
      description: (
        <>
          你可以在服务商控制台创建 API 密钥：{" "}
          <a
            href={isDeepSeek ? "https://platform.deepseek.com/api_keys" : "https://platform.openai.com/api-keys"}
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
            aria-label={`${AI_PROVIDER_NAMES[selectedProvider] ?? "AI"} API 密钥页面`}
          >
            {AI_PROVIDER_NAMES[selectedProvider] ?? "AI"} API 密钥页面
          </a>
        </>
      ),
      placeholder: "请输入 API 密钥",
      error: Boolean(errors.LLM_API_KEY),
      required: false,
    },
  ];

  const onSubmit = async (formData: AIFormValues) => {
    const payload: Partial<AIFormValues> = { ...formData };

    await updateInstanceConfigurations(payload)
      .then(() =>
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "保存成功",
          message: "AI 设置已更新。",
        })
      )
      .catch((err) => console.error(err));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <div className="pb-1 text-18 font-medium text-primary">AI 服务商</div>
          <div className="text-13 font-regular text-tertiary">配置后，所有工作区均可使用 AI 辅助功能。</div>
        </div>
        <div className="grid-col grid w-full grid-cols-1 items-start justify-between gap-x-12 gap-y-8 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">选择服务商</h4>
            <Controller
              control={control}
              name="LLM_PROVIDER"
              render={({ field: { value, onChange } }) => (
                <CustomSelect
                  value={value}
                  label={AI_PROVIDER_NAMES[value] ?? "OpenAI"}
                  onChange={(provider: string) => {
                    onChange(provider);
                    setValue("LLM_MODEL", provider === "deepseek" ? "deepseek-flash" : "gpt-4o-mini");
                  }}
                  buttonClassName="rounded-md border-subtle"
                  input
                >
                  <CustomSelect.Option value="openai" className="w-full">
                    OpenAI
                  </CustomSelect.Option>
                  <CustomSelect.Option value="deepseek" className="w-full">
                    DeepSeek
                  </CustomSelect.Option>
                </CustomSelect>
              )}
            />
          </div>
          {aiFormFields.map((field) => (
            <ControllerInput
              key={field.key}
              control={control}
              type={field.type}
              name={field.key}
              label={field.label}
              description={field.description}
              placeholder={field.placeholder}
              error={field.error}
              required={field.required}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start gap-4">
        <Button variant="primary" size="lg" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
          {isSubmitting ? "正在保存…" : "保存更改"}
        </Button>

        <div className="relative inline-flex items-center gap-1.5 rounded-sm border border-accent-subtle bg-accent-subtle px-4 py-2 text-caption-sm-regular text-accent-secondary">
          <Lightbulb className="size-4" />
          <div>AI 请求会发送到所选服务商处理，请勿提交公司不允许外传的敏感信息。</div>
        </div>
      </div>
    </div>
  );
}
