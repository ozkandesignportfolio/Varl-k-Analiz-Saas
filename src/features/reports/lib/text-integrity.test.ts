import assert from "node:assert/strict";
import test from "node:test";
import { REPORTS_TURKISH_SMOKE_TEXT, assertNoMojibakeText, hasMojibakeText } from "./text-integrity";

test("report smoke text stays valid Turkish", () => {
  assert.equal(REPORTS_TURKISH_SMOKE_TEXT, "Seçili tarih aralığında");
  assert.equal(hasMojibakeText(REPORTS_TURKISH_SMOKE_TEXT), false);
  assert.doesNotThrow(() => assertNoMojibakeText(REPORTS_TURKISH_SMOKE_TEXT, "Raporlar duman testi"));
});

test("mojibake guard rejects corrupted Turkish text without echoing the payload", () => {
  const corrupted = "SeÃ§ili tarih aralÄ±ÄŸÄ±nda";

  assert.equal(hasMojibakeText(corrupted), true);
  assert.throws(
    () => assertNoMojibakeText(corrupted, "PDF duman testi"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "PDF duman testi metni bozuk kodlandı.");
      assert.equal(error.message.includes(corrupted), false);
      return true;
    },
  );
});
