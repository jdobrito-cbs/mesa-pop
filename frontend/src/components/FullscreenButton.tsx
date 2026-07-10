import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useFullscreen } from '../lib/useFullscreen'

/**
 * Botão de tela cheia reutilizável — alterna o fullscreen do elemento alvo.
 * Em tela cheia, a Fullscreen API só mostra o que está DENTRO do alvo — por
 * isso o botão de SAIR é renderizado via portal dentro do próprio elemento
 * (flutuante no canto), senão no celular não há como sair (sem tecla ESC).
 */
export default function FullscreenButton({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const { isFs, toggle } = useFullscreen(targetRef)
  return (
    <>
      <button
        onClick={() => void toggle()}
        className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan"
      >
        {isFs ? '⤢ Sair da tela cheia' : '⛶ Tela cheia'}
      </button>
      {isFs &&
        targetRef.current &&
        createPortal(
          <button onClick={() => void toggle()} className="mp-fs-exit" aria-label="Sair da tela cheia">
            ⤢ Sair
          </button>,
          targetRef.current,
        )}
    </>
  )
}
