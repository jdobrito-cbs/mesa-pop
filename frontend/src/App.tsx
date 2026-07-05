import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Mesa from './pages/Mesa'
import GameLobby from './pages/GameLobby'
import MemoriaSoloPage from './pages/MemoriaSoloPage'
import RoomPage from './pages/RoomPage'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Users from './pages/admin/Users'
import Audit from './pages/admin/Audit'
import Games from './pages/admin/Games'
import Rooms from './pages/admin/Rooms'
import Rankings from './pages/admin/Rankings'
import Announcements from './pages/admin/Announcements'
import { AuthProvider, useAuth } from './lib/auth'
import { Chip } from './components/Logo'

function RequireAuth() {
  const { user, restoring } = useAuth()
  const location = useLocation()
  if (restoring) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-label="Carregando">
        <div className="animate-float">
          <Chip size={64} spin />
        </div>
      </div>
    )
  }
  // link compartilhado de sala → volta para lá depois de entrar (ou como convidado)
  return user ? <Outlet /> : <Navigate to="/entrar" replace state={{ from: location.pathname }} />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-dvh flex-col">
          <Header />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/criar-conta" element={<Register />} />
              <Route element={<RequireAuth />}>
                <Route path="/mesa" element={<Mesa />} />
                <Route path="/jogos/memoria/solo" element={<MemoriaSoloPage />} />
                <Route path="/jogos/:slug" element={<GameLobby />} />
                <Route path="/sala/:code" element={<RoomPage />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="usuarios" element={<Users />} />
                  <Route path="auditoria" element={<Audit />} />
                  <Route path="jogos" element={<Games />} />
                  <Route path="salas" element={<Rooms />} />
                  <Route path="rankings" element={<Rankings />} />
                  <Route path="avisos" element={<Announcements />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
