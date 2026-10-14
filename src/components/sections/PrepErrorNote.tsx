export function PrepErrorNote({ message }: { message: string }) {
  return (
    <p className="note note-warn" role="alert">
      目前的資料設定無法分析：{message} 請到 <a href="#data-preparation">§3 Data Preparation</a> 修正欄位設定。以下顯示的是上一次成功的結果。
    </p>
  )
}
