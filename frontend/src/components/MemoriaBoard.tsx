import { useEffect, useRef, useState } from 'react'
import { MEMORIA_COLS, MEMORIA_ICONES, type MemoriaCarta, type MemoriaView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Jogo da Memória — grade 6×6 com viradas animadas (rotateY). A grade
 * (MemoriaGrid) é burra e reutilizada pelo treino solo; o tabuleiro
 * multiplayer cuida do placar, da vez e de segurar o PAR ERRADO na tela
 * por um instante antes de esconder (o servidor já virou de volta).
 */

const SEAT_COR = ['#9D5CFF', '#33E0D6', '#FFC53D', '#F252C1']

export function MemoriaGrid({
  cartas,
  onFlip,
  disabled = false,
}: {
  cartas: MemoriaCarta[]
  onFlip: (index: number) => void
  disabled?: boolean
}) {
  return (
    <div
      className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${MEMORIA_COLS}, minmax(0, 1fr))` }}
    >
      {cartas.map((c, i) => {
        const aberta = c.estado !== 'oculta'
        const clicavel = !disabled && c.estado === 'oculta'
        return (
          <button
            key={i}
            onClick={clicavel ? () => onFlip(i) : undefined}
            disabled={!clicavel}
            aria-label={aberta ? MEMORIA_ICONES[c.valor!] : `Carta ${i + 1}`}
            className={`relative aspect-square [perspective:600px] ${clicavel ? 'cursor-pointer' : ''}`}
          >
            <div
              className="absolute inset-0 transition-transform duration-300 [transform-style:preserve-3d]"
              style={{ transform: aberta ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* verso */}
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-pop-purple to-ink-800 font-display text-lg font-extrabold text-cream/70 ring-1 ring-ink-700 [backface-visibility:hidden]">
                ?
              </div>
              {/* frente */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-cream text-2xl shadow ring-2 [backface-visibility:hidden] sm:text-3xl"
                style={{
                  transform: 'rotateY(180deg)',
                  borderColor: 'transparent',
                  boxShadow:
                    c.estado === 'presa' && c.dono !== undefined
                      ? `0 0 0 3px ${SEAT_COR[c.dono % SEAT_COR.length]}`
                      : undefined,
                  opacity: c.estado === 'presa' ? 0.88 : 1,
                }}
              >
                {aberta ? MEMORIA_ICONES[c.valor!] : ''}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function MemoriaBoard({
  view,
  yourSeat,
  players,
}: {
  view: MemoriaView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [aviso, setAviso] = useState('')
  // segura o par errado visível por um instante (o servidor já escondeu)
  const [parErrado, setParErrado] = useState<NonNullable<MemoriaView['ultimaJogada']> | null>(null)
  const ultimaKey = useRef('')

  useEffect(() => {
    const u = view.ultimaJogada
    if (!u || u.acertou) return
    const key = `${u.a}-${u.b}-${view.turno}-${view.pares.join(',')}`
    if (key === ultimaKey.current) return
    ultimaKey.current = key
    setParErrado(u)
    const t = setTimeout(() => setParErrado(null), 1300)
    return () => clearTimeout(t)
  }, [view.ultimaJogada, view.turno, view.pares])

  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`
  const minhaVez = view.turno === yourSeat && !view.fim

  async function virar(index: number) {
    const res = await emitAck('game:action', { action: { type: 'virar', index } })
    if (!res.ok) {
      setAviso(res.error ?? 'Não deu')
      setTimeout(() => setAviso(''), 2000)
    }
  }

  // injeta o par errado (ainda visível) na grade vinda do servidor
  const cartas = parErrado
    ? view.cartas.map((c, i) =>
        i === parErrado.a
          ? ({ estado: 'virada', valor: parErrado.va } as MemoriaCarta)
          : i === parErrado.b
            ? ({ estado: 'virada', valor: parErrado.vb } as MemoriaCarta)
            : c,
      )
    : view.cartas

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {view.pares.map((p, seat) => (
          <div
            key={seat}
            className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm ring-1 ${
              view.turno === seat && !view.fim ? 'bg-pop-purple/20 ring-pop-purple/60' : 'bg-ink-800 ring-ink-700'
            }`}
          >
            <span className="size-2.5 rounded-full" style={{ background: SEAT_COR[seat % SEAT_COR.length] }} />
            <span className="font-bold">{seat === yourSeat ? 'Você' : nameOf(seat)}</span>
            <span className="font-display font-extrabold text-pop-yellow tabular-nums">{p}</span>
            {view.turno === seat && !view.fim && <span aria-hidden="true">⏳</span>}
          </div>
        ))}
      </div>

      {aviso && (
        <p className="mb-2 rounded-field bg-pop-magenta/15 px-4 py-2 text-center text-sm font-bold text-pop-magenta">{aviso}</p>
      )}

      <MemoriaGrid cartas={cartas} onFlip={(i) => void virar(i)} disabled={!minhaVez || !!parErrado} />

      <p className="mt-3 text-center text-sm text-text-muted">
        {view.fim
          ? 'Fim de jogo!'
          : minhaVez
            ? parErrado
              ? 'Não foi dessa vez… decorou onde elas estão? 👀'
              : 'Sua vez — vire duas cartas. Achou o par? Joga de novo!'
            : yourSeat >= 0
              ? `vez de ${nameOf(view.turno)}…`
              : 'Assistindo ao vivo 👀'}
      </p>
    </div>
  )
}
