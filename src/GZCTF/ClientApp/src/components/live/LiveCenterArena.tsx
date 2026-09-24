import { FC } from 'react'
import { ChallengeCategory, LiveScoreboardTeamModel, SpeedrunRoundModel } from '@Api'
import { LiveSpinPhase } from './types'
import classes from '@Styles/GalacticCommand.module.css'

export const LiveCenterArena: FC<{
  round?: SpeedrunRoundModel | null; remaining: ChallengeCategory[]; used?: ChallengeCategory[]
  spinPhase: LiveSpinPhase; teams: LiveScoreboardTeamModel[]; attackingTeams: Set<number>
  bloodTeams: Set<number>; scoreDeltas: Map<number, number>; frozen?: boolean
}> = ({ round, spinPhase, frozen, remaining, used = [] }) => <section className={classes.arena} aria-label="Central battlefield">
  {spinPhase === 'spinning' && <div className={classes.sectorScanLabels} aria-label="Scanning available galactic sectors">
    {[...new Set([...remaining, ...used])].map(category => <span key={category}>{category}</span>)}
  </div>}
  <div className={classes.arenaReadout}>
    <span className={classes.eyebrow}>{frozen ? 'Standings sealed' : 'Orbital command'}</span>
    <h1 className={classes.arenaTitle}>{spinPhase === 'spinning' ? 'Scanning sectors' : round?.category ?? 'Awaiting sector'}</h1>
    <p className={classes.arenaDetail}>{spinPhase === 'spinning' ? 'Selection in progress' : frozen ? 'Team telemetry is hidden during the freeze.' : 'Live Speedrun transmission'}</p>
  </div>
</section>
