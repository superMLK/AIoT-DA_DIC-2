# 驗收紀錄（2026-10-14）

驗收環境：macOS、Chrome。自動化測試使用 Vitest（`npm run test`，8 個測試檔、87 個測試）；瀏覽器驗收透過 Claude in Chrome 實際操作頁面完成。

## 自動化（與 statsmodels／scikit-learn／scipy 的標準答案比對）

| 項目 | 結果 |
|---|---|
| t／F 分布（雙尾 p、CDF、0.975 分位數、F 右尾） | 通過，相對誤差 < 1e-9 |
| OLS：β、SE、t、p、CI、s、R²、Adjusted R²、F 與 p、VIF、預測區間、r（tiny、50 Startups、Boston、Boston+B） | 通過，相對誤差 < 1e-6 |
| 測試指標 RMSE、MAE、Test R² | 通過，相對誤差 < 1e-9 |
| Lasso／ElasticNet 的 α 網格與進場順序、SFS 順序、RFE 各 k、Exhaustive 各 k | 與 sklearn 完全一致 |
| 完整管線：各方法 × 各 k 的入選特徵、測試指標、5 折 CV RMSE | 通過（CV 的相對誤差 < 1e-8） |
| 無資料洩漏：改動測試集的 y 不影響任何選擇與 CV | 通過 |
| 只採用最新請求的結果（回應亂序抵達） | 通過 |
| 效能：Boston（p=12）約 330 ms、Boston+B（p=13）約 440 ms | 通過（< 1 秒） |

## 瀏覽器手動驗收

| Spec | 情境 | 結果 |
|---|---|---|
| dataset-loading | 首次開啟載入 50 Startups，y = Profit | 通過 |
| dataset-loading | 切換 Boston：B 欄未勾選並附倫理說明，p=12；勾回 B 並套用後 p=13、k 為 1~13 | 通過 |
| dataset-loading | GitHub blob 網址自動改為 raw，並顯示提示 | 通過（plotly/datasets 的 auto-mpg.csv） |
| dataset-loading | 外部 CSV 的缺值整列刪除（398 → 396），可在面板更換 y 並套用 | 通過 |
| dataset-loading | CORS 失敗：白話說明、出現上傳區，原資料與結果保留 | 通過（example.com） |
| dataset-loading | 本機上傳：分號分隔、引號內千分位、類別欄編碼 | 通過（以 DataTransfer 模擬上傳） |
| regression-engine | 50 Startups 預設切分 40／10；State 編碼為兩個 dummy，參考組為 California | 通過 |
| feature-selection | k 在切到 p 較小的資料集時自動夾限（12 → 5）；OLS 基準時停用 k | 通過 |
| results-presentation | 熱圖數值與 pandas `corr()` 一致（抽查 4 格） | 通過 |
| results-presentation | OLS 基準係數表與 fixture 一致 | 通過 |
| results-presentation | 比較模式：疊圖（同心標記區分重疊的方法）、Test/CV 切換、比較表標註「與 X 相同」、標示 CV 最低、點選列切換細節 | 通過 |
| results-presentation | 單一方法模式：Test 與 CV 兩條線、OLS 水平虛線、目前 k 標示 | 通過 |
| live-predictor | 未使用欄位淡化並標示；部分 dummy 時提示「California 與 New York 等價」；外插提示；截距加貢獻等於預測值 | 通過 |
| page-shell | 六個階段的順序、側邊導覽隨捲動標示、吸頂控制列（含從底部直接跳回頂端時會隱藏） | 通過 |
| page-shell | 深色模式：手動切換後存到 localStorage，圖表與熱圖隨主題變色 | 通過 |
| page-shell | 360px 寬（以 iframe 模擬）：整頁無水平捲動，寬表格在自己的容器內捲動 | 通過 |
| page-shell | `vite preview --base /repo/` 子路徑部署：所有資源 200、主控台無錯誤 | 通過 |

## 驗收過程中發現並修正的問題

- 比較模式下，選到相同特徵的方法曲線完全重疊而被蓋住。改成同心標記：越下層的方法標記越大。
- 從頁面底部直接跳回頂端時，吸頂控制列不會消失（IntersectionObserver 不會觸發）。改用捲動位置判斷。
- 手機寬度下，吸頂控制列折成兩行後沒有完全隱藏，頁首按鈕也被擠成直排；精簡控制列改成 k 在最前面。
- F 檢定卡片的 p 值格式改為「p < .001」。

## 已知限制

- 主程式 bundle 約 720 kB（gzip 後 231 kB），主要來自 KaTeX、Chart.js 與 React；Vite 會顯示 chunk 大小警告。
- 未在實體手機與 Safari 上測試；360px 是以 iframe 模擬。
- 實際推送到 GitHub、啟用 Pages 這些對外操作尚未執行。
