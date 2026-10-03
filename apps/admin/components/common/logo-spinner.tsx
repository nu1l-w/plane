/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTheme } from "next-themes";
import LogoSpinnerDark from "@/app/assets/images/logo-spinner-dark.gif?url";
import LogoSpinnerLight from "@/app/assets/images/logo-spinner-light.gif?url";

export function LogoSpinner() {
  const { resolvedTheme } = useTheme();

  const logoSrc = resolvedTheme === "dark" ? LogoSpinnerLight : LogoSpinnerDark;

  return (
    <div className="flex items-center justify-center">
      <img src={logoSrc} alt="星轴科技标志" className="h-6 w-auto sm:h-11" />
    </div>
  );
}
