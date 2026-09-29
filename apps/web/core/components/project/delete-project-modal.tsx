/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
// Plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IProject } from "@plane/types";
import { Input, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";

type DeleteProjectModal = {
  isOpen: boolean;
  project: IProject;
  onClose: () => void;
};

const defaultValues = {
  projectName: "",
  confirmDelete: "",
};

export function DeleteProjectModal(props: DeleteProjectModal) {
  const { isOpen, project, onClose } = props;
  // store hooks
  const { deleteProject } = useProject();
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  // form info
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    watch,
  } = useForm({ defaultValues });

  const canDelete = watch("projectName") === project?.name && watch("confirmDelete") === "删除项目";

  const handleClose = () => {
    const timer = setTimeout(() => {
      reset(defaultValues);
      clearTimeout(timer);
    }, 350);

    onClose();
  };

  const onSubmit = async () => {
    if (!workspaceSlug || !canDelete) return;

    try {
      await deleteProject(workspaceSlug.toString(), project.id);
      if (projectId && projectId.toString() === project.id) router.push(`/${workspaceSlug}/projects`);
      handleClose();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "删除成功",
        message: "项目已删除。",
      });
    } catch (_error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "删除失败",
        message: "发生错误，请稍后重试。",
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 p-6">
        <div className="flex w-full items-center justify-start gap-6">
          <span className="place-items-center rounded-full bg-danger-subtle p-4">
            <AlertTriangle className="h-6 w-6 text-danger-primary" aria-hidden="true" />
          </span>
          <span className="flex items-center justify-start">
            <h3 className="text-18 font-medium 2xl:text-20">删除项目</h3>
          </span>
        </div>
        <span>
          <p className="text-13 leading-7 text-secondary">
            确定要删除项目 <span className="font-semibold break-words">{project?.name}</span> 吗？
            与该项目相关的全部数据将被永久删除，此操作无法撤销。
          </p>
        </span>
        <div className="text-secondary">
          <p className="text-13 break-words">
            输入项目名称 <span className="font-medium text-primary">{project?.name}</span> 以继续：
          </p>
          <Controller
            control={control}
            name="projectName"
            render={({ field: { value, onChange, ref } }) => (
              <Input
                id="projectName"
                name="projectName"
                type="text"
                value={value}
                onChange={onChange}
                ref={ref}
                hasError={Boolean(errors.projectName)}
                placeholder="项目名称"
                className="mt-2 w-full"
                autoComplete="off"
              />
            )}
          />
        </div>
        <div className="text-secondary">
          <p className="text-13">
            如需确认，请在下方输入 <span className="font-medium text-primary">删除项目</span>：
          </p>
          <Controller
            control={control}
            name="confirmDelete"
            render={({ field: { value, onChange, ref } }) => (
              <Input
                id="confirmDelete"
                name="confirmDelete"
                type="text"
                value={value}
                onChange={onChange}
                ref={ref}
                hasError={Boolean(errors.confirmDelete)}
                placeholder="输入“删除项目”"
                className="mt-2 w-full"
                autoComplete="off"
              />
            )}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="lg" onClick={handleClose}>
            取消
          </Button>
          <Button variant="error-fill" size="lg" type="submit" disabled={!canDelete} loading={isSubmitting}>
            {isSubmitting ? "正在删除" : "删除项目"}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
}
