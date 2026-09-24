import { FC } from 'react'
import { SpeedrunRoundModel, SpeedrunRoundStatus } from '@Api'
import { formatDurationSeconds } from '@Utils/Shared'
import classes from '@Styles/GalacticCommand.module.css'

const statusLabel = (round?: SpeedrunRoundModel | null, concealCategory?: boolean) => {
  if (concealCategory) return 'Sector selection'
  if (!round) return 'Standby'
  if (round.status === SpeedrunRoundStatus.Ready) return 'Ready'
  if (round.status === SpeedrunRoundStatus.Running) return 'Live'
  if (round.status === SpeedrunRoundStatus.Overtime) return 'Overtime'
  if (round.status === SpeedrunRoundStatus.Finished) return 'Round complete'
  if (round.status === SpeedrunRoundStatus.Cancelled) return 'Round cancelled'
  return 'Standby'
}

export const LiveTopHud: FC<{
  round?: SpeedrunRoundModel | null
  remainingSeconds: number
  concealCategory?: boolean
  audioEnabled: boolean
  onUnlockAudio: () => void
}> = ({ round, remainingSeconds, concealCategory, audioEnabled, onUnlockAudio }) => {
  const active = round?.status === SpeedrunRoundStatus.Running || round?.status === SpeedrunRoundStatus.Overtime
  const urgent = active && remainingSeconds <= 60
  const critical = active && remainingSeconds <= 10
  const readySeconds = round?.timeLeftSeconds ?? 0
  const timer = active
    ? formatDurationSeconds(remainingSeconds)
    : round?.status === SpeedrunRoundStatus.Ready && readySeconds > 0
      ? formatDurationSeconds(readySeconds)
      : round?.status === SpeedrunRoundStatus.Finished
        ? '00:00'
        : '--:--'
  const category = concealCategory ? 'Sector scan in progress' : round?.category ?? 'Waiting for next round'

  return <header className={classes.topHud}>
    <div className={classes.brandLockup}>
      <div className={classes.brandGlyph} aria-hidden />
      <div className={classes.brandText}><span>Live transmission</span><strong>HackToday 2026 Final</strong></div>
    </div>
    <div className={classes.statusCluster}>
      <i className={classes.statusDot} aria-hidden />
      <div className={classes.statusCopy}><span className={classes.statusLabel}>{statusLabel(round, concealCategory)}</span>
        <strong className={classes.categoryName} title={String(category)}>{category}</strong></div>
    </div>
    <div className={classes.clockModule}>
      <div className={classes.clockCopy}><span>Round timer</span>
        <strong className={`${urgent ? classes.urgent : ''} ${critical ? classes.critical : ''}`}>{timer}</strong></div>
      <button className={`${classes.audioButton} ${audioEnabled ? classes.audioOn : ''}`} type="button"
        onClick={onUnlockAudio} aria-pressed={audioEnabled} aria-label={audioEnabled ? 'Sound enabled' : 'Enable broadcast sound'}>
        <i aria-hidden /><span>{audioEnabled ? 'Sound on' : 'Enable sound'}</span>
      </button>
    </div>
  </header>
}
