import { CSSProperties, FC } from 'react'
import { Icon } from '@mdi/react'
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
}> = ({ round, spinPhase, frozen }) => {
  const categoryMap = useChallengeCategoryLabelMap()
  const categoryVisual = round?.category ? categoryMap.get(round.category) : undefined
  const categoryStyle = categoryVisual ? ({ '--category-color': categoryVisual.colors[4] } as CSSProperties) : undefined
  return (
  <section className={classes.arena} aria-label="Central battlefield">
    {!frozen && spinPhase === 'spinning' && (
      <div className={classes.vortexIdentity} style={categoryStyle} aria-label={`Selecting ${categoryVisual?.name ?? round?.category ?? 'category'}`}>
        <div className={classes.vortexOrbit}>
          <div className={classes.vortexLogo}>{categoryVisual && <Icon path={categoryVisual.icon} size={3.3} aria-hidden />}</div>
          <strong className={classes.vortexCategory}>{categoryVisual?.name ?? round?.category ?? 'Selecting category'}</strong>
        </div>
      </div>
    )}
    {!frozen && spinPhase !== 'spinning' && <div className={classes.arenaReadout}>
      <span className={classes.eyebrow}>Orbital command</span>
      <h1 className={classes.arenaTitle}>
        {categoryVisual && <Icon path={categoryVisual.icon} size={1.2} aria-hidden />}
        {categoryVisual?.name ?? round?.category ?? 'Awaiting sector'}
      </h1>
      <p className={classes.arenaDetail}>Live Speedrun transmission</p>
    </div>}
  </section>
  )
}
