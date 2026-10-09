/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { LinkItemBlock } from "@plane/ui";
// computed
import { ContentOverflowWrapper } from "@/components/core/content-overflow-HOC";
import { useHome } from "@/hooks/store/use-home";
import { EWidgetKeys, WidgetLoader } from "../loaders";
import { getVisibleDefaultQuickLinks } from "./default-links";
import { ProjectLinkDetail } from "./link-detail";
import type { TLinkOperations } from "./use-links";

export type TLinkOperationsModal = Exclude<TLinkOperations, "create">;

export type TProjectLinkList = {
  linkOperations: TLinkOperationsModal;
  workspaceSlug: string;
};

export const ProjectLinkList = observer(function ProjectLinkList(props: TProjectLinkList) {
  // props
  const { linkOperations, workspaceSlug } = props;
  // hooks
  const {
    quickLinks: { getLinksByWorkspaceId, getLinkById },
  } = useHome();

  const links = getLinksByWorkspaceId(workspaceSlug);

  if (links === undefined) return <WidgetLoader widgetKey={EWidgetKeys.QUICK_LINKS} />;

  const defaultLinks = getVisibleDefaultQuickLinks(links.flatMap((linkId) => getLinkById(linkId) ?? []));

  return (
    <div className="relative">
      <ContentOverflowWrapper
        maxHeight={150}
        containerClassName="box-border min-h-[30px] flex flex-col"
        fallback={<></>}
        buttonClassName="bg-surface-2/20"
      >
        <div className="mb-2 flex flex-1 flex-wrap gap-2">
          {defaultLinks.map((link) => (
            <LinkItemBlock
              key={link.url}
              title={link.title}
              url={link.url}
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
            />
          ))}
          {links.map((linkId) => (
            <ProjectLinkDetail key={linkId} linkId={linkId} linkOperations={linkOperations} />
          ))}
        </div>
      </ContentOverflowWrapper>
    </div>
  );
});
