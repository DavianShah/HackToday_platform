import classes from '@Styles/GalacticCommand.module.css'

export function LiveArenaFallback({ message }: { message: string }) {
  return (
    <div className={classes.worldFallback} role="status">
      <div className={classes.fallbackFortress} aria-hidden />
      <span>{message}</span>
    </div>
  )
}
