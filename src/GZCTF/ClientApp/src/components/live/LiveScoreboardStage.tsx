import { FC, lazy, Suspense, useMemo } from 'react'
import { LiveAnnouncementOverlay } from '@Components/live/LiveAnnouncementOverlay'
import { LiveCategoryPool } from '@Components/live/LiveCategoryPool'
import { LiveCenterArena } from '@Components/live/LiveCenterArena'
import { LiveEventStream } from '@Components/live/LiveEventStream'
import { LiveScoreboardPanel } from '@Components/live/LiveScoreboardPanel'
import { LiveTopHud } from '@Components/live/LiveTopHud'
import { LiveAnnouncement } from '@Components/live/types'
import { useLivePresentation } from '@Hooks/useLivePresentation'
import { GameMode, LiveScoreboardStateModel, SpeedrunRoundStatus } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'
import { uniqueTeams } from './galactic/teamSlots'
import { useSceneDirector } from './galactic/useSceneDirector'

const GalacticScene = lazy(() => import('./galactic/GalacticScene'))

const EVENT_TITLE = 'HackToday 2026 Final'

const Fallback: FC<{ title: string; text: string }> = ({ title, text }) => (
  <main className={classes.fallback}>
    <div className={classes.fallbackInner}>
      <div className={classes.fallbackBrand}>{EVENT_TITLE}</div>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  </main>
)

export const LiveScoreboardStage: FC<{
  state?: LiveScoreboardStateModel
  remainingSeconds: number
  injectedAnnouncement?: LiveAnnouncement
  preview?: boolean
}> = ({ state, remainingSeconds, injectedAnnouncement, preview }) => {
  const presentation = useLivePresentation(state, remainingSeconds, injectedAnnouncement)
  const round = state?.speedrunState?.currentRound
  const safeTeams = useMemo(
    () => (state?.scoreboardFrozen ? [] : uniqueTeams(state?.topTeams ?? [])),
    [state?.scoreboardFrozen, state?.topTeams]
  )

  const sceneEvent = useSceneDirector({
    announcement: presentation.announcement,
    deltas: presentation.scoreDeltas,
    changed: presentation.changedTeams,
    frozen: Boolean(state?.scoreboardFrozen),
    preview: Boolean(preview),
    roundKey: `${round?.id ?? 'standby'}:${round?.status ?? 'none'}`,
  })

  if (!state)
    return (
      <Fallback
        title="Establishing transmission"
        text="Live data will appear as soon as the scoreboard link is ready."
      />
    )
  if (state.gameMode !== GameMode.Speedrun)
    return <Fallback title="Broadcast unavailable" text="This live view is reserved for Speedrun games." />
  if (!state.config?.enabled && !preview)
    return <Fallback title="Live scoreboard offline" text="The broadcast has not been enabled by an administrator." />

  const overtime = round?.status === SpeedrunRoundStatus.Overtime
  const frozen = Boolean(state.scoreboardFrozen)
  const teams = safeTeams
  const events = frozen ? [] : (state.recentEvents ?? [])

  return (
    <main className={`${classes.stage} ${overtime ? classes.stageOvertime : ''}`}>
      <Suspense fallback={null}>
        <GalacticScene
          intensity={state.config?.visualIntensity}
          overtime={overtime}
          teams={teams}
          frozen={frozen}
          event={sceneEvent}
          spinPhase={presentation.spinPhase}
          highlighted={new Set(presentation.rankChanges.keys())}
          categoryCount={
            new Set([
              ...(state.speedrunState?.remainingCategories ?? []),
              ...(state.speedrunState?.usedCategories ?? []),
            ]).size
          }
        />
      </Suspense>
      <div className={classes.shell}>
        <LiveTopHud
          round={round}
          remainingSeconds={remainingSeconds}
          concealCategory={presentation.spinPhase === 'spinning'}
          audioEnabled={presentation.audioEnabled}
          onUnlockAudio={presentation.unlockAudio}
        />
        <div className={classes.content}>
          <div className={classes.mainGrid}>
            <LiveEventStream events={events} frozen={frozen} />
            <LiveCenterArena
              round={round}
              remaining={state.speedrunState?.remainingCategories ?? []}
              used={state.speedrunState?.usedCategories ?? []}
              spinPhase={presentation.spinPhase}
              teams={teams}
              attackingTeams={frozen ? new Set() : presentation.changedTeams}
              bloodTeams={
                frozen
                  ? new Set()
                  : new Set([...presentation.bloodAttackTeams, ...(sceneEvent?.teamId ? [sceneEvent.teamId] : [])])
              }
              scoreDeltas={frozen ? new Map() : presentation.scoreDeltas}
              frozen={frozen}
            />
            <LiveScoreboardPanel
              teams={teams}
              changedTeams={frozen ? new Set() : presentation.changedTeams}
              bloodTeams={frozen ? new Set() : presentation.bloodAttackTeams}
              scoreDeltas={frozen ? new Map() : presentation.scoreDeltas}
              rankChanges={frozen ? new Map() : presentation.rankChanges}
              frozen={frozen}
            />
          </div>
          <LiveCategoryPool
            round={round}
            available={state.speedrunState?.remainingCategories ?? []}
            used={state.speedrunState?.usedCategories ?? []}
            concealActive={presentation.spinPhase === 'spinning'}
          />
        </div>
      </div>
      {sceneEvent && !frozen && (sceneEvent.teamId || sceneEvent.teamName) && (
        <div className={classes.sceneCallout} role="status">
          <span>
            {sceneEvent.kind === 'wrong'
              ? 'Preview ? Target deflected'
              : sceneEvent.kind === 'firstBlood'
                ? 'Priority strike'
                : 'Verified strike'}
          </span>
          <strong>
            {teams.find((team) => team.id === sceneEvent.teamId)?.name ??
              sceneEvent.teamName ??
              'Incoming transmission'}
          </strong>
          {sceneEvent.delta !== undefined && <b>+{sceneEvent.delta.toLocaleString()}</b>}
        </div>
      )}
      <LiveAnnouncementOverlay event={frozen ? undefined : presentation.visibleAnnouncement} />
    </main>
  )
}
