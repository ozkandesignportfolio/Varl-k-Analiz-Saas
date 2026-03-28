export type IntervalUnit = "day" | "week" | "month" | "year";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnly = (value: string) => {
  if (!DATE_REGEX.test(value)) {
    throw new Error("Geçersiz tarih formatı.");
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!year || !month || !day) {
    throw new Error("Geçersiz tarih değeri.");
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Tarih değeri geçersiz.");
  }

  return date;
};

const toDateInputValue = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addMonthsClamped = (source: Date, monthsToAdd: number) => {
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();

  const firstDayOfTargetMonth = new Date(Date.UTC(year, month + monthsToAdd, 1));
  const targetYear = firstDayOfTargetMonth.getUTCFullYear();
  const targetMonth = firstDayOfTargetMonth.getUTCMonth();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
};

export const calculateNextDueDate = ({
  baseDate,
  intervalValue,
  intervalUnit,
}: {
  baseDate: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
}) => {
  const safeIntervalValue = Number(intervalValue);
  if (!Number.isInteger(safeIntervalValue) || safeIntervalValue <= 0) {
    throw new Error("Interval değeri pozitif bir tam sayı olmalı.");
  }

  const source = toDateOnly(baseDate);
  const result = new Date(source);

  if (intervalUnit === "day") {
    result.setUTCDate(result.getUTCDate() + safeIntervalValue);
  } else if (intervalUnit === "week") {
    result.setUTCDate(result.getUTCDate() + safeIntervalValue * 7);
  } else if (intervalUnit === "month") {
    return toDateInputValue(addMonthsClamped(result, safeIntervalValue));
  } else if (intervalUnit === "year") {
    return toDateInputValue(addMonthsClamped(result, safeIntervalValue * 12));
  } else {
    throw new Error("Desteklenmeyen interval birimi.");
  }

  return toDateInputValue(result);
};

export const todayDateInputValue = () => toDateInputValue(new Date());


