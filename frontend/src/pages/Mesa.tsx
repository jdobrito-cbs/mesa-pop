import { GAME_CATALOG, type AnnouncementView, type GameDef, type GameView } from '@mesapop/shared'
import GameCard from '../components/GameCard'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'

interface RoomRow {
  id: string
  code: string
  players: number
  maxPlayers: number
  playerNames: string[]
  game: { slug: string; name: string; icon: string; color: string }
  host: { displayName: string }
}

/** quem já está sentado na sala de espera + lugares livres */
export function RoomPeople({ names, maxPlayers }: { names: string[]; maxPlayers: number }) {
  const free = maxPlayers - names.length
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {names.map((n) => (
        <span
          key={n}
          className="flex items-center gap-1.5 rounded-full bg-ink-900 py-0.5 pr-2.5 pl-0.5 text-xs font-semibold ring-1 ring-ink-700"
        >
          <span
            className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-pop-purple to-pop-magenta text-[10px] font-extrabold text-white"
            aria-hidden="true"
          >
            {n.trim()[0]?.toUpperCase()}
          </span>
          {n}
        </span>
      ))}
      {free > 0 && (
        <span className="rounded-full border border-dashed border-ink-700 px-2.5 py-0.5 text-xs font-semibold text-text-muted">
          {free === 1 ? '1 lugar livre' : `${free} lugares livres`}
        </span>
      )}
    </div>
  )
}

const toGameDef = (g: GameView): GameDef => ({ ...g, enabled: g.isEnabled })

/** Lobby: jogos habilitados, salas abertas e avisos. */
export default function Mesa() {
  const { user } = useAuth()
  const { data: gamesData, loading: loadingGames } = useFetch<{ games: GameView[] }>('/api/games')
  const { data: roomsData } = useFetch<{ rooms: RoomRow[] }>('/api/rooms')
  const { data: annData } = useFetch<{ announcements: AnnouncementView[] }>('/api/announcements')

  if (!user) return null
  const firstName = user.displayName.split(' ')[0]

  const enabled = gamesData?.games ?? []
  const enabledSlugs = new Set(enabled.map((g) => g.slug))
  const comingSoon = GAME_CATALOG.filter((g) => !enabledSlugs.has(g.slug)).slice(0, 6)

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-extrabold">
        E aí, <span className="text-pop-cyan">{firstName}</span>! 👋
      </h1>

      {/* avisos do admin */}
      {!!annData?.announcements.length && (
        <div className="mt-6 flex flex-col gap-3">
          {annData.announcements.map((a) => (
            <div key={a.id} className="card flex items-start gap-3 border-l-4 border-l-pop-yellow p-4">
              <span className="text-2xl" aria-hidden="true">📣</span>
              <div>
                <p className="font-display font-bold">{a.title}</p>
                <p className="text-sm text-text-muted">{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* jogos na mesa */}
      <h2 className="mt-10 text-2xl font-extrabold">Na mesa agora</h2>
      {loadingGames && <p className="mt-3 text-text-muted">Preparando a mesa…</p>}
      {!loadingGames && enabled.length === 0 && (
        <div className="card mt-4 p-8 text-center">
          <p className="text-4xl" aria-hidden="true">🎲</p>
          <p className="mt-3 font-display text-lg font-bold">A mesa está sendo montada</p>
          <p className="mt-1 text-sm text-text-muted">
            Os primeiros jogos acendem aqui em breve — um a um, começando pelas Damas.
          </p>
        </div>
      )}
      {enabled.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {enabled.map((g) => (
            <GameCard key={g.slug} game={toGameDef(g)} />
          ))}
        </div>
      )}

      {/* salas abertas */}
      <h2 className="mt-10 text-2xl font-extrabold">Salas abertas</h2>
      {!roomsData?.rooms.length ? (
        <p className="mt-3 text-sm text-text-muted">
          Nenhuma sala pública esperando jogadores agora. Quando os jogos multiplayer
          chegarem, é aqui que você encontra gente para jogar.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {roomsData.rooms.map((r) => (
            <div key={r.id} className="card flex items-start gap-3 p-4">
              <span className="text-3xl" aria-hidden="true">{r.game.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">{r.game.name}</p>
                <p className="text-sm text-text-muted">
                  Mesa de {r.host.displayName} · {r.players}/{r.maxPlayers} jogadores
                </p>
                <RoomPeople names={r.playerNames} maxPlayers={r.maxPlayers} />
              </div>
              <span className="font-mono text-sm font-bold text-pop-cyan">{r.code}</span>
            </div>
          ))}
        </div>
      )}

      {/* em breve */}
      {comingSoon.length > 0 && (
        <>
          <h2 className="mt-10 text-2xl font-extrabold">Chegando na mesa</h2>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {comingSoon.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
