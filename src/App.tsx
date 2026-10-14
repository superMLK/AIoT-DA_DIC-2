import { Masthead } from './components/layout/Masthead.tsx'
import { SectionNav } from './components/layout/SectionNav.tsx'
import { SourceBar } from './components/layout/SourceBar.tsx'
import { ProgressBar, StickyControls } from './components/layout/StickyControls.tsx'
import { BusinessSection } from './components/sections/BusinessSection.tsx'
import { DataPreparation } from './components/sections/DataPreparation.tsx'
import { DataUnderstanding } from './components/sections/DataUnderstanding.tsx'
import { Deployment } from './components/sections/Deployment.tsx'
import { Evaluation } from './components/sections/Evaluation.tsx'
import { Modeling } from './components/sections/Modeling.tsx'
import { StoreProvider } from './state/store.tsx'
import { ThemeProvider } from './state/theme.tsx'

export function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <ProgressBar />
        <Masthead />
        <SourceBar />
        <StickyControls />
        <div className="shell">
          <SectionNav />
          <main className="content">
            <BusinessSection />
            <DataUnderstanding />
            <DataPreparation />
            <Modeling />
            <Evaluation />
            <Deployment />
            <footer className="colophon muted">
              所有計算皆在瀏覽器內完成；數值引擎以 statsmodels / scikit-learn 的結果做自動化比對測試。
            </footer>
          </main>
        </div>
      </StoreProvider>
    </ThemeProvider>
  )
}
