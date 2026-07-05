import { Link } from 'react-router-dom'
import { GAME_CATALOG } from '@mesapop/shared'
import GameCard from '../components/GameCard'
import { Chip, Spark } from '../components/Logo'
import { useAuth } from '../lib/auth'

/** Fichas flutuantes do hero — a "mesa" vista de cima. */
const HERO_TOKENS = [
  { icon: '🏎️', bg: 'bg-pop-orange/20', ring: 'ring-pop-orange/40', pos: 'top-2 left-6', late: false },
  { icon: '✈️', bg: 'bg-pop-yellow/20', ring: 'ring-pop-yellow/40', pos: 'top-24 right-2', late: true },
  { icon: '🐠', bg: 'bg-pop-cyan/20', ring: 'ring-pop-cyan/40', pos: 'bottom-24 left-0', late: true },
  { icon: '🃏', bg: 'bg-pop-magenta/20', ring: 'ring-pop-magenta/40', pos: 'bottom-2 right-16', late: false },
  { icon: '🌾', bg: 'bg-pop-green/20', ring: 'ring-pop-green/40', pos: 'top-40 left-32', late: false },
]

export default function Home() {
  const { user } = useAuth()

  return (
    <main>
      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-ink-800 px-4 py-1.5 text-sm font-semibold text-pop-cyan ring-1 ring-ink-700">
            <Spark size={14} /> sua mesa está pronta
          </p>
          <h1 className="mt-5 text-5xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
            A mesa tá posta.
            <br />
            <span className="bg-gradient-to-r from-pop-purple via-pop-magenta to-pop-orange bg-clip-text text-transparent">
              Bora jogar?
            </span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-text-muted">
            Cartas, corrida, naves e muito mais — com os amigos em salas
            privadas ou contra o mundo no ranking.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link
                to="/mesa"
                className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3.5 text-white shadow-xl shadow-pop-purple/30"
              >
                Ir para minha mesa
              </Link>
            ) : (
              <>
                <Link
                  to="/criar-conta"
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-7 py-3.5 text-white shadow-xl shadow-pop-purple/30"
                >
                  Criar conta grátis
                </Link>
                <Link
                  to="/entrar"
                  className="btn-pop px-7 py-3.5 ring-2 ring-ink-700 hover:ring-pop-cyan"
                >
                  Já tenho conta
                </Link>
                <Link
                  to="/entrar"
                  className="btn-pop px-7 py-3.5 ring-2 ring-pop-cyan/50 hover:ring-pop-cyan"
                >
                  🎟️ Jogar sem conta
                </Link>
              </>
            )}
          </div>
          {!user && (
            <p className="mt-3 max-w-md text-xs text-text-muted">
              Sem conta você joga tudo — mas chat, fazenda, favoritos e ranking pedem cadastro.
            </p>
          )}
        </div>

        {/* a mesa: ficha central + fichas de jogos flutuando */}
        <div className="relative mx-auto hidden h-96 w-full max-w-md md:block" aria-hidden="true">
          <div className="absolute inset-8 rounded-[3rem] bg-ink-800/70 ring-1 ring-ink-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float">
            <Chip size={132} spin />
          </div>
          {HERO_TOKENS.map((t) => (
            <div
              key={t.icon}
              className={`absolute ${t.pos} flex size-16 items-center justify-center rounded-2xl text-3xl ring-1 ${t.bg} ${t.ring} ${t.late ? 'animate-float-late' : 'animate-float'}`}
            >
              {t.icon}
            </div>
          ))}
        </div>
      </section>

      {/* CATÁLOGO */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-extrabold md:text-4xl">O que vai rolar na mesa</h2>
        <p className="mt-2 text-text-muted">
          A plataforma está nascendo — os jogos entram na mesa um a um.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_CATALOG.slice(0, 9).map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      {/* PILARES */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="card p-6">
            <div className="text-3xl" aria-hidden="true">🎉</div>
            <h3 className="mt-3 text-xl font-bold text-pop-magenta">Chama os amigos</h3>
            <p className="mt-2 text-sm text-text-muted">
              Crie uma sala privada, mande o código no grupo e pronto: a mesa é
              de vocês.
            </p>
          </div>
          <div className="card p-6">
            <div className="text-3xl" aria-hidden="true">📅</div>
            <h3 className="mt-3 text-xl font-bold text-pop-cyan">Desafio diário</h3>
            <p className="mt-2 text-sm text-text-muted">
              Sem ninguém online? Todo dia tem um puzzle novo — o mesmo para
              todo mundo. Compare seu resultado.
            </p>
          </div>
          <div className="card p-6">
            <div className="text-3xl" aria-hidden="true">🏆</div>
            <h3 className="mt-3 text-xl font-bold text-pop-yellow">Seu recorde vale ponto</h3>
            <p className="mt-2 text-sm text-text-muted">
              Cada partida solo entra no ranking. Jogue sozinho, dispute com
              todos.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
