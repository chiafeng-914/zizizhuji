# Firebase 設定步驟（免費方案，不需信用卡）

1. 打開 console.firebase.google.com，用 Google 帳號登入。
2. 按「建立專案」，名稱填 zizizhuji；Google Analytics 可關閉。
3. 過程中若出現「升級」「Blaze」「綁定帳單帳戶」或要求信用卡，一律略過，選擇繼續使用免費方案（Spark）。
4. 進入專案後，左側選單「Build（建構）」→「Firestore Database」→「建立資料庫」。
   - 地區：asia-east1（台灣）
   - 模式：正式版模式
5. 左上角齒輪 →「專案設定」→ 往下找「您的應用程式」→ 點 `</>` 網頁圖示 → 取名後註冊。
6. 複製畫面上的 `firebaseConfig = { ... }` 整段，貼給 Claude（這不是密碼）。

## 免費額度（2026-11 查詢官方定價頁）

- Firestore 每天：寫入 2 萬筆、讀取 5 萬筆、刪除 2 萬筆；總儲存 1 GB。
- 一個 36 人班級每天各練 10 題，大約只用到幾百筆寫入。
- 超過額度時，免費方案是「暫停服務」，不會自動扣款。

來源：https://firebase.google.com/pricing
