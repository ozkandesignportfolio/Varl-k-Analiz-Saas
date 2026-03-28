const MOJIBAKE_MARKERS = ["Ã", "Ä", "Å", "�"];
const MOJIBAKE_PATTERN = new RegExp(MOJIBAKE_MARKERS.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));

export const REPORTS_TURKISH_SMOKE_TEXT = "Seçili tarih aralığında";

export const hasMojibakeText = (value: string) => MOJIBAKE_PATTERN.test(value);

export const assertNoMojibakeText = (value: string, context: string) => {
  if (hasMojibakeText(value)) {
    throw new Error(`${context} metni bozuk kodlandı.`);
  }
};
