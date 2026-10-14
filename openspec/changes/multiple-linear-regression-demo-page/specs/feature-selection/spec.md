# Spec Delta

## Purpose

定義 6 種特徵選擇方法如何從 p 個特徵中挑出 k 個，讓不同方法之間的差異只在於「挑了哪些特徵」，以便公平比較，並示範特徵數與模型表現之間的取捨。

## ADDED Requirements

### Requirement: 方法清單與共同契約
系統 SHALL 提供 Lasso、Forward SFS、RFE、ElasticNet、Exhaustive Search、OLS 基準 6 種方法，另有「一次比較全部」模式。除 OLS 基準外，每種方法在給定 k 時 MUST 只用（該次的）訓練資料挑出**剛好 k 個**特徵，再對這 k 個特徵做 OLS 擬合（見 regression-engine）。任何方法的最終係數都 MUST 是 OLS 係數，不得是懲罰後的係數。

#### Scenario: 統一輸出
- **WHEN** 使用者選 Lasso、k=2
- **THEN** 係數表顯示的是「Lasso 挑出的 2 個特徵」的 OLS 係數，並帶有 SE、p 值與 CI

### Requirement: k 的範圍
k 的可選範圍 SHALL 為 1 到 p（p 為展開 dummy 後的特徵數）。切換資料集或欄位設定後，若目前的 k 超過新的 p，k MUST 自動調整為 p。

#### Scenario: 50 Startups
- **WHEN** 載入 50 Startups
- **THEN** k 可選 1~5

#### Scenario: 切換後 k 超出範圍
- **WHEN** 使用者在 k=12 時，切換到 p=5 的資料集
- **THEN** k 自動變為 5

### Requirement: OLS 基準
OLS 基準 SHALL 使用全部 p 個特徵，不受 k 影響。選擇 OLS 基準時，k 控制項 MUST 停用，並顯示「基準模型使用全部特徵」。

#### Scenario: 選擇 OLS 基準
- **WHEN** 使用者選擇 OLS 基準
- **THEN** k 控制項變成停用，細節區塊顯示全特徵模型

### Requirement: Lasso 與 ElasticNet 的 k 對應
系統 SHALL 先將訓練資料的特徵依訓練資料的平均數與標準差標準化，再沿著正則化強度 α 由大到小計算整條係數路徑，依每個特徵「第一次變成非零」時的 α 由大到小排序。路徑上同一個 α 同時變成非零的多個特徵，依該 α 下標準化係數絕對值由大到小排序；仍然相同時，依欄位原始順序排序。路徑結束時仍未變成非零的特徵，排在最後，依欄位原始順序排序。取排序前 k 個作為入選特徵。ElasticNet 的 L1 比例 MUST 固定為 0.5，且介面上要註明。

#### Scenario: 每個 k 都有結果
- **WHEN** 路徑上有兩個特徵在同一個 α 同時進場
- **THEN** k 的每個值仍然恰好選出 k 個特徵，不會出現「找不到 k」的情況

#### Scenario: 與參考實作一致
- **WHEN** 在 50 Startups 預設切分的訓練集上計算 Lasso 的進場順序
- **THEN** 排序結果與 scikit-learn 在相同標準化資料與相同 α 網格上計算 `lasso_path` 所得的順序相同；ElasticNet（`enet_path`、`l1_ratio=0.5`）亦同

### Requirement: Forward SFS
系統 SHALL 從空集合開始，每一步加入「加入後訓練集殘差平方和（RSS）最小」的特徵。RSS 相同時，選欄位原始順序較前者。k 對應的特徵集合為前 k 步加入的特徵。

#### Scenario: 巢狀結構
- **WHEN** 比較 SFS 在 k=2 與 k=3 的特徵
- **THEN** k=3 的特徵集合包含 k=2 的全部特徵

### Requirement: RFE
系統 SHALL 先依訓練資料標準化特徵，從全部特徵開始，以 OLS 擬合後刪除標準化係數絕對值最小的 1 個特徵，重複直到剩下 k 個。

#### Scenario: 不受原始尺度影響
- **WHEN** 某特徵的原始數值尺度是另一個特徵的 10 萬倍
- **THEN** RFE 的刪除順序與兩者尺度相同時一致（只取決於標準化後的係數）

#### Scenario: 與參考實作一致
- **WHEN** 在 50 Startups 預設切分的標準化訓練集上執行
- **THEN** 每個 k 的入選特徵與 scikit-learn `RFE(LinearRegression(), n_features_to_select=k, step=1)` 相同

### Requirement: Exhaustive Search
系統 SHALL 對每個 k，在所有 C(p, k) 種特徵組合中選出訓練集 RSS 最小的一組。RSS 相同時，選欄位原始順序字典序較前的組合。當 p > 15 時，Exhaustive Search MUST 停用，並說明「特徵組合數 2^p 過多」。

#### Scenario: 最佳子集
- **WHEN** 計算 50 Startups 在 k=2 的 Exhaustive Search
- **THEN** 選出的組合在全部 10 種 2 特徵組合中訓練集 RSS 最小

#### Scenario: 特徵太多時停用
- **WHEN** 資料集 p=18
- **THEN** Exhaustive Search 在方法選單中停用並附說明，「一次比較全部」模式也不包含它

### Requirement: 一次比較全部模式
「一次比較全部」模式 SHALL 對所有可用方法、所有 k 計算結果。圖表 MUST 疊在同一張圖上，並提供目前 k 的方法比較表（見 results-presentation）。

#### Scenario: 進入比較模式
- **WHEN** 使用者選擇「一次比較全部」
- **THEN** RMSE vs k 與 R² vs k 圖同時顯示所有可用方法的曲線，OLS 基準以水平參考線呈現
