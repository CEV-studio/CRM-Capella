/** Prepare imported French numbers for display and calling without changing stored data. */
export function telephone(value: string | null | undefined): { label: string; href: string } | null {
  const raw = value?.trim();
  if (!raw || !/^[+\d\s()./-]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  let number = raw.startsWith("+") ? `+${digits}` : digits.startsWith("00") ? `+${digits.slice(2)}` : digits;
  if (/^[1-9]\d{8}$/.test(number)) number = `0${number}`;
  if (/^\+33[1-9]\d{8}$/.test(number)) number = `0${number.slice(3)}`;
  return { label: number, href: `tel:${number}` };
}
