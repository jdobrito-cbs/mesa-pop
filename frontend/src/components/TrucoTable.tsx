import { useState } from 'react'
import type { TrucoCard, TrucoView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Mesa de Truco — vira e manilha no centro, sua mão embaixo (escondida
 * dos rivais no servidor), tentos por dupla e o botão que muda tudo:
 * TRUCO! O blefe rola no chat da mesa. 😏
 */

const NAIPE = { o: '♦', e: '♠', c: '♥', p: '♣' } as const
const NAIPE_COR = { o: 'text-pop-orange', e: 'text-ink-950', c: 'text-pop-magenta', p: 'text-ink-950' } as const
const VALOR_NOME: Record<number, string> = { 3: 'TRUCO', 6: 'SEIS', 9: 'NOVE', 12: 'DOZE' }

function Card({ card, small = false, destaque = false, onClick }: { card: TrucoCard; small?: boolean; destaque?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`${small ? 'h-16 w-11 text-sm' : 'h-24 w-16 text-lg'} flex flex-col items-center justify-center rounded-xl bg-cream font-display font-extrabold shadow-lg transition ${
        destaque ? 'ring-3 ring-pop-yellow' : 'ring-1 ring-ink-700/30'
      } ${onClick ? 'cursor-pointer hover:-translate-y-2 hover:ring-2 hover:ring-pop-cyan' : ''}`}
    >
      <span className={NAIPE_COR[card.s]}>{card.r}</span>
      <span className={`${small ? 'text-lg' : 'text-2xl'} ${NAIPE_COR[card.s]}`}>{NAIPE[card.s]}</span>
    </button>
  )
}

export default function TrucoTable({
  view,
  yourSeat,
  players,
}: {
  view: TrucoView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [aviso, setAviso] = useState('')
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`
  const minhaVez = view.turno === yourSeat && view.fase === 'jogando'
  const respondo = view.fase === 'respondendo' && yourSeat >= 0 && view.pendente?.paraTeam === view.meuTeam
  const possoTrucar =
    yourSeat >= 0 && view.fase === 'jogando' && view.valor < 12 && view.meuTeam >= 0

  async function agir(action: Record<string, unknown>) {
    const res = await emitAck('game:action', { action })
    if (!res.ok) {
      setAviso(res.error ?? 'Não deu')
      setTimeout(() => setAviso(''), 2200)
    }
  }

  const proximoValor = view.valor === 1 ? 3 : Math.min(view.valor + 3, 12)

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* placar de tentos */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-3">
          {[0, 1].map((team) => (
            <div
              key={team}
              className={`rounded-2xl px-4 py-1.5 ring-1 ${view.meuTeam === team ? 'bg-pop-purple/20 ring-pop-purple/60' : 'bg-ink-800 ring-ink-700'}`}
            >
              <p className="text-[10px] font-extrabold tracking-widest text-text-muted uppercase">
                {view.players === 2 ? nameOf(team) : `dupla ${team === 0 ? '💜' : '🩵'}`}
                {view.meuTeam === team ? ' (sua)' : ''}
              </p>
              <p className="font-display text-xl font-extrabold text-pop-yellow tabular-nums">
                {view.placar[team as 0 | 1]} <span className="text-xs text-text-muted">/12</span>
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-ink-950/80 px-4 py-2 text-center">
          <p className="text-[10px] font-extrabold tracking-widest text-text-muted uppercase">valendo</p>
          <p className="font-display text-xl font-extrabold text-pop-orange">{view.valor}</p>
        </div>
      </div>

      {aviso && (
        <p className="mb-2 rounded-field bg-pop-magenta/15 px-4 py-2 text-center text-sm font-bold text-pop-magenta">{aviso}</p>
      )}

      {/* mesa de feltro */}
      <div className="relative rounded-card bg-gradient-to-br from-[#1E5B38] to-[#14432A] p-5 ring-4 ring-[#0E2E1D]">
        {/* vira + manilha */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <div className="text-center">
            <p className="mb-1 text-[10px] font-extrabold tracking-widest text-cream/60 uppercase">vira</p>
            <Card card={view.vira} small />
          </div>
          <div className="rounded-xl bg-ink-950/40 px-3 py-2 text-center">
            <p className="text-[10px] font-extrabold tracking-widest text-cream/60 uppercase">manilha</p>
            <p className="font-display text-2xl font-extrabold text-pop-yellow">{view.manilha}</p>
          </div>
          {/* vazas */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`flex size-7 items-center justify-center rounded-full text-xs font-extrabold ${
                  view.vazas[i] === undefined
                    ? 'bg-ink-950/30 text-cream/40'
                    : view.vazas[i] === null
                      ? 'bg-ink-950/60 text-cream'
                      : view.vazas[i] === view.meuTeam
                        ? 'bg-pop-green text-ink-950'
                        : 'bg-pop-magenta text-white'
                }`}
              >
                {view.vazas[i] === undefined ? i + 1 : view.vazas[i] === null ? '=' : view.vazas[i] === view.meuTeam ? '✓' : '✗'}
              </span>
            ))}
          </div>
        </div>

        {/* cartas na mesa */}
        <div className="flex min-h-28 items-center justify-center gap-3">
          {view.mesa.length === 0 && (
            <p className="text-sm font-bold text-cream/50">
              {view.fase === 'respondendo'
                ? `✋ ${nameOf(view.pendente!.pedidoPor)} pediu ${VALOR_NOME[view.pendente!.novoValor] ?? view.pendente!.novoValor}!`
                : `vez de ${view.turno === yourSeat ? 'VOCÊ' : nameOf(view.turno)}…`}
            </p>
          )}
          {view.mesa.map((m) => (
            <div key={m.seat} className="text-center">
              <Card card={m.card} small />
              <p className="mt-1 max-w-14 truncate text-[10px] font-bold text-cream/70">{nameOf(m.seat)}</p>
            </div>
          ))}
        </div>

        {/* truco pendente */}
        {view.fase === 'respondendo' && (
          <div className="mt-3 rounded-xl bg-ink-950/60 p-3 text-center">
            <p className="font-display text-xl font-extrabold text-pop-orange">
              {VALOR_NOME[view.pendente!.novoValor] ?? view.pendente!.novoValor}!!!
            </p>
            {respondo ? (
              <div className="mt-2 flex justify-center gap-2">
                <button onClick={() => void agir({ type: 'aceitar' })} className="btn-pop bg-pop-green px-4 py-2 text-sm font-extrabold text-ink-950">
                  Aceitar ({view.pendente!.novoValor})
                </button>
                {view.pendente!.novoValor < 12 && (
                  <button onClick={() => void agir({ type: 'truco' })} className="btn-pop bg-pop-orange px-4 py-2 text-sm font-extrabold text-ink-950">
                    {VALOR_NOME[view.pendente!.novoValor + 3] ?? 'Aumentar'}!
                  </button>
                )}
                <button onClick={() => void agir({ type: 'correr' })} className="btn-pop bg-ink-800 px-4 py-2 text-sm font-bold ring-1 ring-ink-700">
                  Correr 🏃
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-cream/60">esperando a resposta da outra dupla…</p>
            )}
          </div>
        )}
      </div>

      {/* última mão */}
      {view.ultimaMao && view.fase !== 'fim' && (
        <p className="mt-2 text-center text-xs font-semibold text-text-muted">
          {view.ultimaMao.team === null
            ? 'Mão empatada — ninguém pontuou.'
            : `${view.players === 2 ? nameOf(view.ultimaMao.team) : `Dupla ${view.ultimaMao.team === 0 ? '💜' : '🩵'}`} levou ${view.ultimaMao.valor} tento${view.ultimaMao.valor > 1 ? 's' : ''}${view.ultimaMao.correu ? ' (a outra correu! 🏃)' : ''}`}
        </p>
      )}

      {/* minha mão + TRUCO */}
      {yourSeat >= 0 ? (
        <div className="mt-4 flex items-end justify-center gap-3">
          <div className="flex gap-2">
            {view.minhaMao.map((c, i) => (
              <Card
                key={`${c.r}${c.s}`}
                card={c}
                destaque={c.r === view.manilha}
                onClick={minhaVez ? () => void agir({ type: 'carta', index: i }) : undefined}
              />
            ))}
            {view.minhaMao.length === 0 && <p className="text-sm text-text-muted">sem cartas…</p>}
          </div>
          {possoTrucar && (
            <button
              onClick={() => void agir({ type: 'truco' })}
              className="btn-pop bg-gradient-to-br from-pop-orange to-pop-magenta px-5 py-3 font-display text-lg font-extrabold text-white shadow-lg shadow-pop-orange/30"
            >
              {VALOR_NOME[proximoValor]}! ✊
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-text-muted">Assistindo ao vivo 👀 (sem ver as mãos!)</p>
      )}
      <p className="mt-2 text-center text-xs text-text-muted">
        {minhaVez ? 'Sua vez — toque numa carta para jogar. Manilhas brilham em amarelo!' : ' '}
      </p>
    </div>
  )
}
