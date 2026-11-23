# Waktu Salat

Telegram Mini App: Estimated prayer times for Indonesian cities.
*Mini App Telegram: Perkiraan jadwal salat per kota di Indonesia.*

Static site, free on GitHub Pages. No server, no paid API.
*Situs statis, gratis di GitHub Pages. Tanpa server, tanpa API berbayar.*

## Live

- Site: https://kabarunnie.github.io/waktu-salat/
- After a bot exists, set the Web App URL in @BotFather so `https://t.me/<bot>/app` opens this site. There is no separate Telegram channel.

## Layout

```
app/                         ← Pages root
app/data/ads.json            ← ad / affiliate / Stars config (ids empty until you fill them)
.github/workflows/pages.yml  ← deploy ./app
```

All paths are relative, so the app works at `https://<user>.github.io/<repo>/`.

## BotFather (you do this)

1. Open @BotFather → `/newbot`
   - Nama: `Waktu Salat` · username: `@waktusalat_bot`
   - Nama: `Waktu Salat` · username: `@waktu_salat_bot`
   (If a username is taken, use the second, or another unused `*_bot` close to the name.)
2. `/newapp` → this bot → Web App URL = `https://kabarunnie.github.io/waktu-salat/` → short name `app`
3. `/setmenubutton` → this bot → same URL, label `Buka App`
4. Optional: `/setuserpic` and `/setdescription` in Bahasa Indonesia.
5. Send the bot username back if you want the Mini App link added in copy.

Do not paste the bot token in a chat. Keep it only for your own records until a later, approved setup.

## Ads, affiliates, Stars (not signed up)

Slots are already in the app but **hidden until configured**. Filling `app/data/ads.json` is enough to turn them on. Do not create accounts from this repository automatically.

Accounts you would need, later, if you want ads or paid hints:

1. **Adsgram** publisher at https://partner.adsgram.ai — platform type Telegram Mini App, then block IDs for banner (if offered), interstitial (`int-…`), and rewarded (numeric). Put them in `blockIds`.
2. **Monetag** (optional, if you switch `provider` to `monetag`) — a Mini App zone and the official script URL in `sdk.monetag`. Leave empty if unused.
3. **Shopee Affiliate** and/or **Tokopedia Affiliate** — paste your tracked URLs in `affiliates.*.url` and set `enabled` to true. No links are shown while URLs are empty.
4. **Telegram Stars** on this bot (BotFather payments / digital goods) — put the invoice slug or payload in `stars.sku` and set `stars.enabled` to true to show “Hapus iklan”. Disabled until then.

Interstitial frequency is capped (`interstitialMinIntervalMs`, default 3 minutes). Rewarded ads are only used for optional hints or extra rounds, and only after a block id is set. The prayer-time app does not show interstitials on the live countdown screen.

## Free tier only

Public repo + GitHub Pages + optional GitHub Actions. No paid services.

