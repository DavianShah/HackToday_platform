import { CSSProperties, FC } from 'react'
import Icon from '@mdi/react'
import { useChallengeCategoryLabelMap } from '@Utils/Shared'
import { ChallengeCategory, SpeedrunRoundModel, SpeedrunRoundStatus } from '@Api'
import classes from '@Styles/GalacticCommand.module.css'

const CategoryList: FC<{ values: ChallengeCategory[]; className: string }> = ({ values, className }) => {
  const categoryMap = useChallengeCategoryLabelMap()
  return (
    <div className={classes.poolValues}>
      {values.length ? (
        values.map((value) => {
          const visual = categoryMap.get(value)
          const style = visual ? ({ '--category-color': visual.colors[4] } as CSSProperties) : undefined
          return (
            <span
              className={`${classes.categoryPill} ${className}`}
              style={style}
              key={value}
              title={visual?.name ?? String(value)}
            >
              {visual && <Icon path={visual.icon} size={0.6} aria-hidden />}
              {visual?.name ?? value}
            </span>
          )
        })
      ) : (
        <span className={classes.emptyPill}>None</span>
      )}
    </div>
  )
}

export const LiveCategoryPool: FC<{
  round?: SpeedrunRoundModel | null
  available: ChallengeCategory[]
  used: ChallengeCategory[]
  concealActive?: boolean
}> = ({ round, available, used, concealActive }) => (
  <footer className={classes.categoryPool}>
    <div className={classes.poolGroup}>
      <b className={classes.poolLabel}>Galactic sectors / Current</b>
      <CategoryList
        values={!concealActive && round?.category ? [round.category] : []}
        className={round?.status === SpeedrunRoundStatus.Ready ? classes.selectedPill : classes.activePill}
      />
    </div>
    <div className={classes.poolGroup}>
      <b className={classes.poolLabel}>Available sectors</b>
      <CategoryList values={available} className={classes.availablePill} />
    </div>
    <div className={classes.poolGroup}>
      <b className={classes.poolLabel}>Used / started</b>
      <CategoryList values={used} className={classes.usedPill} />
    </div>
  </footer>
)
