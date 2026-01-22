/**
 * Date 객체를 YYYY-MM-DD 형식의 문자열로 변환합니다.
 * @param date - 변환할 Date 객체
 * @returns YYYY-MM-DD 형식의 문자열
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
