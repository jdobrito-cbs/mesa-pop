import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type {
  CheckersState,
  ChessMove,
  ChessState,
  CoopSnapshot,
  DominoAction,
  DominoView,
  GameEndView,
  OneAction,
  OneView,
  RacingSnapshot,
  RoomView,
} from '@mesapop/shared'
import { connectSocket, emitAck } from '../lib/socket'
import { useAuth } from '../lib/auth'
import CheckersBoard from '../components/CheckersBoard'
import ChessBoard from '../components/ChessBoard'
import CoopGame from '../components/CoopGame'
import RacingGame from '../components/RacingGame'
import DominoTable from '../components/DominoTable'
import OneTable from '../components/OneTable'
import SeatPicker from '../components/SeatPicker'
import RoomChat from '../components/RoomChat'
import { Chip } from '../components/Logo'

interface GamePayload {
  state: unknown
  yourSeat: number
}

export default function RoomPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomView | null>(null)
  const [game, setGame] = useState<GamePayload | null>(null)
  const [end, setEnd] = useState<GameEndView | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // hook de dev para testes automatizados de UI (não existe no build de produção)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__game = game
    }
  }, [game])

  useEffect(() => {
    if (!code || !user) return
    const socket = connectSocket()

    const onRoom = (r: RoomView) => {
      setRoom(r)
      // rotação: a sala voltou para a espera → limpa a mesa anterior
      if (r.status === 'WAITING') setGame(null)
    }
    const onState = (payload: GamePayload) => setGame(payload)
    const onEnd = (payload: GameEndView) => setEnd(payload)
    socket.on('room:update', onRoom)
    socket.on('game:state', onState)
    socket.on('game:end', onEnd)

    const join = () =>
      void emitAck<RoomView>('room:join', { code }).then((res) => {
        if (!res.ok) setError(res.error ?? 'Sala não encontrada')
        else setRoom(res.data!)
      })
    join()
    // reconexão do socket → re-entra na sala e recebe o estado de novo
    socket.on('connect', join)

    return () => {
      socket.off('room:update', onRoom)
      socket.off('game:state', onState)
      socket.off('game:end', onEnd)
      socket.off('connect', join)
    }
  }, [code, user])

  async function start() {
    const res = await emitAck('room:start')
    if (!res.ok) setError(res.error ?? 'Não deu para começar')
  }

  async function leave() {
    await emitAck('room:leave')
    navigate(room ? `/jogos/${room.gameSlug}` : '/mesa')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function sendAction(action: unknown) {
    const res = await emitAck('game:action', { action })
    if (!res.ok && res.error) showToast(res.error)
  }

  function copyCode() {
    void navigator.clipboard?.writeText(code ?? '')
    showToast('Código copiado!')
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden="true">🚪</p>
        <h1 className="mt-4 text-2xl font-extrabold">{error}</h1>
        <button onClick={() => navigate('/mesa')} className="btn-pop mt-6 px-6 py-3 ring-2 ring-ink-700 hover:ring-pop-cyan">
          Voltar à minha mesa
        </button>
      </main>
    )
  }

  if (!room || !user) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-float"><Chip size={64} spin /></div>
      </main>
    )
  }

  const isHost = room.hostId === user.id
  const iAmPlayer = room.players.some((p) => p.userId === user.id)
  const playing = room.status === 'PLAYING' && game
  const winnerNames = (end?.winnerUserIds ?? [])
    .map((id) => room.players.find((p) => p.userId === id)?.displayName)
    .filter(Boolean)
    .join(' e ')
  const youWon = !!end?.winnerUserIds.includes(user.id)
  const seatedPlayers = room.players
    .filter((p) => p.seat !== null)
    .map((p) => ({ name: p.displayName, seat: p.seat!, connected: p.isConnected }))

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          {room.gameName} <span className="text-text-muted">· sala</span>{' '}
          <button
            onClick={copyCode}
            title="Copiar código"
            className="cursor-pointer font-mono text-pop-cyan hover:underline"
          >
            {room.code}
          </button>
          {!iAmPlayer && (
            <span className="ml-3 rounded-full bg-pop-yellow/15 px-3 py-1 align-middle text-xs font-bold text-pop-yellow">
              👀 assistindo
            </span>
          )}
        </h1>
        <button onClick={() => void leave()} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
          Sair da sala
        </button>
      </div>

      {toast && (
        <p className="mt-3 rounded-field bg-ink-800 px-4 py-2 text-sm font-semibold text-pop-yellow ring-1 ring-ink-700">
          {toast}
        </p>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {/* SALA DE ESPERA */}
          {room.status === 'WAITING' && (
            <div className="card p-6 text-center sm:p-8">
              <p className="text-sm font-bold tracking-widest text-text-muted uppercase">
                {room.isPrivate ? 'Sala privada — chame com o código' : 'Sala pública'}
              </p>
              <button
                onClick={copyCode}
                className="btn-pop mt-3 bg-ink-900 px-8 py-4 font-mono text-4xl font-extrabold tracking-[0.3em] text-pop-cyan ring-2 ring-ink-700 hover:ring-pop-cyan"
                title="Copiar código"
              >
                {room.code}
              </button>

              {room.features.seatPicking ? (
                <SeatPicker room={room} myUserId={user.id} onError={showToast} />
              ) : (
                <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
                  {room.players.map((p) => (
                    <div key={p.userId} className="flex items-center gap-3 rounded-field bg-ink-900 px-4 py-3 ring-1 ring-ink-700">
                      <span className="text-xl" aria-hidden="true">🪑</span>
                      <span className="font-display font-bold">{p.displayName}</span>
                      {p.userId === room.hostId && (
                        <span className="rounded-full bg-pop-purple/15 px-2 py-0.5 text-xs font-bold text-pop-purple">anfitrião</span>
                      )}
                      {!p.isConnected && (
                        <span className="ml-auto text-xs text-pop-orange">reconectando…</span>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
                    <div key={i} className="rounded-field border-2 border-dashed border-ink-700 px-4 py-3 text-sm text-text-muted">
                      esperando jogador…
                    </div>
                  ))}
                </div>
              )}

              {isHost ? (
                <button
                  onClick={() => void start()}
                  disabled={room.players.length < room.maxPlayers && room.players.length < 2}
                  className="btn-pop mt-8 bg-gradient-to-br from-pop-purple to-pop-magenta px-8 py-3.5 text-white shadow-lg shadow-pop-purple/25 disabled:opacity-50"
                >
                  {room.players.length < 2 ? 'Esperando gente sentar…' : 'Começar partida!'}
                </button>
              ) : (
                <p className="mt-8 text-sm text-text-muted">Esperando o anfitrião começar…</p>
              )}
            </div>
          )}

          {/* PARTIDA — componente por jogo */}
          {playing && !end && (
            <>
              {room.gameSlug === 'damas' && (
                <CheckersBoard
                  state={game.state as CheckersState}
                  yourSeat={game.yourSeat}
                  yourTurn={(game.state as CheckersState).turn === game.yourSeat}
                  onMove={(from, to) => void sendAction({ from, to })}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'xadrez' && (
                <ChessBoard
                  state={game.state as ChessState}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                  onMove={(move: ChessMove) => void sendAction(move)}
                />
              )}
              {room.gameSlug === 'domino' && (
                <DominoTable
                  view={game.state as DominoView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                  onAction={(action: DominoAction) => void sendAction(action)}
                />
              )}
              {room.gameSlug === 'one' && (
                <OneTable
                  view={game.state as OneView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                  onAction={(action: OneAction) => void sendAction(action)}
                />
              )}
              {room.gameSlug === 'esquadrao-coop' && (
                <CoopGame
                  snapshot={game.state as CoopSnapshot}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'corrida' && (
                <RacingGame
                  snapshot={game.state as RacingSnapshot}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
            </>
          )}
        </div>

        {/* chat geral da mesa — jogadores e espectadores */}
        <RoomChat className="h-80 lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)] lg:max-h-[640px]" />
      </div>

      {/* FIM DE JOGO */}
      {end && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 p-4">
          <div className="card w-full max-w-md p-8 text-center">
            <p className="text-5xl" aria-hidden="true">
              {room.gameSlug === 'esquadrao-coop' && end.draw ? '🫡' : end.draw ? '🤝' : youWon ? '🏆' : '💜'}
            </p>
            <h2 className="mt-4 font-display text-3xl font-extrabold">
              {room.gameSlug === 'esquadrao-coop' && end.draw
                ? 'Fim de voo, esquadrão!'
                : end.draw
                ? 'Empate!'
                : youWon
                  ? end.winnerUserIds.length > 1
                    ? 'Sua dupla venceu!'
                    : 'Você venceu!'
                  : `${winnerNames || 'Adversário'} ${end.winnerUserIds.length > 1 ? 'venceram' : 'venceu'}`}
            </h2>
            {end.reason === 'wo' && (
              <p className="mt-2 text-sm text-text-muted">Vitória por W.O. (abandono)</p>
            )}
            {room.features.rotation && !end.draw && (
              <p className="mt-2 text-sm text-text-muted">
                {room.isPrivate || room.spectators.length === 0
                  ? 'A mesa continua com os mesmos jogadores — revanche!'
                  : youWon
                    ? 'Quem vence fica na mesa — o próximo da fila já foi chamado!'
                    : 'Quem perde vai para a fila. A mesa continua!'}
              </p>
            )}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {room.features.rotation ? (
                <button
                  onClick={() => setEnd(null)}
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-3 text-white"
                >
                  Ficar na mesa
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/jogos/${room.gameSlug}`)}
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-3 text-white"
                >
                  Jogar de novo
                </button>
              )}
              <button
                onClick={() => {
                  setEnd(null)
                  void leave()
                }}
                className="btn-pop px-6 py-3 ring-2 ring-ink-700 hover:ring-pop-cyan"
              >
                Sair da mesa
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
