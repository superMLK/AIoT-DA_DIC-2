# Design

## Context

- 這是全新專案。目錄裡目前只有 OpenSpec 設定，還不是 git repo。動機見 proposal.md 的 Why，行為需求見 `specs/`。
- 最後要部署到 GitHub Pages，沒有後端。網址 CSV 必須在瀏覽器內分析，所以不能採用「Python 預先算好 JSON」的做法。
- 本機環境：Node 24、npm、uv、Python 3.10，git 與 gh 都可用。Python 尚未安裝 scikit-learn 與 statsmodels。
- 使用者熟悉 React 與 TypeScript，但較不熟悉 Python 機器學習。因此數值引擎用 TS 撰寫，Python 只用來產生「標準答案」。

## Goals / Non-Goals

**Goals:**
- 數值引擎是純 TS 模組，不依賴 UI，可以單獨在 Node（Vitest）測試，並與 statsmodels / scikit-learn 的結果逐項比對。
- 所有計算都放在 Web Worker 執行。切換方法或 k 時不重新計算，只從快取結果中取值。
- 50 Startups 與 Boston Housing 完整計算（6 種方法 × 所有 k × 測試集＋5 折）都在 1 秒內完成。

**Non-Goals:**
- 不支援 Excel、JSON 等 CSV 以外的格式，也不支援超過 10 MB 的資料。
- 不做互動項、多項式特徵或其他特徵工程。
- 不做多語系，介面只有繁體中文。
- 不追求與 scikit-learn `train_test_split(random_state=42)` 產生相同的切分。
- 不自動決定「最佳 k」。由使用者看圖判斷，網頁只標示 CV 最低的方法。

## Decisions

### D1：運算全部放在瀏覽器，使用自製 TS 引擎並在 Web Worker 中執行
- **選擇**：在 `src/engine/` 撰寫純函式，由 `src/worker/compute.worker.ts` 呼叫。主執行緒只送出「資料＋設定」，接收「全部方法 × 全部 k 的結果」。
- **替代方案**：
  - Pyodide：載入 20–40 MB，首次開啟要等 10–30 秒，手機上更慢。
  - 內建資料預算 JSON、網址資料才用 JS：會有兩條程式路徑，兩邊數字可能對不上。
- **理由**：資料規模小（p ≤ 30），自己實作的難點在數值正確性，可以用標準答案測試補足。

### D2：最終 OLS 擬合使用 Householder QR，不用正規方程式
- 設計矩陣為 `[1, X]`，採原始尺度。QR 分解得到 β 與 R，並由 (XᵀX)⁻¹ = R⁻¹R⁻ᵀ 算出 SE 與槓桿值 h。
- 秩判定：當 `|Rᵢᵢ| < 1e-10 · max|Rⱼⱼ|` 時視為秩不足，並回報對應的特徵。
- **理由**：50 Startups 的 R&D 是 10⁵ 的尺度、dummy 是 0/1，直接算 XᵀX 的條件數很差。QR 在數值上比較穩定。

### D3：子集搜尋使用 Gram 矩陣與 Cholesky 快速計算 RSS
- Exhaustive 與 SFS 要比較非常多組子集的 RSS。p=15 時有 32,767 組，再乘上 6 次（測試集 1 次加 5 折）。若每組都對 n 列做 QR，成本約 10¹⁰ flops，太慢。
- **做法**：每個訓練集只算一次「中心化後」的 G = XcᵀXc 與 b = Xcᵀyc。子集 S 的 RSS = ycᵀyc − b_Sᵀ G_S⁻¹ b_S，用 Cholesky 計算，每組成本 O(k³)，與 n 無關。
- 這個 RSS 只用來排名。選定子集後，仍然用 D2 的 QR 做最終擬合與推論。
- 平手判定採相對誤差 1e-12，平手時依 spec 規則取欄位順序較前者。
- **替代方案**：每組都做 QR，比較簡單，但 Boston 的 Exhaustive 會跑好幾秒。

### D4：Lasso 與 ElasticNet 使用座標下降法，搭配固定的 α 網格
- 目標函數與 scikit-learn 一致：`(1/2n)‖y − Xβ‖² + α·ρ‖β‖₁ + α(1−ρ)/2‖β‖²`。Lasso 的 ρ=1，ElasticNet 的 ρ=0.5。
- X 以訓練資料的平均數與標準差（ddof=0，與 StandardScaler 相同）做標準化，y 做中心化，路徑本身不含截距。
- α 網格：α_max = max|Xᵀy| / (n·ρ)，往下取 200 個對數等距點，最小到 α_max·10⁻⁴。採 warm start，收斂容差 1e-10。
- 「進場」的定義：在網格上第一個讓 |β| > 1e-9 · std(y_train) 的 α。採相對門檻，可以避免 y 的尺度（例如利潤在 10⁵ 等級）讓收斂誤差被誤判成進場。
- 某些 CV 折的訓練部分會出現常數欄，例如某個 dummy 在該折全部是 0。這種欄位在該次選擇中視為不可用，不納入任何方法的候選。如果可用的欄位少於 k，該 (方法, k) 在這一折算是無法估計，CV RMSE 也就無法估計。
- 一個訓練集只算一次路徑，就能得到所有 k 的排序。
- **測試方式**：oracle 把同一組 α 陣列傳給 `sklearn.linear_model.lasso_path` 與 `enet_path`，比對兩邊的進場順序。
- **替代方案**：LARS 能算出精確的進場點，但實作明顯更複雜，而且 ElasticNet 不能直接套用。

### D5：RFE 與 SFS 的實作
- **RFE**：標準化後先以 QR 擬合全部特徵，刪除 |β| 最小的特徵，再重新擬合，重複這個過程。全程只需要做一次，就能得到刪除順序，所有 k 都可以從中取得。
- **SFS**：使用 D3 的 RSS。做一次就能得到完整的加入順序，所有 k 也都從中取得。

### D6：t 與 F 分布自行實作，不使用 jStat
- 正規化不完全 beta 函數 I_x(a,b) 用 Lentz 連分數計算，log-gamma 用 Lanczos 近似。t 與 F 的 CDF 都由 I_x 推導；t 分布的反函數用 Newton 法加二分法保護。
- **理由**：jStat 已經很久沒有維護，也沒有 TS 型別，極小 p 值的精度也不保證。自己實作約 100 行，用 scipy 的大量網格值驗證即可。
- **替代方案**：jStat 開發較快，但要另外驗證它的精度，而且會引入一個不維護的相依套件。

### D7：切分與 CV 使用自製的可重現亂數
- 亂數產生器用 mulberry32(seed)，再以 Fisher–Yates 洗牌。洗牌後的前 `round(n·r)` 筆是測試集，其餘是訓練集。
- CV 用 seed+1 對訓練集的索引洗牌，再切成 5 個連續區塊，各區塊筆數最多相差 1。
- oracle 不重現這套亂數，而是直接接收 JS 端輸出的索引。
- Data Preparation 區塊要註明「切分結果與 scikit-learn 相同 seed 的切分不同」。

### D8：Worker 協定與快取
- 主執行緒送出 `{ requestId, dataset(已清理與編碼), splitConfig }`。Worker 回傳 `progress` 事件，最後回傳一份完整的 `ResultBundle`。`ResultBundle` 依 方法 × k 存放入選特徵、OLS 推論結果、測試集指標、CV RMSE、殘差列。
- 主執行緒只採用 `requestId` 等於最新請求的回應，這樣就能滿足 spec 中「最新請求優先」的要求。
- 切換方法或 k 純粹是在 `ResultBundle` 裡查表，不需要重新計算。
- 預測器在主執行緒直接計算 β·x 與預測區間。為此 `ResultBundle` 需要包含每個模型的 (XᵀX)⁻¹、s 與自由度。

### D9：前端架構
- 使用 Vite、React、TypeScript。狀態用 `useReducer` 加上 Context 管理，不另外引入狀態管理套件。
- 圖表用 Chart.js，以一個薄的自製 React 包裝元件呈現，不引入 react-chartjs-2。
- 熱圖用 CSS grid 搭配 `<table>` 語意實作，不用 Chart.js，比較容易做到無障礙，也比較好處理主題切換。
- 方程式用 KaTeX 排版。
- CSV 解析交給 PapaParse（自動偵測分隔符號）。數字解析自己處理，以支援千分位，並避免 `dynamicTyping` 誤判。
- 預計的目錄結構：

```
src/
  engine/   linalg.ts  distributions.ts  ols.ts  split.ts  encode.ts
            select/{lasso.ts, sfs.ts, rfe.ts, exhaustive.ts}  pipeline.ts
  data/     loader.ts  urlRewrite.ts  clean.ts  builtins.ts
  worker/   compute.worker.ts  protocol.ts
  state/    store.tsx
  components/  (依 CRISP-DM 區塊分資料夾)
  styles/   tokens.css  …
public/datasets/  50_Startups.csv  BostonHousing.csv
tools/oracle/     pyproject.toml  oracle.py
tests/fixtures/   *.json（oracle 產出，提交到 repo）
tests/            *.test.ts
.github/workflows/pages.yml
```

### D10：測試策略
- `tools/oracle/oracle.py` 用 uv 管理環境，讀取 `tests/fixtures/*.input.json`（資料、切分索引、方法、k、α 網格），輸出 `*.expected.json`。
- 產出的 fixtures 要提交到 repo，這樣 CI 和日常開發都不需要 Python。
- 容差：統計量的相對誤差小於 1e-6；測試集指標的相對誤差小於 1e-9；入選特徵必須完全相同。
- 涵蓋的情境：50 Startups 全特徵與各方法各 k、Boston 全特徵、秩不足、n−k−1 ≤ 0、極小 p 值。

### D11：視覺風格與主題
- 色彩、字體、間距都以 CSS 自訂屬性（tokens）定義在 `:root`。深色主題放在 `[data-theme="dark"]` 與 `prefers-color-scheme` 下。使用者的手動選擇存在 localStorage，存取時包在 try/catch 裡。
- 字體：標題用 Noto Serif TC，內文用 Noto Sans TC，數字用 `font-variant-numeric: tabular-nums` 搭配等寬字體，從 Google Fonts 載入。
- Chart.js 的配色在建立圖表時從 CSS 變數讀取，主題切換時重新套用。
- 實作時不參考範例網站的任何畫面或 CSS。

### D12：部署
- Vite 設定 `base: './'`，worker 以 `new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' })` 載入。內建 CSV 以 `import.meta.env.BASE_URL` 組出路徑。
- GitHub Actions 使用官方的 `actions/upload-pages-artifact` 與 `actions/deploy-pages`。流程是先跑測試，再 build，最後部署。
- 實作階段只建立 workflow 檔並在本機驗證 build。建立遠端 repo、push 與啟用 Pages 這些對外操作，都由使用者自行執行或另外授權。

## Risks / Trade-offs

- [自製的分布函式在極端值失準] → oracle 產生一組 scipy 參考值（t 的自由度 1–500、|t| 最大到 50；F 也涵蓋多種自由度）做表格比對，極小 p 值以絕對誤差判定。
- [α 網格解析度不足，造成假的「同時進場」] → spec 已定義確定性的破平手規則；oracle 使用相同網格，排序仍可逐一比對。網格點數可以再調整，不影響 spec。
- [測試集只有 10 筆，Test RMSE 很不穩定] → 這正是教學重點。圖上同時畫 CV RMSE，並開放調整 seed，讓使用者自己觀察。
- [Gram 法在高共線資料上的 RSS 排名受到數值誤差影響] → 先標準化再組 Gram 矩陣；Cholesky 失敗（不正定）時，該子集退回用 QR 計算。最終推論一律使用 QR。
- [外部網址常被 CORS 擋下] → 提供網址自動修正、白話說明與本機上傳備援。依 spec，不使用第三方 proxy。
- [中文字型檔很大，手機載入慢] → Google Fonts 會依 unicode-range 分片載入，並設定 `font-display: swap`。
- [大型 CSV（例如 10 萬列）會拖慢 CV 計算] → 主要成本是 O(n·p²) 的 Gram 矩陣與 QR，可以接受。另外有 Worker 進度條，使用者不會以為當機。
- [Boston Housing 的 B 欄有倫理爭議] → 預設排除並附說明（見 dataset-loading spec）。

## Migration Plan

全新專案，不需要遷移。上線步驟：本機 `npm run test` 與 `npm run build` 都通過後，使用者建立 GitHub repo 並 push，再到 repo 設定中把 Pages 的來源設為 GitHub Actions。若要回滾，在 Actions 中重新部署前一個 commit 即可。

## Open Questions

- 兩個內建 CSV 的實際下載來源。實作時會從常見的公開來源取得，並在 README 註明出處，不影響 spec 與任務拆分。
