import { FC } from 'react'
import { LiveAnnouncement } from '@Components/live/types'
import classes from '@Styles/GalacticCommand.module.css'

const announcementClasses: Partial<Record<LiveAnnouncement['kind'], string>> = {
  firstBlood: classes.announcement_firstBlood,
  blood: classes.announcement_blood,
  hint: classes.announcement_hint,
  overtime: classes.announcement_overtime,
  countdown: classes.announcement_countdown,
  category: classes.announcement_category,
}

const eyebrow: Partial<Record<LiveAnnouncement['kind'], string>> = {
  firstBlood: 'Priority transmission', blood: 'Solve transmission', hint: 'Data packet received',
  overtime: 'Critical round status', correct: 'Verified score update', wrong: 'Preview simulation',
  category: 'Sector acquired', start: 'Round synchronization', finished: 'Round status',
  reminder: 'Time remaining', countdown: 'Final countdown',
}

export const LiveAnnouncementOverlay: FC<{ event?: LiveAnnouncement }> = ({ event }) => event ? <div
  className={`${classes.announcement} ${announcementClasses[event.kind] ?? ''}`} role="status" aria-live="assertive">
  <div className={classes.announcementFrame} aria-hidden />
  <div className={classes.announcementCopy}>
    {eyebrow[event.kind] && <small>{eyebrow[event.kind]}</small>}
    <strong>{event.title}</strong>
    {event.text && <span>{event.text}</span>}
  </div>
</div> : null
