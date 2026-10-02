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
}> = ({ round, remaining, used = [], spinPhase, frozen }) => {
  const categoryMap = useChallengeCategoryLabelMap()
  const categoryVisual = round?.category ? categoryMap.get(round.category) : undefined
  const categoryStyle = categoryVisual ? ({ '--category-color': categoryVisual.colors[4] } as CSSProperties) : undefined
  const categories = [...new Set([...remaining, ...used, ...(round?.category ? [round.category] : [])])]
  return (
  <section className={classes.arena} aria-label="Central battlefield">
    {!frozen && spinPhase === 'spinning' && (
      <div className={classes.vortexIdentity} aria-label={`Selecting from ${categories.length} categories`}>
        <div className={classes.vortexOrbit}>
          {categories.map((category, index) => {
            const visual = categoryMap.get(category)
            const style = {
              '--category-color': visual?.colors[4] ?? 'var(--gc-cyan)',
              '--sector-angle': `${(index * 360) / categories.length}deg`,
              '--sector-angle-negative': `${(-index * 360) / categories.length}deg`,
            } as CSSProperties
            return <div className={classes.vortexItem} key={category} style={style}>
              <div className={classes.vortexCategory}>
                {visual && <Icon path={visual.icon} size={0.85} aria-hidden />}
                <span>{visual?.name ?? category}</span>
              </div>
            </div>
          })}
        </div>
      </div>
    )}
    {!frozen && spinPhase === 'revealed' && round?.category && (
      <div className={classes.categoryReveal} style={categoryStyle} role="status">
        {categoryVisual && <Icon path={categoryVisual.icon} size={2.4} aria-hidden />}
        <strong>{categoryVisual?.name ?? round.category}</strong>
      </div>
    )}
    {!frozen && spinPhase === 'idle' && <div className={classes.arenaReadout}>
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
