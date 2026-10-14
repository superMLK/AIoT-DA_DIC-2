# Spec Delta

## Purpose

把資料探索、模型結果與評估以圖表和表格呈現。重點是讓學習者看出不同 k 與方法之間的取捨，以及單一模型的統計意義與診斷。

## ADDED Requirements

### Requirement: 資料探索呈現
系統 SHALL 在 Data Understanding 階段顯示：
- 資料預覽：前 10 列
- 每個數值欄的描述統計：筆數、平均數、標準差、最小值、最大值
- 相關係數熱圖：目標 y 與所有入選特徵（含 dummy）之間的 Pearson 相關係數，以清理後的完整資料計算

熱圖每一格 MUST 顯示數值，且以發散色階呈現正負相關。

#### Scenario: 50 Startups 熱圖
- **WHEN** 載入 50 Startups
- **THEN** 熱圖顯示 Profit、R&D Spend、Administration、Marketing Spend、State_Florida、State_New York 共 6×6 格，每格標示相關係數

### Requirement: 指標卡片
系統 SHALL 顯示目前模型（目前的方法與 k）的指標卡片，包含：Test RMSE、Test MAE、Test R²、Adjusted R²（訓練集）、F 統計量與其 p 值（訓練集）。每張卡片 MUST 標明是以「測試集」或「訓練集」計算。模型無法估計時，不適用的卡片 MUST 顯示「無法估計」。

#### Scenario: 卡片資料來源標示
- **WHEN** 顯示任何模型的指標卡片
- **THEN** RMSE、MAE、R² 卡片標示「測試集」，Adjusted R² 與 F 卡片標示「訓練集」

### Requirement: RMSE vs k 圖
系統 SHALL 以折線圖呈現 RMSE 隨 k 變化的情形，k 為橫軸：
- 單一方法模式：同時畫出該方法的 Test RMSE 與 CV RMSE 兩條線
- 比較全部模式：每個方法各一條線，並提供「Test／CV」切換決定畫哪一種
- 兩種模式都 MUST 畫出 OLS 基準的水平虛線

目前選擇的 k MUST 在圖上標示。無法估計的點 MUST 留空，不得以 0 代替。

#### Scenario: 單一方法
- **WHEN** 使用者選 Exhaustive Search
- **THEN** 圖上有 Test RMSE、CV RMSE 兩條線與 OLS 基準水平虛線，目前 k 有標示

#### Scenario: 比較模式切換
- **WHEN** 在比較模式把切換從 Test 改成 CV
- **THEN** 每個方法的線改為 CV RMSE

### Requirement: R² vs k 圖
系統 SHALL 以折線圖呈現 R² 隨 k 變化的情形：
- 單一方法模式：畫出 Test R² 與訓練集 Adjusted R² 兩條線
- 比較全部模式：每個方法各畫一條 Test R² 線
- 兩種模式都 MUST 畫出 OLS 基準的水平虛線並標示目前 k

#### Scenario: 比較模式
- **WHEN** 使用者選「一次比較全部」
- **THEN** R² 圖上每個可用方法各有一條 Test R² 線

### Requirement: 方法比較表
比較全部模式下，系統 SHALL 顯示目前 k 的方法比較表，每列一個方法，欄位包含：入選特徵、Test RMSE、CV RMSE、Adjusted R²。入選特徵集合與其他方法完全相同時，MUST 標註與哪個方法相同。CV RMSE 最低的方法 MUST 被醒目標示，並預設作為下方細節區塊顯示的模型。點選任一列 MUST 把細節區塊切換到該方法。

#### Scenario: 預設細節
- **WHEN** 進入比較模式
- **THEN** 細節區塊（卡片、方程式、係數表、預測器、殘差表）顯示 CV RMSE 最低的方法，比較表中該列有標示

#### Scenario: 點選切換
- **WHEN** 使用者點選比較表中的 Lasso 列
- **THEN** 細節區塊改為顯示 Lasso 在目前 k 的模型

#### Scenario: 相同特徵標註
- **WHEN** SFS 與 Exhaustive 在目前 k 選出相同特徵
- **THEN** 其中一列標註「與 Exhaustive 相同」

### Requirement: 迴歸方程式
系統 SHALL 以數學排版顯示目前模型的迴歸方程式，包含截距與每個入選特徵的係數，係數取 4 位有效數字。方程式含 dummy 時 MUST 註明參考組。

#### Scenario: 含 dummy 的方程式
- **WHEN** 模型包含 State_Florida
- **THEN** 方程式下方註明「State 的參考組為 California」

### Requirement: 係數表
系統 SHALL 以表格顯示目前模型的截距與每個入選特徵的 β、SE、t、p 值、95% CI、VIF。顯示規則：
- p 值小於 0.001 時 MUST 顯示為「<.001」
- p 值 < 0.05 的列 MUST 有視覺標示
- VIF ≥ 10 MUST 以警示色標示，5 ≤ VIF < 10 MUST 以注意色標示
- 截距列的 VIF 顯示「—」

#### Scenario: 高共線
- **WHEN** 某特徵的 VIF 為 12.3
- **THEN** 該格以警示色顯示，並附提示說明共線性

### Requirement: 殘差診斷表
系統 SHALL 以表格列出目前模型在測試集每一筆的資料：原始列號、實際值、預測值、殘差、標準化預測殘差 r = e / (s · √(1 + h))、95% 預測區間。表格 MUST 依 |殘差| 由大到小排序。|r| 大於 t₀.₉₇₅,ₙ₋ₖ₋₁（等同落在 95% 預測區間外）時標示「注意」；|r| > 3 時標示「可能離群」。

#### Scenario: 排序與標示
- **WHEN** 測試集中有一筆 r = −3.62
- **THEN** 該筆標示「可能離群」，且依 |殘差| 排在對應位置

#### Scenario: 區間外即標示
- **WHEN** 某筆實際值落在其 95% 預測區間外、但 |r| ≤ 3
- **THEN** 該筆標示「注意」

### Requirement: 數字格式
所有金額與大數值 SHALL 使用千分位。表格中的數值欄 MUST 使用等寬數字並靠右對齊。

#### Scenario: 千分位
- **WHEN** 顯示 RMSE 9055.237
- **THEN** 顯示為 9,055.24
