import { CSSProperties, FC } from 'react'
import { LiveScoreboardTeamModel } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'
import { uniqueTeams } from './galactic/teamSlots'

const podiumClass = (rank?: number) => {
  if (rank === 1) return classes.podium1
  if (rank === 2) return classes.podium2
  if (rank === 3) return classes.podium3
  return ''
}

const numeric = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—')

export const LiveScoreboardPanel: FC<{
  teams: LiveScoreboardTeamModel[]
  changedTeams: Set<number>
  bloodTeams?: Set<number>
  rankChanges: Map<number, { from: number; to: number }>
  frozen?: boolean
}> = ({ teams, changedTeams, bloodTeams = new Set(), rankChanges, frozen }) => (
  <aside className={`${classes.panel} ${classes.scoreboardPanel}`}>
    <header className={classes.panelHead}>
      <div>
        <span className={classes.eyebrow}>Live standings · top 10</span>
        <h2 className={classes.panelTitle}>Standings</h2>
      </div>
    </header>
    {frozen ? (
      <div className={classes.sealedRows}>
        <div>
          <strong>Standings sealed</strong>
          <span>Names, scores, solves, and movement are hidden until the freeze is lifted.</span>
        </div>
      </div>
    ) : (
      <div className={classes.scoreRows}>
        {uniqueTeams(teams)
          .slice(0, 10)
          .map((team) => {
            const id = team.id!
            const movement = rankChanges.get(id)
            const rank = Number.isSafeInteger(team.rank) && team.rank! > 0 ? team.rank : undefined
            const name = typeof team.name === 'string' && team.name.trim() ? team.name : 'Unnamed team'
            return (
              <div
                key={id}
                style={
                  movement
                    ? ({ '--rank-start': movement.to < movement.from ? '12px' : '-12px' } as CSSProperties)
                    : undefined
                }
                className={`${classes.scoreRow} ${podiumClass(rank)} ${movement ? classes.rankMoved : ''} ${changedTeams.has(id) || bloodTeams.has(id) ? classes.scorePulse : ''}`}
              >
                <strong>{rank === undefined ? '--' : String(rank).padStart(2, '0')}</strong>
                <div className={classes.teamIdentity}>
                  <b title={name}>{name}</b>
                  <small>{numeric(team.solvedCount)} solves</small>
                </div>
                <span className={classes.scoreValue}>{numeric(team.score)}</span>
              </div>
            )
          })}
        {!teams.length && (
          <div className={classes.emptyState}>
            <i aria-hidden />
            No ranked teams are available yet
          </div>
        )}
      </div>
    )}
  </aside>
)
