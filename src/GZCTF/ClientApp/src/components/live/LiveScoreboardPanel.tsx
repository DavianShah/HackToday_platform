import { FC } from 'react'
import { LiveScoreboardTeamModel } from '@Api'
import classes from '@Styles/CyberpunkBossRaid.module.css'

const podiumClass = (rank?: number) => {
  if (rank === 1) return classes.podium1
  if (rank === 2) return classes.podium2
  if (rank === 3) return classes.podium3
  return ''
}

const unitType = (id: number | undefined, index: number) => ['Assault mech', 'Combat drone', 'Hovercraft'][Math.abs((id ?? index) % 3)]

export const LiveScoreboardPanel: FC<{
  teams: LiveScoreboardTeamModel[]
  changedTeams: Set<number>
  bloodTeams?: Set<number>
  scoreDeltas: Map<number, number>
  rankChanges: Map<number, { from: number; to: number }>
  frozen?: boolean
}> = ({ teams, changedTeams, bloodTeams = new Set(), scoreDeltas, rankChanges, frozen }) => <aside className={`${classes.waterPanel} ${classes.scoreboardPanel}`}>
  <header className={classes.panelHead}>
    <div><span>Combat units · top 10</span><h2>Leaderboard</h2></div>
    <div className={classes.scoreLabels}><span>Score</span><span>Solves</span></div>
  </header>
  <div className={classes.scoreRows}>{teams.slice(0, 10).map((team, index) => {
    const id = team.id ?? index
    const delta = scoreDeltas.get(id)
    const movement = rankChanges.get(id)
    return <div key={id} className={`${classes.scoreRow} ${podiumClass(team.rank)} ${changedTeams.has(id) || bloodTeams.has(id) ? classes.scorePulse : ''}`}>
      <strong>{team.rank ?? index + 1}</strong>
      <div><b>{team.name ?? 'Unknown unit'}</b><small>{team.rank === 1 ? 'Raid leader' : unitType(team.id, index)}</small></div>
      <span>{frozen ? '???' : team.score?.toLocaleString() ?? 0}</span>
      <em>{frozen ? '???' : team.solvedCount ?? 0}</em>
      {movement && <div className={classes.rankShift}>{movement.to < movement.from ? '↑' : '↓'} #{movement.from} → #{movement.to}</div>}
      {delta !== undefined && !frozen && <div className={classes.scoreDelta}>+{delta.toLocaleString()} score attack</div>}
    </div>
  })}</div>
</aside>
