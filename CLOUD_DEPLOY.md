# ☁️ Zomin FastFood Hub — Cloudga Joylashtirish (Deployment Guide)

Ushbu loyihani bulutli xostinglarga (Render, Railway, Fly.io yoki Docker orqali ixtiyoriy VPS serverga) joylashtirish bo'yicha to'liq qo'llanma.

---

## 🚀 1-Variant: Render.com (Eng oson va 100% Bepul)

Render.com da loyihani 3 daqiqada ishga tushirish mumkin:

1. **GitHub ga yuklash**:
   Loyihani o'zingizning GitHub hisobingizga yuklang (`git push origin main`).

2. **Render.com da yangi Web Service ochish**:
   - [Render.com](https://render.com) ga kiring va **"New +"** $\rightarrow$ **"Web Service"** tugmasini bosing.
   - GitHub omboringizni (repository) tanlang.

3. **Sozlamalarni kiritish**:
   - **Name**: `zomin-fastfood`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`

4. **Environment Variables (Atrof-muhit o'zgaruvchilari)**:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = `(ixtiyoriy uzun maxfiy kalit so'z)`
   - `ADMIN_DEFAULT_PASSWORD` = `admin123` (yoki o'zingizning parolingiz)
   - `BOT_TOKEN` = `(Telegram BotFather bergan token, agar bot ishlatmoqchi bo'lsangiz)`
   - `ADMIN_CHAT_ID` = `(Telegram buyurtmalar guruhi ID raqami)`

5. **Deploy qilish**:
   **"Deploy Web Service"** tugmasini bosing. Render avtomatik tarzda serverni o'rnatib, sizga doimiy havola (`https://zomin-fastfood.onrender.com`) beradi.

---

## 🚅 2-Variant: Railway.app

1. [Railway.app](https://railway.app) ga kiring.
2. **"New Project"** $\rightarrow$ **"Deploy from GitHub repo"** ni tanlang.
3. Loyihada tayyor `railway.json` mavjud bo'lgani uchun, Railway avtomatik tarzda sozlamalarni aniqlaydi va bir zumda ishga tushiradi.
4. **Variables** bo'limida `JWT_SECRET`, `BOT_TOKEN` kabilarni kiriting.

---

## 🐳 3-Variant: Docker & Docker Compose (VPS / Server uchun)

Agar o'zingizning Ubuntu / Debian VPS serveringiz bo'lsa:

1. Loyihani serverga nusxalang:
   ```bash
   git clone <repo-url> zomin_fastfood
   cd zomin_fastfood
   ```

2. `.env` faylini yarating:
   ```bash
   cp .env.example .env
   # .env faylini tahrirlab kerakli parametrlarni yozing:
   nano .env
   ```

3. Docker orqali ishga tushiring:
   ```bash
   docker-compose up -d --build
   ```

4. Server holatini tekshirish:
   ```bash
   curl http://localhost:3000/health
   # Natija: {"status":"ok","service":"zomin-fastfood-api",...}
   ```

---

## 🛡 Tizim Rollari va Standart Loginlar

Tizim birinchi marta ishga tushganda SQLite ma'lumotlar bazasida 4 ta xodim avtomatik yaratiladi:

| Rol | Login | Parol | Huquqlari |
| :--- | :--- | :--- | :--- |
| **🛡 Administrator** | `admin` | `admin123` | Barcha bo'limlar, Moliyaviy kassa hisoboti, Xodimlar boshqaruvi, Taomlar tahrirlash |
| **👨‍🍳 Oshpaz (KDS)** | `oshpaz` | `oshpaz123` | Oshxona monitori, Taomlarni pishirishga olish va tayyor qilish |
| **🛵 Kuryer** | `kuryer` | `kuryer123` | Yetkazish portali, Xarita navigatsiyasi, Qo'ng'iroq qilish, Topshirish |
| **👔 Kassir / Zal** | `kassir` | `kassir123` | Stol zakazlarini olish, Ofitsiant paneli |

---

## 🌐 Kirish Manzillari

* 🌐 **Mijozlar Veb-sayti**: `http://localhost:3000`
* 🔑 **Xodimlar Tizimga Kirish (Login)**: `http://localhost:3000/login.html`
* 🛡 **Admin Boshqaruv Paneli**: `http://localhost:3000/admin.html`
* 👨‍🍳 **Oshxona Monitori (KDS)**: `http://localhost:3000/kitchen.html`
* 🛵 **Kuryer Yetkazish Portali**: `http://localhost:3000/courier.html`
* 🍽 **Ofitsiant / Zal Portali**: `http://localhost:3000/waiter.html`
* 🩺 **Cloud Salomatlik Tekshiruvi**: `http://localhost:3000/health`
