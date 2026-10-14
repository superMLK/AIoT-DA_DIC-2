# Spec Delta

## Purpose

定義整個教學網頁的外框，包括 CRISP-DM 六階段的單頁結構、導覽與控制列、視覺風格限制、深色模式、響應式版面，以及作為靜態網站部署的方式。

## ADDED Requirements

### Requirement: CRISP-DM 單頁結構
網頁 SHALL 是一個單頁捲動的頁面。頁首下方 MUST 有一列「資料來源列」（見「資料來源列」需求），其後依序分成六個階段區塊，各區塊內容如下：
1. Business Understanding：問題定義與資料集背景說明（內建資料集有專屬說明，外部資料集顯示通用說明）
2. Data Understanding：資料預覽、描述統計、相關係數熱圖
3. Data Preparation：欄位面板、清理報告、類別編碼說明、切分設定
4. Modeling：方法與 k 的選擇、迴歸方程式、係數表
5. Evaluation：指標卡片、RMSE vs k 圖、R² vs k 圖、方法比較表、殘差診斷表
6. Deployment：即時預測器

#### Scenario: 區塊順序
- **WHEN** 使用者由上往下捲動頁面
- **THEN** 依序看到上述六個階段的區塊，每個區塊有階段編號與名稱

### Requirement: 資料來源列
資料來源的選擇（內建資料集下拉選單、CSV 網址輸入、本機上傳）SHALL 位於頁首正下方、第一個階段區塊之前，讓使用者開啟頁面就能選擇資料集。網址改寫提示、載入錯誤說明與拖曳上傳區 MUST 顯示在資料來源列內。這對應 CRISP-DM 的「蒐集初始資料」步驟。

#### Scenario: 開啟頁面即可選擇資料集
- **WHEN** 使用者開啟網頁、尚未捲動
- **THEN** 不需捲動即可看到資料集下拉選單、網址輸入欄與上傳按鈕，且位於 §1 之前

#### Scenario: 載入失敗的說明位置
- **WHEN** 從網址載入失敗
- **THEN** 錯誤說明與拖曳上傳區出現在資料來源列中

### Requirement: 階段導覽
桌面寬度下，系統 SHALL 在頁面側邊顯示六個階段的導覽。目前捲動到的階段 MUST 被標示，點選導覽項目 MUST 捲動到對應區塊。在手機寬度下，導覽 MUST 收合成頁面頂端可橫向捲動的列。

#### Scenario: 捲動標示
- **WHEN** 使用者捲動到 Evaluation 區塊
- **THEN** 導覽中的「5 Evaluation」被標示為目前階段

#### Scenario: 點選導覽
- **WHEN** 使用者點選「6 Deployment」
- **THEN** 頁面捲動到預測器區塊

### Requirement: 吸頂控制列
方法與 k 的控制項 SHALL 位於 Modeling 區塊。當使用者捲過 Modeling 區塊的控制項後，一個精簡版的控制列 MUST 固定在畫面頂端，讓使用者在 Evaluation 與 Deployment 區塊也能切換方法與 k。

#### Scenario: 在評估區切換 k
- **WHEN** 使用者正在看 Evaluation 區塊的圖表，並在頂端控制列把 k 從 3 改成 2
- **THEN** 圖表的目前 k 標示、指標卡片與下方所有細節區塊都更新為 k=2

### Requirement: 運算中狀態
背景計算進行中時，系統 SHALL 顯示進度指示。計算完成前，受影響的區塊 MUST 維持顯示上一次的結果並標示「更新中」，不得清空或顯示錯誤的中間值。

#### Scenario: 切換資料集
- **WHEN** 使用者切換到 Boston Housing
- **THEN** 頁面出現進度指示，計算完成後所有區塊一次更新

### Requirement: 視覺風格
網頁 SHALL 採用「統計課本／實驗筆記」風格：
- 米白紙張底色
- 標題使用襯線字體、內文使用無襯線字體
- 數值使用等寬數字
- 表格採用學術三線表樣式，不使用卡片陰影
- 墨藍為主色、赭紅為警示色

視覺設計 MUST NOT 模仿 https://huanchen1107.github.io/AIoT-DIC2-MultipleLR/ 的版面、配色或元件樣式。

#### Scenario: 表格樣式
- **WHEN** 顯示係數表
- **THEN** 表格只有頂線、表頭下線與底線三條橫線，沒有直線與陰影

### Requirement: 深色模式
系統 SHALL 依作業系統的色彩偏好自動切換淺色或深色主題，並提供手動切換按鈕。手動選擇 MUST 在重新整理後保留。圖表與熱圖的顏色 MUST 隨主題切換，並維持可讀的對比。

#### Scenario: 系統偏好深色
- **WHEN** 使用者的作業系統設定為深色模式，且從未手動切換過
- **THEN** 網頁以深色主題顯示，圖表文字與格線清晰可讀

### Requirement: 響應式版面
在 360px 寬的手機畫面上，頁面 SHALL 沒有整頁的水平捲動。寬表格（係數表、殘差表、比較表）MUST 在自己的容器內水平捲動。

#### Scenario: 手機瀏覽
- **WHEN** 以 360px 寬度開啟網頁
- **THEN** 整頁不會水平捲動，係數表可以在表格區域內左右滑動

### Requirement: 靜態部署
網站 SHALL 能以純靜態檔案部署在 GitHub Pages 的子路徑（`https://<user>.github.io/<repo>/`）下正常運作，不需要任何後端服務。所有內建資料與資源 MUST 以相對於網站根目錄的路徑載入。

#### Scenario: 子路徑部署
- **WHEN** 網站部署在 `https://<user>.github.io/<repo>/`
- **THEN** 內建資料集、背景運算、字體與圖表都能正常載入，瀏覽器主控台沒有 404 錯誤
