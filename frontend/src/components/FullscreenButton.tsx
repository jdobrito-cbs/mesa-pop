import type { RefObject } from 'react'
import { useFullscreen } from '../lib/useFullscreen'

/** Botão de tela cheia reutilizável — alterna o fullscreen do elemento alvo. */
export default function FullscreenButton({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const { isFs, toggle } = useFullscreen(targetRef)
  return (
    <button
      onClick={() => void toggle()}
      className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan"
    >
      {isFs ? '⤢ Sair da tela cheia' : '⛶ Tela cheia'}
    </button>
  )
}
