import { CSSProperties, FC } from 'react'
import { ChallengeCategory, LiveScoreboardTeamModel, SpeedrunRoundModel, SpeedrunRoundStatus } from '@Api'
import { LiveSpinPhase } from '@Components/live/types'
import { useChallengeCategoryLabelMap } from '@Utils/Shared'
import classes from '@Styles/CyberpunkBossRaid.module.css'

const unitTypes = ['ASSAULT MECH', 'COMBAT DRONE', 'HOVERCRAFT']
const unitColors = ['#8b8dd8', '#ffcd2a', '#b4b6e7', '#e83380', '#5355c4', '#f4a5c8']

const bossState = (integrity: number) => {
  if (integrity <= 0) return ['defeated', 'DEFEATED'] as const
  if (integrity <= .25) return ['critical', 'CRITICAL'] as const
  if (integrity <= .5) return ['enraged', 'ENRAGED'] as const
  if (integrity <= .75) return ['alert', 'ALERT'] as const
  return ['normal', 'NORMAL'] as const
}

const unitType = (teamId: number | undefined, index: number) => unitTypes[Math.abs((teamId ?? index) % unitTypes.length)]

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
  const totalCategories = remaining.length + used.length
  const integrity = totalCategories ? remaining.length / totalCategories : 1
  const [phase, phaseLabel] = bossState(integrity)
  const active = round?.status === SpeedrunRoundStatus.Running || round?.status === SpeedrunRoundStatus.Overtime
  const title = spinPhase === 'spinning' ? 'TARGET ACQUISITION' : round?.category ? String(round.category) : 'AWAITING TARGET'
  const detail = spinPhase === 'spinning'
    ? 'Scanning challenge sectors…'
    : active
      ? `${remaining.length} sectors remain in this raid`
      : round?.status === SpeedrunRoundStatus.Ready
        ? 'Combat units standing by'
        : 'Waiting for the next raid round'

  return <section className={`${classes.raidArena} ${classes[`phase_${phase}`]} ${spinPhase === 'spinning' ? classes.raidSpinning : ''} ${attackingTeams.size ? classes.raidImpact : ''} ${bloodTeams.size ? classes.raidBloodImpact : ''}`} aria-label="Cyberpunk boss raid arena">
    <div className={classes.arenaGrid} aria-hidden />
    <div className={classes.arenaScanline} aria-hidden />

    <div className={classes.bossDock} aria-label={`Boss integrity ${Math.round(integrity * 100)} percent`}>
      <div className={classes.bossHeader}><span>HOSTILE AI CORE</span><b>{phaseLabel}</b></div>
      <div className={classes.bossEntity} aria-hidden>
        <div className={classes.bossHalo} />
        <div className={classes.bossFrame}><i /><i /><i /><i /></div>
        <div className={classes.bossEye}><span /></div>
        <div className={classes.bossCore}><span /></div>
        <div className={classes.bossCables}><i /><i /><i /></div>
      </div>
      <div className={classes.bossMeter}><span style={{ width: `${Math.max(0, integrity) * 100}%` }} /><b>{Math.round(integrity * 100)}% integrity</b></div>
      <small className={classes.bossCaption}>{phase === 'defeated' ? 'SYSTEM OVERRIDE' : 'NEURAL FIREWALL ACTIVE'}</small>
    </div>

    <div className={classes.targetReadout}>
      <span className={classes.eyebrow}>{category ? 'CURRENT TARGET' : 'RAID STATUS'}</span>
      <h1>{title}</h1>
      <p>{detail}</p>
      {category && <span className={classes.targetChip}>{category.name} sector</span>}
    </div>

    <div className={classes.unitLanes} aria-label="Team combat units">
      {teams.slice(0, 8).map((team, index) => {
        const id = team.id ?? index
        const attacking = attackingTeams.has(id) || bloodTeams.has(id)
        const blood = bloodTeams.has(id)
        const delta = scoreDeltas.get(id)
        const unitStyle = { '--unit-color': unitColors[index % unitColors.length] } as CSSProperties
        return <div className={`${classes.unitLane} ${attacking ? classes.unitLaneActive : ''}`} key={`${id}-${delta ?? 0}`}>
          <div className={classes.laneLabel} style={unitStyle}><span>{String(team.rank ?? index + 1).padStart(2, '0')}</span><strong>{team.name ?? 'Unknown unit'}</strong><small>{unitType(team.id, index)}</small></div>
          <div className={`${classes.combatUnit} ${classes[`unit_${index % 3}`]} ${attacking ? classes.combatUnitAttack : ''} ${blood ? classes.combatUnitBlood : ''}`} style={unitStyle} aria-hidden>
            <i /><i /><i />
          </div>
          {attacking && <div className={`${classes.attackBeam} ${blood ? classes.attackBeamHeavy : ''}`} style={unitStyle} key={`beam-${id}-${delta ?? 0}`} aria-hidden><i /></div>}
          {attacking && !frozen && delta !== undefined && <b className={classes.floatingDelta} style={unitStyle}>+{delta.toLocaleString()}</b>}
        </div>
      })}
    </div>

    {phase === 'defeated' && <div className={classes.defeatBanner} role="status"><span>SYSTEM OVERRIDE</span><strong>BOSS DEFEATED</strong><small>Final ranking locked from scoreboard data</small></div>}
    <div className={classes.arenaLegend}><span><i className={classes.legendUnit} /> Combat units</span><span><i className={classes.legendAttack} /> Score attack</span><span><i className={classes.legendBoss} /> Boss integrity</span></div>
  </section>
}
