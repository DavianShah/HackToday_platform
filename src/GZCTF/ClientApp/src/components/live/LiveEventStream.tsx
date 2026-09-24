import { FC } from 'react'
import { LiveScoreboardEventModel, NoticeType } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'

const eventMeta = (event: LiveScoreboardEventModel) => {
  if (event.type === NoticeType.FirstBlood) return ['First Blood', classes.bloodEvent]
  if (event.type === NoticeType.SecondBlood) return ['Second Blood', classes.bloodEvent]
  if (event.type === NoticeType.ThirdBlood) return ['Third Blood', classes.bloodEvent]
  if (event.type === NoticeType.NewHint || event.message?.startsWith('Hint #')) return ['Hint released', classes.hintEvent]
  if (event.message?.toLowerCase().includes('overtime')) return ['Overtime', classes.overtimeEvent]
  if (event.message?.toLowerCase().includes('category')) return ['Sector update', classes.roundEvent]
  if (event.message?.toLowerCase().includes('round')) return ['Round update', classes.roundEvent]
  return ['Transmission', '']
}

const eventTime = (createdAt?: number) => createdAt
  ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .format(new Date(createdAt))
  : '--:--:--'

export const LiveEventStream: FC<{ events: LiveScoreboardEventModel[]; frozen?: boolean }> = ({ events, frozen }) => <aside className={`${classes.panel} ${classes.eventPanel}`}>
  <header className={classes.panelHead}><div><span className={classes.eyebrow}>Galactic transmission</span><h2 className={classes.panelTitle}>Recent events</h2></div><i className={classes.signal} aria-hidden /></header>
  {frozen ? <div className={classes.sealedRows}><div><strong>Feed sealed</strong><span>Event identities are hidden while standings are frozen.</span></div></div>
    : <div className={classes.eventRows}>{events.slice(0, 8).map(event => {
      const [label, color] = eventMeta(event)
      return <article className={`${classes.eventRow} ${color}`} key={event.id ?? `${event.createdAt}-${event.message}`}>
        <time className={classes.eventTime} dateTime={event.createdAt ? new Date(event.createdAt).toISOString() : undefined}>{eventTime(event.createdAt)}</time>
        <div className={classes.eventBody}><b className={classes.eventBadge}>{label}</b><p className={classes.eventMessage}>{event.message}</p></div>
      </article>
    })}{!events.length && <div className={classes.emptyState}><i aria-hidden />Awaiting verified live events</div>}</div>}
</aside>
