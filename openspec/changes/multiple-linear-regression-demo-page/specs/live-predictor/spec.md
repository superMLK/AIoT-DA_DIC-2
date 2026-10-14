# Spec Delta

## Purpose

讓學習者輸入各特徵值並即時看到目前模型的預測結果，同時理解每個特徵對預測值的貢獻，以及被淘汰的特徵為什麼不影響預測。

## ADDED Requirements

### Requirement: 預測器輸入欄位
系統 SHALL 為資料集的每個原始特徵欄位（不是每個 dummy）提供一個輸入控制項：數值欄為數字輸入，類別欄為下拉選單。標題 MUST 使用目標 y 的名稱，例如「預測 Profit」。輸入欄位的初始值：數值欄 MUST 為訓練集平均數，類別欄 MUST 為訓練集中最常出現的類別。

#### Scenario: 50 Startups 的預測器
- **WHEN** 載入 50 Startups
- **THEN** 預測器有 R&D Spend、Administration、Marketing Spend 三個數字輸入與一個 State 下拉選單，標題為「預測 Profit」

### Requirement: 即時預測
任何輸入值改變，或目前模型改變（方法、k、切分、資料集）時，系統 SHALL 立即更新點預測值與 95% 預測區間，不需要按按鈕。輸入不是有效數字時，MUST 顯示錯誤提示並不顯示預測值。

#### Scenario: 修改輸入
- **WHEN** 使用者把 R&D Spend 從 70000 改成 120000
- **THEN** 預測值與預測區間立即更新

#### Scenario: 無效輸入
- **WHEN** 使用者清空某個被模型使用的數值欄
- **THEN** 該欄顯示「請輸入數字」，預測值區域顯示等待輸入的狀態

### Requirement: 未使用特徵的呈現
目前模型沒有用到的原始特徵，其輸入控制項 SHALL 保留在原位，但呈現淡化且停用的狀態，並標示「此模型未使用」。切換模型時，已輸入的值 MUST 保留。

#### Scenario: k=2 時
- **WHEN** 目前模型只使用 R&D Spend 與 Marketing Spend
- **THEN** Administration 與 State 欄位淡化、停用並標示「此模型未使用」，欄位不會從畫面上消失

#### Scenario: 切回使用該特徵的模型
- **WHEN** 使用者先在 Administration 輸入 150000，切到不使用它的模型，再切回使用它的模型
- **THEN** Administration 仍顯示 150000，且恢復成可編輯

### Requirement: 部分 dummy 入選時的等價提示
類別特徵只有部分 dummy 入選時，該下拉選單 SHALL 保持可用，並提示哪些類別在此模型中等價（未入選的 dummy 所對應的類別與參考組會得到相同的預測值）。

#### Scenario: 只選到 State_Florida
- **WHEN** 模型包含 State_Florida、不含 State_New York
- **THEN** State 下拉選單可用，旁邊提示「New York 與 California 在此模型中等價」

### Requirement: 貢獻拆解
系統 SHALL 在每個被使用的特徵旁顯示該特徵對預測值的貢獻 β·x（類別特徵則顯示所選類別對應 dummy 的 β，參考組顯示 0），並顯示截距，讓「截距＋各貢獻＝預測值」可以直接對照。

#### Scenario: 加總一致
- **WHEN** 預測器顯示任一預測
- **THEN** 截距與所有顯示的貢獻相加，等於顯示的預測值（在顯示的四捨五入精度內）

### Requirement: 外插提示
被使用的數值特徵輸入值超出訓練集最小值到最大值的範圍時，系統 SHALL 在該欄位旁提示「超出訓練資料範圍，預測可靠度較低」。

#### Scenario: 超出範圍
- **WHEN** 訓練集 R&D Spend 最大值為 165349，使用者輸入 300000
- **THEN** R&D Spend 欄位旁出現外插提示，預測仍然照常顯示
