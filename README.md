# CXO Woman 活動提案與報名網站

這是一個獨立網站，用來管理女創會員活動提案、後台審核、會員報名與 Gmail 自動通知。

## 功能

- 女創會員提交活動提案、文案、日期、時間、名額、費用與圖片
- 管理後台審核提案，可核准或退回
- 核准後自動產生活動報名頁
- 會員填寫報名資料
- 後台查看每場活動報名名單
- 匯出 CSV 報名資料
- 直接在「網站設定」修改網站名稱、首頁文字、品牌色、主視覺與 Email 公版內容
- Supabase 雲端活動提案與會員報名資料
- Gmail 自動確認信與排程提醒
- 管理員與夥伴個別 Email 帳號登入

## 開啟方式

直接打開 `index.html`，或用本機伺服器開啟此資料夾。

開啟後點選右上方的「網站設定」，修改內容並按「儲存網站設定」。
連接 Supabase 後，網站設定會同步到雲端；尚未連接時會先保存在同一個瀏覽器的 `localStorage`。

## 本機展示登入

- 帳號：`admin@example.com`
- 密碼：`cxo2026`

尚未填寫 `config.js` 時會使用這組展示帳密。連接 Supabase 後，改用 Supabase
Authentication 建立的個別 Email 與密碼。

正式雲端設定請閱讀 `CLOUD_SETUP.md`。

後續維護、修改位置、上線流程與已完成設定紀錄請閱讀 `MAINTENANCE_NOTES.md`。

## 維護重點

- 前端公開頁：`index.html`、`styles.css`、`script.js`
- Supabase SQL：`supabase/migrations/`
- Supabase Edge Functions：`supabase/functions/`
- 修改紀錄與上線流程：`MAINTENANCE_NOTES.md`
