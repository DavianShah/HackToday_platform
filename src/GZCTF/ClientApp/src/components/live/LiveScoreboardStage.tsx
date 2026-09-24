import { FC } from 'react'
import { GameMode, LiveScoreboardStateModel, SpeedrunRoundStatus } from '@Api'
import { LiveAnnouncement } from '@Components/live/types'
import { LiveAnnouncementOverlay } from '@Components/live/LiveAnnouncementOverlay'
import { LiveCategoryPool } from '@Components/live/LiveCategoryPool'
import { LiveCenterArena } from '@Components/live/LiveCenterArena'
import { LiveEventStream } from '@Components/live/LiveEventStream'
import { LiveScoreboardPanel } from '@Components/live/LiveScoreboardPanel'
import { LiveTopHud } from '@Components/live/LiveTopHud'
import { useLivePresentation } from '@Hooks/useLivePresentation'
import classes from '@Styles/GalacticCommand.module.css'

const EVENT_TITLE = 'HackToday 2026 Final'

const Fallback: FC<{ title: string; text: string }> = ({ title, text }) => <main className={classes.fallback}>
  <div className={classes.fallbackInner}>
    <div className={classes.fallbackGlyph} aria-hidden />
    <div className={classes.fallbackBrand}>{EVENT_TITLE}</div>
    <h1>{title}</h1>
    <p>{text}</p>
  </div>
</main>

export const LiveScoreboardStage: FC<{
  state?: LiveScoreboardStateModel
  remainingSeconds: number
  injectedAnnouncement?: LiveAnnouncement
  preview?: boolean
}> = ({ state, remainingSeconds, injectedAnnouncement, preview }) => {
  const presentation = useLivePresentation(state, remainingSeconds, injectedAnnouncement)
  const round = state?.speedrunState?.currentRound

  if (!state) return <Fallback title="Establishing transmission" text="Live data will appear as soon as the scoreboard link is ready." />
  if (state.gameMode !== GameMode.Speedrun) return <Fallback title="Broadcast unavailable" text="This live view is reserved for Speedrun games." />
  if (!state.config?.enabled && !preview) return <Fallback title="Live scoreboard offline" text="The broadcast has not been enabled by an administrator." />

  const overtime = round?.status === SpeedrunRoundStatus.Overtime
  const frozen = Boolean(state.scoreboardFrozen)
  const teams = frozen ? [] : state.topTeams ?? []
  const events = frozen ? [] : state.recentEvents ?? []

  return <main className={`${classes.stage} ${overtime ? classes.stageOvertime : ''}`}>
    <div className={classes.shell}>
      <LiveTopHud round={round} remainingSeconds={remainingSeconds}
        concealCategory={presentation.spinPhase === 'spinning'} audioEnabled={presentation.audioEnabled}
        onUnlockAudio={presentation.unlockAudio} />
      <div className={classes.content}>
        <div className={classes.mainGrid}>
          <LiveEventStream events={events} frozen={frozen} />
          <LiveCenterArena round={round} remaining={state.speedrunState?.remainingCategories ?? []}
            used={state.speedrunState?.usedCategories ?? []} spinPhase={presentation.spinPhase} teams={teams}
            attackingTeams={frozen ? new Set() : presentation.changedTeams}
            bloodTeams={frozen ? new Set() : presentation.bloodAttackTeams}
            scoreDeltas={frozen ? new Map() : presentation.scoreDeltas} frozen={frozen} />
          <LiveScoreboardPanel teams={teams} changedTeams={frozen ? new Set() : presentation.changedTeams}
            bloodTeams={frozen ? new Set() : presentation.bloodAttackTeams}
            scoreDeltas={frozen ? new Map() : presentation.scoreDeltas}
            rankChanges={frozen ? new Map() : presentation.rankChanges} frozen={frozen} />
        </div>
        <LiveCategoryPool round={round} available={state.speedrunState?.remainingCategories ?? []}
          used={state.speedrunState?.usedCategories ?? []} concealActive={presentation.spinPhase === 'spinning'} />
      </div>
    </div>
    <LiveAnnouncementOverlay event={frozen ? undefined : presentation.visibleAnnouncement} />
  </main>
}
