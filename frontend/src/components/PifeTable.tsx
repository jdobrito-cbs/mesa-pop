import { useState } from 'react'
import type { PifeCard, PifeView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Mesa de Pife — monte e lixo no centro, sua mão embaixo (ordenada por
 * naipe só na exibição; o índice enviado é o da mão real no servidor).
 * Comprou? Descarta clicando na carta — ou BATE se os três jogos fecharem.
 */

const NAIPE = { o: '♦', e: '♠', c: '♥', p: '♣' } as const
const NAIPE_COR = { o: 'text-pop-orange', e: 'text-ink-950', c: 'text-pop-magenta', p: 'text-ink-950' } as const
const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function Card({
  card,
  small = false,
  destaque = false,
  onClick,
}: {
  card: PifeCard
  small?: boolean
  destaque?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`${small ? 'h-16 w-11 text-sm' : 'h-22 w-15 text-base'} flex flex-col items-center justify-center rounded-xl bg-cream font-display font-extrabold shadow-lg transition ${
        destaque ? 'ring-3 ring-pop-yellow' : 'ring-1 ring-ink-700/30'
      } ${onClick ? 'cursor-pointer hover:-translate-y-2 hover:ring-2 hover:ring-pop-cyan' : ''}`}
    >
      <span className={NAIPE_COR[card.s]}>{RANK[card.r]}</span>
      <span className={`${small ? 'text-lg' : 'text-xl'} ${NAIPE_COR[card.s]}`}>{NAIPE[card.s]}</span>
    </button>
  )
}

export default function PifeTable({
  view,
  yourSeat,
  players,
}: {
  view: PifeView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [aviso, setAviso] = useState('')
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`
  const minhaVez = view.turno === yourSeat && view.fase !== 'fim'
  const comprando = minhaVez && view.fase === 'comprando'
  const descartando = minhaVez && view.fase === 'descartando'

  async function agir(action: Record<string, unknown>) {
    const res = await emitAck('game:action', { action })
    if (!res.ok) {
      setAviso(res.error ?? 'Não deu')
      setTimeout(() => setAviso(''), 2200)
    }
  }

  // exibe ordenada por naipe/valor, mas envia o índice REAL da mão
  const ordenada = view.minhaMao
    .map((card, index) => ({ card, index }))
    .sort((a, b) => (a.card.s === b.card.s ? a.card.r - b.card.r : a.card.s.localeCompare(b.card.s)))

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* rivais */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {view.cartasRestantes.map((n, seat) =>
          seat === yourSeat ? null : (
            <div
              key={seat}
              className={`rounded-2xl px-3 py-1.5 text-sm ring-1 ${view.turno === seat ? 'bg-pop-purple/20 ring-pop-purple/60' : 'bg-ink-800 ring-ink-700'}`}
            >
              <span className="font-bold">{nameOf(seat)}</span>
              <span className="ml-2 text-text-muted">🂠 {n}</span>
              {view.turno === seat && view.fase !== 'fim' && <span className="ml-1">⏳</span>}
            </div>
          ),
        )}
      </div>

      {aviso && (
        <p className="mb-2 rounded-field bg-pop-magenta/15 px-4 py-2 text-center text-sm font-bold text-pop-magenta">{aviso}</p>
      )}

      {/* mesa de feltro: monte + lixo */}
      <div className="rounded-card bg-gradient-to-br from-[#1E5B38] to-[#14432A] p-5 ring-4 ring-[#0E2E1D]">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="mb-1 text-[10px] font-extrabold tracking-widest text-cream/60 uppercase">monte · {view.monte}</p>
            <button
              onClick={comprando ? () => void agir({ type: 'monte' }) : undefined}
              disabled={!comprando}
              className={`flex h-22 w-15 items-center justify-center rounded-xl bg-gradient-to-br from-pop-purple to-ink-800 font-display text-2xl font-extrabold text-cream ring-1 ring-ink-700 ${
                comprando ? 'cursor-pointer transition hover:-translate-y-1 hover:ring-2 hover:ring-pop-cyan' : 'opacity-80'
              }`}
              aria-label="Comprar do monte"
            >
              🂠
            </button>
          </div>
          <div className="text-center">
            <p className="mb-1 text-[10px] font-extrabold tracking-widest text-cream/60 uppercase">lixo · {view.lixo}</p>
            {view.lixoTopo ? (
              <Card
                card={view.lixoTopo}
                onClick={comprando ? () => void agir({ type: 'lixo' }) : undefined}
              />
            ) : (
              <div className="h-22 w-15 rounded-xl border-2 border-dashed border-cream/30" />
            )}
          </div>
          <div className="max-w-44 text-center text-sm font-bold text-cream/60">
            {view.fase === 'fim'
              ? `🏆 ${nameOf(view.vencedor!)} BATEU!`
              : minhaVez
                ? comprando
                  ? 'Sua vez: compre do monte ou do lixo'
                  : 'Agora descarte uma carta (ou BATA!)'
                : `vez de ${nameOf(view.turno)}…`}
          </div>
        </div>

        {/* jogos do vencedor revelados */}
        {view.gruposVencedores && (
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {view.gruposVencedores.map((grupo, gi) => (
              <div key={gi} className="flex gap-1 rounded-xl bg-ink-950/40 p-2">
                {grupo.map((c, ci) => (
                  <Card key={ci} card={c} small />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* minha mão */}
      {yourSeat >= 0 ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-end justify-center gap-1.5">
            {ordenada.map(({ card, index }) => (
              <Card
                key={`${index}-${card.r}${card.s}`}
                card={card}
                destaque={descartando && index === view.presaDoLixo}
                onClick={
                  descartando && index !== view.presaDoLixo
                    ? () => void agir({ type: 'descartar', index })
                    : undefined
                }
              />
            ))}
            {view.podeBater && (
              <button
                onClick={() => void agir({ type: 'bater' })}
                className="btn-pop ml-2 bg-gradient-to-br from-pop-orange to-pop-magenta px-5 py-3 font-display text-lg font-extrabold text-white shadow-lg shadow-pop-orange/30"
              >
                BATER! 🫱
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-text-muted">
            {descartando
              ? view.presaDoLixo !== null
                ? 'Toque numa carta para descartar — a amarela veio do lixo e não pode voltar agora.'
                : 'Toque numa carta para descartar.'
              : comprando
                ? '3 trincas ou sequências do mesmo naipe fecham o jogo.'
                : ' '}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-text-muted">Assistindo ao vivo 👀 (sem ver as mãos!)</p>
      )}
    </div>
  )
}
