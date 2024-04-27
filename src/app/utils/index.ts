import dayjs from "dayjs";

/**
 * 주어진 값이 논리적인(JS 문법이 아닌) Empty 상태인지 반환합니다.
 * @param {unknown} value - 검사값
 * @returns {Boolean} value의 값이 논리적인 Empty 상태인가?
 */
export const isEmpty = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

export function formatTime(time: string, format: string = "YYYY-MM-DD HH:mm") {
  return dayjs(time).format(format);
}
