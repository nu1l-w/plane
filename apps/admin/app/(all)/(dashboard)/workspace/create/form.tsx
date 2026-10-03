/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { WEB_BASE_URL, ORGANIZATION_SIZE, RESTRICTED_URLS } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { InstanceWorkspaceService } from "@plane/services";
import type { IWorkspace } from "@plane/types";
import { validateSlug, validateWorkspaceName } from "@plane/utils";
// components
import { CustomSelect, Input } from "@plane/ui";
// hooks
import { useWorkspace } from "@/hooks/store";

const instanceWorkspaceService = new InstanceWorkspaceService();

const WORKSPACE_VALIDATION_TRANSLATIONS: Record<string, string> = {
  "Workspace name is required": "请输入工作区名称。",
  "Workspace name must be 80 characters or less": "工作区名称不能超过 80 个字符。",
  [`Workspace name cannot contain special characters like < > ' " { } [ ] * ^ ! # %`]: `工作区名称不能包含特殊字符：< > ' " { } [ ] * ^ ! # %。`,
  "Workspace name can only contain letters, numbers, spaces, hyphens, and underscores":
    "工作区名称只能包含英文字母、数字、空格、连字符和下划线。",
  "Workspace name must contain at least one letter or number": "工作区名称至少需要包含一个字母或数字。",
  "Slug is required": "请输入工作区网址标识。",
  "Slug must be 48 characters or less": "工作区网址标识不能超过 48 个字符。",
  [`Slug cannot contain special characters like < > ' " { } [ ] * ^ ! # %`]: `工作区网址标识不能包含特殊字符：< > ' " { } [ ] * ^ ! # %。`,
  "Slug can only contain letters, numbers, hyphens, and underscores":
    "工作区网址标识只能包含英文字母、数字、连字符和下划线。",
};

const localizeWorkspaceValidation = (result: boolean | string): boolean | string =>
  typeof result === "string" ? (WORKSPACE_VALIDATION_TRANSLATIONS[result] ?? "输入内容无效，请检查后重试。") : result;

export function WorkspaceCreateForm() {
  // router
  const router = useRouter();
  // states
  const [slugError, setSlugError] = useState(false);
  const [invalidSlug, setInvalidSlug] = useState(false);
  const [defaultValues, setDefaultValues] = useState<Partial<IWorkspace>>({
    name: "",
    slug: "",
    organization_size: "",
  });
  // store hooks
  const { createWorkspace } = useWorkspace();
  // form info
  const {
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<IWorkspace>({ defaultValues, mode: "onChange" });
  // derived values
  const [workspaceBaseURL, setWorkspaceBaseURL] = useState(() => encodeURI(WEB_BASE_URL || ""));

  useEffect(() => {
    if (!WEB_BASE_URL) {
      setWorkspaceBaseURL(encodeURI(window.location.origin + "/"));
    }
  }, []);

  const handleCreateWorkspace = async (formData: IWorkspace) => {
    try {
      const res = await instanceWorkspaceService.slugCheck(formData.slug);
      if (res.status !== true || RESTRICTED_URLS.includes(formData.slug)) {
        setSlugError(true);
        return;
      }

      setSlugError(false);
      try {
        await createWorkspace(formData);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "创建成功",
          message: "工作区已创建。",
        });
        router.push(`/workspace`);
      } catch {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "创建失败",
          message: "无法创建工作区，请重试。",
        });
      }
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "创建失败",
        message: "创建工作区时发生错误，请重试。",
      });
    }
  };

  useEffect(
    () => () => {
      // when the component unmounts set the default values to whatever user typed in
      setDefaultValues(getValues());
    },
    [getValues, setDefaultValues]
  );

  return (
    <div className="space-y-8">
      <div className="grid-col grid w-full max-w-4xl grid-cols-1 items-start justify-between gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <h4 className="text-13 text-tertiary">工作区名称</h4>
          <div className="flex flex-col gap-1">
            <Controller
              control={control}
              name="name"
              rules={{
                validate: (value) => localizeWorkspaceValidation(validateWorkspaceName(value, true)),
              }}
              render={({ field: { value, ref, onChange } }) => (
                <Input
                  id="workspaceName"
                  type="text"
                  value={value}
                  onChange={(e) => {
                    onChange(e.target.value);
                    setValue("name", e.target.value);
                    setValue("slug", e.target.value.toLocaleLowerCase().trim().replace(/ /g, "-"), {
                      shouldValidate: true,
                    });
                  }}
                  ref={ref}
                  hasError={Boolean(errors.name)}
                  placeholder="请输入易于识别的名称"
                  className="w-full"
                />
              )}
            />
            <span className="text-11 text-danger-primary">{errors?.name?.message}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-13 text-tertiary">设置工作区网址</h4>
          <div className="flex w-full items-center gap-0.5 rounded-md border-[0.5px] border-subtle px-3">
            <span className="text-13 whitespace-nowrap text-secondary">{workspaceBaseURL}</span>
            <Controller
              control={control}
              name="slug"
              rules={{
                validate: (value) => localizeWorkspaceValidation(validateSlug(value)),
              }}
              render={({ field: { onChange, value, ref } }) => (
                <Input
                  id="workspaceUrl"
                  type="text"
                  value={value.toLocaleLowerCase().trim().replace(/ /g, "-")}
                  onChange={(e) => {
                    if (/^[a-zA-Z0-9_-]+$/.test(e.target.value)) setInvalidSlug(false);
                    else setInvalidSlug(true);
                    onChange(e.target.value.toLowerCase());
                  }}
                  ref={ref}
                  hasError={Boolean(errors.slug)}
                  placeholder="工作区名称"
                  className="block w-full rounded-md border-none bg-transparent !px-0 py-2 text-13"
                />
              )}
            />
          </div>
          {slugError && <p className="text-13 text-danger-primary">此网址已被占用，请更换一个。</p>}
          {invalidSlug && (
            <p className="text-13 text-danger-primary">{`网址只能包含英文字母、数字、连字符（-）和下划线（_）。`}</p>
          )}
          {errors.slug && <span className="text-11 text-danger-primary">{errors.slug.message}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-13 text-tertiary">预计有多少人使用此工作区？</h4>
          <div className="w-full">
            <Controller
              name="organization_size"
              control={control}
              rules={{ required: "此项为必填项。" }}
              render={({ field: { value, onChange } }) => (
                <CustomSelect
                  value={value}
                  onChange={onChange}
                  label={
                    ORGANIZATION_SIZE.find((c) => c === value) ?? (
                      <span className="text-placeholder">请选择人数范围</span>
                    )
                  }
                  buttonClassName="!border-[0.5px] !border-subtle !shadow-none"
                  input
                >
                  {ORGANIZATION_SIZE.map((item) => (
                    <CustomSelect.Option key={item} value={item}>
                      {item}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.organization_size && (
              <span className="text-13 text-danger-primary">{errors.organization_size.message}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex max-w-4xl items-center gap-4 py-1">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit(handleCreateWorkspace)}
          disabled={!isValid}
          loading={isSubmitting}
        >
          {isSubmitting ? "正在创建…" : "创建工作区"}
        </Button>
        <Link className={getButtonStyling("secondary", "lg")} href="/workspace">
          返回
        </Link>
      </div>
    </div>
  );
}
