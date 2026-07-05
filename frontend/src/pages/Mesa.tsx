import { Link } from 'react-router-dom'
import { GAME_CATALOG, type AnnouncementView, type GameDef, type GameView } from '@mesapop/shared'
import AdSlot from '../components/AdSlot'
import GameCard from '../components/GameCard'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'

interface RoomRow {
  id: string
  code: string
  players: number
  maxPlayers: number
  playerNames: string[]
  isFavorite: boolean
  game: { slug: string; name: string; icon: string; color: string }
  host: { displayName: string }
}

interface Standing {
  guest: boolean
  globalRank: number | null
  globalWins: number
  topGame: { slug: string; name: string; icon: string; plays: number; rank: number | null; metric: string } | null
}

/** estrela de favoritar sala pública (contas registradas) */
export function FavoriteStar({
  room,
  onToggled,
  disabled,
}: {
  room: { id: string; isFavorite: boolean }
  onToggled: () => void
  disabled?: boolean
}) {
  if (disabled) return null
  return (
    <button
      onClick={() => void api(`/api/rooms/${room.id}/favorite`, { method: 'POST' }).then(onToggled).catch(() => {})}
      aria-label={room.isFavorite ? 'Remover dos favoritos' : 'Favoritar sala'}
      title={room.isFavorite ? 'Remover dos favoritos' : 'Favoritar sala'}
      className={`btn-pop px-2 py-1 text-xl ${room.isFavorite ? 'text-pop-yellow' : 'text-text-muted/50 hover:text-pop-yellow'}`}
    >
      {room.isFavorite ? '★' : '☆'}
    </button>
  )
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
  const { data: roomsData, reload: reloadRooms } = useFetch<{ rooms: RoomRow[] }>('/api/rooms')
  const { data: annData } = useFetch<{ announcements: AnnouncementView[] }>('/api/announcements')
  const { data: standing } = useFetch<Standing>('/api/me/standing')

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

      {/* sua posição nos rankings */}
      {user.isGuest ? (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-pop-cyan p-4">
          <p className="text-sm text-text-muted">
            🎟️ Você está jogando como <strong className="text-text">convidado</strong> — chat,
            fazenda, favoritos e ranking pedem conta.
          </p>
          <Link
            to="/criar-conta"
            className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-2.5 text-sm text-white"
          >
            Criar minha conta
          </Link>
        </div>
      ) : (
        standing &&
        !standing.guest && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="card flex items-center gap-4 p-4">
              <span className="text-3xl" aria-hidden="true">🌍</span>
              <div>
                <p className="font-display font-bold">Ranking global</p>
                <p className="text-sm text-text-muted">
                  {standing.globalRank
                    ? <>Você é o <strong className="text-pop-yellow">{standing.globalRank}º</strong> em vitórias ({standing.globalWins})</>
                    : 'Vença sua primeira partida para entrar no ranking!'}
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-4 p-4">
              <span className="text-3xl" aria-hidden="true">{standing.topGame?.icon ?? '🎮'}</span>
              <div>
                <p className="font-display font-bold">
                  {standing.topGame ? `Seu jogo: ${standing.topGame.name}` : 'Seu jogo favorito'}
                </p>
                <p className="text-sm text-text-muted">
                  {standing.topGame
                    ? standing.topGame.rank
                      ? <><strong className="text-pop-cyan">{standing.topGame.rank}º</strong> no ranking de {standing.topGame.metric} · {standing.topGame.plays} partidas</>
                      : `${standing.topGame.plays} partidas jogadas — pontue para ranquear!`
                    : 'Jogue qualquer coisa e ele aparece aqui.'}
                </p>
              </div>
            </div>
          </div>
        )
      )}

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
              <FavoriteStar room={r} onToggled={() => void reloadRooms()} disabled={user.isGuest} />
              <span className="font-mono text-sm font-bold text-pop-cyan">{r.code}</span>
            </div>
          ))}
        </div>
      )}

      <AdSlot className="mt-10" />

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
