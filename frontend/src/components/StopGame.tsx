import { useEffect, useRef, useState } from 'react'
import { STOP_CATEGORIAS, type StopView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Stop! (Adedanha) — letra sorteada, categorias para preencher e o botão
 * de gritar STOP. As respostas dos rivais só aparecem no resultado;
 * enquanto isso você vê apenas o progresso deles (x/7).
 */
export default function StopGame({
  view,
  yourSeat,
  players,
}: {
  view: StopView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [valores, setValores] = useState<string[]>(() => [...view.minhas])
  const [aviso, setAviso] = useState('')
  const rodadaRef = useRef(view.rodada)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`

  // nova rodada → limpa os campos
  useEffect(() => {
    if (rodadaRef.current !== view.rodada) {
      rodadaRef.current = view.rodada
      setValores(Array.from({ length: STOP_CATEGORIAS.length }, () => ''))
    }
  }, [view.rodada])

  function setValor(i: number, v: string) {
    setValores((prev) => {
      const next = prev.map((x, k) => (k === i ? v : x))
      // envia com um pequeno atraso (o servidor guarda escondido)
      if (sendTimer.current) clearTimeout(sendTimer.current)
      sendTimer.current = setTimeout(() => {
        void emitAck('game:action', { action: { type: 'respostas', valores: next } })
      }, 400)
      return next
    })
  }

  async function gritarStop() {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    await emitAck('game:action', { action: { type: 'respostas', valores } })
    const res = await emitAck('game:action', { action: { type: 'stop' } })
    if (!res.ok) {
      setAviso(res.error ?? 'Não deu')
      setTimeout(() => setAviso(''), 2200)
    }
  }

  const completou = valores.every((v) => v.trim().length > 0)
  const preenchendo = view.fase === 'preenchendo' && yourSeat >= 0

  return (
    <div>
      {/* letra + tempo + rodada */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pop-purple to-pop-magenta font-display text-4xl font-extrabold text-white shadow-lg shadow-pop-purple/30">
            {view.letra}
          </span>
          <div>
            <p className="font-display font-bold">
              {view.fase === 'preenchendo' ? 'Palavras com a letra…' : view.fase === 'resultado' ? 'Comparando!' : 'Fim de jogo!'}
            </p>
            <p className="text-sm text-text-muted">rodada {view.rodada}/{view.totalRodadas}</p>
          </div>
        </div>
        <span className="rounded-full bg-ink-950/80 px-4 py-2 font-display text-xl font-extrabold text-pop-yellow tabular-nums">
          ⏱ {view.tempo}s
        </span>
      </div>

      {aviso && (
        <p className="mb-3 rounded-field bg-pop-magenta/15 px-4 py-2 text-sm font-bold text-pop-magenta">{aviso}</p>
      )}

      {view.fase === 'preenchendo' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="card flex flex-col gap-3 p-4">
            {STOP_CATEGORIAS.map((cat, i) => (
              <label key={cat} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-bold text-text-muted">{cat}</span>
                <input
                  className="field flex-1 py-2"
                  value={valores[i] ?? ''}
                  placeholder={`${cat} com ${view.letra}…`}
                  maxLength={30}
                  disabled={!preenchendo}
                  onChange={(e) => setValor(i, e.target.value)}
                />
              </label>
            ))}
            {preenchendo && (
              <button
                onClick={() => void gritarStop()}
                disabled={!completou}
                className="btn-pop mt-1 bg-gradient-to-br from-pop-orange to-pop-magenta py-3 font-display text-xl font-extrabold text-white shadow-lg shadow-pop-orange/30 disabled:opacity-40"
              >
                ✋ STOP!
              </button>
            )}
          </div>

          {/* progresso dos rivais (sem os textos!) */}
          <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col">
            {view.progresso
              .filter((p) => p.seat !== yourSeat)
              .map((p) => (
                <div key={p.seat} className="card min-w-40 p-3">
                  <p className="truncate text-sm font-bold">{nameOf(p.seat)}</p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-900">
                    <div
                      className="h-full bg-gradient-to-r from-pop-cyan to-pop-green transition-all"
                      style={{ width: `${(p.preenchidas / STOP_CATEGORIAS.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-muted tabular-nums">
                    {p.preenchidas}/{STOP_CATEGORIAS.length} · {view.scores[p.seat] ?? 0} pts
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {(view.fase === 'resultado' || view.fase === 'fim') && view.resultado && (
        <div className="card overflow-x-auto p-4">
          {view.stopPor !== null ? (
            <p className="mb-3 font-display font-bold text-pop-orange">✋ {nameOf(view.stopPor)} gritou STOP!</p>
          ) : (
            <p className="mb-3 font-display font-bold text-text-muted">⏱ O tempo acabou!</p>
          )}
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wider text-text-muted uppercase">
                <th className="pb-2">Categoria</th>
                {view.resultado.map((l) => (
                  <th key={l.seat} className="pb-2">
                    {nameOf(l.seat)}
                    {l.seat === yourSeat ? ' (você)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STOP_CATEGORIAS.map((cat, i) => (
                <tr key={cat} className="border-t border-ink-700">
                  <td className="py-1.5 font-bold text-text-muted">{cat}</td>
                  {view.resultado!.map((l) => (
                    <td key={l.seat} className="py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          l.pontos[i] === 10
                            ? 'bg-pop-green/20 text-pop-green'
                            : l.pontos[i] === 5
                              ? 'bg-pop-yellow/20 text-pop-yellow'
                              : 'bg-ink-900 text-text-muted/60'
                        }`}
                      >
                        {l.respostas[i]?.trim() || '—'} {l.pontos[i] ? `+${l.pontos[i]}` : ''}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-ink-700">
                <td className="pt-2 font-display font-extrabold">Total</td>
                {view.resultado.map((l) => (
                  <td key={l.seat} className="pt-2 font-display font-extrabold text-pop-cyan tabular-nums">
                    {view.scores[l.seat] ?? 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {view.fase === 'resultado' && (
            <p className="mt-3 text-xs text-text-muted">Próxima letra em {view.tempo}s…</p>
          )}
        </div>
      )}
    </div>
  )
}
