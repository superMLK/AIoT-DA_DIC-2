# Spec Delta

## Purpose

在瀏覽器內完成類別編碼、資料切分、交叉驗證、OLS 擬合與所有統計推論，數字必須與統計學標準實作一致，可作為教學依據。

## ADDED Requirements

### Requirement: 類別變數編碼
系統 SHALL 對每個類別特徵做 one-hot 編碼，並丟掉「依字母序排第一」的類別作為參考組。每個 dummy 欄位 MUST 視為一個獨立特徵，計入特徵數 p 與 k。dummy 欄位名稱 MUST 採用 `<欄位名>_<類別值>` 格式。類別清單 MUST 由清理後的完整資料決定，不隨切分改變。

#### Scenario: 50 Startups 的 State 編碼
- **WHEN** 載入 50 Startups
- **THEN** State 展開為 `State_Florida` 與 `State_New York` 兩個 0/1 特徵，California 為參考組，特徵數 p=5

#### Scenario: 參考組的意義顯示
- **WHEN** 任何類別特徵被編碼
- **THEN** 介面上可以看到該類別的參考組名稱

### Requirement: Hold-out 切分
系統 SHALL 將清理後的資料隨機切成訓練集與測試集。預設比例為 80/20、seed 為 42。使用者 MUST 能從 70/30、75/25、80/20、90/10 中選擇比例，也能輸入整數 seed 或按鈕隨機產生 seed。相同的資料、比例與 seed MUST 產生完全相同的切分。測試集筆數為 `round(n × 測試比例)`，且至少 1 筆。

#### Scenario: 50 Startups 預設切分
- **WHEN** 以預設設定載入 50 Startups
- **THEN** 訓練集 40 筆、測試集 10 筆

#### Scenario: 切分可重現
- **WHEN** 使用者把 seed 改成 7，再改回 42
- **THEN** 結果與最初 seed=42 時完全相同

#### Scenario: 更換 seed 觸發重算
- **WHEN** 使用者更換 seed 或比例
- **THEN** 所有方法、所有 k 的結果、圖表與表格都依新切分重新計算

### Requirement: 訓練集內 5-fold 交叉驗證
系統 SHALL 在訓練集內以 seed 決定的方式切成 5 折，對每個方法與每個 k 計算 CV RMSE（5 折驗證 RMSE 的平均）。每一折 MUST 只用該折的訓練部分重新執行完整流程（特徵選擇與 OLS 擬合），驗證部分不得參與任何選擇或擬合。測試集 MUST NOT 參與 CV。

#### Scenario: 無資料洩漏
- **WHEN** 計算某方法在 k=3 的 CV RMSE
- **THEN** 每一折的特徵選擇只看得到該折的訓練部分

#### Scenario: 特徵選擇只用訓練集
- **WHEN** 計算 Test RMSE
- **THEN** 特徵選擇與擬合都只用訓練集，測試集只用來評估

### Requirement: OLS 擬合與推論統計量
對任一組特徵，系統 SHALL 在訓練集上以含截距的 OLS 擬合，並以原始尺度（未標準化）輸出：
- 每個係數（含截距）的 β、標準誤 SE、t 值、雙尾 p 值、95% 信賴區間
- 殘差標準誤 s = √(SSE / (n − k − 1))
- 訓練集 R²、Adjusted R²、F 統計量（自由度 k 與 n − k − 1）及其 p 值

其中 n 為訓練筆數、k 為特徵數，p 值與信賴區間 MUST 依 t 分布與 F 分布計算。

#### Scenario: 與參考實作一致
- **WHEN** 以 50 Startups 預設切分、使用全部 5 個特徵擬合
- **THEN** 所有係數、SE、t、p、CI、R²、Adjusted R²、F 與其 p 值，和 statsmodels OLS 在相同資料上的結果相對誤差小於 1e-6（p 值小於 1e-12 時，改比較絕對誤差小於 1e-12）

### Requirement: 測試集評估指標
系統 SHALL 以訓練好的模型預測測試集，計算 Test RMSE、Test MAE 與 Test R²。Test R² 的定義為 1 − SSE_test / SST_test，其中 SST_test 以測試集自己的平均數計算。

#### Scenario: 指標一致性
- **WHEN** 計算任一模型的測試指標
- **THEN** 結果與 scikit-learn 的 `mean_squared_error` 開根號、`mean_absolute_error`、`r2_score` 在相同預測值上的結果相對誤差小於 1e-9

### Requirement: VIF
系統 SHALL 對模型中每個特徵計算變異數膨脹因子 VIF_j = 1 / (1 − R²_j)。R²_j 是在訓練集上，以「其他已入選特徵加截距」迴歸特徵 j 所得的 R²。模型只有 1 個特徵時，VIF MUST 顯示為不適用。

#### Scenario: 單一特徵
- **WHEN** 模型只有 R&D Spend 一個特徵
- **THEN** VIF 欄位顯示「—」

#### Scenario: 與參考實作一致
- **WHEN** 計算全特徵模型的 VIF
- **THEN** 與 statsmodels `variance_inflation_factor`（設計矩陣含常數項）的結果相對誤差小於 1e-6

### Requirement: 預測區間
對任一特徵向量 x₀，系統 SHALL 計算點預測 ŷ₀ 與 95% 預測區間 ŷ₀ ± t₀.₉₇₅,ₙ₋ₖ₋₁ · s · √(1 + h₀)，其中 h₀ = x₀ᵀ(XᵀX)⁻¹x₀（x₀ 與 X 都含截距項）。

#### Scenario: 與參考實作一致
- **WHEN** 計算測試集每一筆的 95% 預測區間
- **THEN** 與 statsmodels `get_prediction().summary_frame(alpha=0.05)` 的 `obs_ci_lower`、`obs_ci_upper` 相對誤差小於 1e-6

### Requirement: 無法估計的情況
當 n − k − 1 ≤ 0 時，系統 SHALL 將該模型標示為「無法估計」，不輸出 SE、t、p、CI、Adjusted R²、F 與預測區間。當入選特徵之間完全共線（設計矩陣秩不足）時，系統 MUST 標示為無法估計，並指出造成共線的特徵。

#### Scenario: 資料太少
- **WHEN** 訓練集只有 6 筆，而 k=5
- **THEN** 該點在圖表與比較表中標為「無法估計」，其他 k 照常顯示

#### Scenario: 完全共線
- **WHEN** 資料中有兩欄數值完全相同且同時入選
- **THEN** 系統顯示這兩欄完全共線、該模型無法估計的訊息，頁面不會崩潰

### Requirement: 運算不阻塞畫面
所有方法與所有 k 的計算 SHALL 在背景執行，計算期間頁面 MUST 保持可捲動、可操作，並顯示進度。新的計算請求 MUST 取代尚未完成的舊請求，畫面只顯示最新請求的結果。

#### Scenario: 計算中切換設定
- **WHEN** 計算尚未完成時使用者又更換 seed
- **THEN** 畫面最後顯示的是新 seed 的結果，不會先閃過舊 seed 的結果
