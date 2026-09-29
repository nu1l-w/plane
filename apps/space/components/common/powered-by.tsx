/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type TPoweredBy = {
  disabled?: boolean;
};

export function PoweredBy(props: TPoweredBy) {
  // props
  const { disabled = false } = props;

  if (disabled) return null;

  return <div className="fixed right-5 bottom-2.5 !z-[999999] text-11 text-secondary">星轴科技研发管理平台</div>;
}
