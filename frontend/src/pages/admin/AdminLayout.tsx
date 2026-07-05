import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const links = [
  { to: '/admin', label: 'Visão geral', end: true },
  { to: '/admin/usuarios', label: 'Usuários' },
  { to: '/admin/auditoria', label: 'Auditoria' },
  { to: '/admin/jogos', label: 'Jogos' },
  { to: '/admin/salas', label: 'Salas ao vivo' },
  { to: '/admin/rankings', label: 'Rankings' },
  { to: '/admin/avisos', label: 'Avisos' },
]

export default function AdminLayout() {
  const { user, restoring } = useAuth()
  if (restoring) return null
  if (!user) return <Navigate to="/entrar" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/mesa" replace />

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
      <nav
        aria-label="Painel do admin"
        className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col"
      >
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition ${
                isActive
                  ? 'bg-gradient-to-br from-pop-purple to-pop-magenta text-white'
                  : 'text-text-muted hover:bg-ink-800 hover:text-text'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </main>
  )
}
