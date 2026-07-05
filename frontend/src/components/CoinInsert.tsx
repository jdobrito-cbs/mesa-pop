import { useEffect, useState } from 'react'
import type { GameDef } from '@mesapop/shared'
import { Chip } from './Logo'

/**
 * Transição padrão de entrada em qualquer jogo: uma ficha é inserida na
 * fenda do fliperama, com letreiro retrô "INSERT COIN". Ar de jogos antigos.
 *
 * Fases: dropping (ficha caindo) → inserted (flash + "READY!") → onDone.
 * Para jogos ainda não disponíveis, mostra "EM BREVE" no lugar de "READY!".
 */
export default function CoinInsert({
  game,
  onDone,
}: {
  game: GameDef
  onDone: () => void
}) {
  const [inserted, setInserted] = useState(false)

  useEffect(() => {
    const drop = setTimeout(() => setInserted(true), 900)
    const done = setTimeout(onDone, 2300)
    return () => {
      clearTimeout(drop)
      clearTimeout(done)
    }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/95"
      role="dialog"
      aria-label={`Entrando em ${game.name}`}
      onClick={onDone}
    >
      <div className="flex flex-col items-center gap-8 px-4">
        {/* letreiro retrô */}
        <p className="font-display text-2xl font-extrabold tracking-[0.3em] text-pop-yellow uppercase sm:text-3xl">
          {inserted ? (
            <span className={game.enabled ? 'text-pop-green' : 'text-pop-orange'}>
              {game.enabled ? '★ Ready! ★' : 'Em breve…'}
            </span>
          ) : (
            <span className="animate-blink">Insert coin</span>
          )}
        </p>

        {/* máquina: painel com a fenda */}
        <div className="relative flex flex-col items-center">
          {/* a ficha caindo (some ao entrar na fenda) */}
          {!inserted && (
            <div className="absolute -top-6 z-10 animate-coin-drop">
              <Chip size={72} />
            </div>
          )}

          <div
            className={`relative mt-16 w-64 rounded-card bg-ink-800 p-6 ring-2 ring-ink-700 sm:w-72 ${inserted ? 'animate-slot-flash' : ''}`}
          >
            {/* fenda da ficha */}
            <div className="mx-auto h-3 w-24 rounded-full bg-ink-950 ring-2 ring-pop-purple/60" />
            <div className="mt-5 flex items-center justify-center gap-3">
              <span className="text-4xl" aria-hidden="true">
                {game.icon}
              </span>
              <span className="font-display text-xl font-bold">{game.name}</span>
            </div>
            <p className="mt-2 text-center text-xs tracking-widest text-text-muted uppercase">
              1 ficha · 1 crédito
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
