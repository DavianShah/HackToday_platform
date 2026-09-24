import { useCallback, useEffect, useRef, useState } from 'react'
import { uniqueTeams } from '@Components/live/galactic/teamSlots'
import { LiveAnnouncement, LiveSpinPhase } from '@Components/live/types'
import { crossedReminderPoints, withoutBloodScoreChanges } from '@Utils/LiveEventQueue'
import { formatDurationSeconds } from '@Utils/Shared'
import { useLiveEventQueue } from '@Hooks/useLiveEventQueue'
import { useStageSound } from '@Hooks/useStageSound'
import { LiveScoreboardStateModel, NoticeType, SpeedrunRoundStatus } from '@Api'

const SPIN_DURATION_MS = 6500
const REVEAL_DURATION_MS = 2500

export const useLivePresentation = (
  state: LiveScoreboardStateModel | undefined,
  remainingSeconds: number,
  injectedAnnouncement?: LiveAnnouncement
) => {
  const round = state?.speedrunState?.currentRound
  const activeRound = round?.status === SpeedrunRoundStatus.Running || round?.status === SpeedrunRoundStatus.Overtime
  const { audioEnabled, unlockAudio, play, stop } = useStageSound(state?.config, Boolean(state?.scoreboardFrozen))
  const {
    active: announcement,
    visible: visibleAnnouncement,
    enqueue,
    markSeen,
    clear,
  } = useLiveEventQueue(useCallback((event: LiveAnnouncement) => play(event.sound), [play]))
  const initialized = useRef(false)
  const wasFrozen = useRef(false)
  const previousRound = useRef<string | undefined>(undefined)
  const previousScores = useRef(new Map<number, number>())
  const previousRanks = useRef(new Map<number, number>())
  const processedEvents = useRef(new Set<string>())
  const reminderKeys = useRef(new Set<string>())
  const previousRemaining = useRef<{ roundKey: string; value: number } | undefined>(undefined)
  const spinTimers = useRef<number[]>([])
  const attackTimer = useRef<number | undefined>(undefined)
  const [spinPhase, setSpinPhase] = useState<LiveSpinPhase>('idle')
  const [changedTeams, setChangedTeams] = useState(new Set<number>())
  const [bloodAttackTeams, setBloodAttackTeams] = useState(new Set<number>())
  const [scoreDeltas, setScoreDeltas] = useState(new Map<number, number>())
  const [rankChanges, setRankChanges] = useState(new Map<number, { from: number; to: number }>())

  useEffect(() => {
    if (!injectedAnnouncement) return
    if (state?.scoreboardFrozen) {
      markSeen([injectedAnnouncement.key])
      return
    }
    enqueue(injectedAnnouncement)
  }, [enqueue, markSeen, injectedAnnouncement, state?.scoreboardFrozen])

  useEffect(() => {
    if (!state) return
    const eventIds = (state.recentEvents ?? []).flatMap((event) => (event.id ? [event.id] : []))
    const fingerprint = `${round?.id ?? 'none'}:${round?.status ?? 'none'}`
    if (initialized.current && fingerprint !== previousRound.current) {
      clear()
      stop()
      window.clearTimeout(attackTimer.current)
      setChangedTeams(new Set())
      setBloodAttackTeams(new Set())
      setScoreDeltas(new Map())
      setRankChanges(new Map())
    }

    if (state.scoreboardFrozen) {
      markSeen(eventIds)
      eventIds.forEach((id) => processedEvents.current.add(id))
      clear()
      spinTimers.current.forEach((timer) => window.clearTimeout(timer))
      spinTimers.current = []
      window.clearTimeout(attackTimer.current)
      previousScores.current.clear()
      previousRanks.current.clear()
      previousRound.current = fingerprint
      setSpinPhase('idle')
      setChangedTeams(new Set())
      setBloodAttackTeams(new Set())
      setScoreDeltas(new Map())
      setRankChanges(new Map())
      wasFrozen.current = true
      initialized.current = true
      return
    }

    if (wasFrozen.current) {
      uniqueTeams(state.topTeams ?? []).forEach((team) => {
        if (team.id === undefined) return
        if (typeof team.score === 'number' && Number.isFinite(team.score))
          previousScores.current.set(team.id, team.score)
        else previousScores.current.delete(team.id)
        if (team.rank !== undefined) previousRanks.current.set(team.id, team.rank)
      })
      markSeen(eventIds)
      eventIds.forEach((id) => processedEvents.current.add(id))
      previousRound.current = fingerprint
      setSpinPhase(round?.status === SpeedrunRoundStatus.Ready ? 'revealed' : 'idle')
      wasFrozen.current = false
      return
    }

    if (!initialized.current) {
      markSeen(eventIds)
      eventIds.forEach((id) => processedEvents.current.add(id))
      uniqueTeams(state.topTeams ?? []).forEach((team) => {
        if (team.id === undefined) return
        if (typeof team.score === 'number' && Number.isFinite(team.score))
          previousScores.current.set(team.id, team.score)
        else previousScores.current.delete(team.id)
        if (team.rank !== undefined) previousRanks.current.set(team.id, team.rank)
      })
      previousRound.current = fingerprint
      setSpinPhase(round?.status === SpeedrunRoundStatus.Ready ? 'revealed' : 'idle')
      initialized.current = true
      return
    }

    if (fingerprint !== previousRound.current) {
      spinTimers.current.forEach((timer) => window.clearTimeout(timer))
      spinTimers.current = []
      if (round?.status === SpeedrunRoundStatus.Ready) {
        setSpinPhase('spinning')
        play('spin')
        for (const delay of [3600, 4400, 5100, 5650, 6100])
          spinTimers.current.push(window.setTimeout(() => play('countdownTick'), delay))
        spinTimers.current.push(
          window.setTimeout(() => {
            setSpinPhase('revealed')
            enqueue({
              key: `category-${round.id}`,
              kind: 'category',
              title: 'Category selected',
              text: round.category,
              sound: 'categorySelected',
              duration: REVEAL_DURATION_MS,
            })
          }, SPIN_DURATION_MS)
        )
      } else if (round?.status === SpeedrunRoundStatus.Running) {
        setSpinPhase('idle')
        enqueue({
          key: `start-${round.id}`,
          kind: 'start',
          title: 'Round started',
          text: round.category,
          sound: 'gameStart',
          duration: 3800,
        })
      } else if (round?.status === SpeedrunRoundStatus.Overtime) {
        setSpinPhase('idle')
        enqueue({
          key: `overtime-${round.id}`,
          kind: 'overtime',
          title: 'Overtime',
          text: 'Unsolved challenges remain',
          sound: 'overtime',
          duration: 4400,
        })
      } else if (
        round?.status === SpeedrunRoundStatus.Finished ||
        (!round && previousRound.current && previousRound.current !== 'none:none')
      ) {
        setSpinPhase('idle')
        enqueue({
          key: `finished-${previousRound.current}`,
          kind: 'finished',
          title: 'Round finished',
          text: 'Waiting for the next category',
          sound: 'roundFinished',
          duration: 3500,
        })
      }
      if (round?.status === SpeedrunRoundStatus.Cancelled) setSpinPhase('idle')
      previousRound.current = fingerprint
    }

    const unseenEvents = (state.recentEvents ?? []).filter(
      (event) => event.id && !processedEvents.current.has(event.id)
    )
    const freshBloodTeamIds = new Set(
      unseenEvents.flatMap((event) => {
        const blood =
          event.type === NoticeType.FirstBlood ||
          event.type === NoticeType.SecondBlood ||
          event.type === NoticeType.ThirdBlood
        if (!blood) return []
        if (event.teamId !== undefined && event.teamId !== null) return [event.teamId]
        const teamId = uniqueTeams(state.topTeams ?? []).find((team) => team.name === event.teamName)?.id
        return teamId !== undefined && teamId !== null ? [teamId] : []
      })
    )

    for (const event of [...unseenEvents].reverse()) {
      processedEvents.current.add(event.id!)
      if (event.type === NoticeType.FirstBlood)
        enqueue({
          key: event.id!,
          kind: 'firstBlood',
          title: 'First Blood',
          text: [event.teamName, event.challengeTitle ? `solved ${event.challengeTitle}` : 'recorded a solve']
            .filter(Boolean)
            .join(' '),
          teamName: event.teamName ?? undefined,
          teamId: event.teamId ?? undefined,
          sound: 'firstBlood',
          sceneKind: 'firstBlood',
          popupDelay: 5000,
          duration: 8600,
        })
      else if (event.type === NoticeType.SecondBlood)
        enqueue({
          key: event.id!,
          kind: 'blood',
          title: 'Second Blood',
          text: [event.teamName, event.challengeTitle ? `solved ${event.challengeTitle}` : 'recorded a solve']
            .filter(Boolean)
            .join(' '),
          teamName: event.teamName ?? undefined,
          teamId: event.teamId ?? undefined,
          sound: 'secondBlood',
          sceneKind: 'blood',
          duration: 3600,
        })
      else if (event.type === NoticeType.ThirdBlood)
        enqueue({
          key: event.id!,
          kind: 'blood',
          title: 'Third Blood',
          text: [event.teamName, event.challengeTitle ? `solved ${event.challengeTitle}` : 'recorded a solve']
            .filter(Boolean)
            .join(' '),
          teamName: event.teamName ?? undefined,
          teamId: event.teamId ?? undefined,
          sound: 'thirdBlood',
          sceneKind: 'blood',
          duration: 3600,
        })
      else if (event.type === NoticeType.NewHint || event.message?.startsWith('Hint #'))
        enqueue({
          key: event.id!,
          kind: 'hint',
          title: 'Hint released',
          text: event.message,
          sound: 'hintDrop',
          sceneKind: 'hint',
          popupDelay: 2000,
          duration: 5400,
        })
      else markSeen([event.id!])
    }

    const scoreChangedTeamIds: number[] = []
    const nextScoreDeltas = new Map<number, number>()
    const nextRankChanges = new Map<number, { from: number; to: number }>()
    for (const team of uniqueTeams(state.topTeams ?? [])) {
      if (team.id === undefined) continue
      const oldScore = previousScores.current.get(team.id)
      if (
        oldScore !== undefined &&
        typeof team.score === 'number' &&
        Number.isFinite(team.score) &&
        team.score > oldScore
      ) {
        scoreChangedTeamIds.push(team.id)
        nextScoreDeltas.set(team.id, team.score - oldScore)
        if (!freshBloodTeamIds.has(team.id)) play('correctSubmit')
      }
      const oldRank = previousRanks.current.get(team.id)
      if (oldRank !== undefined && team.rank !== undefined && oldRank !== team.rank)
        nextRankChanges.set(team.id, { from: oldRank, to: team.rank })
      if (typeof team.score === 'number' && Number.isFinite(team.score)) previousScores.current.set(team.id, team.score)
      else previousScores.current.delete(team.id)
      if (team.rank !== undefined) previousRanks.current.set(team.id, team.rank)
    }
    if (scoreChangedTeamIds.length || nextRankChanges.size) {
      const ordinaryChanges = new Set(withoutBloodScoreChanges(scoreChangedTeamIds, freshBloodTeamIds))
      const bloodChanges = new Set(scoreChangedTeamIds.filter((teamId) => freshBloodTeamIds.has(teamId)))
      setChangedTeams(ordinaryChanges)
      setBloodAttackTeams(bloodChanges)
      setScoreDeltas(nextScoreDeltas)
      setRankChanges(nextRankChanges)
      window.clearTimeout(attackTimer.current)
      attackTimer.current = window.setTimeout(() => {
        setChangedTeams(new Set())
        setBloodAttackTeams(new Set())
        setScoreDeltas(new Map())
        setRankChanges(new Map())
      }, 3200)
    }
  }, [clear, enqueue, markSeen, play, stop, round, state])

  useEffect(() => {
    if (state?.scoreboardFrozen || !activeRound || !round?.id) {
      previousRemaining.current = undefined
      return
    }

    const roundKey = `${round.id}-${round.status}`
    const previous = previousRemaining.current
    previousRemaining.current = { roundKey, value: remainingSeconds }
    if (!previous || previous.roundKey !== roundKey) return

    for (const reminderPoint of crossedReminderPoints(previous.value, remainingSeconds)) {
      const key = `time-${round.id}-${round.status}-${reminderPoint}`
      if (reminderKeys.current.has(key)) continue
      reminderKeys.current.add(key)
      enqueue({
        key,
        kind: reminderPoint <= 10 ? 'countdown' : 'reminder',
        title: reminderPoint <= 10 ? String(reminderPoint) : `${formatDurationSeconds(reminderPoint)} left`,
        text: reminderPoint <= 10 ? 'Final countdown' : 'Round time',
        sound: reminderPoint <= 10 ? 'countdownTick' : 'reminder',
        duration: reminderPoint <= 10 ? 800 : 2100,
      })
    }
  }, [activeRound, enqueue, remainingSeconds, round?.id, round?.status, state?.scoreboardFrozen])

  useEffect(
    () => () => {
      spinTimers.current.forEach((timer) => window.clearTimeout(timer))
      window.clearTimeout(attackTimer.current)
    },
    []
  )

  return {
    announcement,
    visibleAnnouncement,
    audioEnabled,
    unlockAudio,
    spinPhase,
    changedTeams,
    bloodAttackTeams,
    scoreDeltas,
    rankChanges,
  }
}
