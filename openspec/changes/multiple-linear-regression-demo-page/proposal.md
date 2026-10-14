# Proposal

## Why

課程需要一個能放上 GitHub Pages 的互動式教學網頁，用來展示多元線性迴歸搭配特徵選擇時「特徵越多不一定越好」的 bias-variance 取捨，並以 CRISP-DM 流程串起整個分析。功能對標 https://huanchen1107.github.io/AIoT-DIC2-MultipleLR/，但需要再擴充：可以切換內建資料集，也可以直接分析任意網址上的 CSV。**視覺風格必須自行設計，不得模仿該範例網頁。**

## What Changes

- 新建一個純靜態的單頁網站，部署在 GitHub Pages，沒有後端。所有迴歸與特徵選擇都在瀏覽器內計算。
- 資料來源有三種：
  - 內建資料集下拉選單：50 Startups（預設）、Boston Housing
  - 輸入 CSV 網址
  - 拖曳上傳本機 CSV，作為 CORS 失敗時的備援
- 載入資料後自動判斷欄位角色（目標 y、數值特徵、類別特徵），使用者可以在面板上修改。系統會產出一份資料清理報告。
- 類別變數做 one-hot 編碼，丟掉字母序第一個類別當參考組，每個 dummy 各算一個特徵。50 Startups 因此有 p=5，k=1~5。
- 支援 6 種方法，外加「一次比較全部」模式：
  - Lasso、Forward SFS、RFE、ElasticNet、Exhaustive Search：都是先挑出 k 個特徵，再對這 k 個特徵擬合 OLS
  - OLS 基準：直接使用全部特徵
- 評估方式：hold-out 切分（預設 80/20、seed=42，兩者都可在網頁上調整），另在訓練集內做 5-fold CV。
- 呈現內容：
  - 指標卡片：Test RMSE、MAE、R²、Adjusted R²、F 檢定與 p 值
  - RMSE vs k 圖（Test 與 CV 兩條線）、R² vs k 圖
  - 方法比較表、迴歸方程式
  - 係數表：β、SE、t、p、95% CI、VIF
- 即時預測器：模型沒用到的欄位淡化並標示，同時列出各特徵 β·x 的貢獻。
- 測試集殘差診斷表：依 |殘差| 排序，落在 95% 預測區間外就標記為可能離群。
- 頁面依 CRISP-DM 六個階段組織成單頁捲動。新增相關係數熱圖，用來解釋共線性。視覺採「統計課本／實驗筆記」風格，支援深色模式與手機版面。
- 另附一支離線 Python 腳本，用 statsmodels / scikit-learn 產生標準答案，自動化測試會用它驗證瀏覽器引擎算出的數字。

## Capabilities

### New Capabilities

- `dataset-loading`：資料來源（內建下拉選單、網址、本機上傳）、網址自動修正與 CORS 錯誤處理、規模上限、欄位角色偵測與手動修正、缺值與異常欄位清理、清理報告
- `regression-engine`：類別編碼、hold-out 切分與 k-fold CV、OLS 擬合與所有統計量（係數、SE、t、p、CI、VIF、R²、Adjusted R²、F、RMSE、MAE、預測區間），以及與參考實作的數值一致性
- `feature-selection`：6 種方法如何對應「選出 k 個特徵」、k 的範圍、各方法的停用規則
- `results-presentation`：指標卡片、k 曲線圖、方法比較表、迴歸方程式、係數表、殘差診斷表、相關係數熱圖
- `live-predictor`：即時預測器的輸入、未使用特徵的呈現、類別等價提示、貢獻拆解
- `page-shell`：CRISP-DM 單頁結構、導覽與吸頂控制列、運算中狀態、視覺風格限制、深色模式、響應式版面、靜態部署

### Modified Capabilities

（無，這是新專案）

## Impact

- **程式碼**：從零建立。目前專案目錄只有 OpenSpec 設定，不是 git repo。
- **新增前端相依套件**：React、TypeScript、Vite、Chart.js、PapaParse、KaTeX，測試用 Vitest。t 與 F 分布由專案自行實作，不另外加套件。
- **新增開發工具相依**：Python 3 搭配 numpy、pandas、scikit-learn、statsmodels，只供產生測試標準答案，不會部署。本機目前尚未安裝 scikit-learn。
- **部署**：GitHub Pages 加上 GitHub Actions workflow。實際建立遠端 repo 與 push 由使用者自行操作。
- **資料授權**：內建的 50 Startups 與 Boston Housing CSV 會一併放進 repo。Boston Housing 的 B 欄有倫理爭議，網頁會預設排除該欄並附上說明。
