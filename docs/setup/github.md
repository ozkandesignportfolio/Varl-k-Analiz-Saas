# GitHub Bağlantısı

Bu ortamda `git` araci kurulu olmadığı için remote bağlantısı komutlari manuel olarak asagida verilmiştir.

## 1) Git baslatma
```bash
git init
git add .
git commit -m "chore: bootstrap Assetly MVP"
```

## 2) GitHub remote ekleme
```bash
git remote add origin https://github.com/<kullanıcı>/<repo>.git
git branch -M main
git push -u origin main
```

## 3) Secrets (CI için)
GitHub repo `Settings > Secrets and variables > Actions`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`


