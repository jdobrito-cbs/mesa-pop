import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameDef } from '@mesapop/shared'
import CoinInsert from './CoinInsert'

/** Classes estáticas por cor do catálogo (Tailwind não resolve nomes dinâmicos). */
const COLOR_STYLES: Record<string, { chip: string; glow: string }> = {
  'pop-purple': { chip: 'bg-pop-purple/20 text-pop-purple', glow: 'hover:ring-pop-purple/60' },
  'pop-magenta': { chip: 'bg-pop-magenta/20 text-pop-magenta', glow: 'hover:ring-pop-magenta/60' },
  'pop-cyan': { chip: 'bg-pop-cyan/20 text-pop-cyan', glow: 'hover:ring-pop-cyan/60' },
  'pop-yellow': { chip: 'bg-pop-yellow/20 text-pop-yellow', glow: 'hover:ring-pop-yellow/60' },
  'pop-orange': { chip: 'bg-pop-orange/20 text-pop-orange', glow: 'hover:ring-pop-orange/60' },
  'pop-green': { chip: 'bg-pop-green/20 text-pop-green', glow: 'hover:ring-pop-green/60' },
}

export default function GameCard({ game }: { game: GameDef }) {
  const [inserting, setInserting] = useState(false)
  const navigate = useNavigate()
  const style = COLOR_STYLES[game.color] ?? COLOR_STYLES['pop-purple']!

  // ficha inserida: jogo liberado entra no lobby; "em breve" só fecha
  function onCoinDone() {
    setInserting(false)
    if (game.enabled) navigate(`/jogos/${game.slug}`)
  }
  const players =
    game.minPlayers === game.maxPlayers
      ? game.maxPlayers === 1
        ? 'solo'
        : `${game.maxPlayers} jogadores`
      : `${game.minPlayers}–${game.maxPlayers} jogadores`

  return (
    <>
      <button
        type="button"
        onClick={() => setInserting(true)}
        className={`card group relative cursor-pointer p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:rotate-[-0.6deg] ${style.glow}`}
        aria-label={`Jogar ${game.name}`}
      >
        <div
          className={`flex size-14 items-center justify-center rounded-2xl text-3xl ${style.chip}`}
          aria-hidden="true"
        >
          {game.icon}
        </div>
        <h3 className="mt-4 text-xl font-bold">{game.name}</h3>
        <p className="mt-1 min-h-10 text-sm text-text-muted">{game.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            {players}
          </span>
          {!game.enabled && (
            <span className="rounded-full bg-pop-yellow/15 px-3 py-1 text-xs font-bold text-pop-yellow">
              Em breve
            </span>
          )}
        </div>
      </button>

      {/* ficha no fliperama — transição padrão de entrada nos jogos */}
      {inserting && <CoinInsert game={game} onDone={onCoinDone} />}
    </>
  )
}
