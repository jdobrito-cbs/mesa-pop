import { useState } from 'react'
import { QUIZ_TEMPO_PERGUNTA, type QuizView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Quiz — pergunta gigante, 4 alternativas coloridas, barra de tempo e
 * revelação com verde/vermelho + pontos ganhos. A correta só chega do
 * servidor na hora da revelação.
 */

const CORES = ['#9D5CFF', '#33E0D6', '#FFC53D', '#F252C1']
const ROTULOS = ['A', 'B', 'C', 'D']

export default function QuizGame({
  view,
  yourSeat,
  players,
}: {
  view: QuizView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [aviso, setAviso] = useState('')
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`
  const souJogador = yourSeat >= 0 && yourSeat < view.players
  const revelando = view.fase !== 'pergunta'
  const podeResponder = souJogador && view.fase === 'pergunta' && view.minhaResposta === null

  async function responde(index: number) {
    const res = await emitAck('game:action', { action: { type: 'resposta', index } })
    if (!res.ok) {
      setAviso(res.error ?? 'Não deu')
      setTimeout(() => setAviso(''), 2000)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* placar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {view.placar.map((p, seat) => (
            <div key={seat} className="flex items-center gap-1.5 rounded-2xl bg-ink-800 px-3 py-1.5 text-sm ring-1 ring-ink-700">
              <span className="font-bold">{seat === yourSeat ? 'Você' : nameOf(seat)}</span>
              <span className="font-display font-extrabold text-pop-yellow tabular-nums">{p}</span>
              {view.fase === 'pergunta' && view.responderam[seat] && <span aria-hidden="true">✅</span>}
              {view.fase === 'revelacao' && view.ganhoUltima[seat]! > 0 && (
                <span className="font-bold text-pop-green">+{view.ganhoUltima[seat]}</span>
              )}
            </div>
          ))}
        </div>
        <span className="rounded-2xl bg-ink-950/80 px-3 py-1.5 text-xs font-extrabold text-text-muted">
          {view.rodada + 1}/{view.totalRodadas}
        </span>
      </div>

      {aviso && (
        <p className="mb-2 rounded-field bg-pop-magenta/15 px-4 py-2 text-center text-sm font-bold text-pop-magenta">{aviso}</p>
      )}

      <div className="rounded-card bg-ink-900 p-5 ring-1 ring-ink-700">
        {/* barra de tempo */}
        {view.fase === 'pergunta' && (
          <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-ink-950">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pop-cyan to-pop-purple transition-[width] duration-500 ease-linear"
              style={{ width: `${(view.tempoRestante / QUIZ_TEMPO_PERGUNTA) * 100}%` }}
            />
          </div>
        )}

        <p className="text-center text-[11px] font-extrabold tracking-widest text-pop-cyan uppercase">{view.categoria}</p>
        <p className="mt-1 text-center font-display text-xl font-extrabold text-balance sm:text-2xl">{view.pergunta}</p>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {view.alternativas.map((alt, i) => {
            const minha = view.minhaResposta === i
            const certa = revelando && view.correta === i
            const errei = revelando && minha && view.correta !== i
            return (
              <button
                key={i}
                onClick={podeResponder ? () => void responde(i) : undefined}
                disabled={!podeResponder}
                className={`flex items-center gap-3 rounded-2xl p-3.5 text-left font-bold transition ${
                  certa
                    ? 'bg-pop-green/25 ring-2 ring-pop-green'
                    : errei
                      ? 'bg-pop-magenta/20 ring-2 ring-pop-magenta'
                      : minha
                        ? 'bg-pop-purple/25 ring-2 ring-pop-purple'
                        : revelando
                          ? 'bg-ink-800/60 opacity-60 ring-1 ring-ink-700'
                          : podeResponder
                            ? 'cursor-pointer bg-ink-800 ring-1 ring-ink-700 hover:-translate-y-0.5 hover:ring-pop-cyan'
                            : 'bg-ink-800/80 ring-1 ring-ink-700'
                }`}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-lg font-extrabold text-ink-950"
                  style={{ background: CORES[i] }}
                >
                  {ROTULOS[i]}
                </span>
                <span className="min-w-0 flex-1">{alt}</span>
                {certa && <span aria-hidden="true">✅</span>}
                {errei && <span aria-hidden="true">❌</span>}
              </button>
            )
          })}
        </div>

        <p className="mt-4 text-center text-sm font-bold text-text-muted">
          {view.fase === 'revelacao'
            ? view.respostas && souJogador && view.respostas[yourSeat] === view.correta
              ? `Acertou! +${view.ganhoUltima[yourSeat]} 🎉`
              : 'A certa estava aí em verde…'
            : !souJogador
              ? 'Assistindo ao vivo 👀'
              : view.minhaResposta !== null
                ? 'Resposta travada! Esperando os outros…'
                : `Responda rápido — cada segundo vale bônus! (${Math.ceil(view.tempoRestante)}s)`}
        </p>
      </div>
    </div>
  )
}
