# 字字珠璣｜字音字形練習程式

給國、高中生課後自主練習字音字形的網頁程式。老師可以在後台看到全班最常錯的字，回到課堂精準補強。

學生練習：https://chiafeng-914.github.io/zizizhuji/

老師專用：https://chiafeng-914.github.io/zizizhuji/teacher.html

## 檔案說明

| 檔案 | 內容 |
| --- | --- |
| `index.html` | 網頁入口 |
| `style.css` | 介面樣式（紙感書房風格） |
| `app.js` | 練習程式（登入、錯題本、五盒複習、訪客模式） |
| `db.js` | Firebase 連線 |
| `teacher.html`、`teacher.js` | 老師專用頁：建立班級、查看學生、重設密碼 |
| `firestore.rules` | Firestore 安全規則（貼到 Firebase 主控台） |
| `questions.js` | 題庫第一批 100 題（已審核） |
| `questions-classics.js` | 古文十五篇 63 題（已審核） |
| `questions-idioms.js` | 成語應用 50 題，國高中通用（已審核） |
| `questions-idiom-list.js` | 《成語精選》講義第 1～1150 則：自動產生成語釋義、看意思選成語、例句填空、讀音題（待審核） |
| `questions-idiom-typos.js` | 成語錯別字 22 題：沿用成語題的成語與例句，自動產生錯別字題（待審核） |
| `firebase-config.js` | Firebase 設定 |
| `docs/開發規格書.md` | 完整開發規格 |
| `docs/討論與決策紀錄.md` | 每次討論決定的事項與進度 |

## 技術

- 網頁：GitHub Pages
- 資料庫：Firebase（專案 words-8e4f1，Firestore，Spark 免費方案）

學生資料只存在 Firebase，不會放進這個 GitHub 儲存庫。
