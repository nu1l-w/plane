/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
// ui
import { useParams } from "next/navigation";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AlertModalCore } from "@plane/ui";
import { getPageName } from "@plane/utils";
// constants
// plane web hooks
import { useAppRouter } from "@/hooks/use-app-router";
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type TConfirmPageDeletionProps = {
  isOpen: boolean;
  onClose: () => void;
  page: TPageInstance;
  storeType: EPageStoreType;
};

export const DeletePageModal = observer(function DeletePageModal(props: TConfirmPageDeletionProps) {
  const { isOpen, onClose, page, storeType } = props;
  const { t } = useTranslation();
  // states
  const [isDeleting, setIsDeleting] = useState(false);
  // store hooks
  const { removePage } = usePageStore(storeType);

  // derived values
  const { id: pageId, name } = page;

  const handleClose = () => {
    setIsDeleting(false);
    onClose();
  };

  const router = useAppRouter();
  const { pageId: routePageId } = useParams();

  const handleDelete = async () => {
    if (!pageId) return;
    setIsDeleting(true);
    try {
      await removePage({ pageId });
      handleClose();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("page_delete.toasts.success.title"),
        message: t("page_delete.toasts.success.message"),
      });

      if (routePageId) {
        router.back();
      }
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("page_delete.toasts.error.title"),
        message: t("page_delete.toasts.error.message"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!page || !page.id) return null;

  return (
    <AlertModalCore
      handleClose={handleClose}
      handleSubmit={handleDelete}
      isSubmitting={isDeleting}
      isOpen={isOpen}
      title={t("page_delete.title")}
      primaryButtonText={{ default: t("common.delete"), loading: t("common.deleting") }}
      secondaryButtonText={t("common.cancel")}
      content={
        <>
          {t("page_delete.confirm_before_name")}
          <span className="font-medium break-words break-all text-primary">{getPageName(name)}</span>
          {t("page_delete.confirm_after_name")}
        </>
      }
    />
  );
});
