/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { PROJECT_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ListTodo } from "lucide-react";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsPageHeader } from "@/components/settings/page-header";

export const WorkItemTypesProjectSettingsHeader = observer(function WorkItemTypesProjectSettingsHeader() {
  const { t } = useTranslation();
  const settingsDetails = PROJECT_SETTINGS.work_item_types;

  return (
    <SettingsPageHeader
      leftItem={
        <BreadcrumbLink label={t(settingsDetails.i18n_label)} icon={<ListTodo className="size-4 text-tertiary" />} />
      }
    />
  );
});
