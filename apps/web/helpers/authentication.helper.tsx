/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import Link from "next/link";
// plane imports
import { SUPPORT_EMAIL } from "@plane/constants";

export enum EPageTypes {
  PUBLIC = "PUBLIC",
  NON_AUTHENTICATED = "NON_AUTHENTICATED",
  SET_PASSWORD = "SET_PASSWORD",
  ONBOARDING = "ONBOARDING",
  AUTHENTICATED = "AUTHENTICATED",
}

export enum EAuthModes {
  SIGN_IN = "SIGN_IN",
  SIGN_UP = "SIGN_UP",
}

export enum EAuthSteps {
  EMAIL = "EMAIL",
  PASSWORD = "PASSWORD",
  UNIQUE_CODE = "UNIQUE_CODE",
}

export enum EErrorAlertType {
  BANNER_ALERT = "BANNER_ALERT",
  INLINE_FIRST_NAME = "INLINE_FIRST_NAME",
  INLINE_EMAIL = "INLINE_EMAIL",
  INLINE_PASSWORD = "INLINE_PASSWORD",
  INLINE_EMAIL_CODE = "INLINE_EMAIL_CODE",
}

export enum EAuthenticationErrorCodes {
  // Global
  INSTANCE_NOT_CONFIGURED = "5000",
  INVALID_EMAIL = "5005",
  EMAIL_REQUIRED = "5010",
  SIGNUP_DISABLED = "5015",
  MAGIC_LINK_LOGIN_DISABLED = "5016",
  BOT_USER_LOGIN_FORBIDDEN = "5017",
  PASSWORD_LOGIN_DISABLED = "5018",
  USER_ACCOUNT_DEACTIVATED = "5019",
  // Password strength
  INVALID_PASSWORD = "5020",
  PASSWORD_TOO_WEAK = "5021",
  SMTP_NOT_CONFIGURED = "5025",
  // Sign Up
  USER_ALREADY_EXIST = "5030",
  AUTHENTICATION_FAILED_SIGN_UP = "5035",
  REQUIRED_EMAIL_PASSWORD_SIGN_UP = "5040",
  INVALID_EMAIL_SIGN_UP = "5045",
  INVALID_EMAIL_MAGIC_SIGN_UP = "5050",
  MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED = "5055",
  // Sign In
  USER_DOES_NOT_EXIST = "5060",
  AUTHENTICATION_FAILED_SIGN_IN = "5065",
  REQUIRED_EMAIL_PASSWORD_SIGN_IN = "5070",
  INVALID_EMAIL_SIGN_IN = "5075",
  INVALID_EMAIL_MAGIC_SIGN_IN = "5080",
  MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED = "5085",
  // Both Sign in and Sign up for magic
  INVALID_MAGIC_CODE_SIGN_IN = "5090",
  INVALID_MAGIC_CODE_SIGN_UP = "5092",
  EXPIRED_MAGIC_CODE_SIGN_IN = "5095",
  EXPIRED_MAGIC_CODE_SIGN_UP = "5097",
  EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN = "5100",
  EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP = "5102",
  // Oauth
  OAUTH_NOT_CONFIGURED = "5104",
  GOOGLE_NOT_CONFIGURED = "5105",
  GITHUB_NOT_CONFIGURED = "5110",
  GITLAB_NOT_CONFIGURED = "5111",
  GOOGLE_OAUTH_PROVIDER_ERROR = "5115",
  GITHUB_OAUTH_PROVIDER_ERROR = "5120",
  GITLAB_OAUTH_PROVIDER_ERROR = "5121",
  // Reset Password
  INVALID_PASSWORD_TOKEN = "5125",
  EXPIRED_PASSWORD_TOKEN = "5130",
  // Change password
  INCORRECT_OLD_PASSWORD = "5135",
  MISSING_PASSWORD = "5138",
  INVALID_NEW_PASSWORD = "5140",
  // set password
  PASSWORD_ALREADY_SET = "5145",
  // Admin
  ADMIN_ALREADY_EXIST = "5150",
  REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME = "5155",
  INVALID_ADMIN_EMAIL = "5160",
  INVALID_ADMIN_PASSWORD = "5165",
  REQUIRED_ADMIN_EMAIL_PASSWORD = "5170",
  ADMIN_AUTHENTICATION_FAILED = "5175",
  ADMIN_USER_ALREADY_EXIST = "5180",
  ADMIN_USER_DOES_NOT_EXIST = "5185",
  ADMIN_USER_DEACTIVATED = "5190",
  // Rate limit
  RATE_LIMIT_EXCEEDED = "5900",
}

export type TAuthErrorInfo = {
  type: EErrorAlertType;
  code: EAuthenticationErrorCodes;
  title: string;
  message: ReactNode;
};

// TODO: move all error messages to translation files
const errorCodeMessages: {
  [key in EAuthenticationErrorCodes]: { title: string; message: (email?: string) => ReactNode };
} = {
  // global
  [EAuthenticationErrorCodes.INSTANCE_NOT_CONFIGURED]: {
    title: `实例未配置`,
    message: () => `实例尚未配置，请联系管理员。`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL]: {
    title: `邮箱无效`,
    message: () => `邮箱无效，请重试。`,
  },
  [EAuthenticationErrorCodes.EMAIL_REQUIRED]: {
    title: `需要邮箱`,
    message: () => `请输入邮箱后重试。`,
  },
  [EAuthenticationErrorCodes.SIGNUP_DISABLED]: {
    title: `注册已关闭`,
    message: () => `注册功能已关闭，请联系管理员。`,
  },
  [EAuthenticationErrorCodes.MAGIC_LINK_LOGIN_DISABLED]: {
    title: `魔法链接登录已关闭`,
    message: () => `魔法链接登录已关闭，请联系管理员。`,
  },
  [EAuthenticationErrorCodes.PASSWORD_LOGIN_DISABLED]: {
    title: `密码登录已关闭`,
    message: () => `密码登录已关闭，请联系管理员。`,
  },
  [EAuthenticationErrorCodes.USER_ACCOUNT_DEACTIVATED]: {
    title: `账号已停用`,
    message: () => `账号已停用，请联系${SUPPORT_EMAIL || "管理员"}。`,
  },
  [EAuthenticationErrorCodes.BOT_USER_LOGIN_FORBIDDEN]: {
    title: `不允许登录`,
    message: () => `此账号无法登录，请使用个人账号。`,
  },
  [EAuthenticationErrorCodes.INVALID_PASSWORD]: {
    title: `密码无效`,
    message: () => `密码无效，请重试。`,
  },
  [EAuthenticationErrorCodes.PASSWORD_TOO_WEAK]: {
    title: `密码强度不足`,
    message: () => `请使用更强的密码。`,
  },
  [EAuthenticationErrorCodes.SMTP_NOT_CONFIGURED]: {
    title: `SMTP 未配置`,
    message: () => `SMTP 尚未配置，请联系管理员。`,
  },

  // sign up
  [EAuthenticationErrorCodes.USER_ALREADY_EXIST]: {
    title: `用户已存在`,
    message: (email = undefined) => (
      <div>
        Your account is already registered.&nbsp;
        <Link
          className="font-medium underline underline-offset-4 transition-all hover:font-bold"
          href={`/sign-in${email ? `?email=${encodeURIComponent(email)}` : ``}`}
        >
          Sign In
        </Link>
        &nbsp;now.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP]: {
    title: `需要邮箱和密码`,
    message: () => `请输入邮箱和密码后重试。`,
  },
  [EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP]: {
    title: `认证失败`,
    message: () => `认证失败，请重试。`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_UP]: {
    title: `邮箱无效`,
    message: () => `邮箱无效，请重试。`,
  },
  [EAuthenticationErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED]: {
    title: `需要邮箱和验证码`,
    message: () => `请输入邮箱和验证码后重试。`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP]: {
    title: `邮箱无效`,
    message: () => `邮箱无效，请重试。`,
  },

  [EAuthenticationErrorCodes.USER_DOES_NOT_EXIST]: {
    title: `用户不存在`,
    message: (email = undefined) => (
      <div>
        No account found.&nbsp;
        <Link
          className="font-medium underline underline-offset-4 transition-all hover:font-bold"
          href={`/${email ? `?email=${encodeURIComponent(email)}` : ``}`}
        >
          Create one
        </Link>
        &nbsp;to get started.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN]: {
    title: `需要邮箱和密码`,
    message: () => `请输入邮箱和密码后重试。`,
  },
  [EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN]: {
    title: `认证失败`,
    message: () => `认证失败，请重试。`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_IN]: {
    title: `邮箱无效`,
    message: () => `邮箱无效，请重试。`,
  },
  [EAuthenticationErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED]: {
    title: `需要邮箱和验证码`,
    message: () => `请输入邮箱和验证码后重试。`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN]: {
    title: `邮箱无效`,
    message: () => `邮箱无效，请重试。`,
  },

  // Both Sign in and Sign up
  [EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_IN]: {
    title: `认证失败`,
    message: () => `验证码无效，请重试。`,
  },
  [EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_UP]: {
    title: `认证失败`,
    message: () => `验证码无效，请重试。`,
  },
  [EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN]: {
    title: `验证码已过期`,
    message: () => `验证码已过期，请重试。`,
  },
  [EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP]: {
    title: `验证码已过期`,
    message: () => `验证码已过期，请重试。`,
  },
  [EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN]: {
    title: `验证码已过期`,
    message: () => `验证码已过期，请重试。`,
  },
  [EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP]: {
    title: `验证码已过期`,
    message: () => `验证码已过期，请重试。`,
  },

  // Oauth
  [EAuthenticationErrorCodes.OAUTH_NOT_CONFIGURED]: {
    title: `OAuth 未配置`,
    message: () => `OAuth 尚未配置，请联系管理员。`,
  },
  [EAuthenticationErrorCodes.GOOGLE_NOT_CONFIGURED]: {
    title: `Google 未配置`,
    message: () => `Google 尚未配置，请联系管理员。`,
  },
  [EAuthenticationErrorCodes.GITHUB_NOT_CONFIGURED]: {
    title: `GitHub 未配置`,
    message: () => `GitHub 尚未配置，请联系管理员。`,
  },
  [EAuthenticationErrorCodes.GITLAB_NOT_CONFIGURED]: {
    title: `GitLab 未配置`,
    message: () => `GitLab 尚未配置，请联系管理员。`,
  },
  [EAuthenticationErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR]: {
    title: `Google OAuth 提供商错误`,
    message: () => `Google OAuth 提供商发生错误，请重试。`,
  },
  [EAuthenticationErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR]: {
    title: `GitHub OAuth 提供商错误`,
    message: () => `GitHub OAuth 提供商发生错误，请重试。`,
  },
  [EAuthenticationErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR]: {
    title: `GitLab OAuth 提供商错误`,
    message: () => `GitLab OAuth 提供商发生错误，请重试。`,
  },

  // Reset Password
  [EAuthenticationErrorCodes.INVALID_PASSWORD_TOKEN]: {
    title: `密码令牌无效`,
    message: () => `密码令牌无效。`,
  },
  [EAuthenticationErrorCodes.EXPIRED_PASSWORD_TOKEN]: {
    title: `密码令牌已过期`,
    message: () => `密码令牌已过期，请重试。`,
  },

  // Change password
  [EAuthenticationErrorCodes.MISSING_PASSWORD]: {
    title: `需要密码`,
    message: () => `请输入密码后重试。`,
  },
  [EAuthenticationErrorCodes.INCORRECT_OLD_PASSWORD]: {
    title: `旧密码错误`,
    message: () => `旧密码错误，请重试。`,
  },
  [EAuthenticationErrorCodes.INVALID_NEW_PASSWORD]: {
    title: `新密码无效`,
    message: () => `新密码无效，请重试。`,
  },

  // set password
  [EAuthenticationErrorCodes.PASSWORD_ALREADY_SET]: {
    title: `密码已设置`,
    message: () => `密码已经设置，请重试。`,
  },

  // admin
  [EAuthenticationErrorCodes.ADMIN_ALREADY_EXIST]: {
    title: `管理员已存在`,
    message: () => `管理员已经存在，请重试。`,
  },
  [EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME]: {
    title: `需要邮箱、密码和姓名`,
    message: () => `请输入邮箱、密码和姓名后重试。`,
  },
  [EAuthenticationErrorCodes.INVALID_ADMIN_EMAIL]: {
    title: `管理员邮箱无效`,
    message: () => `管理员邮箱无效，请重试。`,
  },
  [EAuthenticationErrorCodes.INVALID_ADMIN_PASSWORD]: {
    title: `管理员密码无效`,
    message: () => `管理员密码无效，请重试。`,
  },
  [EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD]: {
    title: `需要邮箱和密码`,
    message: () => `请输入邮箱和密码后重试。`,
  },
  [EAuthenticationErrorCodes.ADMIN_AUTHENTICATION_FAILED]: {
    title: `认证失败`,
    message: () => `认证失败，请重试。`,
  },
  [EAuthenticationErrorCodes.ADMIN_USER_ALREADY_EXIST]: {
    title: `管理员用户已存在`,
    message: () => (
      <div>
        Admin user already exists.&nbsp;
        <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" href={`/admin`}>
          Sign In
        </Link>
        &nbsp;now.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.ADMIN_USER_DOES_NOT_EXIST]: {
    title: `管理员用户不存在`,
    message: () => (
      <div>
        Admin user does not exist.&nbsp;
        <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" href={`/admin`}>
          Sign In
        </Link>
        &nbsp;now.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.ADMIN_USER_DEACTIVATED]: {
    title: `管理员用户已停用`,
    message: () => <div>Your account is deactivated</div>,
  },
  [EAuthenticationErrorCodes.RATE_LIMIT_EXCEEDED]: {
    title: "",
    message: () => `请求过于频繁，请稍后重试。`,
  },
};

export const authErrorHandler = (errorCode: EAuthenticationErrorCodes, email?: string): TAuthErrorInfo | undefined => {
  const bannerAlertErrorCodes = [
    EAuthenticationErrorCodes.INSTANCE_NOT_CONFIGURED,
    EAuthenticationErrorCodes.INVALID_EMAIL,
    EAuthenticationErrorCodes.EMAIL_REQUIRED,
    EAuthenticationErrorCodes.SIGNUP_DISABLED,
    EAuthenticationErrorCodes.MAGIC_LINK_LOGIN_DISABLED,
    EAuthenticationErrorCodes.PASSWORD_LOGIN_DISABLED,
    EAuthenticationErrorCodes.BOT_USER_LOGIN_FORBIDDEN,
    EAuthenticationErrorCodes.USER_ACCOUNT_DEACTIVATED,
    EAuthenticationErrorCodes.INVALID_PASSWORD,
    EAuthenticationErrorCodes.SMTP_NOT_CONFIGURED,
    EAuthenticationErrorCodes.USER_ALREADY_EXIST,
    EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP,
    EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP,
    EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_UP,
    EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP,
    EAuthenticationErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED,
    EAuthenticationErrorCodes.USER_DOES_NOT_EXIST,
    EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN,
    EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN,
    EAuthenticationErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED,
    EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_UP,
    EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN,
    EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP,
    EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN,
    EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP,
    EAuthenticationErrorCodes.OAUTH_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GOOGLE_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GITHUB_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GITLAB_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.INVALID_PASSWORD_TOKEN,
    EAuthenticationErrorCodes.EXPIRED_PASSWORD_TOKEN,
    EAuthenticationErrorCodes.INCORRECT_OLD_PASSWORD,
    EAuthenticationErrorCodes.MISSING_PASSWORD,
    EAuthenticationErrorCodes.INVALID_NEW_PASSWORD,
    EAuthenticationErrorCodes.PASSWORD_ALREADY_SET,
    EAuthenticationErrorCodes.ADMIN_ALREADY_EXIST,
    EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME,
    EAuthenticationErrorCodes.INVALID_ADMIN_EMAIL,
    EAuthenticationErrorCodes.INVALID_ADMIN_PASSWORD,
    EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD,
    EAuthenticationErrorCodes.ADMIN_AUTHENTICATION_FAILED,
    EAuthenticationErrorCodes.ADMIN_USER_ALREADY_EXIST,
    EAuthenticationErrorCodes.ADMIN_USER_DOES_NOT_EXIST,
    EAuthenticationErrorCodes.ADMIN_USER_DEACTIVATED,
    EAuthenticationErrorCodes.RATE_LIMIT_EXCEEDED,
    EAuthenticationErrorCodes.PASSWORD_TOO_WEAK,
  ];

  if (bannerAlertErrorCodes.includes(errorCode))
    return {
      type: EErrorAlertType.BANNER_ALERT,
      code: errorCode,
      title: errorCodeMessages[errorCode]?.title || "Error",
      message: errorCodeMessages[errorCode]?.message(email) || "Something went wrong. Please try again.",
    };

  return undefined;
};

export const passwordErrors = [
  EAuthenticationErrorCodes.PASSWORD_TOO_WEAK,
  EAuthenticationErrorCodes.INVALID_NEW_PASSWORD,
];
