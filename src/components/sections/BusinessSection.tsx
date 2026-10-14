import { useStore } from '../../state/store.tsx'
import { Chapter } from '../layout/Chapter.tsx'

export function BusinessSection() {
  const { state } = useStore()
  const ds = state.dataset
  return (
    <Chapter id="business">
      <div className="stack">
        <p className="caption">
          資料集：{ds?.label ?? '載入中…'}
          {ds && <span className="sub">目標 y = {ds.config.target}</span>}
        </p>
        {(ds?.description ?? []).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        <h3 style={{ fontSize: '1.1rem', marginTop: 24 }}>這一頁要回答的問題</h3>
        <ol>
          <li>不同的特徵選擇方法，在同樣的特徵數 k 下會挑出一樣的特徵嗎？</li>
          <li>k 從 1 增加到 p 時，測試誤差是一路下降，還是在某個 k 之後反而變差？</li>
          <li>只用一次切分得到的「最佳 k」可靠嗎？換一個隨機種子結論會不會改變？</li>
        </ol>
        <p className="note">
          <strong>偏差與變異的取捨（bias-variance trade-off）</strong>：特徵太少，模型抓不到真正的關係（偏差大）；特徵太多，模型會把訓練資料裡的雜訊也一起學起來，換一批資料就失準（變異大）。在訓練集上，加特徵永遠讓誤差變小；只有在沒看過的資料上，才看得出哪個 k 剛剛好。
        </p>
      </div>
    </Chapter>
  )
}
