# 多元迴歸特徵選擇教學網頁

依 CRISP-DM 流程，比較 Lasso、Forward SFS、RFE、ElasticNet、Exhaustive Search 與 OLS 基準在不同特徵數 k 下的多元線性迴歸表現，用來說明「特徵越多不一定越好」的偏差與變異取捨。全部運算都在瀏覽器內完成，可直接部署成 GitHub Pages 靜態網站。

## 功能

- **資料來源**：內建 50 Startups（預設）與 Boston Housing；也可以輸入 CSV 網址（GitHub 檔案頁面與 Google Sheets 分享網址會自動改成可下載的網址），或上傳本機 CSV（檔案只在瀏覽器內讀取）。
- **資料準備**：自動判斷欄位角色並可手動修正，含缺值刪列、高基數類別欄與常數欄排除，並產出清理報告。類別變數以 one-hot 編碼，丟掉字母序第一個類別當參考組。
- **評估**：hold-out 切分（比例與 seed 可調整），並在訓練集內做 5 折交叉驗證。每一折都重新挑選特徵，避免資料洩漏。
- **呈現內容**：指標讀數、RMSE／R² vs k 圖、方法比較表、迴歸方程式、係數表（β、SE、t、p、95% CI、VIF）、測試集殘差診斷，以及含 95% 預測區間的即時預測器。

## 本機開發

需要 Node.js 24 以上。

```bash
npm install
npm run dev        # 開發伺服器，網址見終端輸出
npm run test       # 數值引擎與資料處理的單元測試（Vitest）
npm run build      # 輸出靜態網站到 dist/
npm run preview    # 在本機預覽 dist/
npm run bench      # 計時內建資料集的完整計算
```

## 數值正確性：oracle 標準答案

TS 數值引擎的測試會比對 `tests/fixtures/*.expected.json`。這些檔案由 `tools/oracle/oracle.py` 透過 statsmodels、scikit-learn 與 scipy 計算產生，比對項目包括：OLS 推論統計量、VIF、預測區間、測試指標、Lasso／ElasticNet 的進場順序、SFS、RFE、Exhaustive 的選擇結果、完整管線的 CV RMSE，以及 t／F 分布數值。這些檔案已經提交到 repo，平常開發與 CI 都不需要 Python。

需要重新產生時（例如修改了選擇規則，或新增 fixture）：

```bash
# 需先安裝 uv：https://docs.astral.sh/uv/
npm run fixtures:inputs              # 用網頁實際使用的清理、編碼與切分流程產生 *.input.json
npm run oracle                       # 處理 tests/fixtures/ 下所有 *.input.json，輸出 *.expected.json
npm run oracle -- tests/fixtures/tiny.input.json   # 只處理指定的 input
```

每個 `*.input.json` 包含已編碼的數值矩陣 `X`、目標 `y`、`train`／`test` 索引、5 折 `folds` 索引（選填），以及要額外回報 OLS 推論的特徵子集 `subsets`（選填）。

## 資料來源

詳見 [`public/datasets/SOURCES.md`](public/datasets/SOURCES.md)。

Boston Housing 的 `B` 欄定義為 `1000(Bk − 0.63)²`，其中 Bk 是該區黑人居民比例。原作者以此假設種族與房價有關，這個假設有倫理爭議，scikit-learn 自 1.2 版起已移除這份資料集。本網站預設不使用 B 欄，並在欄位面板上說明原因；需要比較時，可以手動勾選加入。

## 部署到 GitHub Pages

1. 在 GitHub 建立 repo，把這個專案 push 到 `main` 分支。
2. 到 repo 的 **Settings → Pages**，把 **Source** 設為 **GitHub Actions**。
3. 之後每次 push 到 `main`，`.github/workflows/pages.yml` 都會依序執行測試與 build，再部署到 `https://<user>.github.io/<repo>/`。

Vite 的 `base` 設為 `./`，所以部署在任何子路徑下都能正確載入資源。要回滾時，在 Actions 頁面重新執行前一個 commit 的部署即可。

## 專案結構

```
src/engine/      數值引擎（純 TS）：線性代數、t／F 分布、OLS、切分、特徵選擇、完整管線
src/data/        CSV 解析、網址改寫、清理、內建資料集設定
src/worker/      Web Worker：在背景執行完整計算
src/state/       React 狀態（reducer、資料載入、主題）
src/components/  依 CRISP-DM 階段組織的畫面元件
tools/oracle/    產生標準答案的 Python 工具（uv 管理）
tests/           Vitest 測試與 fixtures
```
