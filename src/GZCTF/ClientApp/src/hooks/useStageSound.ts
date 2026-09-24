import { useCallback, useEffect, useRef, useState } from 'react'
import { stageSoundPack } from '@Components/live/stageSoundPack'
import { StageSoundName } from '@Components/live/types'
import { LiveScoreboardConfigModel } from '@Api'

const patterns: Record<StageSoundName, [number, number, OscillatorType][]> = {
  spin: [
    [180, 0.22, 'sine'],
    [220, 0.22, 'sine'],
    [270, 0.22, 'sine'],
    [330, 0.22, 'sine'],
    [400, 0.22, 'sine'],
    [480, 0.22, 'sine'],
    [570, 0.22, 'sine'],
    [680, 0.22, 'sine'],
    [810, 0.25, 'sine'],
    [960, 0.32, 'sine'],
  ],
  categorySelected: [
    [523, 0.16, 'sine'],
    [659, 0.16, 'sine'],
    [784, 0.3, 'sine'],
  ],
  gameStart: [
    [262, 0.18, 'triangle'],
    [392, 0.18, 'triangle'],
    [523, 0.45, 'triangle'],
  ],
  hintDrop: [
    [880, 0.1, 'sine'],
    [1175, 0.12, 'sine'],
    [1568, 0.25, 'sine'],
  ],
  firstBlood: [
    [90, 0.35, 'sawtooth'],
    [180, 0.25, 'triangle'],
    [720, 0.45, 'sine'],
  ],
  secondBlood: [
    [130, 0.25, 'sawtooth'],
    [520, 0.3, 'sine'],
  ],
  thirdBlood: [
    [160, 0.22, 'triangle'],
    [440, 0.28, 'sine'],
  ],
  correctSubmit: [
    [523, 0.12, 'sine'],
    [659, 0.12, 'sine'],
    [784, 0.2, 'sine'],
  ],
  wrongSubmit: [
    [220, 0.16, 'square'],
    [155, 0.25, 'square'],
  ],
  reminder: [[500, 0.22, 'triangle']],
  countdownTick: [[760, 0.09, 'square']],
  overtime: [
    [180, 0.2, 'sawtooth'],
    [260, 0.2, 'sawtooth'],
    [180, 0.3, 'sawtooth'],
  ],
  roundFinished: [
    [523, 0.18, 'sine'],
    [392, 0.18, 'sine'],
    [262, 0.35, 'sine'],
  ],
  scoreUpdate: [
    [620, 0.08, 'sine'],
    [820, 0.12, 'sine'],
  ],
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
    playing.current.forEach((audio) => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    })
    playing.current.clear()
    voices.current.forEach((voice) => {
      try {
        voice.stop()
      } catch {
        /* already ended */
      }
      voice.disconnect()
    })
    voices.current.clear()
  }, [])
  useEffect(() => {
    if (muted || !config?.soundEnabled) stop()
  }, [muted, config?.soundEnabled, stop])
  useEffect(
    () => () => {
      stop()
      preloaded.current.forEach((audio) => {
        audio.pause()
        audio.removeAttribute('src')
      })
      void context.current?.close()
      context.current = undefined
    },
    [stop]
  )
  const oscillator = useCallback((ctx: AudioContext) => {
    const voice = ctx.createOscillator()
    voices.current.add(voice)
    voice.onended = () => {
      voices.current.delete(voice)
      voice.disconnect()
    }
    return voice
  }, [])

  const unlock = useCallback(() => {
    const ctx = context.current ?? new AudioContext()
    context.current = ctx
    void ctx.resume()
    if (!preloaded.current.length) {
      preloaded.current = Object.values(stageSoundPack).map((url) => {
        const audio = new Audio()
        audio.preload = 'auto'
        audio.src = url
        audio.load()
        return audio
      })
    }
    setEnabled(true)
  }, [])

  const fallback = useCallback(
    (name: StageSoundName) => {
      const ctx = context.current
      if (!ctx) return
      const volume = Math.max(0, Math.min(1, configRef.current?.volume ?? 0.75))

      if (name === 'firstBlood') {
        const now = ctx.currentTime
        const master = ctx.createGain()
        const compressor = ctx.createDynamicsCompressor()
        master.gain.setValueAtTime(volume * 0.48, now)
        master.gain.exponentialRampToValueAtTime(0.001, now + 8)
        master.connect(compressor).connect(ctx.destination)

        const impact = oscillator(ctx)
        const impactGain = ctx.createGain()
        impact.type = 'sine'
        impact.frequency.setValueAtTime(82, now + 4.65)
        impact.frequency.exponentialRampToValueAtTime(38, now + 5.35)
        impactGain.gain.setValueAtTime(0.001, now + 4.6)
        impactGain.gain.exponentialRampToValueAtTime(0.9, now + 4.68)
        impactGain.gain.exponentialRampToValueAtTime(0.001, now + 5.55)
        impact.connect(impactGain).connect(master)
        impact.start(now + 4.6)
        impact.stop(now + 5.6)

        const swell = oscillator(ctx)
        const swellFilter = ctx.createBiquadFilter()
        const swellGain = ctx.createGain()
        swell.type = 'sawtooth'
        swell.frequency.setValueAtTime(110, now + 0.08)
        swell.frequency.exponentialRampToValueAtTime(245, now + 4.5)
        swellFilter.type = 'lowpass'
        swellFilter.frequency.setValueAtTime(240, now)
        swellFilter.frequency.exponentialRampToValueAtTime(1100, now + 4.45)
        swellGain.gain.setValueAtTime(0.001, now)
        swellGain.gain.exponentialRampToValueAtTime(0.24, now + 0.45)
        swellGain.gain.exponentialRampToValueAtTime(0.001, now + 4.75)
        swell.connect(swellFilter).connect(swellGain).connect(master)
        swell.start(now + 0.06)
        swell.stop(now + 4.8)

        for (const [index, frequency] of [392, 587, 784, 1175].entries()) {
          const voice = oscillator(ctx)
          const gain = ctx.createGain()
          const at = now + 4.85 + index * 0.17
          voice.type = index < 2 ? 'triangle' : 'sine'
          voice.frequency.setValueAtTime(frequency, at)
          gain.gain.setValueAtTime(0.001, at)
          gain.gain.exponentialRampToValueAtTime(0.2, at + 0.035)
          gain.gain.exponentialRampToValueAtTime(0.001, at + 0.72)
          voice.connect(gain).connect(master)
          voice.addEventListener(
            'ended',
            () => {
              gain.disconnect()
              if (index === 3) {
                master.disconnect()
                compressor.disconnect()
                impactGain.disconnect()
                swellGain.disconnect()
                swellFilter.disconnect()
              }
            },
            { once: true }
          )
          voice.start(at)
          voice.stop(at + 0.75)
        }
        return
      }

      let at = ctx.currentTime
      for (const [frequency, duration, type] of patterns[name]) {
        const oscillatorNode = oscillator(ctx)
        const gain = ctx.createGain()
        oscillatorNode.type = type
        oscillatorNode.frequency.setValueAtTime(frequency, at)
        gain.gain.setValueAtTime(volume * 0.14, at)
        gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
        oscillatorNode.connect(gain).connect(ctx.destination)
        oscillatorNode.addEventListener('ended', () => gain.disconnect(), { once: true })
        oscillatorNode.start(at)
        oscillatorNode.stop(at + duration)
        at += duration * 0.75
      }
    },
    [oscillator]
  )

  const play = useCallback(
    (name: StageSoundName) => {
      const currentConfig = configRef.current
      if (!enabled || mutedRef.current || !currentConfig?.soundEnabled || currentConfig.volume === 0) return
      const override = currentConfig.sounds?.[name]?.trim()
      if (name === 'firstBlood' && !override) {
        fallback(name)
        return
      }
      const url = override || stageSoundPack[name]
      const audio = new Audio(url)
      audio.volume = Math.max(0, Math.min(1, currentConfig.volume ?? 0.75))
      const epoch = generation.current
      playing.current.add(audio)
      audio.onended = () => playing.current.delete(audio)
      void audio.play().catch(() => {
        playing.current.delete(audio)
        if (epoch === generation.current && !mutedRef.current && configRef.current?.soundEnabled) fallback(name)
      })
    },
    [enabled, fallback]
  )

  return { audioEnabled: enabled, unlockAudio: unlock, play, stop }
}
