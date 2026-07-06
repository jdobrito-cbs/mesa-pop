import { useState } from 'react'
import { bingoLetra, BINGO_COLUNAS, BINGO_LINHAS, type BingoView } from '@mesapop/shared'
import { emitAck } from '../lib/socket'

/**
 * Bingo 75 — a bola da vez GIGANTE, histórico completo, sua cartela
 * marcável no toque e o botão BINGO! que só o servidor confirma.
 */

const COR_COLUNA = ['#9D5CFF', '#33E0D6', '#FFC53D', '#F252C1', '#55E07F']

export default function BingoGame({
  view,
  yourSeat,
  players,
}: {
  view: BingoView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
}) {
  const [aviso, setAviso] = useState('')
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Jogador ${seat + 1}`
  const souJogador = yourSeat >= 0 && view.minhaCartela.length === 25

  async function agir(action: Record<string, unknown>) {
    const res = await emitAck('game:action', { action })
    if (!res.ok) {
      setAviso(res.error ?? 'Não deu')
      setTimeout(() => setAviso(''), 2200)
    }
  }

  const tenhoLinha =
    souJogador && BINGO_LINHAS.some((cells) => cells.every((c) => view.minhasMarcadas[c]))
  const sorteadas = new Set(view.bolas)

  return (
    <div className="mx-auto w-full max-w-3xl">
      {aviso && (
        <p className="mb-2 rounded-field bg-pop-magenta/15 px-4 py-2 text-center text-sm font-bold text-pop-magenta">{aviso}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        {/* bola da vez + histórico */}
        <div className="flex flex-col gap-3">
          <div className="rounded-card bg-ink-900 p-4 text-center ring-1 ring-ink-700">
            <p className="text-[10px] font-extrabold tracking-widest text-text-muted uppercase">bola da vez</p>
            {view.bolaAtual ? (
              <div
                key={view.bolaAtual}
                className="mx-auto mt-2 flex size-24 animate-[pop_.3s_ease-out] flex-col items-center justify-center rounded-full font-display font-extrabold text-ink-950 shadow-lg"
                style={{ background: COR_COLUNA[Math.min(4, Math.floor((view.bolaAtual - 1) / 15))] }}
              >
                <span className="text-sm leading-none">{bingoLetra(view.bolaAtual)}</span>
                <span className="text-4xl leading-none">{view.bolaAtual}</span>
              </div>
            ) : (
              <p className="mt-4 font-display text-lg font-bold text-text-muted">girando o globo…</p>
            )}
            <p className="mt-2 text-xs text-text-muted">
              {view.fase === 'fim' ? 'fim de jogo' : `${view.bolas.length}/75 · próxima em ${Math.ceil(view.proximaEm)}s`}
            </p>
          </div>

          {/* rivais */}
          <div className="rounded-card bg-ink-900 p-3 ring-1 ring-ink-700">
            <p className="mb-2 text-[10px] font-extrabold tracking-widest text-text-muted uppercase">na disputa</p>
            <div className="flex flex-col gap-1">
              {view.rivais.map((r) => (
                <div key={r.seat} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {r.seat === yourSeat ? 'Você' : nameOf(r.seat)}
                  </span>
                  <span className="font-bold text-pop-cyan tabular-nums">{r.marcadas}/25</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* cartela */}
          {souJogador ? (
            <div className="rounded-card bg-gradient-to-br from-[#1E5B38] to-[#14432A] p-4 ring-4 ring-[#0E2E1D]">
              <div className="mx-auto grid max-w-sm grid-cols-5 gap-1.5">
                {BINGO_COLUNAS.map((l, c) => (
                  <span key={l} className="text-center font-display text-lg font-extrabold" style={{ color: COR_COLUNA[c] }}>
                    {l}
                  </span>
                ))}
                {view.minhaCartela.map((n, i) => {
                  const marcada = view.minhasMarcadas[i]
                  const daLinha = view.linhaVencedora?.includes(i) && view.vencedor === yourSeat
                  const cantada = n !== 0 && sorteadas.has(n)
                  return (
                    <button
                      key={i}
                      onClick={!marcada && n !== 0 ? () => void agir({ type: 'marcar', index: i }) : undefined}
                      disabled={marcada || n === 0 || view.fase === 'fim'}
                      className={`flex aspect-square items-center justify-center rounded-xl font-display text-lg font-extrabold transition sm:text-xl ${
                        daLinha
                          ? 'bg-pop-yellow text-ink-950 ring-2 ring-pop-yellow'
                          : n === 0
                            ? 'bg-pop-purple/40 text-cream'
                            : marcada
                              ? 'bg-pop-magenta text-white'
                              : cantada
                                ? 'cursor-pointer bg-cream text-ink-950 ring-2 ring-pop-yellow hover:-translate-y-0.5'
                                : 'cursor-pointer bg-cream/90 text-ink-950 hover:-translate-y-0.5'
                      }`}
                    >
                      {n === 0 ? '★' : n}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 text-center">
                <button
                  onClick={() => void agir({ type: 'bingo' })}
                  disabled={view.fase === 'fim'}
                  className={`btn-pop px-8 py-3 font-display text-xl font-extrabold text-white shadow-lg transition ${
                    tenhoLinha
                      ? 'animate-bounce bg-gradient-to-br from-pop-orange to-pop-magenta shadow-pop-orange/40'
                      : 'bg-ink-800 ring-1 ring-ink-700'
                  }`}
                >
                  BINGO! 🎉
                </button>
                <p className="mt-1 text-xs text-cream/60">
                  linha, coluna ou diagonal completa — toque nos números cantados para marcar
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-card bg-ink-900 p-6 text-center text-sm text-text-muted ring-1 ring-ink-700">
              Assistindo ao vivo 👀 — torça por alguém!
            </p>
          )}

          {/* histórico de bolas */}
          <div className="rounded-card bg-ink-900 p-3 ring-1 ring-ink-700">
            <p className="mb-2 text-[10px] font-extrabold tracking-widest text-text-muted uppercase">
              já cantadas · {view.bolas.length}
            </p>
            <div className="flex flex-wrap gap-1">
              {view.bolas.map((b) => (
                <span
                  key={b}
                  className="flex size-7 items-center justify-center rounded-full text-[11px] font-extrabold text-ink-950"
                  style={{ background: `${COR_COLUNA[Math.min(4, Math.floor((b - 1) / 15))]}CC` }}
                >
                  {b}
                </span>
              ))}
              {view.bolas.length === 0 && <span className="text-sm text-text-muted">…</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
