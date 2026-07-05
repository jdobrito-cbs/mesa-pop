import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiRequestError } from '../lib/api'

/**
 * Fazenda Pop — o servidor calcula o crescimento (funciona offline);
 * aqui só apresentamos com countdowns ao vivo e muito capricho.
 */

interface CropInfo {
  slug: string
  name: string
  icon: string
  cost: number
  sell: number
  growSecs: number
}

interface PlotView {
  id: number
  crop: { slug: string; name: string; icon: string; sell: number } | null
  plantedAt: string | null
  readyAt: string | null
  isReady: boolean
  progress: number
}

interface FarmView {
  coins: number
  upgrades: { fertilizer: number }
  plots: PlotView[]
  catalog: CropInfo[]
  shop: {
    plot: { price: number; owned: number; max: number } | null
    fertilizer: { price: number; level: number; max: number } | null
  }
  serverTime: string
}

const fmtTime = (secs: number) => {
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}min`
  if (secs >= 60) return `${Math.floor(secs / 60)}min ${Math.floor(secs % 60)}s`
  return `${Math.max(Math.ceil(secs), 0)}s`
}

export default function FarmPage() {
  const navigate = useNavigate()
  const [farm, setFarm] = useState<FarmView | null>(null)
  const [picker, setPicker] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [, forceTick] = useState(0)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const load = useCallback(async () => {
    try {
      setFarm(await api<FarmView>('/api/farm'))
    } catch {
      showToast('Não deu para carregar a fazenda')
    }
  }, [])

  useEffect(() => {
    void load()
    const poll = setInterval(() => void load(), 30000)
    const tick = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load])

  async function call(path: string, body: unknown, okMsg?: (r: FarmView & { harvested?: { name: string; icon: string; sell: number } }) => string) {
    try {
      const r = await api<FarmView & { harvested?: { name: string; icon: string; sell: number } }>(path, { body })
      setFarm(r)
      if (okMsg) showToast(okMsg(r))
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Algo deu errado')
    }
  }

  const now = Date.now()

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          <span aria-hidden="true">🌾</span> Fazenda Pop
        </h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-pop-yellow/15 px-4 py-1.5 font-display text-lg font-extrabold text-pop-yellow tabular-nums">
            🪙 {farm?.coins ?? '…'}
          </span>
          <button onClick={() => navigate('/mesa')} className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-orange">
            Voltar à mesa
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Suas plantações crescem no servidor — até com você offline. Plante agora, colha depois.
      </p>

      {toast && (
        <p className="mt-3 rounded-field bg-ink-800 px-4 py-2 text-sm font-semibold text-pop-yellow ring-1 ring-ink-700">
          {toast}
        </p>
      )}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_280px]">
        {/* canteiros */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {farm?.plots.map((plot) => {
            const readyAt = plot.readyAt ? new Date(plot.readyAt).getTime() : null
            const remaining = readyAt !== null ? (readyAt - now) / 1000 : null
            const ready = readyAt !== null && remaining !== null && remaining <= 0
            return (
              <div
                key={plot.id}
                className={`card relative flex min-h-36 flex-col items-center justify-center gap-1 p-4 text-center ${ready ? 'ring-2 ring-pop-yellow' : ''}`}
                style={{ background: 'linear-gradient(180deg, #3A2A17 0%, #2B1E10 100%)' }}
              >
                {!plot.crop ? (
                  <button
                    onClick={() => setPicker(plot.id)}
                    className="btn-pop flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-[#5C452A] px-6 py-4 text-sm font-bold text-[#B99B6B] hover:border-pop-green hover:text-pop-green"
                  >
                    <span className="text-2xl" aria-hidden="true">🌱</span>
                    Plantar
                  </button>
                ) : ready ? (
                  <button
                    onClick={() =>
                      void call('/api/farm/harvest', { plotId: plot.id }, (r) =>
                        r.harvested ? `${r.harvested.icon} ${r.harvested.name} vendida por 🪙 ${r.harvested.sell}!` : 'Colhido!',
                      )
                    }
                    className="btn-pop flex flex-col items-center gap-1"
                  >
                    <span className="animate-float text-4xl drop-shadow-[0_0_10px_rgba(255,197,61,0.8)]" aria-hidden="true">
                      {plot.crop.icon}
                    </span>
                    <span className="rounded-full bg-pop-yellow px-4 py-1 text-xs font-extrabold text-ink-950">
                      Colher! +🪙{plot.crop.sell}
                    </span>
                  </button>
                ) : (
                  <>
                    <span className="text-3xl opacity-80" aria-hidden="true" style={{ transform: `scale(${0.55 + plot.progress * 0.45})` }}>
                      {plot.crop.icon}
                    </span>
                    <span className="text-xs font-bold">{plot.crop.name}</span>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-950/60">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-pop-green to-pop-yellow transition-all"
                        style={{ width: `${Math.min(((now - new Date(plot.plantedAt!).getTime()) / (readyAt! - new Date(plot.plantedAt!).getTime())) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#B99B6B] tabular-nums">⏱ {fmtTime(remaining ?? 0)}</span>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* loja */}
        <div className="flex flex-col gap-3">
          <div className="card p-4">
            <p className="font-display text-sm font-bold">🏪 Melhorias</p>
            <div className="mt-3 flex flex-col gap-2">
              {farm?.shop.plot ? (
                <button
                  onClick={() => void call('/api/farm/buy', { upgrade: 'plot' }, () => 'Canteiro novo! 🎉')}
                  disabled={farm.coins < farm.shop.plot.price}
                  className="btn-pop justify-between rounded-field bg-ink-900 px-3 py-2.5 text-sm ring-1 ring-ink-700 hover:ring-pop-green disabled:opacity-50"
                >
                  <span>🟫 Novo canteiro ({farm.shop.plot.owned}/{farm.shop.plot.max})</span>
                  <span className="font-bold text-pop-yellow">🪙 {farm.shop.plot.price}</span>
                </button>
              ) : (
                <p className="text-xs text-text-muted">🟫 Fazenda no tamanho máximo!</p>
              )}
              {farm?.shop.fertilizer ? (
                <button
                  onClick={() => void call('/api/farm/buy', { upgrade: 'fertilizer' }, (r) => `Adubo nível ${r.upgrades.fertilizer}! Crescimento mais rápido 🌱`)}
                  disabled={farm.coins < farm.shop.fertilizer.price}
                  className="btn-pop justify-between rounded-field bg-ink-900 px-3 py-2.5 text-sm ring-1 ring-ink-700 hover:ring-pop-green disabled:opacity-50"
                >
                  <span>💩 Adubo nível {farm.shop.fertilizer.level + 1} (−8% tempo)</span>
                  <span className="font-bold text-pop-yellow">🪙 {farm.shop.fertilizer.price}</span>
                </button>
              ) : (
                <p className="text-xs text-text-muted">💩 Adubo no nível máximo!</p>
              )}
            </div>
          </div>

          <div className="card p-4">
            <p className="font-display text-sm font-bold">📖 Sementes</p>
            <div className="mt-2 flex flex-col gap-1.5 text-xs">
              {farm?.catalog.map((c) => (
                <div key={c.slug} className="flex items-center justify-between rounded-field bg-ink-900 px-3 py-1.5 ring-1 ring-ink-700">
                  <span>
                    {c.icon} {c.name} <span className="text-text-muted">· {fmtTime(c.growSecs)}</span>
                  </span>
                  <span className="tabular-nums">
                    <span className="text-pop-orange">−{c.cost}</span> → <span className="text-pop-green">+{c.sell}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* seletor de sementes */}
      {picker !== null && farm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4"
          onClick={(e) => e.target === e.currentTarget && setPicker(null)}
        >
          <div className="card w-full max-w-sm p-5">
            <p className="font-display text-lg font-bold">O que vamos plantar?</p>
            <div className="mt-3 flex flex-col gap-2">
              {farm.catalog.map((c) => (
                <button
                  key={c.slug}
                  disabled={farm.coins < c.cost}
                  onClick={() => {
                    const plotId = picker
                    setPicker(null)
                    void call('/api/farm/plant', { plotId, crop: c.slug }, () => `${c.icon} ${c.name} plantada!`)
                  }}
                  className="btn-pop justify-between rounded-field bg-ink-900 px-4 py-3 text-sm ring-1 ring-ink-700 hover:ring-pop-green disabled:opacity-40"
                >
                  <span className="text-left">
                    <span className="text-xl" aria-hidden="true">{c.icon}</span> <strong>{c.name}</strong>
                    <span className="block text-xs text-text-muted">cresce em {fmtTime(c.growSecs)} · vende por 🪙{c.sell}</span>
                  </span>
                  <span className="font-bold text-pop-yellow">🪙 {c.cost}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPicker(null)} className="btn-pop mt-3 w-full px-4 py-2 text-sm text-text-muted ring-1 ring-ink-700">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
