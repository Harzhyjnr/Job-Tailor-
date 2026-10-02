import { useState } from 'react'

import { AppFooter } from '@/components/layout/AppFooter'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppShell } from '@/components/layout/AppShell'
import { StageIndicator } from '@/components/layout/StageIndicator'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ToastViewport } from '@/components/ui/Toast'
import { AppStateProvider } from '@/context/AppStateProvider'
import { ToastProvider } from '@/context/ToastContext'
import type { Stage } from '@/constants/workflow'
import { Analysis, Editor, Preview, Tailor } from '@/pages/Analysis'
import { Home } from '@/pages/Home'
import { JobInput, Upload } from '@/pages/Upload'

function Workspace({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>('Resume')

  return (
    <>
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <StageIndicator current={stage} />
          <Button variant="ghost" size="sm" onClick={onExit}>
            Back to home
          </Button>
        </div>
      </div>

      {stage === 'Resume' ? <Upload onContinue={() => setStage('Job')} /> : null}

      {stage === 'Job' ? <JobInput onContinue={() => setStage('Recruiter Review')} /> : null}
      {stage === 'Recruiter Review' ? <Analysis onTailor={() => setStage('Tailor')} /> : null}
      {stage === 'Tailor' ? <Tailor onContinue={() => setStage('Editor')} /> : null}
      {stage === 'Editor' ? <Editor onContinue={() => setStage('Export')} /> : null}
      {stage === 'Export' ? <Preview /> : null}
    </>
  )
}

function App() {
  const [view, setView] = useState<'home' | 'workspace'>('home')
  const [privacyOpen, setPrivacyOpen] = useState(false)

  const start = () => {
    setView('workspace')
    window.scrollTo({ top: 0 })
  }

  return (
    <ToastProvider>
      <AppShell
        header={<AppHeader onStart={start} onOpenPrivacy={() => setPrivacyOpen(true)} />}
        footer={<AppFooter />}
      >
        {view === 'home' ? (
          <Home onStart={start} />
        ) : (
          <AppStateProvider>
            <Workspace onExit={() => setView('home')} />
          </AppStateProvider>
        )}
      </AppShell>

      <Modal
        open={privacyOpen}
        title="Privacy"
        onClose={() => setPrivacyOpen(false)}
        description="Job Tailor is designed to work locally in your browser."
        footer={<Button onClick={() => setPrivacyOpen(false)}>Close</Button>}
      >
        <div className="flex flex-col gap-3 text-sm text-ink-muted">
          <p>
            Your resume and job descriptions are not uploaded to a Job Tailor server. There is no
            server, no database and no account.
          </p>
          <p>
            If you choose to use an external AI provider with your own API key, the relevant text
            may be sent directly to that provider.
          </p>
        </div>
      </Modal>

      <ToastViewport />
    </ToastProvider>
  )
}

export default App
