# 內建資料集來源

## 50_Startups.csv

- 內容：50 家新創公司的 R&D Spend、Administration、Marketing Spend、State 與 Profit。
- 這份資料最早出自 SuperDataScience 的「Machine Learning A-Z」課程教材，後來被大量轉載，原始授權條款並不明確。這裡僅作課堂教學示範使用。
- 取得來源：<https://github.com/maykulkarni/Machine-Learning-Notebooks/blob/master/02.%20Regression/50_Startups.csv>。已與 <https://github.com/shradha-khapra/MachineLearning> 中的同名檔案比對，內容逐位元組相同（換行字元除外）。
- 處理方式：統一改成 LF 換行，資料內容未做任何更動。

## BostonHousing.csv

- 內容：Harrison, D. & Rubinfeld, D.L. (1978). *Hedonic prices and the demand for clean air*. Journal of Environmental Economics and Management, 5, 81–102。共 506 列，包含 13 個特徵與目標 MEDV。資料原本由 StatLib（Carnegie Mellon University）發布。
- 取得來源：<https://github.com/selva86/datasets/blob/master/BostonHousing.csv>。已與 <https://github.com/jbrownlee/Datasets/blob/master/housing.csv> 逐格比對數值，最大差異為 0。
- 處理方式：欄位名稱改成大寫（CRIM … MEDV），CHAS 欄的引號拿掉，其餘數值未更動。
- **倫理說明**：`B` 欄的定義是 `1000(Bk − 0.63)²`，其中 Bk 是該區黑人居民的比例。原作者假設種族比例與房價有關，這個假設有爭議，scikit-learn 自 1.2 版起已把這份資料集移除。本網站預設不使用 B 欄，使用者如果要自行比較，可以手動勾選加入。
