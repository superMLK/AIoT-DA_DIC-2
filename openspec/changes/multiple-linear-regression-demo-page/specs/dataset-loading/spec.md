# Spec Delta

## Purpose

讓使用者從內建資料集、CSV 網址或本機檔案載入資料，並在進入建模前完成欄位角色設定與資料清理，同時清楚看到每一步做了什麼。

## ADDED Requirements

### Requirement: 內建資料集下拉選單
系統 SHALL 提供一個資料集下拉選單，內含「50 Startups」與「Boston Housing」兩個內建資料集。首次開啟頁面時 MUST 預設載入 50 Startups。內建資料集的 CSV MUST 與網站一起部署，不依賴外部網址。

#### Scenario: 首次開啟頁面
- **WHEN** 使用者第一次開啟網頁
- **THEN** 系統載入 50 Startups，目標 y 為 Profit，特徵為 R&D Spend、Administration、Marketing Spend、State

#### Scenario: 切換到 Boston Housing
- **WHEN** 使用者在下拉選單選擇 Boston Housing
- **THEN** 系統載入 Boston Housing，目標 y 為 MEDV，所有分析結果依新資料集重新計算

### Requirement: 內建資料集的預設欄位設定
每個內建資料集 SHALL 帶有預先寫好的欄位角色設定與資料集說明文字，使用者不需要手動調整。Boston Housing 的 `B` 欄 MUST 預設不列入特徵，並在欄位面板旁顯示說明：此欄以種族比例建構，具倫理爭議。使用者 MUST 仍能自行勾選加入。

#### Scenario: Boston Housing 的 B 欄預設排除
- **WHEN** 使用者載入 Boston Housing
- **THEN** 欄位面板中 B 欄未勾選且旁邊有說明，特徵數 p=12，k 的範圍為 1~12

#### Scenario: 使用者勾回 B 欄
- **WHEN** 使用者在 Boston Housing 勾選 B 欄並套用
- **THEN** 特徵數 p=13，k 的範圍變成 1~13，所有結果重新計算

### Requirement: 從網址載入 CSV
系統 SHALL 提供網址輸入欄，讓使用者載入任意可公開存取的 CSV。載入前 MUST 自動修正以下常見網址格式：
- GitHub 檔案頁面網址（`github.com/<owner>/<repo>/blob/<ref>/<path>`）改成對應的 `raw.githubusercontent.com` 網址
- Google Sheets 分享網址改成 CSV 匯出網址

網址被修正時，畫面 MUST 告知使用者實際讀取的網址。

#### Scenario: 貼上 GitHub blob 網址
- **WHEN** 使用者輸入 `https://github.com/u/r/blob/main/data.csv` 並按下載入
- **THEN** 系統改為讀取 `https://raw.githubusercontent.com/u/r/main/data.csv`，並顯示「已自動改為 raw 網址」的提示

#### Scenario: 成功載入外部 CSV
- **WHEN** 使用者輸入一個允許跨網域存取的 CSV 網址並按下載入
- **THEN** 系統解析該 CSV、顯示欄位面板與清理報告，並完成分析

### Requirement: 網址讀取失敗的處理與本機上傳備援
當網址因 CORS 限制、網路錯誤或 HTTP 錯誤而無法讀取時，系統 SHALL 用白話說明失敗原因，並提供拖曳或選擇本機 CSV 的上傳區作為替代。上傳的檔案 MUST 只在瀏覽器內讀取，不得傳送到任何伺服器。系統 MUST NOT 透過第三方 CORS proxy 轉送請求。

#### Scenario: CORS 被擋
- **WHEN** 使用者輸入的網址所在伺服器不允許跨網域讀取
- **THEN** 系統顯示「對方伺服器不允許網頁直接讀取（CORS），請下載檔案後拖曳到下方」，並顯示上傳區

#### Scenario: 本機上傳
- **WHEN** 使用者把一個 CSV 檔拖曳到上傳區
- **THEN** 系統在瀏覽器內解析該檔案，後續流程與網址載入相同

#### Scenario: 載入失敗時保留目前資料
- **WHEN** 任何外部載入失敗
- **THEN** 頁面繼續顯示先前已載入的資料集與分析結果，不會清空

### Requirement: CSV 解析
系統 SHALL 自動偵測分隔符號（逗號、分號、Tab），正確處理有引號的欄位，並以第一列作為欄位名稱。數值欄位中的千分位逗號 MUST 被視為數值的一部分。

#### Scenario: 分號分隔的 CSV
- **WHEN** 載入以分號分隔的 CSV
- **THEN** 欄位被正確拆開，欄位面板顯示正確的欄位名稱

#### Scenario: 千分位數值
- **WHEN** 某欄的值為帶引號的 `"1,234.5"`
- **THEN** 該欄被判定為數值欄，值為 1234.5

### Requirement: 規模上限
系統 SHALL 拒絕超過 10 MB 的檔案並說明原因。展開 dummy 之後的特徵數 p 超過 30 時，系統 MUST 不進行分析，並提示使用者在欄位面板取消部分欄位。

#### Scenario: 檔案過大
- **WHEN** 使用者載入 12 MB 的 CSV
- **THEN** 系統拒絕載入並顯示「檔案超過 10 MB 上限」

#### Scenario: 特徵過多
- **WHEN** 套用欄位設定後 p=34
- **THEN** 系統不執行分析，顯示「特徵數 34 超過上限 30，請取消部分欄位」，使用者可以直接在面板上修改

### Requirement: 欄位角色自動偵測與手動修正
非內建資料集載入後，系統 SHALL 自動判斷欄位角色：所有值都能解析成數字的欄位為數值欄，其他欄位為類別欄；最後一個數值欄預設為目標 y，其餘欄位預設為特徵。系統 MUST 顯示欄位面板，讓使用者可以：
- 更換目標 y（只能選數值欄）
- 勾選或取消任一特徵
- 看到每個欄位的型別，類別欄另外顯示級數

面板變更 MUST 在使用者按下「套用」後才重新計算。

#### Scenario: 預設角色
- **WHEN** 載入欄位為 `id, area, rooms, city, price` 的 CSV（city 為文字欄）
- **THEN** 目標 y 預設為 price；area、rooms、city、id 預設為特徵；city 標示為「類別（N 級）」

#### Scenario: 更換目標並排除欄位
- **WHEN** 使用者把 id 取消勾選後按下套用
- **THEN** 系統以不含 id 的特徵重新計算所有結果

#### Scenario: 目標不可為類別欄
- **WHEN** 使用者開啟目標 y 的選單
- **THEN** 選單只列出數值欄

### Requirement: 資料清理規則
建模前，系統 SHALL 依序套用以下清理規則：
1. 目標 y 或任一已勾選特徵有缺值的列，整列刪除
2. 級數超過 10 的類別欄，預設取消勾選並提示原因（使用者仍可手動勾回）
3. 清理後只剩單一值的欄位（常數欄）自動排除
4. 清理後可用列數不足以估計時（見 regression-engine 的自由度規則），顯示錯誤並停止分析

#### Scenario: 缺值整列刪除
- **WHEN** 資料有 398 列，其中 6 列的 horsepower 為空值，且 horsepower 為已勾選特徵
- **THEN** 系統以 392 列進行分析

#### Scenario: 高基數類別欄
- **WHEN** 某文字欄有 305 個不同值
- **THEN** 該欄預設未勾選，旁邊註明「類別超過 10 級，預設排除」

#### Scenario: 常數欄
- **WHEN** 某勾選欄位在清理後每一列的值都相同
- **THEN** 該欄被自動排除，並記錄在清理報告中

### Requirement: 資料清理報告
每次載入或套用欄位設定後，系統 SHALL 顯示一份清理報告，內容 MUST 包含：原始列數、可用列數、各欄因缺值刪除的列數、被自動排除的欄位與原因、目標 y 的名稱、最終特徵數 p。

#### Scenario: 報告內容
- **WHEN** 載入一份有缺值與常數欄的 CSV
- **THEN** 清理報告列出「原始 N 列 → 可用 M 列」、每個缺值欄位的刪除數，以及被排除的常數欄名稱
