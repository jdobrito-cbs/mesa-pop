import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * Tela cheia de um elemento. Usa a Fullscreen API (PC e Android); quando ela
 * não existe (iPhone/iPad no Safari), cai num fallback CSS (posição fixa
 * cobrindo a viewport) via a classe `mp-fs--fake`. O elemento sempre leva a
 * classe `game-fs` para o CSS estilizar tanto o `:fullscreen` quanto o fake.
 */

interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => void
}
interface FsDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFs, setIsFs] = useState(false)

  const sync = useCallback(() => {
    const el = ref.current
    const doc = document as FsDocument
    const real = !!((doc.fullscreenElement || doc.webkitFullscreenElement) && el && (doc.fullscreenElement === el || doc.webkitFullscreenElement === el))
    const fake = !!el?.classList.contains('mp-fs--fake')
    setIsFs(real || fake)
  }, [ref])

  useEffect(() => {
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync as EventListener)
    }
  }, [sync])

  const toggle = useCallback(async () => {
    const el = ref.current as FsElement | null
    if (!el) return
    const doc = document as FsDocument

    const emReal = !!(doc.fullscreenElement || doc.webkitFullscreenElement)
    const emFake = el.classList.contains('mp-fs--fake')

    if (emReal || emFake) {
      if (emReal) {
        if (doc.exitFullscreen) await doc.exitFullscreen().catch(() => {})
        else doc.webkitExitFullscreen?.()
      }
      el.classList.remove('mp-fs--fake')
      setIsFs(false)
      return
    }

    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
      else throw new Error('sem Fullscreen API')
      setIsFs(true)
    } catch {
      el.classList.add('mp-fs--fake') // iOS: tela cheia "fake" via CSS
      setIsFs(true)
    }
  }, [ref])

  return { isFs, toggle }
}
