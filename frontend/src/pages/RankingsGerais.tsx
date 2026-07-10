import type { RankingGeralRow, RankingsGerais as RankingsGeraisType } from '@mesapop/shared'
import AvatarSvg from '../components/AvatarSvg'
import { useFetch } from '../lib/useFetch'

/** formata ms em "Xh Ymin" (ou só "Ymin" abaixo de 1h) */
export function fmtTempo(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

const MEDALHA = ['🥇', '🥈', '🥉'] as const

function RankRow({ row, fmt }: { row: RankingGeralRow; fmt: (v: number) => string }) {
  const destaque = row.rank <= 3
  const bg =
    row.rank === 1 ? 'bg-pop-yellow/10' : row.rank === 2 ? 'bg-slate-300/10' : row.rank === 3 ? 'bg-orange-500/10' : ''
  return (
    <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${bg}`}>
      <span className="w-7 shrink-0 text-center font-display text-lg font-extrabold">
        {destaque ? MEDALHA[row.rank - 1] : `#${row.rank}`}
      </span>
      <AvatarSvg id={row.avatar ?? row.displayName} size={28} />
      <span className="min-w-0 flex-1 truncate font-semibold">{row.displayName}</span>
      <span className="shrink-0 font-bold text-pop-cyan">{fmt(row.valor)}</span>
    </div>
  )
}

function RankCard({
  titulo,
  rows,
  fmt,
  voce,
  vazio,
}: {
  titulo: string
  rows: RankingGeralRow[]
  fmt: (v: number) => string
  voce: number | null | undefined
  vazio: string
}) {
  const noTop = voce != null && voce > rows.length
  return (
    <div className="card p-5">
      <h2 className="font-display text-xl font-extrabold">{titulo}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">{vazio}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-1">
          {rows.map((row) => (
            <RankRow key={row.userId} row={row} fmt={fmt} />
          ))}
        </div>
      )}
      {voce === null && (
        <p className="mt-3 border-t border-ink-800 pt-3 text-sm text-text-muted">
          Jogue partidas para entrar no ranking!
        </p>
      )}
      {noTop && (
        <p className="mt-3 border-t border-ink-800 pt-3 text-sm text-text-muted">
          Você: <strong className="text-pop-yellow">nº {voce}</strong>
        </p>
      )}
    </div>
  )
}

/** Página /rankings — os dois top-10 gerais da plataforma (pontos e tempo de jogo). */
export default function RankingsGerais() {
  const { data, loading } = useFetch<RankingsGeraisType>('/api/rankings/gerais')

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-4xl font-extrabold">🏆 Rankings da Mesa</h1>
      <p className="mt-2 text-text-muted">
        Top 10 de cada ranking pode usar avatares ESPECIAIS; o nº 1, os SUPER ✨
      </p>

      {loading && <p className="mt-8 text-text-muted">Carregando…</p>}

      {!loading && data && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <RankCard
            titulo="🎯 Pontuação geral"
            rows={data.pontos}
            fmt={(v) => `${v.toLocaleString('pt-BR')} pts`}
            voce={data.voce?.pontos}
            vazio="Ainda não há partidas suficientes — seja o primeiro!"
          />
          <RankCard
            titulo="⏱️ Tempo de jogo"
            rows={data.tempo}
            fmt={fmtTempo}
            voce={data.voce?.tempo}
            vazio="Ainda não há partidas suficientes — seja o primeiro!"
          />
        </div>
      )}
    </main>
  )
}
