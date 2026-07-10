import type { ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DESAFIOS_DIARIOS, ehDesafioDiario } from '@mesapop/shared'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../lib/auth'
import AdSlot from '../components/AdSlot'
import AvatarSvg from '../components/AvatarSvg'
import SudokuPage from './SudokuPage'
import CacaPalavrasPage from './CacaPalavrasPage'
import CruzadinhaPage from './CruzadinhaPage'
import MahjongPage from './MahjongPage'

/**
 * Desafio Diário — o MESMO puzzle para todos a cada dia (seed = a data).
 * Hub (/desafio) lista os desafios do dia com o que você já fez; o
 * despachante (/desafio/:slug) abre o puzzle em modo diário ou, se você
 * já jogou hoje, mostra o placar e convida a voltar amanhã.
 */

interface HojeResp {
  date: string
  jogos: Array<{ slug: string; done: boolean; points: number }>
}

interface RankResp {
  date: string
  slug: string
  rows: Array<{ rank: number; userId: string; displayName: string; points: number; segundos: number }>
}

function dataLonga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${d} de ${meses[(m ?? 1) - 1]}. de ${y}`
}

/** hub em /desafio */
export default function DesafioHub() {
  const navigate = useNavigate()
  const { data } = useFetch<HojeResp>('/api/desafio/hoje')
  const statusDe = (slug: string) => data?.jogos.find((j) => j.slug === slug)
  const feitos = data?.jogos.filter((j) => j.done).length ?? 0

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold">
            <span aria-hidden="true">📅</span> Desafio Diário
          </h1>
          <p className="mt-1 text-text-muted">
            O mesmo tabuleiro para toda a mesa hoje — {data ? dataLonga(data.date) : '…'}. Volte amanhã para novos.
          </p>
        </div>
        <span className="rounded-full bg-pop-green/15 px-3 py-1 text-sm font-bold text-pop-green">
          {feitos}/{DESAFIOS_DIARIOS.length} feitos hoje
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {DESAFIOS_DIARIOS.map((d) => {
          const st = statusDe(d.slug)
          return (
            <button
              key={d.slug}
              onClick={() => navigate(`/desafio/${d.slug}`)}
              className="card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-1"
              style={{ boxShadow: `inset 0 0 0 1px ${d.cor}33` }}
            >
              <span
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
                style={{ background: `${d.cor}22` }}
                aria-hidden="true"
              >
                {d.icone}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-bold">{d.nome}</span>
                <span className="block truncate text-sm text-text-muted">{d.descricao}</span>
              </span>
              {st?.done ? (
                <span className="shrink-0 rounded-full bg-pop-green/15 px-3 py-1 text-sm font-bold text-pop-green">
                  ✓ {st.points} pts
                </span>
              ) : (
                <span className="shrink-0 rounded-full px-3 py-1 text-sm font-bold text-pop-cyan ring-1 ring-pop-cyan/40 group-hover:bg-pop-cyan/10">
                  Jogar →
                </span>
              )}
            </button>
          )
        })}
      </div>

      <AdSlot className="mt-10" />
    </main>
  )
}

const PAGINAS: Record<string, (daily: string) => ReactElement> = {
  sudoku: (daily) => <SudokuPage daily={daily} />,
  'caca-palavras': (daily) => <CacaPalavrasPage daily={daily} />,
  cruzadinha: (daily) => <CruzadinhaPage daily={daily} />,
  mahjong: (daily) => <MahjongPage daily={daily} />,
}

/** despachante em /desafio/:slug */
export function DesafioJogo() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data } = useFetch<HojeResp>('/api/desafio/hoje')

  if (!slug || !ehDesafioDiario(slug)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden="true">📅</p>
        <h1 className="mt-4 text-2xl font-extrabold">Este desafio não existe</h1>
        <button onClick={() => navigate('/desafio')} className="btn-pop mt-6 px-6 py-3 ring-2 ring-ink-700 hover:ring-pop-cyan">
          Ver desafios de hoje
        </button>
      </main>
    )
  }

  if (!data) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-text-muted">Carregando o desafio…</main>
  }

  const st = data.jogos.find((j) => j.slug === slug)
  if (st?.done) return <DesafioFeito slug={slug} pontos={st.points} />
  return PAGINAS[slug]!(data.date)
}

/** já jogou hoje: mostra o placar do dia e convida a voltar amanhã */
function DesafioFeito({ slug, pontos }: { slug: string; pontos: number }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data } = useFetch<RankResp>(`/api/desafio/ranking/${slug}`)
  const def = DESAFIOS_DIARIOS.find((d) => d.slug === slug)!
  const minhaPos = data?.rows.find((r) => r.userId === user?.id)?.rank

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="card p-8 text-center">
        <p className="text-5xl" aria-hidden="true">{def.icone}</p>
        <h1 className="mt-3 text-3xl font-extrabold">Desafio de hoje concluído!</h1>
        <p className="mt-1 text-text-muted">
          Você fez <b className="text-pop-yellow">{pontos} pts</b> no {def.nome}
          {minhaPos ? <> · {minhaPos}º lugar do dia</> : null}. Volte amanhã para um novo.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => navigate('/desafio')} className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-6 py-2.5 text-sm text-white">
            Ver outros desafios
          </button>
          <button onClick={() => navigate('/mesa')} className="btn-pop px-6 py-2.5 text-sm ring-1 ring-ink-700 hover:ring-pop-cyan">
            Voltar à mesa
          </button>
        </div>
      </div>

      <div className="card mt-5 p-5">
        <p className="font-display text-sm font-bold">🏆 Ranking de hoje · {def.nome}</p>
        <div className="mt-3 flex flex-col gap-1.5">
          {!data?.rows.length && <p className="text-sm text-text-muted">Ninguém no placar ainda hoje.</p>}
          {data?.rows.map((row) => (
            <div
              key={row.userId}
              className={`flex items-center gap-2 rounded-field px-3 py-1.5 text-sm ring-1 ${
                row.userId === user?.id ? 'bg-pop-purple/20 ring-pop-purple/50' : 'bg-ink-900 ring-ink-700'
              }`}
            >
              <span className={`w-7 font-display font-extrabold ${row.rank <= 3 ? 'text-pop-yellow' : 'text-text-muted'}`}>{row.rank}º</span>
              <AvatarSvg id={row.displayName} size={20} />
              <span className="min-w-0 flex-1 truncate font-semibold">{row.displayName}</span>
              <span className="text-xs text-text-muted tabular-nums">{row.segundos}s</span>
              <span className="font-bold text-pop-cyan tabular-nums">{row.points}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
