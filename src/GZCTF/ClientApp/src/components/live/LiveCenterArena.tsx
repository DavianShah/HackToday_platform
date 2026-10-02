import { FC } from 'react'
import { Icon } from '@mdi/react'
import { useChallengeCategoryLabelMap } from '@Utils/Shared'
import { ChallengeCategory, LiveScoreboardTeamModel, SpeedrunRoundModel } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'
import { LiveSpinPhase } from './types'
import logo from '../../assets/logo.png'

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
  const categoryVisual = spinPhase !== 'spinning' && round?.category ? categoryMap.get(round.category) : undefined
  return (
  <section className={classes.arena} aria-label="Central battlefield">
    {!frozen && spinPhase === 'spinning' && (
      <div className={classes.vortexIdentity} aria-label={`Selecting ${round?.category ?? 'category'}`}>
        <div className={classes.vortexOrbit}>
          <div className={classes.vortexLogo}><img src={logo} alt="HackToday logo" /></div>
          <strong className={classes.vortexCategory}>{round?.category ?? 'Selecting category'}</strong>
        </div>
      </div>
    )}
    {!frozen && spinPhase !== 'spinning' && <div className={classes.arenaReadout}>
      <span className={classes.eyebrow}>Orbital command</span>
      <h1 className={classes.arenaTitle}>
        {categoryVisual && <Icon path={categoryVisual.icon} size={1.2} aria-hidden />}
        {round?.category ?? 'Awaiting sector'}
      </h1>
      <p className={classes.arenaDetail}>Live Speedrun transmission</p>
    </div>}
  </section>
  )
}
