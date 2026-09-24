// Development-only test entry; Vite's production entry does not include tests/.
import { MantineProvider } from '@mantine/core'
import i18n from 'i18next'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router'
import '@mantine/core/styles.css'
import { LiveScoreboardStage } from '../src/components/live/LiveScoreboardStage'
import { useLivePreviewState } from '../src/hooks/useLivePreviewState'
import LivePage from '../src/pages/games/[id]/live'

await i18n
  .use(initReactI18next)
  .init({ lng: 'en', resources: { en: { translation: {} } }, interpolation: { escapeValue: false } })
const config = { title: 'Fixture', enabled: true, soundEnabled: true, volume: 0.3 }
function Fixture() {
  const preview = useLivePreviewState(1, config)
  const [override, setOverride] = useState({})
  useEffect(() => {
    Object.assign(window, { galactic: { ...preview, override: setOverride } })
  }, [preview])
  return (
    <LiveScoreboardStage
      key={preview.resetEpoch}
      state={{ ...preview.state, ...override }}
      remainingSeconds={preview.remainingSeconds}
      injectedAnnouncement={preview.injectedAnnouncement}
      preview
    />
  )
}
const root = createRoot(document.getElementById('root')!)
import.meta.hot?.dispose(() => root.unmount())
root.render(
  <StrictMode>
    <MantineProvider defaultColorScheme="dark">
      {location.search.includes('live') ? (
        <MemoryRouter initialEntries={['/games/1/live']}>
          <Routes>
            <Route path="/games/:id/live" element={<LivePage />} />
          </Routes>
        </MemoryRouter>
      ) : (
        <Fixture />
      )}
    </MantineProvider>
  </StrictMode>
)
