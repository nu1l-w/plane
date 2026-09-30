/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTheme } from "next-themes";
import { Check, Languages, Palette } from "lucide-react";
import { observer } from "mobx-react";
import { THEME_OPTIONS } from "@plane/constants";
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES, useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setPromiseToast, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import { CustomMenu } from "@plane/ui";
import { useUserProfile } from "@/hooks/store/user";

const topNavigationButtonClassName =
  "group flex size-8 items-center justify-center rounded-md text-tertiary outline-none hover:bg-layer-transparent-hover hover:text-primary";

export const TopNavigationPreferences = observer(function TopNavigationPreferences() {
  const { setTheme } = useTheme();
  const { data: profile, updateUserProfile, updateUserTheme } = useUserProfile();
  const { t } = useTranslation();

  const handleThemeChange = async (theme: string) => {
    setTheme(theme);
    const updatePromise = updateUserTheme({ theme });
    setPromiseToast(updatePromise, {
      loading: "正在保存主题...",
      success: {
        title: "主题已更新",
        message: () => "正在应用主题...",
      },
      error: {
        title: "更新失败",
        message: () => "主题设置保存失败。",
      },
    });

    try {
      await updatePromise;
      window.location.reload();
    } catch {
      setTheme(profile?.theme?.theme || "system");
    }
  };

  const handleLanguageChange = async (language: string) => {
    try {
      await updateUserProfile({ language });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "语言已更新",
        message: "界面语言已切换。",
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "更新失败",
        message: "语言设置保存失败。",
      });
    }
  };

  const selectedLanguage = profile?.language || FALLBACK_LANGUAGE;
  const selectedTheme = profile?.theme?.theme || "system";

  return (
    <div className="flex items-center gap-1">
      <Tooltip tooltipContent={t("theme")} position="bottom">
        <span className="inline-flex">
          <CustomMenu
            ariaLabel={t("theme")}
            customButton={<Palette className="size-4" />}
            customButtonClassName={topNavigationButtonClassName}
            optionsClassName="w-52"
            placement="bottom-end"
          >
            {THEME_OPTIONS.map((themeOption) => (
              <CustomMenu.MenuItem
                key={themeOption.value}
                onClick={() => void handleThemeChange(themeOption.value)}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="relative flex size-4 rotate-45 items-center justify-center rounded-full border"
                    style={{ borderColor: themeOption.icon.border }}
                  >
                    <span className="h-full w-1/2 rounded-l-full" style={{ background: themeOption.icon.color1 }} />
                    <span
                      className="h-full w-1/2 rounded-r-full border-l"
                      style={{
                        background: themeOption.icon.color2,
                        borderColor: themeOption.icon.border,
                      }}
                    />
                  </span>
                  {t(themeOption.key)}
                </span>
                {selectedTheme === themeOption.value && <Check className="size-3.5 shrink-0" />}
              </CustomMenu.MenuItem>
            ))}
          </CustomMenu>
        </span>
      </Tooltip>

      <Tooltip tooltipContent={t("language")} position="bottom">
        <span className="inline-flex">
          <CustomMenu
            ariaLabel={t("language")}
            customButton={<Languages className="size-4" />}
            customButtonClassName={topNavigationButtonClassName}
            optionsClassName="max-h-80 w-48"
            placement="bottom-end"
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <CustomMenu.MenuItem
                key={language.value}
                onClick={() => void handleLanguageChange(language.value)}
                className="flex items-center justify-between gap-3"
              >
                {language.label}
                {selectedLanguage === language.value && <Check className="size-3.5 shrink-0" />}
              </CustomMenu.MenuItem>
            ))}
          </CustomMenu>
        </span>
      </Tooltip>
    </div>
  );
});
