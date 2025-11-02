// 补零函数：确保数字为两位数（如 9 → "09"，12 → "12"）
export const padZero = (num: number) => {
  return num < 10 ? '0' + num : num.toString();
}
