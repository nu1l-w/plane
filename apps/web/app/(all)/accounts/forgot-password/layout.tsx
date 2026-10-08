/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BRAND_NAME } from "@plane/constants";

import { Outlet } from "react-router";
import type { Route } from "./+types/layout";

export default function ForgotPasswordLayout() {
  return <Outlet />;
}

export const meta: Route.MetaFunction = () => [{ title: `Forgot Password - ${BRAND_NAME}` }];
