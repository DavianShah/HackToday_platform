import { useCallback, useEffect, useRef, useState } from 'react'
import { LiveScoreboardConfigModel } from '@Api'
import { stageSoundPack } from '@Components/live/stageSoundPack'
import { StageSoundName } from '@Components/live/types'

const patterns: Record<StageSoundName, [number, number, OscillatorType][]> = {
  spin: [[180, .22, 'sine'], [220, .22, 'sine'], [270, .22, 'sine'], [330, .22, 'sine'], [400, .22, 'sine'],
    [480, .22, 'sine'], [570, .22, 'sine'], [680, .22, 'sine'], [810, .25, 'sine'], [960, .32, 'sine']],
  categorySelected: [[523, .16, 'sine'], [659, .16, 'sine'], [784, .3, 'sine']],
  gameStart: [[262, .18, 'triangle'], [392, .18, 'triangle'], [523, .45, 'triangle']],
  hintDrop: [[880, .1, 'sine'], [1175, .12, 'sine'], [1568, .25, 'sine']],
  firstBlood: [[90, .35, 'sawtooth'], [180, .25, 'triangle'], [720, .45, 'sine']],
  secondBlood: [[130, .25, 'sawtooth'], [520, .3, 'sine']],
  thirdBlood: [[160, .22, 'triangle'], [440, .28, 'sine']],
  correctSubmit: [[523, .12, 'sine'], [659, .12, 'sine'], [784, .2, 'sine']],
  wrongSubmit: [[220, .16, 'square'], [155, .25, 'square']],
  reminder: [[500, .22, 'triangle']],
  countdownTick: [[760, .09, 'square']],
  overtime: [[180, .2, 'sawtooth'], [260, .2, 'sawtooth'], [180, .3, 'sawtooth']],
  roundFinished: [[523, .18, 'sine'], [392, .18, 'sine'], [262, .35, 'sine']],
  scoreUpdate: [[620, .08, 'sine'], [820, .12, 'sine']],
}

export const useStageSound = (config?: LiveScoreboardConfigModel, muted = false) => {
  const [enabled, setEnabled] = useState(false)
  const context = useRef<AudioContext | undefined>(undefined)
  const preloaded = useRef<HTMLAudioElement[]>([])
  const configRef = useRef(config)

  const mutedRef = useRef(muted)
  configRef.current = config
  mutedRef.current = muted
  const voices = useRef(new Set<OscillatorNode>())
  const playing = useRef(new Set<HTMLAudioElement>())
  const generation = useRef(0)
  const stop = useCallback(() => {
    generation.current++
    playing.current.forEach(audio => { audio.pause(); audio.removeAttribute('src'); audio.load() })
    playing.current.clear()
    voices.current.forEach(voice => { try { voice.stop() } catch { /* already ended */ } voice.disconnect() })
    voices.current.clear()
  }, [])
  useEffect(() => { if (muted || !config?.soundEnabled) stop() }, [muted, config?.soundEnabled, stop])
  useEffect(() => () => {
    stop()
    preloaded.current.forEach(audio => { audio.pause(); audio.removeAttribute('src') })
    void context.current?.close()
    context.current = undefined
  }, [stop])
  const oscillator = useCallback((ctx: AudioContext) => {
    const voice = ctx.createOscillator()
    voices.current.add(voice)
    voice.onended = () => { voices.current.delete(voice); voice.disconnect() }
    return voice
  }, [])

  const unlock = useCallback(() => {
    const ctx = context.current ?? new AudioContext()
    context.current = ctx
    void ctx.resume()
    if (!preloaded.current.length) {
      preloaded.current = Object.values(stageSoundPack).map(url => {
        const audio = new Audio()
        audio.preload = 'auto'
        audio.src = url
        audio.load()
        return audio
      })
    }
    setEnabled(true)
  }, [])

  const fallback = useCallback((name: StageSoundName) => {
    const ctx = context.current
    if (!ctx) return
    const volume = Math.max(0, Math.min(1, configRef.current?.volume ?? .75))

    if (name === 'firstBlood') {
      const now = ctx.currentTime
      const master = ctx.createGain()
      const compressor = ctx.createDynamicsCompressor()
      master.gain.setValueAtTime(volume * .48, now)
      master.gain.exponentialRampToValueAtTime(.001, now + 8)
      master.connect(compressor).connect(ctx.destination)

      const impact = oscillator(ctx)
      const impactGain = ctx.createGain()
      impact.type = 'sine'
      impact.frequency.setValueAtTime(82, now + 4.65)
      impact.frequency.exponentialRampToValueAtTime(38, now + 5.35)
      impactGain.gain.setValueAtTime(.001, now + 4.6)
      impactGain.gain.exponentialRampToValueAtTime(.9, now + 4.68)
      impactGain.gain.exponentialRampToValueAtTime(.001, now + 5.55)
      impact.connect(impactGain).connect(master)
      impact.start(now + 4.6)
      impact.stop(now + 5.6)

      const swell = oscillator(ctx)
      const swellFilter = ctx.createBiquadFilter()
      const swellGain = ctx.createGain()
      swell.type = 'sawtooth'
      swell.frequency.setValueAtTime(110, now + .08)
      swell.frequency.exponentialRampToValueAtTime(245, now + 4.5)
      swellFilter.type = 'lowpass'
      swellFilter.frequency.setValueAtTime(240, now)
      swellFilter.frequency.exponentialRampToValueAtTime(1100, now + 4.45)
      swellGain.gain.setValueAtTime(.001, now)
      swellGain.gain.exponentialRampToValueAtTime(.24, now + .45)
      swellGain.gain.exponentialRampToValueAtTime(.001, now + 4.75)
      swell.connect(swellFilter).connect(swellGain).connect(master)
      swell.start(now + .06)
      swell.stop(now + 4.8)

      for (const [index, frequency] of [392, 587, 784, 1175].entries()) {
        const voice = oscillator(ctx)
        const gain = ctx.createGain()
        const at = now + 4.85 + index * .17
        voice.type = index < 2 ? 'triangle' : 'sine'
        voice.frequency.setValueAtTime(frequency, at)
        gain.gain.setValueAtTime(.001, at)
        gain.gain.exponentialRampToValueAtTime(.2, at + .035)
        gain.gain.exponentialRampToValueAtTime(.001, at + .72)
        voice.connect(gain).connect(master)
        voice.start(at)
        voice.stop(at + .75)
      }
      return
    }

    let at = ctx.currentTime
    for (const [frequency, duration, type] of patterns[name]) {
      const oscillatorNode = oscillator(ctx)
      const gain = ctx.createGain()
      oscillatorNode.type = type
      oscillatorNode.frequency.setValueAtTime(frequency, at)
      gain.gain.setValueAtTime(volume * .14, at)
      gain.gain.exponentialRampToValueAtTime(.001, at + duration)
      oscillatorNode.connect(gain).connect(ctx.destination)
      oscillatorNode.start(at)
      oscillatorNode.stop(at + duration)
      at += duration * .75
    }
  }, [oscillator])

  const play = useCallback((name: StageSoundName) => {
    const currentConfig = configRef.current
    if (!enabled || mutedRef.current || !currentConfig?.soundEnabled) return
    const override = currentConfig.sounds?.[name]?.trim()
    if (name === 'firstBlood' && !override) { fallback(name); return }
    const url = override || stageSoundPack[name]
    const audio = new Audio(url)
    audio.volume = Math.max(0, Math.min(1, currentConfig.volume ?? .75))
    const epoch = generation.current
    playing.current.add(audio)
    audio.onended = () => playing.current.delete(audio)
    void audio.play().catch(() => {
      playing.current.delete(audio)
      if (epoch === generation.current && !mutedRef.current && configRef.current?.soundEnabled) fallback(name)
    })
  }, [enabled, fallback])

  return { audioEnabled: enabled, unlockAudio: unlock, play }
}
