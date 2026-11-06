# 字字珠璣｜字音字形練習程式

給國、高中生課後自主練習字音字形的網頁程式。老師可以在後台看到全班最常錯的字，回到課堂精準補強。

網頁網址（開啟 GitHub Pages 後）：https://chiafeng-914.github.io/zizizhuji/

## 檔案說明

| 檔案 | 內容 |
| --- | --- |
| `index.html` | 網頁入口 |
| `style.css` | 介面樣式（紙感書房風格） |
| `app.js` | 練習程式 |
| `questions.js` | 題庫（第一批 100 題，待審核） |
| `firebase-config.js` | Firebase 設定（第二階段開始使用） |
| `docs/開發規格書.md` | 完整開發規格 |
| `docs/討論與決策紀錄.md` | 每次討論決定的事項與進度 |

## 技術

- 網頁：GitHub Pages
- 資料庫：Firebase（專案 words-8e4f1，Firestore，Spark 免費方案）

學生資料只存在 Firebase，不會放進這個 GitHub 儲存庫。
