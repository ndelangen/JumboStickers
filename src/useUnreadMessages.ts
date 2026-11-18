import { useCallback, useEffect, useRef, useState } from 'react'
import type { DemoState } from './demo'

function playChime(audio: AudioContext) {
  const start = audio.currentTime
  for (const [index, frequency] of [659.25, 880].entries()) {
    const time = start + index * 0.12
    const note = audio.createOscillator()
    const volume = audio.createGain()
    note.frequency.value = frequency
    volume.gain.setValueAtTime(0, time)
    volume.gain.linearRampToValueAtTime(0.075, time + 0.025)
    volume.gain.exponentialRampToValueAtTime(0.001, time + 0.25)
    note.connect(volume).connect(audio.destination)
    note.onended = () => { note.disconnect(); volume.disconnect() }
    note.start(time)
    note.stop(time + 0.26)
  }
}

export function useUnreadMessages(inbox: DemoState['inbox'] | undefined) {
  const [arrival, setArrival] = useState(0)
  const previous = useRef(new Set<string>())
  const waiting = useRef(new Set<string>())
  const audio = useRef<AudioContext | null>(null)

  const notify = useCallback(() => {
    if (!waiting.current.size || audio.current?.state !== 'running') return
    waiting.current.clear()
    playChime(audio.current)
  }, [])

  const audioContext = useCallback(() => {
    if (!audio.current && typeof AudioContext !== 'undefined') {
      try {
        audio.current = new AudioContext()
        audio.current.addEventListener('statechange', notify)
      } catch {
        // The unread indicator still works without audio.
      }
    }
    return audio.current
  }, [notify])

  useEffect(() => {
    function unlock(event: Event) {
      if (!event.isTrusted) return
      const context = audioContext()
      if (context && context.state !== 'running') void context.resume().then(notify).catch(() => {})
    }
    document.addEventListener('click', unlock, true)
    document.addEventListener('keydown', unlock, true)
    return () => {
      document.removeEventListener('click', unlock, true)
      document.removeEventListener('keydown', unlock, true)
      audio.current?.removeEventListener('statechange', notify)
      void audio.current?.close().catch(() => {})
      audio.current = null
    }
  }, [audioContext, notify])

  useEffect(() => {
    if (!inbox) return
    const ids = new Set(inbox.map(({ id }) => id))
    const added = [...ids].filter((id) => !previous.current.has(id))
    previous.current = ids
    for (const id of waiting.current) {
      if (!ids.has(id)) waiting.current.delete(id)
    }
    if (!added.length) return
    for (const id of added) waiting.current.add(id)
    setArrival((value) => value + 1)
    audioContext()
    notify()
  }, [audioContext, inbox, notify])

  const unread = inbox?.length ?? 0
  useEffect(() => {
    const title = document.title
    if (unread) document.title = `(${unread}) ${title}`
    return () => { document.title = title }
  }, [unread])

  return { arrival, unread }
}
