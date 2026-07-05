import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Mesa from './pages/Mesa'
import { AuthProvider, useAuth } from './lib/auth'
import { Chip } from './components/Logo'

function RequireAuth() {
  const { user, restoring } = useAuth()
  if (restoring) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-label="Carregando">
        <div className="animate-float">
          <Chip size={64} spin />
        </div>
      </div>
    )
  }
  return user ? <Outlet /> : <Navigate to="/entrar" replace />
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
