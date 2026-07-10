import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AVATARES_ESPECIAIS, AVATARES_NORMAIS, AVATARES_SUPER } from '@mesapop/shared'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import AvatarSvg from './AvatarSvg'

/** escolha do avatar ativo — normais livres; especiais/super bloqueados (fases futuras) */
export default function MeusAvataresModal({ onClose }: { onClose: () => void }) {
  const { user, setAvatar } = useAuth()
  const [erro, setErro] = useState('')
  async function escolher(id: string) {
    setErro('')
    try {
      await api('/api/me/avatar', { method: 'PUT', body: { id } })
      setAvatar(id)
    } catch {
      setErro('Esse avatar ainda está bloqueado — conquiste nos rankings ou com fichas.')
    }
  }
  // amostra dos bloqueados (o catálogo completo chega nas fases C/D)
  const bloqueados = [...AVATARES_ESPECIAIS.slice(0, 24), ...AVATARES_SUPER.slice(0, 6)]
  // portal no body: o header tem backdrop-blur, e backdrop-filter faz o
  // position:fixed do overlay virar relativo ao HEADER (modal cortado)
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink-950/80 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">Meus avatares</h2>
          <button onClick={onClose} className="btn-pop px-3 py-1.5 text-sm ring-1 ring-ink-700">Fechar</button>
        </div>
        {erro && <p className="mb-2 text-sm font-semibold text-pop-magenta">{erro}</p>}
        <p className="mb-1 text-sm font-bold text-text-muted">Livres</p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
          {AVATARES_NORMAIS.map((id) => (
            <button
              key={id}
              onClick={() => escolher(id)}
              aria-pressed={user?.avatar === id}
              className={`rounded-full ring-2 transition ${user?.avatar === id ? 'ring-pop-cyan' : 'ring-transparent hover:ring-pop-purple/60'}`}
            >
              <AvatarSvg id={id} size={44} />
            </button>
          ))}
        </div>
        <p className="mb-1 mt-4 text-sm font-bold text-text-muted">🔒 Especiais — conquiste nos rankings ou com fichas</p>
        <div className="grid grid-cols-6 gap-2 opacity-50 sm:grid-cols-10">
          {bloqueados.map((id) => (
            <div key={id} className="relative rounded-full grayscale" title="bloqueado">
              <AvatarSvg id={id} size={44} />
              <span className="absolute inset-0 grid place-items-center text-sm">🔒</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
