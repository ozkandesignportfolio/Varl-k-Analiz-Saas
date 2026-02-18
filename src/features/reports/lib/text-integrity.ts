const MOJIBAKE_PATTERN = /Ã.|Ä.|Å./;

export const REPORTS_TURKISH_SMOKE_TEXT = "Seçili tarih aralığında";

export const assertNoMojibakeText = (value: string, context: string) => {
  if (MOJIBAKE_PATTERN.test(value)) {
    throw new Error(`${context} metni bozuk kodlandi: ${value}`);
  }
};
