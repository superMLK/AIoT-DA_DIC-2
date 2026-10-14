# Tasks

## 1. 專案骨架

- [x] 1.1 執行 `git init`，並建立 `.gitignore`（排除 node_modules、dist、.venv）；驗證：`git status` 可以正常執行，且不會列出 node_modules
- [x] 1.2 以 Vite 的 React + TypeScript 範本建立專案，加入 Vitest、Chart.js、PapaParse、KaTeX 相依；在 `vite.config.ts` 設定 `base: './'`；驗證：`npm run build` 成功，`npm run test` 能跑完一個佔位測試
- [x] 1.3 依 design D9 建立 `src/engine`、`src/data`、`src/worker`、`src/state`、`src/components`、`src/styles`、`tools/oracle`、`tests/fixtures` 目錄；驗證：`npx tsc --noEmit` 無錯誤

## 2. 內建資料與標準答案工具

- [x] 2.1 取得 50 Startups 與 Boston Housing 的 CSV，放到 `public/datasets/`，並在 `public/datasets/SOURCES.md` 記錄出處與授權；驗證：50 Startups 有 50 列 5 欄，Boston 有 506 列 14 欄
- [x] 2.2 以 uv 建立 `tools/oracle`，相依 numpy、pandas、scipy、scikit-learn、statsmodels；驗證：`uv run python -c "import sklearn, statsmodels"` 成功
- [x] 2.3 撰寫 `oracle.py`：讀取 `tests/fixtures/*.input.json`（資料、切分索引、特徵子集、α 網格），輸出 `*.expected.json`，內容包含 OLS 推論、VIF、預測區間、測試指標、Lasso/EN 進場順序、RFE 入選特徵、t/F 分布參考值；驗證：對一個手寫的小型 input 執行後，產出的 JSON 欄位齊全
- [x] 2.4 在 README 說明如何重新產生 fixtures（`npm run oracle`）；驗證：照著 README 的指令操作可以重現 fixtures

## 3. 數值引擎核心（線性代數、分布、OLS）

- [x] 3.1 實作 `distributions.ts`（log-gamma、正規化不完全 beta、t 與 F 的 CDF、t 的反函數）；驗證：與 scipy 參考表比對，相對誤差小於 1e-9，極小值的絕對誤差小於 1e-12
- [x] 3.2 實作 `linalg.ts`（Householder QR、上三角求解、R⁻¹、秩判定、Cholesky）；驗證：單元測試涵蓋可逆矩陣、秩不足矩陣，以及 Cholesky 失敗的回報
- [x] 3.3 實作 `ols.ts`：β、SE、t、p、CI、s、R²、Adjusted R²、F 與 p 值、(XᵀX)⁻¹、無法估計的判定；驗證：50 Startups 全特徵 fixture 的各項相對誤差小於 1e-6，n−k−1 ≤ 0 與完全共線兩種案例回傳「無法估計」，且能指出共線的特徵
- [x] 3.4 實作 VIF、預測區間、標準化預測殘差 r；驗證：與 statsmodels 的 VIF 及 `obs_ci_lower`/`obs_ci_upper` 相對誤差小於 1e-6，k=1 時 VIF 為不適用
- [x] 3.5 實作測試集指標（RMSE、MAE、Test R²）；驗證：與 sklearn 的相對誤差小於 1e-9

## 4. 資料處理（解析、清理、編碼、切分）

- [x] 4.1 實作 `loader.ts` 的 CSV 解析（PapaParse 自動偵測分隔符號、自行處理千分位數字）以及型別偵測；驗證：單元測試涵蓋逗號、分號、Tab 分隔、引號內的千分位、文字欄判定
- [x] 4.2 實作 `urlRewrite.ts`（GitHub blob 轉 raw、Google Sheets 轉 CSV 匯出）；驗證：單元測試涵蓋兩種改寫、不需改寫的網址，以及回傳「是否有改寫」的旗標
- [x] 4.3 實作 `clean.ts`：欄位角色預設、缺值整列刪除、類別超過 10 級預設排除、常數欄排除、10 MB 與 p>30 上限、清理報告；驗證：dataset-loading spec 中「缺值整列刪除」「高基數類別欄」「常數欄」「特徵過多」等情境都有對應測試並通過
- [x] 4.4 實作 `builtins.ts`，內含兩個內建資料集的欄位設定與說明文字，Boston 的 B 欄預設排除；驗證：測試確認 50 Startups 的 p=5，Boston 的 p=12
- [x] 4.5 實作 `encode.ts`（以字母序第一個類別為參考組、dummy 命名 `<欄>_<值>`）；驗證：50 Startups 編出 State_Florida 與 State_New York，參考組為 California
- [x] 4.6 實作 `split.ts`（mulberry32、Fisher–Yates、各種比例、5 折連續區塊）；驗證：同一個 seed 產生的切分相同、50 Startups 80/20 得到 40/10、各折筆數相差不超過 1、測試集與各折沒有重疊

## 5. 特徵選擇方法與完整管線

- [x] 5.1 實作 Lasso 與 ElasticNet 的座標下降路徑（D4 的網格與標準化）及進場排序、破平手規則；驗證：與 oracle 的 `lasso_path`/`enet_path` 進場順序完全相同，另以人造資料測試同時進場的情況，確認每個 k 都恰好選出 k 個
- [x] 5.2 實作以 Gram 矩陣加 Cholesky 計算子集 RSS 的工具，失敗時退回 QR；驗證：隨機子集的 RSS 與 QR 計算結果相對誤差小於 1e-8
- [x] 5.3 實作 Forward SFS 與 Exhaustive Search（含平手規則，p>15 時停用）；驗證：Exhaustive 的結果與「暴力列舉加 QR」相同，SFS 具備巢狀結構，p=18 時 Exhaustive 回傳停用及原因
- [x] 5.4 實作 RFE；驗證：50 Startups 每個 k 的入選特徵與 sklearn `RFE(step=1)` 相同，且結果不受特徵尺度影響
- [x] 5.5 實作 `pipeline.ts`：對每個方法與每個 k，在訓練集上挑選特徵並以 OLS 擬合、計算測試指標，並在 5 折 CV 的每一折內重跑整個流程；OLS 基準只算一次；輸出 `ResultBundle`；驗證：測試確認 CV 每一折的選擇只用到該折的訓練索引，且 50 Startups 的結果與 fixture 一致
- [x] 5.6 效能檢查；驗證：在 Node 中對 Boston（p=12，以及勾回 B 欄的 p=13）跑完整管線，耗時都在 1 秒內

## 6. Web Worker 與前端狀態

- [x] 6.1 定義 `protocol.ts`，並實作 `compute.worker.ts`（progress 事件、回傳 ResultBundle）；驗證：`npm run build` 後 dist 內有獨立的 worker chunk，並以 Vitest 測試 worker 的訊息處理函式
- [x] 6.2 實作 `store.tsx`（資料集、欄位設定、切分設定、方法、k、比較模式的選取列、主題），以及「只採用最新 requestId」的邏輯；驗證：單元測試模擬回應亂序抵達，確認只會套用最新的結果
- [x] 6.3 實作 k 範圍隨 p 自動夾限、OLS 基準時停用 k 的邏輯；驗證：單元測試涵蓋 feature-selection spec 中「切換後 k 超出範圍」的情境

## 7. 頁面外框與視覺風格

- [x] 7.1 建立 `tokens.css`（米白底、墨藍、赭紅、字體、間距）、淺色與深色主題、三線表基礎樣式，並載入 Google Fonts；驗證：在瀏覽器中切換系統深色模式，頁面跟著變色；手動切換後重新整理，選擇仍然保留
- [x] 7.2 建立六個 CRISP-DM 區塊的骨架、側邊導覽（依捲動位置標示目前階段、點選後捲動），以及手機版的頂端橫向導覽；驗證：瀏覽器實測捲動時導覽的標示正確；在 360px 寬度下整頁沒有水平捲動
- [x] 7.3 建立吸頂控制列，以及「計算中／更新中」狀態元件；驗證：瀏覽器實測捲過 Modeling 區塊後控制列出現在頂端，切換資料集時會顯示進度

## 8. 各階段內容區塊

- [x] 8.1 Business Understanding 與 Data Understanding：資料集說明、前 10 列預覽、描述統計、相關係數熱圖（發散色階、每格標示數值）；驗證：50 Startups 熱圖為 6×6，數值與 pandas `corr()` 一致（抽查 3 格）
- [x] 8.2 Data Preparation：資料來源（下拉選單、網址輸入與改寫提示、CORS 錯誤說明、拖曳上傳）、欄位面板（目標只能選數值欄、勾選後按套用）、清理報告、編碼說明、切分設定（比例、seed、隨機按鈕，並註明與 sklearn 切分不同）；驗證：瀏覽器實測載入一個 raw.githubusercontent.com 的 CSV 成功；輸入一個不支援 CORS 的網址時出現說明與上傳區；載入失敗後原資料仍保留
- [x] 8.3 Modeling：方法選單（ElasticNet 註明 L1 比例 0.5、Exhaustive 停用時附說明）、k 選擇、KaTeX 方程式（註明參考組）、係數表（<.001 格式、p<0.05 標示、VIF 的警示與注意色、截距 VIF 顯示「—」）；驗證：瀏覽器中 50 Startups 的 OLS 基準係數表與 fixture 數字一致
- [x] 8.4 Evaluation：指標卡片（標示測試集或訓練集、無法估計的狀態）、RMSE vs k 圖與 R² vs k 圖（單一方法與比較模式的畫法、OLS 水平虛線、目前 k 標示、無法估計的點留空、Test/CV 切換）、比較表（相同特徵標註、CV 最低者標示、點選列切換細節）、殘差診斷表（依 |殘差| 排序、「注意」與「可能離群」的標示）；驗證：瀏覽器實測 results-presentation spec 中各情境，切換主題時圖表顏色跟著更新
- [x] 8.5 Deployment 預測器：依原始欄位產生輸入控制項，初始值為訓練集平均數或眾數；即時顯示預測值與 95% PI；未使用的欄位淡化、停用並保留輸入值；部分 dummy 入選時的等價提示；β·x 貢獻拆解；外插提示；無效輸入的處理；驗證：單元測試確認「截距＋各貢獻＝預測值」，並在瀏覽器實測 live-predictor spec 的各情境

## 9. 部署設定與文件

- [x] 9.1 建立 `.github/workflows/pages.yml`，流程依序為安裝、test、build、upload-pages-artifact、deploy-pages；驗證：用 actionlint 或人工逐項檢查與 GitHub 官方範本一致（實際 push 由使用者執行）
- [x] 9.2 撰寫 README，內容包含專案說明、本機開發指令、oracle 使用方式、資料來源、Boston B 欄的說明，以及部署步驟；驗證：README 中每個指令在本機都能照做成功

## 10. 整合驗收

- [x] 10.1 以 `npm run build` 加上在子路徑下模擬部署的 `vite preview --base /repo/`，在瀏覽器中走過六個階段；驗證：主控台沒有 404 或錯誤，內建資料集、worker、字體都正常載入
- [x] 10.2 依各 spec 的情境逐一手動驗收（50 Startups、Boston 含與不含 B 欄、外部網址 CSV、上傳檔、360px 手機寬度、深色模式），並記錄結果；驗證：所有情境都通過，或列出未通過的項目與原因
