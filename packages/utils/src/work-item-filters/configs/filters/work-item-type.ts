/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TFilterProperty, TProjectWorkItemType, TSupportedOperators } from "@plane/types";
import { COLLECTION_OPERATOR, EQUALITY_OPERATOR } from "@plane/types";
import type { IFilterIconConfig, TCreateFilterConfig, TCreateFilterConfigParams } from "../../../rich-filters";
import { createFilterConfig, createOperatorConfigEntry, getMultiSelectConfig } from "../../../rich-filters";

export type TCreateWorkItemTypeFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<TProjectWorkItemType> & {
    workItemTypes: TProjectWorkItemType[];
  };

const getWorkItemTypeMultiSelectConfig = (
  params: TCreateWorkItemTypeFilterParams,
  singleValueOperator: TSupportedOperators
) =>
  getMultiSelectConfig<TProjectWorkItemType, string, TProjectWorkItemType>(
    {
      items: params.workItemTypes,
      getId: (workItemType) => workItemType.issue_type,
      getLabel: (workItemType) => workItemType.work_item_type.name,
      getValue: (workItemType) => workItemType.issue_type,
      getIconData: (workItemType) => workItemType,
    },
    {
      singleValueOperator,
      ...params,
    },
    {
      getOptionIcon: params.getOptionIcon,
    }
  );

export const getWorkItemTypeFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateWorkItemTypeFilterParams> =>
  (params: TCreateWorkItemTypeFilterParams) =>
    createFilterConfig<P>({
      id: key,
      label: params.label ?? "Work item type",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getWorkItemTypeMultiSelectConfig(updatedParams, EQUALITY_OPERATOR.EXACT)
        ),
      ]),
    });
