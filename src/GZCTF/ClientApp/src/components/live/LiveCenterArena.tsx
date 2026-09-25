import { FC } from 'react'
import Icon from '@mdi/react'
import { useChallengeCategoryLabelMap } from '@Utils/Shared'
import { ChallengeCategory, LiveScoreboardTeamModel, SpeedrunRoundModel } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'
import { LiveSpinPhase } from './types'

export const LiveCenterArena: FC<{
  round?: SpeedrunRoundModel | null
  remaining: ChallengeCategory[]
  used?: ChallengeCategory[]
  spinPhase: LiveSpinPhase
  teams: LiveScoreboardTeamModel[]
  attackingTeams: Set<number>
  bloodTeams: Set<number>
  scoreDeltas: Map<number, number>
  frozen?: boolean
}> = ({ round, spinPhase, frozen, remaining, used = [] }) => {
  const categoryMap = useChallengeCategoryLabelMap()
  const categoryVisual = spinPhase !== 'spinning' && round?.category ? categoryMap.get(round.category) : undefined
  return (
  <section className={classes.arena} aria-label="Central battlefield">
    {spinPhase === 'spinning' && (
      <div className={classes.sectorScanLabels} aria-label="Scanning available galactic sectors">
        {[...new Set([...remaining, ...used])].map((category) => (
          <span key={category}>
            {categoryMap.get(category) && <Icon path={categoryMap.get(category)!.icon} size={0.7} aria-hidden />}
            {category}
          </span>
        ))}
      </div>
    )}
    <div className={classes.arenaReadout}>
      <span className={classes.eyebrow}>{frozen ? 'Standings sealed' : 'Orbital command'}</span>
      <h1 className={classes.arenaTitle}>
        {categoryVisual && <Icon path={categoryVisual.icon} size={1.2} aria-hidden />}
        {spinPhase === 'spinning' ? 'Scanning sectors' : (round?.category ?? 'Awaiting sector')}
      </h1>
      <p className={classes.arenaDetail}>
        {spinPhase === 'spinning'
          ? 'Selection in progress'
          : frozen
            ? 'Team telemetry is hidden during the freeze.'
            : 'Live Speedrun transmission'}
      </p>
    </div>
  </section>
  )
}
