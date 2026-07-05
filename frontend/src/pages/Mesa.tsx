import { GAME_CATALOG } from '@mesapop/shared'
import GameCard from '../components/GameCard'
import { useAuth } from '../lib/auth'

/** Home do usuário logado — vira o lobby de verdade na Fase 1. */
export default function Mesa() {
  const { user } = useAuth()
  if (!user) return null

  const firstName = user.displayName.split(' ')[0]

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-extrabold">
        E aí, <span className="text-pop-cyan">{firstName}</span>! 👋
      </h1>
      <p className="mt-2 text-text-muted">
        Sua mesa está sendo montada. Os primeiros jogos chegam em breve — cada
        um vai acender aqui quando estiver pronto.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-semibold text-text-muted">Partidas jogadas</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-pop-purple">0</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-text-muted">Vitórias</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-pop-yellow">0</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-text-muted">Recordes</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-pop-cyan">0</p>
        </div>
      </div>

      <h2 className="mt-12 text-2xl font-extrabold">Jogos chegando na mesa</h2>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {GAME_CATALOG.slice(0, 6).map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </main>
  )
}
