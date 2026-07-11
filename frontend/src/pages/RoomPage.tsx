import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type {
  CheckersState,
  ChessMove,
  ChessState,
  CoopSnapshot,
  DesenhaView,
  DueloView,
  DominoAction,
  DominoView,
  BingoView,
  CiscoView,
  ForcaView,
  GameEndView,
  GGView,
  CobraSnapshot,
  MagnataView,
  MemoriaView,
  OneAction,
  OneView,
  PareoView,
  PifeView,
  QuizView,
  RacingSnapshot,
  RoomView,
  StopView,
  TrucoView,
} from '@mesapop/shared'
import { connectSocket, emitAck } from '../lib/socket'
import { useAuth } from '../lib/auth'
import FullscreenButton from '../components/FullscreenButton'
import CheckersBoard from '../components/CheckersBoard'
import ChessBoard from '../components/ChessBoard'
import GiraGenioGame from '../components/GiraGenioGame'
import SlitherGame from '../components/SlitherGame'
import MagnataBoard from '../components/MagnataBoard'
import DesenhaGame from '../components/DesenhaGame'
import DueloGame from '../components/DueloGame'
import StopGame from '../components/StopGame'
import TrucoTable from '../components/TrucoTable'
import CoopGame from '../components/CoopGame'
import RacingGame from '../components/RacingGame'
import DominoTable from '../components/DominoTable'
import OneTable from '../components/OneTable'
import PareoGame from '../components/PareoGame'
import CiscoGame from '../components/CiscoGame'
import PifeTable from '../components/PifeTable'
import MemoriaBoard from '../components/MemoriaBoard'
import ForcaGame from '../components/ForcaGame'
import BingoGame from '../components/BingoGame'
import QuizGame from '../components/QuizGame'
import SeatPicker from '../components/SeatPicker'
import RoomChat from '../components/RoomChat'
import AdSlot from '../components/AdSlot'
import AvatarSvg from '../components/AvatarSvg'
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
  /** fim anunciado, overlay ainda não mostrado (a jogada final termina de animar) */
  const [endSoon, setEndSoon] = useState(false)
  const endShowingRef = useRef(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // hook de dev para testes automatizados de UI (não existe no build de produção)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__game = game
    }
  }, [game])

  // a tela do jogo abre no topo, sem rolagem automática (título junto ao header)
  const partidaRef = useRef<HTMLDivElement>(null)
  // tela cheia da área de jogo + chat (botão de sair vem do FullscreenButton)
  const fsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!code || !user) return
    const socket = connectSocket()

    let endTimer: ReturnType<typeof setTimeout> | null = null
    const onRoom = (r: RoomView) => {
      setRoom(r)
      // rotação: a sala voltou para a espera → limpa a mesa anterior
      // (mas segura o tabuleiro enquanto o overlay de fim estiver na tela)
      if (r.status === 'WAITING' && !endShowingRef.current) setGame(null)
      if (r.status === 'PLAYING') endShowingRef.current = false
    }
    const onState = (payload: GamePayload) => setGame(payload)
    const onEnd = (payload: GameEndView) => {
      // deixa a jogada final terminar de animar antes do "venceu!"
      endShowingRef.current = true
      setEndSoon(true)
      endTimer = setTimeout(() => setEnd(payload), 1100)
      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__end = payload
      }
    }
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
      if (endTimer) clearTimeout(endTimer)
      socket.off('room:update', onRoom)
      socket.off('game:state', onState)
      socket.off('game:end', onEnd)
      socket.off('connect', join)
    }
  }, [code, user])

  // partida em andamento: recarregar/fechar a página pede confirmação
  // (no celular um refresh acidental derrubava o jogador da mesa)
  useEffect(() => {
    if (room?.status !== 'PLAYING') return
    const guarda = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', guarda)
    return () => window.removeEventListener('beforeunload', guarda)
  }, [room?.status])

  /** fecha o overlay de fim e libera a mesa (rotação já pode ter resetado) */
  function dismissEnd() {
    setEnd(null)
    setEndSoon(false)
    endShowingRef.current = false
    if (room?.status !== 'PLAYING') setGame(null)
  }

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

  /** compartilha o LINK da sala (amigos entram direto, até sem conta) */
  async function shareRoom() {
    const url = `${window.location.origin}/sala/${code}`
    const title = `Vem jogar ${room?.gameName ?? ''} comigo na Mesa Pop!`
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // usuário cancelou — cai para o clipboard
      }
    }
    void navigator.clipboard?.writeText(url)
    showToast('Link da sala copiado — manda para a galera! 🔗')
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
  // endSoon mantém o tabuleiro na tela enquanto a jogada final anima
  const playing = (room.status === 'PLAYING' || endSoon) && game
  const winnerNames = (end?.winnerUserIds ?? [])
    .map((id) => room.players.find((p) => p.userId === id)?.displayName)
    .filter(Boolean)
    .join(' e ')
  const youWon = !!end?.winnerUserIds.includes(user.id)
  const seatedPlayers = room.players
    .filter((p) => p.seat !== null)
    .map((p) => ({
      name: p.displayName,
      seat: p.seat!,
      connected: p.isConnected,
      avatar: p.avatar,
      isAdmin: p.isAdmin,
    }))

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
          {(room.gameSlug === 'pareo' || room.gameSlug === 'cisco') && (
            <span
              className="ml-3 rounded-full bg-pop-cyan/15 px-3 py-1 align-middle text-xs font-bold text-pop-cyan"
              title="Pessoas nesta sala"
            >
              👥 {room.players.length}/{room.maxPlayers} na sala
            </span>
          )}
          {!iAmPlayer && (
            <span className="ml-3 rounded-full bg-pop-yellow/15 px-3 py-1 align-middle text-xs font-bold text-pop-yellow">
              👀 assistindo
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          <FullscreenButton targetRef={fsRef} />
          <button
            onClick={() => void shareRoom()}
            className="btn-pop px-4 py-2 text-sm ring-1 ring-pop-cyan/50 hover:ring-pop-cyan"
          >
            🔗 Compartilhar
          </button>
          <button onClick={() => void leave()} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Sair da sala
          </button>
        </div>
      </div>

      {toast && (
        <p className="mt-3 rounded-field bg-ink-800 px-4 py-2 text-sm font-semibold text-pop-yellow ring-1 ring-ink-700">
          {toast}
        </p>
      )}

      {/* Desenha & Adivinha tem chat PRÓPRIO (RESPOSTAS) — o geral sai de cena na partida */}
      <div
        ref={fsRef}
        className={`game-fs mt-6 grid items-start gap-4 ${
          room.gameSlug === 'desenha-adivinha' && playing ? '' : 'lg:grid-cols-[1fr_320px]'
        }`}
      >
        <div>
          {/* SALA DE ESPERA */}
          {room.status === 'WAITING' && !playing && (
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
                      <AvatarSvg id={p.avatar ?? p.displayName} size={18} />
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
                  disabled={room.players.length < room.minPlayers}
                  className="btn-pop mt-8 bg-gradient-to-br from-pop-purple to-pop-magenta px-8 py-3.5 text-white shadow-lg shadow-pop-purple/25 disabled:opacity-50"
                >
                  {room.players.length < room.minPlayers ? 'Esperando gente sentar…' : 'Começar partida!'}
                </button>
              ) : (
                <p className="mt-8 text-sm text-text-muted">Esperando o anfitrião começar…</p>
              )}
            </div>
          )}

          {/* PARTIDA — componente por jogo */}
          {playing && !end && (
            <div ref={partidaRef}>
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
              {room.gameSlug === 'gira-genio' && (
                <GiraGenioGame
                  view={game.state as GGView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                  onGirar={() => void sendAction({ type: 'girar' })}
                  onResponder={(opcao) => void sendAction({ type: 'responder', opcao })}
                />
              )}
              {room.gameSlug === 'cobra-arena' && (
                <SlitherGame
                  snapshot={game.state as CobraSnapshot}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'magnata' && (
                <MagnataBoard
                  view={game.state as MagnataView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                  onAction={(a) => void sendAction(a)}
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
              {room.gameSlug === 'desenha-adivinha' && (
                <DesenhaGame
                  view={game.state as DesenhaView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'duelo-palavras' && (
                <DueloGame
                  view={game.state as DueloView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'stop' && (
                <StopGame
                  view={game.state as StopView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'truco' && (
                <TrucoTable
                  view={game.state as TrucoView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'pife' && (
                <PifeTable
                  view={game.state as PifeView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'memoria' && (
                <MemoriaBoard
                  view={game.state as MemoriaView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'forca' && (
                <ForcaGame
                  view={game.state as ForcaView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'bingo' && (
                <BingoGame
                  view={game.state as BingoView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {(room.gameSlug === 'quiz-pop' || room.gameSlug === 'quiz-nostalgia') && (
                <QuizGame
                  view={game.state as QuizView}
                  yourSeat={game.yourSeat}
                  players={seatedPlayers}
                />
              )}
              {room.gameSlug === 'pareo' && <PareoGame view={game.state as PareoView} />}
              {room.gameSlug === 'cisco' && <CiscoGame view={game.state as CiscoView} />}
            </div>
          )}
        </div>

        {/* chat geral da mesa — jogadores e espectadores */}
        {!(room.gameSlug === 'desenha-adivinha' && playing) && (
          // no celular/tablet o chat só aparece na horizontal (retrato esconde)
          <div className="flex flex-col gap-4 max-lg:portrait:hidden lg:sticky lg:top-20">
            <RoomChat className="h-80 lg:h-[calc(100vh-14rem)] lg:max-h-[560px]" />
            <AdSlot />
          </div>
        )}
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
                  onClick={dismissEnd}
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
                  dismissEnd()
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
