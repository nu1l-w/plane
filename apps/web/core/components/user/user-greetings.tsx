/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane types
// hooks
import type { IUser } from "@plane/types";
import { useCurrentTime } from "@/hooks/use-current-time";
// types

export interface IUserGreetingsView {
  user: IUser;
}

function getDisplayValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue && !["null", "undefined"].includes(normalizedValue.toLowerCase()) ? normalizedValue : "";
}

export function UserGreetingsView(props: IUserGreetingsView) {
  const { user } = props;
  // current time hook
  const { currentTime } = useCurrentTime();
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: user?.user_timezone,
    hour12: false,
    hour: "numeric",
  }).format(currentTime);

  const dateTime = new Intl.DateTimeFormat("zh-CN", {
    timeZone: user?.user_timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(currentTime);

  const greeting = parseInt(hour, 10) < 12 ? "morning" : parseInt(hour, 10) < 18 ? "afternoon" : "evening";
  const greetingText = greeting === "morning" ? "早上好" : greeting === "afternoon" ? "下午好" : "晚上好";
  const displayName =
    [getDisplayValue(user?.first_name), getDisplayValue(user?.last_name)].filter(Boolean).join(" ") ||
    getDisplayValue(user?.display_name) ||
    getDisplayValue(user?.username);

  return (
    <div className="my-6 flex flex-col items-center">
      <h2 className="text-center text-20 font-semibold">
        {greetingText}，{displayName}
      </h2>
      <h5 className="flex items-center gap-2 font-medium text-placeholder">
        <div>{greeting === "morning" ? "🌤️" : greeting === "afternoon" ? "🌥️" : "🌙️"}</div>
        <div>{dateTime}</div>
      </h5>
    </div>
  );
}
