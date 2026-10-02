import { FC, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { LiveAnnouncementOverlay } from '@Components/live/LiveAnnouncementOverlay'
import { LiveArenaFallback } from '@Components/live/LiveArenaFallback'
import { LiveCategoryPool } from '@Components/live/LiveCategoryPool'
import { LiveCenterArena } from '@Components/live/LiveCenterArena'
import { LiveEventStream } from '@Components/live/LiveEventStream'
import { LiveScoreboardPanel } from '@Components/live/LiveScoreboardPanel'
import { LiveTopHud } from '@Components/live/LiveTopHud'
import { LiveAnnouncement } from '@Components/live/types'
import { useLivePresentation } from '@Hooks/useLivePresentation'
import { GameMode, LiveScoreboardStateModel, SpeedrunRoundStatus } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'
import { resolveTeamId, uniqueTeams } from './galactic/teamSlots'
import { useSceneDirector } from './galactic/useSceneDirector'

const GalacticScene = lazy(() => import('./galactic/GalacticScene'))
const WorldFallback = () => (
  <div className={classes.world} aria-label="Orbital battlefield">
    <LiveArenaFallback message="Arena unavailable · Live broadcast data continues" />
  </div>
)

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
  const previousWaveRound = useRef<{ id?: number; status?: SpeedrunRoundStatus; frozen: boolean; present: boolean } | undefined>(undefined)
  const [roundWave, setRoundWave] = useState<string>()
  useEffect(() => {
    const previous = previousWaveRound.current
    const frozen = Boolean(state?.scoreboardFrozen)
    if (!frozen && previous?.present && !previous.frozen &&
      (previous.id !== round?.id || previous.status !== round?.status)) {
      if (round?.status === SpeedrunRoundStatus.Running)
        setRoundWave(`start-${round.id}-${performance.now()}`)
      else if (round?.status === SpeedrunRoundStatus.Finished ||
        (!round && previous.id !== undefined && previous.status !== SpeedrunRoundStatus.Finished))
        setRoundWave(`finished-${previous.id}-${performance.now()}`)
    }
    if (frozen) setRoundWave(undefined)
    previousWaveRound.current = { id: round?.id, status: round?.status, frozen, present: Boolean(state) }
  }, [round?.id, round?.status, state, state?.scoreboardFrozen])
  useEffect(() => {
    if (!roundWave) return
    const timer = window.setTimeout(() => setRoundWave(undefined), 3200)
    return () => window.clearTimeout(timer)
  }, [roundWave])
  const safeTeams = useMemo(
    () => (state?.scoreboardFrozen ? [] : uniqueTeams(state?.topTeams ?? [])),
    [state?.scoreboardFrozen, state?.topTeams]
  )
  const orbitTeams = useMemo(
    () => state?.scoreboardFrozen
      ? uniqueTeams(state.topTeams ?? []).map((team) => ({ id: team.id }))
      : safeTeams,
    [state?.scoreboardFrozen, state?.topTeams, safeTeams]
  )
  const sceneAnnouncement = useMemo(() => {
    const announcement = presentation.announcement
    if (!announcement || !['firstBlood', 'blood', 'correct', 'wrong'].includes(announcement.kind)) return announcement
    return {
      ...announcement,
      teamId: resolveTeamId(safeTeams, announcement.teamId, announcement.teamName),
    }
  }, [presentation.announcement, safeTeams])

  const sceneEvent = useSceneDirector({
    announcement: sceneAnnouncement,
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
    <main
      className={`${classes.stage} ${overtime ? classes.stageOvertime : ''} ${frozen ? classes.stageFrozen : ''} ${!frozen && presentation.visibleAnnouncement?.kind === 'firstBlood' ? classes.stageBlood : ''}`}
    >
      <ErrorBoundary FallbackComponent={WorldFallback}>
        <Suspense
          fallback={
            <div className={classes.world} aria-label="Orbital battlefield">
              <LiveArenaFallback message="Loading arena" />
            </div>
          }
        >
          <GalacticScene
            intensity={state.config?.visualIntensity}
            overtime={overtime}
            teams={orbitTeams}
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
      </ErrorBoundary>
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
              rankChanges={frozen ? new Map() : presentation.rankChanges}
              frozen={frozen}
            />
          </div>
          <LiveCategoryPool
            round={round}
            available={state.speedrunState?.remainingCategories ?? []}
            used={state.speedrunState?.usedCategories ?? []}
            concealActive={frozen || presentation.spinPhase === 'spinning'}
            spinning={!frozen && presentation.spinPhase === 'spinning'}
          />
        </div>
      </div>
      {!frozen && roundWave && (
        <div key={roundWave} className={classes.roundWave} aria-hidden="true" />
      )}
      {sceneEvent &&
        !frozen &&
        (sceneEvent.teamId || sceneEvent.teamName) &&
        !['firstBlood', 'blood'].includes(presentation.visibleAnnouncement?.kind ?? '') && (
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
