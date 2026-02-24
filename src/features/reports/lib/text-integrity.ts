const MOJIBAKE_PREFIX_CHARS = [195, 196, 197].map((codePoint) => String.fromCharCode(codePoint)).join("");
const MOJIBAKE_PATTERN = new RegExp(`[${MOJIBAKE_PREFIX_CHARS}].`);

export const REPORTS_TURKISH_SMOKE_TEXT = "Seçili tarih aralığında";

export const assertNoMojibakeText = (value: string, context: string) => {
  if (MOJIBAKE_PATTERN.test(value)) {
    throw new Error(`${context} metni bozuk kodlandı: ${value}`);
  }
};
