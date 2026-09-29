import { FC, useLayoutEffect, useRef } from 'react'
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

export const LiveAnnouncementOverlay: FC<{ event?: LiveAnnouncement }> = ({ event }) => {
  const titleRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (event?.kind !== 'firstBlood' || !titleRef.current) return
    const title = titleRef.current
    const measure = () => {
      const naturalWidth = title.offsetWidth
      if (naturalWidth) title.style.setProperty('--blood-fit', String(window.innerWidth * 0.9 / naturalWidth))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(document.documentElement)
    void document.fonts.ready.then(measure)
    measure()
    return () => observer.disconnect()
  }, [event?.kind, event?.key, event?.title])
  return event ? <div key={event.key}
  className={`${classes.announcement} ${announcementClasses[event.kind] ?? ''} ${event.sound === 'thirdBlood' ? classes.announcement_thirdBlood : ''}`} role="status" aria-live="assertive">
  <div className={classes.announcementFrame} aria-hidden />
  <div className={classes.announcementCopy}>
    {eyebrow[event.kind] && <small>{eyebrow[event.kind]}</small>}
    <strong ref={event.kind === 'firstBlood' ? titleRef : undefined} data-blood-title={event.kind === 'firstBlood' ? '' : undefined}>{event.title}</strong>
    {event.kind === 'firstBlood' || event.kind === 'blood' ? (
      <>
        {event.teamName && <span className={classes.bloodTeam}>{event.teamName}</span>}
        {event.challengeTitle && <span className={classes.bloodChallenge}>{event.challengeTitle}</span>}
        {!event.teamName && !event.challengeTitle && event.text && <span>{event.text}</span>}
      </>
    ) : event.text && <span>{event.text}</span>}
  </div>
</div> : null
}
