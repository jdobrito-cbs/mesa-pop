import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameView, RoomView } from '@mesapop/shared'
import { useFetch } from '../lib/useFetch'
import { emitAck } from '../lib/socket'
import SoloGamePage, { SOLO_GAMES } from './SoloGamePage'
import FarmPage from './FarmPage'
import TermoPage from './TermoPage'
import PacienciaPage from './PacienciaPage'
import SudokuPage from './SudokuPage'
import CacaPalavrasPage from './CacaPalavrasPage'
import CruzadinhaPage from './CruzadinhaPage'
import MahjongPage from './MahjongPage'
import { FavoriteStar, RoomPeople } from './Mesa'
import { useAuth } from '../lib/auth'
import AdSlot from '../components/AdSlot'

interface RoomRow {
  id: string
  code: string
  players: number
  maxPlayers: number
  playerNames: string[]
  isFavorite: boolean
  game: { slug: string; name: string; icon: string }
  host: { displayName: string }
}

/**
 * Rota /jogos/:slug — jogos solo abrem direto no canvas;
 * multiplayer cai no lobby de salas.
 */
export default function GameLobby() {
  const { slug } = useParams<{ slug: string }>()
  if (slug === 'fazenda') return <FarmPage />
  if (slug === 'termo-diario') return <TermoPage />
  if (slug === 'paciencia') return <PacienciaPage />
  if (slug === 'sudoku') return <SudokuPage />
  if (slug === 'caca-palavras') return <CacaPalavrasPage />
  if (slug === 'cruzadinha') return <CruzadinhaPage />
  if (slug === 'mahjong') return <MahjongPage />
  const solo = slug ? SOLO_GAMES[slug] : undefined
  if (solo) return <SoloGamePage key={solo.slug} def={solo} />
  return <MultiplayerLobby slug={slug} />
}

/** Lobby de um jogo multiplayer: criar sala, entrar por código ou sentar. */
function MultiplayerLobby({ slug }: { slug: string | undefined }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: gamesData } = useFetch<{ games: GameView[] }>('/api/games')
  const { data: roomsData, reload } = useFetch<{ rooms: RoomRow[] }>('/api/rooms')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [coopMode, setCoopMode] = useState<'juntos' | 'lado-a-lado'>('juntos')
  const [vehicle, setVehicle] = useState<'carro' | 'moto'>('carro')

  const game = gamesData?.games.find((g) => g.slug === slug)
  const rooms = (roomsData?.rooms ?? []).filter((r) => r.game.slug === slug)
  const isCoop = slug === 'esquadrao-coop'
  const isRace = slug === 'corrida'
  // jogos que já jogam contra o robô (cresce a cada lote)
  const hasBot = [
    'damas', 'xadrez', 'domino', 'one', 'pife', 'gira-genio', 'magnata',
    'truco', 'memoria', 'forca', 'quiz-pop', 'quiz-nostalgia',
  ].includes(slug ?? '')

  async function playVsBot() {
    setBusy(true)
    setError('')
    const res = await emitAck<RoomView>('room:createVsBot', { gameSlug: slug })
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Não deu para chamar o robô')
    navigate(`/sala/${res.data!.code}`)
  }

  async function createRoom(isPrivate: boolean) {
    setBusy(true)
    setError('')
    const res = await emitAck<RoomView>('room:create', {
      gameSlug: slug,
      isPrivate,
      ...(isCoop ? { options: { mode: coopMode } } : {}),
      ...(isRace ? { options: { vehicle } } : {}),
    })
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Não deu para criar a sala')
    navigate(`/sala/${res.data!.code}`)
  }

  async function joinByCode(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError('')
    const res = await emitAck<RoomView>('room:join', { code: code.trim().toUpperCase() })
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'Não deu para entrar na sala')
    navigate(`/sala/${res.data!.code}`)
  }

  if (gamesData && !game) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden="true">🚧</p>
        <h1 className="mt-4 text-3xl font-extrabold">Este jogo ainda não está na mesa</h1>
        <button onClick={() => navigate('/mesa')} className="btn-pop mt-6 px-6 py-3 ring-2 ring-ink-700 hover:ring-pop-cyan">
          Voltar à minha mesa
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-ink-800 text-4xl ring-1 ring-ink-700" aria-hidden="true">
          {game?.icon ?? '🎲'}
        </span>
        <div>
          <h1 className="text-4xl font-extrabold">{game?.name ?? '…'}</h1>
          <p className="text-text-muted">{game?.description}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-field bg-pop-magenta/15 px-4 py-3 text-sm font-semibold text-pop-magenta">
          {error}
        </p>
      )}

      {/* memória também tem treino solo com ranking */}
      {slug === 'memoria' && (
        <button
          onClick={() => navigate('/jogos/memoria/solo')}
          className="card mt-8 flex w-full items-center gap-4 p-5 text-left transition hover:-translate-y-1 hover:ring-pop-yellow/60"
        >
          <span className="text-3xl" aria-hidden="true">⏱️</span>
          <span>
            <span className="block font-display text-lg font-bold">Treino solo contra o relógio</span>
            <span className="block text-sm text-text-muted">Ache os 18 pares sozinho — menos tempo e menos erros valem mais no ranking.</span>
          </span>
        </button>
      )}

      {/* modo do co-op */}
      {isCoop && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setCoopMode('juntos')}
            aria-pressed={coopMode === 'juntos'}
            className={`card p-4 text-left transition ${coopMode === 'juntos' ? 'ring-2 ring-pop-green' : 'opacity-70 hover:opacity-100'}`}
          >
            <p className="font-display font-bold text-pop-green">🤝 Sobrevive junto</p>
            <p className="mt-1 text-xs text-text-muted">
              Pontuação do time. Derrubado? Seu parceiro voa até você e te reanima.
            </p>
          </button>
          <button
            onClick={() => setCoopMode('lado-a-lado')}
            aria-pressed={coopMode === 'lado-a-lado'}
            className={`card p-4 text-left transition ${coopMode === 'lado-a-lado' ? 'ring-2 ring-pop-yellow' : 'opacity-70 hover:opacity-100'}`}
          >
            <p className="font-display font-bold text-pop-yellow">⚔️ Lado a lado</p>
            <p className="mt-1 text-xs text-text-muted">
              3 vidas e placar para cada um — cooperam, mas o maior placar leva.
            </p>
          </button>
        </div>
      )}

      {/* veículo da corrida */}
      {isRace && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setVehicle('carro')}
            aria-pressed={vehicle === 'carro'}
            className={`card p-4 text-left transition ${vehicle === 'carro' ? 'ring-2 ring-pop-orange' : 'opacity-70 hover:opacity-100'}`}
          >
            <p className="font-display font-bold text-pop-orange">🏎️ Carro</p>
            <p className="mt-1 text-xs text-text-muted">
              Equilibrado: gruda no asfalto e perdoa o exagero na curva.
            </p>
          </button>
          <button
            onClick={() => setVehicle('moto')}
            aria-pressed={vehicle === 'moto'}
            className={`card p-4 text-left transition ${vehicle === 'moto' ? 'ring-2 ring-pop-cyan' : 'opacity-70 hover:opacity-100'}`}
          >
            <p className="font-display font-bold text-pop-cyan">🏍️ Moto</p>
            <p className="mt-1 text-xs text-text-muted">
              Mais veloz e mais escorregadia — para quem domina o drift.
            </p>
          </button>
        </div>
      )}

      {/* jogar contra o computador — começa na hora, sem esperar ninguém */}
      {hasBot && (
        <button
          onClick={() => void playVsBot()}
          disabled={busy}
          className="card mt-8 flex w-full items-center gap-4 p-5 text-left transition hover:-translate-y-1 hover:ring-pop-green/60 disabled:opacity-60"
        >
          <span className="text-3xl" aria-hidden="true">🤖</span>
          <span>
            <span className="block font-display text-lg font-bold text-pop-green">
              Jogar contra o robô
            </span>
            <span className="block text-sm text-text-muted">
              Comece agora mesmo, sem esperar outra pessoa — um adversário do seu tamanho.
            </span>
          </span>
        </button>
      )}

      <div className={`${isCoop || isRace || hasBot ? 'mt-4' : 'mt-8'} grid gap-4 sm:grid-cols-2`}>
        <button
          onClick={() => void createRoom(false)}
          disabled={busy}
          className="card group p-6 text-left transition hover:-translate-y-1 hover:ring-pop-cyan/60 disabled:opacity-60"
        >
          <p className="text-3xl" aria-hidden="true">🌎</p>
          <h2 className="mt-2 font-display text-xl font-bold">Sala pública</h2>
          <p className="mt-1 text-sm text-text-muted">
            Aparece na lista — qualquer um pode sentar.
          </p>
        </button>
        <button
          onClick={() => void createRoom(true)}
          disabled={busy}
          className="card group p-6 text-left transition hover:-translate-y-1 hover:ring-pop-magenta/60 disabled:opacity-60"
        >
          <p className="text-3xl" aria-hidden="true">🔒</p>
          <h2 className="mt-2 font-display text-xl font-bold">Sala privada</h2>
          <p className="mt-1 text-sm text-text-muted">
            Só entra quem tiver o código — manda no grupo!
          </p>
        </button>
      </div>

      <form onSubmit={joinByCode} className="card mt-4 flex items-center gap-3 p-4">
        <span className="text-2xl" aria-hidden="true">🎟️</span>
        <input
          className="field flex-1 font-mono tracking-[0.2em] uppercase"
          placeholder="CÓDIGO"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-label="Código da sala"
        />
        <button disabled={busy || code.length < 6} className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-2.5 text-sm text-white disabled:opacity-50">
          Entrar
        </button>
      </form>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Salas esperando jogadores</h2>
        <button onClick={() => void reload()} className="btn-pop px-3 py-1.5 text-xs ring-1 ring-ink-700 hover:ring-pop-cyan">
          Atualizar
        </button>
      </div>
      {rooms.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">
          Nenhuma sala pública aberta — crie a primeira e chame alguém!
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {rooms.map((r) => (
            <div key={r.id} className="card flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">Mesa de {r.host.displayName}</p>
                <p className="text-sm text-text-muted">{r.players}/{r.maxPlayers} jogadores</p>
                <RoomPeople names={r.playerNames} maxPlayers={r.maxPlayers} />
              </div>
              <FavoriteStar room={r} onToggled={() => void reload()} disabled={!!user?.isGuest} />
              <button
                onClick={() => {
                  setCode(r.code)
                  void emitAck<RoomView>('room:join', { code: r.code }).then((res) =>
                    res.ok ? navigate(`/sala/${r.code}`) : setError(res.error ?? 'Erro'),
                  )
                }}
                className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-2 text-sm text-white"
              >
                Sentar
              </button>
            </div>
          ))}
        </div>
      )}

      <AdSlot className="mt-8" />
    </main>
  )
}
