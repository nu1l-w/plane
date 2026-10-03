/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
// icons
import { Eye, EyeOff } from "lucide-react";
// plane internal packages
import { API_BASE_URL, E_PASSWORD_STRENGTH } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { AuthService } from "@plane/services";
import { Checkbox, Input, PasswordStrengthIndicator, Spinner } from "@plane/ui";
import { getPasswordStrength, validatePersonName, validateCompanyName } from "@plane/utils";
// components
import { AuthHeader } from "@/app/(all)/(home)/auth-header";
import { Banner } from "../common/banner";
import { FormHeader } from "./form-header";

// service initialization
const authService = new AuthService();

// error codes
enum EErrorCodes {
  INSTANCE_NOT_CONFIGURED = "INSTANCE_NOT_CONFIGURED",
  ADMIN_ALREADY_EXIST = "ADMIN_ALREADY_EXIST",
  REQUIRED_EMAIL_PASSWORD_FIRST_NAME = "REQUIRED_EMAIL_PASSWORD_FIRST_NAME",
  INVALID_EMAIL = "INVALID_EMAIL",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
}

type TError = {
  type: EErrorCodes | undefined;
  message: string | undefined;
};

// form data
type TFormData = {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  password: string;
  confirm_password?: string;
  is_telemetry_enabled: boolean;
};

const defaultFromData: TFormData = {
  first_name: "",
  last_name: "",
  email: "",
  company_name: "",
  password: "",
  is_telemetry_enabled: true,
};

const ADMIN_PASSWORD_STRENGTH_TRANSLATIONS: Record<string, string> = {
  "Please enter your password": "请输入密码",
  "Password is too short": "密码长度不足",
  "Password is weak": "密码强度较弱",
  "Password is strong": "密码强度较高",
  "Min 8 characters": "至少 8 个字符",
  "Min 1 upper-case letter": "至少包含 1 个大写字母",
  "Min 1 lower-case letter": "至少包含 1 个小写字母",
  "Min 1 number": "至少包含 1 个数字",
  "Min 1 special character": "至少包含 1 个特殊字符",
};

const translateAdminPasswordStrengthText = (text: string): string => ADMIN_PASSWORD_STRENGTH_TRANSLATIONS[text] ?? text;

export function InstanceSetupForm() {
  // search params
  const searchParams = useSearchParams();
  const firstNameParam = searchParams?.get("first_name") || undefined;
  const lastNameParam = searchParams?.get("last_name") || undefined;
  const companyParam = searchParams?.get("company") || undefined;
  const emailParam = searchParams?.get("email") || undefined;
  const isTelemetryEnabledParam = searchParams?.get("is_telemetry_enabled") !== "False";
  const errorCode = searchParams?.get("error_code") || undefined;
  const errorMessage = searchParams?.get("error_message") || undefined;
  // state
  const [showPassword, setShowPassword] = useState({
    password: false,
    retypePassword: false,
  });
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<TFormData>(defaultFromData);
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleFormChange = (key: keyof TFormData, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (csrfToken === undefined)
      authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
  }, [csrfToken]);

  useEffect(() => {
    if (firstNameParam) setFormData((prev) => ({ ...prev, first_name: firstNameParam }));
    if (lastNameParam) setFormData((prev) => ({ ...prev, last_name: lastNameParam }));
    if (companyParam) setFormData((prev) => ({ ...prev, company_name: companyParam }));
    if (emailParam) setFormData((prev) => ({ ...prev, email: emailParam }));
    if (isTelemetryEnabledParam) setFormData((prev) => ({ ...prev, is_telemetry_enabled: isTelemetryEnabledParam }));
  }, [firstNameParam, lastNameParam, companyParam, emailParam, isTelemetryEnabledParam]);

  // derived values
  const errorData: TError = useMemo(() => {
    if (errorCode && errorMessage) {
      switch (errorCode) {
        case EErrorCodes.INSTANCE_NOT_CONFIGURED:
          return { type: EErrorCodes.INSTANCE_NOT_CONFIGURED, message: "实例尚未配置完成，请检查部署设置后重试。" };
        case EErrorCodes.ADMIN_ALREADY_EXIST:
          return { type: EErrorCodes.ADMIN_ALREADY_EXIST, message: "此实例已完成初始化，请返回登录页面。" };
        case EErrorCodes.REQUIRED_EMAIL_PASSWORD_FIRST_NAME:
          return { type: EErrorCodes.REQUIRED_EMAIL_PASSWORD_FIRST_NAME, message: "请填写姓名、邮箱和密码。" };
        case EErrorCodes.INVALID_EMAIL:
          return { type: EErrorCodes.INVALID_EMAIL, message: "请输入有效的邮箱地址。" };
        case EErrorCodes.INVALID_PASSWORD:
          return { type: EErrorCodes.INVALID_PASSWORD, message: "密码强度不足，请设置更强的密码。" };
        case EErrorCodes.USER_ALREADY_EXISTS:
          return { type: EErrorCodes.USER_ALREADY_EXISTS, message: "此邮箱已注册，请使用其他邮箱。" };
        default:
          return { type: undefined, message: undefined };
      }
    } else return { type: undefined, message: undefined };
  }, [errorCode, errorMessage]);

  const isButtonDisabled = useMemo(
    () =>
      isSubmitting ||
      !formData.first_name ||
      !formData.email ||
      !formData.password ||
      getPasswordStrength(formData.password) !== E_PASSWORD_STRENGTH.STRENGTH_VALID ||
      formData.password !== formData.confirm_password,
    [formData.confirm_password, formData.email, formData.first_name, formData.password, isSubmitting]
  );

  const password = formData?.password ?? "";
  const confirmPassword = formData?.confirm_password ?? "";
  const renderPasswordMatchError = !isRetryPasswordInputFocused || confirmPassword.length >= password.length;

  return (
    <>
      <AuthHeader />
      <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
        <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
          <FormHeader heading="初始化星轴科技研发管理平台" subHeading="完成后即可进入管理后台配置平台。" />
          {errorData.type &&
            errorData?.message &&
            ![EErrorCodes.INVALID_EMAIL, EErrorCodes.INVALID_PASSWORD].includes(errorData.type) && (
              <Banner type="error" message={errorData?.message} />
            )}
          <form
            className="space-y-4"
            method="POST"
            action={`${API_BASE_URL}/api/instances/admins/sign-up/`}
            onSubmit={() => setIsSubmitting(true)}
            onError={() => setIsSubmitting(false)}
          >
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <input type="hidden" name="is_telemetry_enabled" value={formData.is_telemetry_enabled ? "True" : "False"} />

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="w-full space-y-1">
                <label className="text-13 font-medium text-tertiary" htmlFor="first_name">
                  名 <span className="text-danger-primary">*</span>
                </label>
                <Input
                  className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                  id="first_name"
                  name="first_name"
                  type="text"
                  inputSize="md"
                  placeholder="小明"
                  value={formData.first_name}
                  onChange={(e) => {
                    const validation = validatePersonName(e.target.value);
                    if (validation === true || e.target.value === "") {
                      handleFormChange("first_name", e.target.value);
                    }
                  }}
                  autoComplete="off"
                  maxLength={50}
                />
              </div>
              <div className="w-full space-y-1">
                <label className="text-13 font-medium text-tertiary" htmlFor="last_name">
                  姓 <span className="text-danger-primary">*</span>
                </label>
                <Input
                  className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                  id="last_name"
                  name="last_name"
                  type="text"
                  inputSize="md"
                  placeholder="张"
                  value={formData.last_name}
                  onChange={(e) => {
                    const validation = validatePersonName(e.target.value);
                    if (validation === true || e.target.value === "") {
                      handleFormChange("last_name", e.target.value);
                    }
                  }}
                  autoComplete="off"
                  maxLength={50}
                />
              </div>
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="email">
                邮箱 <span className="text-danger-primary">*</span>
              </label>
              <Input
                className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                id="email"
                name="email"
                type="email"
                inputSize="md"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                hasError={errorData.type === EErrorCodes.INVALID_EMAIL}
                autoComplete="off"
              />
              {errorData.type && errorData.type === EErrorCodes.INVALID_EMAIL && errorData.message && (
                <p className="px-1 text-11 text-danger-primary">{errorData.message}</p>
              )}
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="company_name">
                公司名称 <span className="text-danger-primary">*</span>
              </label>
              <Input
                className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                id="company_name"
                name="company_name"
                type="text"
                inputSize="md"
                placeholder="星轴科技"
                value={formData.company_name}
                onChange={(e) => {
                  const validation = validateCompanyName(e.target.value, false);
                  if (validation === true || e.target.value === "") {
                    handleFormChange("company_name", e.target.value);
                  }
                }}
                maxLength={80}
              />
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="password">
                设置密码 <span className="text-danger-primary">*</span>
              </label>
              <div className="relative">
                <Input
                  className="w-full border border-subtle !bg-surface-1 placeholder:text-placeholder"
                  id="password"
                  name="password"
                  type={showPassword.password ? "text" : "password"}
                  inputSize="md"
                  placeholder="请输入新密码"
                  value={formData.password}
                  onChange={(e) => handleFormChange("password", e.target.value)}
                  hasError={errorData.type === EErrorCodes.INVALID_PASSWORD}
                  onFocus={() => setIsPasswordInputFocused(true)}
                  onBlur={() => setIsPasswordInputFocused(false)}
                  autoComplete="new-password"
                />
                {showPassword.password ? (
                  <button
                    type="button"
                    aria-label="隐藏密码"
                    className="absolute top-3.5 right-3 flex items-center justify-center text-placeholder"
                    onClick={() => handleShowPassword("password")}
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="显示密码"
                    className="absolute top-3.5 right-3 flex items-center justify-center text-placeholder"
                    onClick={() => handleShowPassword("password")}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
              {errorData.type && errorData.type === EErrorCodes.INVALID_PASSWORD && errorData.message && (
                <p className="px-1 text-11 text-danger-primary">{errorData.message}</p>
              )}
              <PasswordStrengthIndicator
                password={formData.password}
                isFocused={isPasswordInputFocused}
                translateText={translateAdminPasswordStrengthText}
              />
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="confirm_password">
                确认密码 <span className="text-danger-primary">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword.retypePassword ? "text" : "password"}
                  id="confirm_password"
                  name="confirm_password"
                  inputSize="md"
                  value={formData.confirm_password}
                  onChange={(e) => handleFormChange("confirm_password", e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full border border-subtle !bg-surface-1 pr-12 placeholder:text-placeholder"
                  onFocus={() => setIsRetryPasswordInputFocused(true)}
                  onBlur={() => setIsRetryPasswordInputFocused(false)}
                  autoComplete="new-password"
                />
                {showPassword.retypePassword ? (
                  <button
                    type="button"
                    aria-label="隐藏密码"
                    className="absolute top-3.5 right-3 flex items-center justify-center text-placeholder"
                    onClick={() => handleShowPassword("retypePassword")}
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="显示密码"
                    className="absolute top-3.5 right-3 flex items-center justify-center text-placeholder"
                    onClick={() => handleShowPassword("retypePassword")}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
              {!!formData.confirm_password &&
                formData.password !== formData.confirm_password &&
                renderPasswordMatchError && <span className="text-13 text-danger-primary">两次输入的密码不一致</span>}
            </div>

            <div className="relative flex gap-2">
              <div>
                <Checkbox
                  className="h-4 w-4"
                  iconClassName="w-3 h-3"
                  id="is_telemetry_enabled"
                  onChange={() => handleFormChange("is_telemetry_enabled", !formData.is_telemetry_enabled)}
                  checked={formData.is_telemetry_enabled}
                />
              </div>
              <label className="cursor-pointer text-13 font-medium text-tertiary" htmlFor="is_telemetry_enabled">
                允许匿名收集使用情况数据，以帮助改进系统。
              </label>
            </div>

            <div className="py-2">
              <Button type="submit" size="xl" className="w-full" disabled={isButtonDisabled}>
                {isSubmitting ? <Spinner height="20px" width="20px" /> : "继续"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
