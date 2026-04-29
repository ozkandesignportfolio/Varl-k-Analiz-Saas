/**
 * Normalizes known broken Turkish system-generated text to correct characters.
 *
 * This helper is designed ONLY for system-generated messages (timeline titles,
 * status headlines, alert descriptions). It must NOT be applied blindly to
 * user-entered content like asset names.
 *
 * The replacements are word-boundary-safe and case-sensitive to avoid false
 * positives. Each entry represents a known broken pattern from the database
 * RPC function `get_dashboard_snapshot` or automation event payloads.
 */

type ReplacementEntry = readonly [pattern: RegExp, replacement: string];

const REPLACEMENTS: ReplacementEntry[] = [
  // --- Timeline event titles ---
  [/\bServis kaydi eklendi\b/g, "Servis kaydı eklendi"],
  [/\bBelge yuklendi\b/g, "Belge yüklendi"],
  [/\bBakim kurali olusturuldu\b/g, "Bakım kuralı oluşturuldu"],
  [/\bOdeme islendi\b/g, "Ödeme işlendi"],

  // --- Status headlines ---
  [/\bgecikmis bakim\b/g, "gecikmiş bakım"],
  [/\bgecikmis odeme\b/g, "gecikmiş ödeme"],
  [/\bBakim kurali eksik\b/g, "Bakım kuralı eksik"],
  [/\bHer sey yolunda\b/g, "Her şey yolunda"],

  // --- Status detail messages ---
  [/\bveri geldikce otomatik guncellenecek\b/g, "veri geldikçe otomatik güncellenecek"],
  [/\bBakim takvimi plani gerisinde\b/g, "Bakım takvimi planı gerisinde"],
  [/\bHemen aksiyon alin\b/g, "Hemen aksiyon alın"],
  [/\bFinans kayitlari gecikmede\b/g, "Finans kayıtları gecikmede"],
  [/\bVade durumunu kontrol edin\b/g, "Vade durumunu kontrol edin"],
  [/\bVarliklar icin en az bir bakim kurali tanimlayarak riski azaltin\b/g, "Varlıklar için en az bir bakım kuralı tanımlayarak riski azaltın"],
  [/\bYaklasan takvimler icin onleyici adim alinmasi onerilir\b/g, "Yaklaşan takvimler için önleyici adım alınması önerilir"],
  [/\bKritik veya yaklasan risk kaydi su an bulunmuyor\b/g, "Kritik veya yaklaşan risk kaydı şu an bulunmuyor"],

  // --- Common fallback asset name ---
  [/\bBilinmeyen Varlik\b/g, "Bilinmeyen Varlık"],

  // --- Individual broken words (catch-all for edge cases) ---
  [/\bSistem Akisi\b/g, "Sistem Akışı"],
  [/\bGosterge\b/g, "Gösterge"],
  [/\bGaranti suresi\b/g, "Garanti süresi"],
  [/\bolusturuldu\b/g, "oluşturuldu"],
  [/\bguncellendi\b/g, "güncellendi"],
  [/\bbasarili\b/g, "başarılı"],
  [/\bbasarisiz\b/g, "başarısız"],
  [/\byuklendi\b/g, "yüklendi"],
  [/\bbaglanti\b/g, "bağlantı"],
  [/\boncelik\b/g, "öncelik"],
  [/\bcikis\b/g, "çıkış"],
  [/\bislem\b/g, "işlem"],
  [/\buyari\b/g, "uyarı"],
  [/\bkayit\b/g, "kayıt"],
];

export function normalizeTurkishDisplayText(text: string): string {
  if (!text) return text;

  let result = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
