/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TCalendarLayouts } from "@plane/types";
import { EStartOfTheWeek } from "@plane/types";

export const MONTHS_LIST: {
  [monthNumber: number]: {
    shortTitle: string;
    title: string;
  };
} = {
  1: {
    shortTitle: "1月",
    title: "一月",
  },
  2: {
    shortTitle: "2月",
    title: "二月",
  },
  3: {
    shortTitle: "3月",
    title: "三月",
  },
  4: {
    shortTitle: "4月",
    title: "四月",
  },
  5: {
    shortTitle: "5月",
    title: "五月",
  },
  6: {
    shortTitle: "6月",
    title: "六月",
  },
  7: {
    shortTitle: "7月",
    title: "七月",
  },
  8: {
    shortTitle: "8月",
    title: "八月",
  },
  9: {
    shortTitle: "9月",
    title: "九月",
  },
  10: {
    shortTitle: "10月",
    title: "十月",
  },
  11: {
    shortTitle: "11月",
    title: "十一月",
  },
  12: {
    shortTitle: "12月",
    title: "十二月",
  },
};

export const DAYS_LIST: {
  [dayIndex: number]: {
    shortTitle: string;
    title: string;
    value: EStartOfTheWeek;
  };
} = {
  1: {
    shortTitle: "日",
    title: "星期日",
    value: EStartOfTheWeek.SUNDAY,
  },
  2: {
    shortTitle: "一",
    title: "星期一",
    value: EStartOfTheWeek.MONDAY,
  },
  3: {
    shortTitle: "二",
    title: "星期二",
    value: EStartOfTheWeek.TUESDAY,
  },
  4: {
    shortTitle: "三",
    title: "星期三",
    value: EStartOfTheWeek.WEDNESDAY,
  },
  5: {
    shortTitle: "四",
    title: "星期四",
    value: EStartOfTheWeek.THURSDAY,
  },
  6: {
    shortTitle: "五",
    title: "星期五",
    value: EStartOfTheWeek.FRIDAY,
  },
  7: {
    shortTitle: "六",
    title: "星期六",
    value: EStartOfTheWeek.SATURDAY,
  },
};

export const CALENDAR_LAYOUTS: {
  [layout in TCalendarLayouts]: {
    key: TCalendarLayouts;
    title: string;
  };
} = {
  month: {
    key: "month",
    title: "月视图",
  },
  week: {
    key: "week",
    title: "周视图",
  },
};
