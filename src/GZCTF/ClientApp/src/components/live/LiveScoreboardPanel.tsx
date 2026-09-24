import { FC } from 'react'
import { LiveScoreboardTeamModel } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'

const podiumClass = (rank?: number) => {
  if (rank === 1) return classes.podium1
  if (rank === 2) return classes.podium2
  if (rank === 3) return classes.podium3
  return ''
}

const teamLabel = (rank?: number) => rank === 1 ? 'Leading team' : rank && rank <= 3 ? 'Podium position' : 'Ranked team'

export const LiveScoreboardPanel: FC<{
  teams: LiveScoreboardTeamModel[]
  changedTeams: Set<number>
  bloodTeams?: Set<number>
  scoreDeltas: Map<number, number>
  rankChanges: Map<number, { from: number; to: number }>
  frozen?: boolean
}> = ({ teams, changedTeams, bloodTeams = new Set(), scoreDeltas, rankChanges, frozen }) => <aside className={`${classes.panel} ${classes.scoreboardPanel}`}>
  <header className={classes.panelHead}>
    <div><span className={classes.eyebrow}>Live standings · top 10</span><h2 className={classes.panelTitle}>Standings</h2></div>
    <div className={classes.columnLabels}><span>Score</span><span>Solves</span></div>
  </header>
  {frozen ? <div className={classes.sealedRows}><div><strong>Standings sealed</strong><span>Names, scores, solves, and movement are hidden until the freeze is lifted.</span></div></div>
    : <div className={classes.scoreRows}>{teams.slice(0, 10).map((team, index) => {
      const id = team.id ?? index
      const delta = scoreDeltas.get(id)
      const movement = rankChanges.get(id)
      const rank = team.rank ?? index + 1
      const name = team.name ?? 'Unknown team'
      return <div key={id} className={`${classes.scoreRow} ${podiumClass(rank)} ${changedTeams.has(id) || bloodTeams.has(id) ? classes.scorePulse : ''}`}>
        <strong>{String(rank).padStart(2, '0')}</strong>
        <div className={classes.teamIdentity}><b title={name}>{name}</b><small>{team.solvedCount ?? "?"} solves ? {teamLabel(rank)}</small></div>
        <span className={classes.scoreValue}>{team.score?.toLocaleString() ?? 0}</span>
        <em className={classes.solveValue}>{team.solvedCount ?? 0}</em>
        {movement && <div className={classes.rankShift}>{movement.to < movement.from ? '↑' : '↓'} {movement.from} → {movement.to}</div>}
        {delta !== undefined && <div className={classes.scoreDelta}>+{delta.toLocaleString()}</div>}
      </div>
    })}{!teams.length && <div className={classes.emptyState}><i aria-hidden />No ranked teams are available yet</div>}</div>}
</aside>
