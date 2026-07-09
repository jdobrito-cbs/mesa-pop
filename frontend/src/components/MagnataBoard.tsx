import {
  CORES_GRUPO,
  CUSTO_CASA,
  grupoDe,
  MAGNATA_CASAS,
  MAGNATA_FIANCA,
  type MagnataAction,
  type MagnataGrupo,
  type MagnataView,
} from '@mesapop/shared'

/**
 * Magnata — tabuleiro quadrado (perímetro de 11×11). Mostra as casas com cor
 * do grupo, preço, dono e casas/hotel; peões dos jogadores; e no centro os
 * dados, o CARTÃO DE CRÉDITO, as ações e o histórico.
 */

function cell(i: number): { r: number; c: number } {
  if (i <= 10) return { r: 11, c: 11 - i }
  if (i <= 20) return { r: 11 - (i - 10), c: 1 }
  if (i <= 30) return { r: 1, c: i - 20 + 1 }
  return { r: i - 30 + 1, c: 11 }
}

const reais = (n: number) => `R$ ${n}`

function DiceFace({ v }: { v: number }) {
  const P: Record<number, Array<[number, number]>> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  }
  return (
    <svg width={34} height={34} viewBox="0 0 34 34" className="drop-shadow">
      <rect x={1} y={1} width={32} height={32} rx={7} fill="#faf6ea" stroke="#d8cfb4" />
      {(P[v] ?? []).map(([c, r], i) => (
        <circle key={i} cx={7 + c * 10} cy={7 + r * 10} r={3.2} fill="#16233a" />
      ))}
    </svg>
  )
}

export default function MagnataBoard({
  view,
  yourSeat,
  onAction,
}: {
  view: MagnataView
  yourSeat: number
  players: { name: string; seat: number; connected: boolean }[]
  onAction: (a: MagnataAction) => void
}) {
  const eu = view.jogadores.find((j) => j.seat === yourSeat)
  const suaVez = view.turno === yourSeat && !view.vencedor
  const nomeSeat = (s: number) => view.jogadores.find((j) => j.seat === s)?.nome ?? `J${s + 1}`

  // propriedades onde EU posso construir (grupo completo, < hotel)
  const construir: number[] = []
  if (eu && suaVez && (view.fase === 'agir' || view.fase === 'comprar')) {
    for (const c of MAGNATA_CASAS) {
      if (c.tipo === 'propriedade' && view.donoDe[c.i] === yourSeat && grupoDe(c.grupo!).every((i) => view.donoDe[i] === yourSeat)) {
        if ((eu.casas[c.i] ?? 0) < 5) construir.push(c.i)
      }
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* TABULEIRO */}
      <div
        className="relative mx-auto grid aspect-square w-full max-w-[560px] gap-0.5 rounded-card bg-[#0d5c3a] p-1.5 ring-2 ring-ink-700"
        style={{ gridTemplateColumns: 'repeat(11,1fr)', gridTemplateRows: 'repeat(11,1fr)' }}
      >
        {MAGNATA_CASAS.map((c) => {
          const p = cell(c.i)
          const dono = view.donoDe[c.i]
          const donoCor = dono !== null && dono !== undefined ? view.jogadores[dono]?.cor : undefined
          const grupoCor = c.grupo ? CORES_GRUPO[c.grupo] : undefined
          const nCasas = dono !== null && dono !== undefined ? (view.jogadores[dono]?.casas[c.i] ?? 0) : 0
          return (
            <div
              key={c.i}
              style={{ gridRow: p.r, gridColumn: p.c, borderColor: donoCor ?? 'transparent' }}
              className={`relative flex flex-col overflow-hidden rounded-[3px] bg-ink-900 text-[6px] leading-tight ${donoCor ? 'ring-2' : 'ring-1 ring-ink-700'}`}
            >
              {grupoCor && <div style={{ background: grupoCor }} className="h-1.5 w-full shrink-0" />}
              <div className="flex-1 px-0.5 pt-0.5 font-bold text-cream/90">{c.nome}</div>
              {c.preco !== undefined && <div className="px-0.5 pb-0.5 text-pop-yellow">{c.preco}</div>}
              {c.tipo === 'sorte' && <div className="grid flex-1 place-items-center text-base">🎲</div>}
              {c.tipo === 'cofre' && <div className="grid flex-1 place-items-center text-base">📦</div>}
              {c.tipo === 'imposto' && <div className="grid flex-1 place-items-center text-base">🏛️</div>}
              {c.tipo === 'prisao' && <div className="grid flex-1 place-items-center text-base">🚓</div>}
              {c.tipo === 'vaprisao' && <div className="grid flex-1 place-items-center text-base">👮</div>}
              {c.tipo === 'parada' && <div className="grid flex-1 place-items-center text-base">🅿️</div>}
              {c.tipo === 'inicio' && <div className="grid flex-1 place-items-center text-base">🏁</div>}
              {nCasas > 0 && (
                <div className="absolute right-0.5 bottom-0.5 text-[7px]">{nCasas >= 5 ? '🏨' : '🏠'.repeat(nCasas)}</div>
              )}
              {/* peões */}
              <div className="absolute inset-x-0 top-2 flex flex-wrap justify-center gap-px">
                {view.jogadores.map(
                  (j) =>
                    !j.falido &&
                    j.pos === c.i && (
                      <span
                        key={j.seat}
                        title={j.nome}
                        style={{ backgroundColor: j.cor }}
                        className={`size-2 rounded-full ring-1 ring-white/70 ${j.seat === yourSeat ? 'animate-pulse' : ''}`}
                      />
                    ),
                )}
              </div>
            </div>
          )
        })}

        {/* CENTRO: dados + ações */}
        <div
          style={{ gridRow: '3 / 10', gridColumn: '3 / 10' }}
          className="flex flex-col items-center justify-center gap-2 rounded-lg bg-ink-950/40 p-2 text-center"
        >
          <p className="font-display text-lg font-extrabold text-cream">MAGNATA</p>
          {view.dados && (
            <div className="flex gap-2">
              <DiceFace v={view.dados[0]} />
              <DiceFace v={view.dados[1]} />
            </div>
          )}
          {view.aviso && <p className="max-w-[90%] text-[10px] leading-tight text-pop-yellow">{view.aviso}</p>}
          {view.vencedor !== null ? (
            <p className="font-display text-sm font-extrabold text-pop-green">🏆 {nomeSeat(view.vencedor)} venceu!</p>
          ) : (
            <p className="text-[10px] text-text-muted">
              Vez de <span className="font-bold text-cream">{nomeSeat(view.turno)}</span>
            </p>
          )}
        </div>
      </div>

      {/* PAINEL LATERAL */}
      <div className="flex flex-col gap-3">
        {/* seu cartão de crédito */}
        {eu && (
          <div className="rounded-card bg-gradient-to-br from-pop-purple to-pop-magenta p-3 text-white shadow-lg">
            <div className="flex items-center justify-between text-xs opacity-90">
              <span>💳 Cartão Magnata</span>
              <span>{eu.nome}</span>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-[10px] opacity-80">Caixa</p>
                <p className="font-display text-xl font-extrabold tabular-nums">{reais(eu.dinheiro)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] opacity-80">Crédito livre</p>
                <p className="font-display text-lg font-extrabold tabular-nums">{reais(eu.cartaoLimite - eu.cartaoUsado)}</p>
              </div>
            </div>
            <div className="mt-1 text-[10px] opacity-80">
              limite {reais(eu.cartaoLimite)} · usado {reais(eu.cartaoUsado)}
            </div>
          </div>
        )}

        {/* ações */}
        <div className="card flex flex-col gap-2 p-3">
          {view.vencedor !== null ? (
            <p className="text-center text-sm font-bold text-pop-green">Fim de jogo!</p>
          ) : !suaVez ? (
            <p className="text-center text-sm text-text-muted">Aguarde: vez de {nomeSeat(view.turno)}…</p>
          ) : (
            <>
              {view.fase === 'rolar' && (
                <>
                  <button onClick={() => onAction({ type: 'rolar' })} className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-3 font-display font-extrabold text-white">
                    🎲 {eu?.preso ? 'Tentar dupla' : 'Rolar dados'}
                  </button>
                  {eu?.preso && (
                    <button onClick={() => onAction({ type: 'fianca' })} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
                      Pagar fiança ({reais(MAGNATA_FIANCA)})
                    </button>
                  )}
                </>
              )}
              {view.fase === 'comprar' && view.compravel !== null && (
                <>
                  <button onClick={() => onAction({ type: 'comprar' })} className="btn-pop bg-gradient-to-br from-pop-green to-pop-cyan px-4 py-3 font-bold text-white">
                    🏠 Comprar {MAGNATA_CASAS[view.compravel]!.nome} ({reais(MAGNATA_CASAS[view.compravel]!.preco!)})
                  </button>
                  <button onClick={() => onAction({ type: 'passar' })} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
                    Passar
                  </button>
                </>
              )}
              {(view.fase === 'agir' || view.fase === 'fim') && (
                <button onClick={() => onAction({ type: 'encerrar' })} className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-3 font-bold text-white">
                  Encerrar turno
                </button>
              )}
              {construir.map((i) => (
                <button
                  key={i}
                  onClick={() => onAction({ type: 'construir', casa: i })}
                  className="btn-pop px-3 py-1.5 text-xs ring-1 ring-pop-green/50 hover:ring-pop-green"
                >
                  🏗️ Construir em {MAGNATA_CASAS[i]!.nome} ({reais(CUSTO_CASA[MAGNATA_CASAS[i]!.grupo as MagnataGrupo] ?? 100)})
                </button>
              ))}
            </>
          )}
        </div>

        {/* jogadores */}
        <div className="card p-3">
          <p className="mb-2 font-display text-sm font-bold">Jogadores</p>
          <div className="flex flex-col gap-1.5">
            {view.jogadores.map((j) => (
              <div key={j.seat} className={`flex items-center gap-2 rounded-field px-2 py-1 text-xs ring-1 ${j.seat === view.turno && !view.vencedor ? 'bg-ink-800 ring-pop-yellow' : 'bg-ink-900 ring-ink-700'} ${j.falido ? 'opacity-40' : ''}`}>
                <span style={{ backgroundColor: j.cor }} className="size-3 rounded-full" />
                <span className="min-w-0 flex-1 truncate font-semibold">{j.nome}{j.preso ? ' 🚓' : ''}{j.falido ? ' 💥' : ''}</span>
                <span className="tabular-nums text-pop-yellow">{reais(j.dinheiro)}</span>
                <span className="tabular-nums text-text-muted">🏠{j.props.length}</span>
              </div>
            ))}
          </div>
        </div>

        {/* log */}
        <div className="card max-h-40 overflow-y-auto p-3 text-xs text-text-muted">
          {view.log.map((l, i) => (
            <p key={i} className={i === 0 ? 'font-semibold text-cream' : ''}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
