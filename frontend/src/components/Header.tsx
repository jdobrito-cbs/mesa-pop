import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { useAuth } from '../lib/auth'
import AvatarSvg from './AvatarSvg'
import MeusAvataresModal from './MeusAvataresModal'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [avatares, setAvatares] = useState(false)

  async function handleLogout() {
    // vai para a home ANTES de limpar a sessão: assim saímos da rota
    // protegida primeiro e o RequireAuth não desvia para /entrar (o que
    // causava o pisca-pisca login/spinner). Termina direto na home.
    navigate('/')
    await logout()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/60 bg-ink-900/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" aria-label="Mesa Pop — início" className="shrink-0">
          <Logo className="text-2xl" />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {!user.isGuest && (
                <button
                  onClick={() => setAvatares(true)}
                  className="btn-pop px-4 py-2 text-sm text-text hover:text-pop-cyan"
                >
                  Meus avatares
                </button>
              )}
              <Link
                to="/mesa"
                className="btn-pop px-4 py-2 text-sm text-text hover:text-pop-cyan"
              >
                Minha mesa
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className="btn-pop px-4 py-2 text-sm text-pop-yellow hover:text-pop-orange"
                >
                  Admin
                </Link>
              )}
              <span className="hidden items-center gap-2 sm:flex" title={user.displayName}>
                <AvatarSvg id={user.avatar} size={30} />
                <span className="max-w-40 truncate text-sm text-text-muted">
                  {user.displayName}
                  {user.isGuest && <span className="ml-1 text-xs font-bold text-pop-yellow">· convidado</span>}
                </span>
              </span>
              {user.isGuest && (
                <Link
                  to="/criar-conta"
                  className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-4 py-2 text-sm text-white shadow-lg shadow-pop-purple/25"
                >
                  Criar conta
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="btn-pop px-4 py-2 text-sm ring-1 ring-ink-700 hover:ring-pop-magenta"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/entrar" className="btn-pop px-4 py-2 text-sm text-text hover:text-pop-cyan">
                Entrar
              </Link>
              <Link
                to="/criar-conta"
                className="btn-pop bg-gradient-to-br from-pop-purple to-pop-magenta px-5 py-2.5 text-sm text-white shadow-lg shadow-pop-purple/25"
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
      {avatares && <MeusAvataresModal onClose={() => setAvatares(false)} />}
    </header>
  )
}
