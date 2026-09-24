import { CSSProperties, FC } from 'react'
import { ChallengeCategory, LiveScoreboardTeamModel, SpeedrunRoundModel, SpeedrunRoundStatus } from '@Api'
import { LiveSpinPhase } from '@Components/live/types'
import { useChallengeCategoryLabelMap } from '@Utils/Shared'
import orbitalCore from '../../assets/live-galactic/orbital-core.svg'
import sectorMarker from '../../assets/live-galactic/sector-marker.svg'
import classes from '@Styles/GalacticCommand.module.css'

const pingPosition = (id: number, index: number) => ({
  '--ping-x': `${18 + Math.abs((id * 37 + index * 11) % 65)}%`,
  '--ping-y': `${20 + Math.abs((id * 23 + index * 17) % 55)}%`,
  '--ping-color': index % 3 === 0 ? '#FFD166' : '#61E7FF',
}) as CSSProperties

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
}> = ({ round, remaining, used = [], spinPhase, teams, attackingTeams, bloodTeams, scoreDeltas, frozen }) => {
  const categoryMap = useChallengeCategoryLabelMap()
  const category = round?.category ? categoryMap.get(round.category) : undefined
  const active = round?.status === SpeedrunRoundStatus.Running || round?.status === SpeedrunRoundStatus.Overtime
  const title = spinPhase === 'spinning' ? 'Scanning sectors' : category?.name ?? round?.category ?? 'Awaiting sector'
  const detail = spinPhase === 'spinning'
    ? 'The selected category remains concealed until the scan completes.'
    : active
      ? 'Active sector synchronized with the live Speedrun round.'
      : round?.status === SpeedrunRoundStatus.Ready
        ? 'Sector selected. Teams are standing by for round start.'
        : round?.status === SpeedrunRoundStatus.Finished
          ? 'Round complete. Waiting for the next sector.'
          : 'Orbital map holding for the next verified round.'
  const effectIds = [...new Set([...attackingTeams, ...bloodTeams])]

  return <section className={`${classes.arena} ${spinPhase === 'spinning' ? classes.arenaSpinning : ''} ${attackingTeams.size ? classes.arenaImpact : ''} ${bloodTeams.size ? classes.arenaBloodImpact : ''}`} aria-label="Holographic sector map">
    <div className={classes.arenaGrid} aria-hidden />
    <div className={classes.arenaScan} aria-hidden />
    <div className={classes.sectorCounts}>
      <div className={classes.countCard}><span>Available sectors</span><strong>{remaining.length}</strong></div>
      <div className={classes.countCard}><span>Activated / previous</span><strong>{used.length}</strong></div>
    </div>
    <div className={classes.sectorVisual} aria-hidden>
      <img className={classes.orbitalCore} src={orbitalCore} alt="" />
      <i className={classes.orbitRing} /><i className={classes.orbitRingTwo} /><i className={classes.radarSweep} />
      <img className={`${classes.sectorMarker} ${classes.markerOne}`} src={sectorMarker} alt="" />
      <img className={`${classes.sectorMarker} ${classes.markerTwo}`} src={sectorMarker} alt="" />
      <img className={`${classes.sectorMarker} ${classes.markerThree}`} src={sectorMarker} alt="" />
    </div>
    {!frozen && <div className={classes.energyPings} aria-hidden>{effectIds.map((id, index) => {
      const team = teams.find(value => value.id === id)
      const stableId = team?.id ?? id
      const delta = scoreDeltas.get(id)
      return <i className={classes.energyPing} style={pingPosition(stableId, index)} key={stableId}>
        {delta !== undefined && <b className={classes.pingDelta}>+{delta.toLocaleString()}</b>}
      </i>
    })}</div>}
    <div className={classes.arenaReadout}>
      <span className={classes.eyebrow}>{active ? 'Active sector' : 'Sector control'}</span>
      <h1 className={classes.arenaTitle} title={String(title)}>{title}</h1>
      <p className={classes.arenaDetail}>{detail}</p>
    </div>
    {frozen && <div className={classes.frozenSeal} role="status"><strong>Standings sealed</strong><span>Team telemetry is hidden during the freeze.</span></div>}
  </section>
}
