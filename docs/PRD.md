# AssetCare PRD (MVP v1.1)

## 1) Belge Amacı
Bu belge AssetCare MVP ürününün güncel kapsamını, hedefini, deneme planı sınırlarını ve yol haritasını sade biçimde tanımlar.

## 2) Ürün Özeti
AssetCare; kullanıcıların varlık, bakım, servis ve belge süreçlerini tek panelden takip etmesini sağlayan web tabanlı SaaS üründür.

Temel değer:
- Bakım tarihlerini kaçırmamak
- Garanti süresini takip etmek
- Servis ve fatura belgelerini tek yerde saklamak

## 3) Mevcut Durum (23 Şubat 2026)
Uygulamada çalışan ana modüller:
- Kimlik doğrulama (kayıt, giriş, oturum koruması)
- Varlık yönetimi
- Bakım kuralı ve sonraki bakım tarihi hesaplama
- Servis kayıtları
- Belge yükleme ve listeleme
- Dashboard, timeline, maliyet görünümü
- PDF rapor alma
- Abonelik ve fatura takip modülü (MVP düzeyi)

Tamamlanmamış / iyileştirme gerektiren alanlar:
- Final hardening (kritik E2E, izleme, backup drill)
- CI içine ek güvenlik testlerinin tam entegrasyonu
- Canlı sonrası 7 günlük stabilite izleme disiplini

## 4) Hedef
MVP hedefi:
- Kullanıcıya ilk 10 dakika içinde değer göstermek
- Bakım ve garanti riskini görünür kılmak
- Varlık + belge + abonelik/fatura takibini tek uygulamada birleştirmek

Başarı metrikleri (hedef):
- `signup_to_asset_rate` >= %60
- `asset_to_rule_rate` >= %70
- `d7_retention` >= %25

## 5) Deneme Planı (Free Plan) Limitleri
Free plan sınırları açık, net ve sistem tarafından zorunlu olarak uygulanır:

- En fazla 3 varlık
- En fazla 5 belge
- En fazla 3 abonelik
- En fazla 5 fatura

Kurallar:
- Limitler backend seviyesinde enforce edilir.
- Limit aşıldığında kullanıcıya anlamlı hata mesajı gösterilir.
- Premium plana geçildiğinde limitler kaldırılır veya artırılır (fiyatlandırma politikasına bağlı).

Türkçe karakterlerin tamamı UTF-8 standardına uygun olmalıdır.
Bozuk karakter (mojibake) kesinlikle kabul edilmez.

## 6) Kapsam Dışı (MVP)
MVP kapsamında olmayanlar:
- WhatsApp bildirimleri: yok
- SMS bildirimleri: yok
- IoT cihaz entegrasyonu
- OCR / gelişmiş belge otomasyonu
- Çoklu kullanıcı/ekip paylaşımı

Bildirim kanalı MVP'de:
- Uygulama içi durum görünümü
- E-posta (varsa etkin)
- Push bildirim (varsa etkin)

## 7) Türkçe Karakter Standardı
Dokümantasyon ve kullanıcıya görünen metinlerde standart:
- Kodlama: UTF-8
- Türkçe karakterler doğru kullanılmalı (`ç, ğ, ı, İ, ö, ş, ü`)
- Bozuk karakter (mojibake) kabul edilmez
- Dosya adlarında mümkün olduğunca ASCII tercih edilir, içerikte doğru Türkçe zorunludur

## 8) Yol Haritası
### Faz 1: MVP Stabilizasyon (kısa vade)
- Playwright ile kritik kullanıcı akışlarının E2E otomasyonu
- RLS negatif testlerinin CI entegrasyonu
- Temel gözlemlenebilirlik (hata izleme ve alarm)

### Faz 2: Operasyonel Güven (orta vade)
- Gerçek cihazlarda PWA kurulum ve offline/online test turu
- Yedekleme ve geri dönüş tatbikatı
- Canlı sonrası P0/P1 hata yönetimi ve kök neden raporu

### Faz 3: Büyüme (sonraki vade)
- Paketleme/fiyatlandırma netleştirme
- Free -> Premium dönüşüm optimizasyonu
- Kullanım analitiğine göre onboarding ve aktivasyon iyileştirmeleri

## 9) Çıkış Kriterleri (MVP)
MVP "yayına hazır" sayılması için:
- Auth + varlık + bakım + servis + belge + abonelik/fatura akışları çalışır
- RLS ve storage izolasyonu doğrulanır
- Kritik hatalar (P0/P1) kapatılır
- Deneme planı limitleri sistemde aktif olur
