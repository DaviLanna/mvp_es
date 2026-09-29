import { lazy, type ReactNode } from "react"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router"

import { Spinner } from "@/components/comum"
import { AppLayout } from "@/components/layout/AppLayout"
import { rotaInicial, useAuth } from "@/lib/auth"
import type { Perfil } from "@/lib/types"
import Login from "@/pages/Login"

// Páginas carregadas sob demanda (o motorista no celular não baixa gráficos nem cadastros)
const Auditoria = lazy(() => import("@/pages/Auditoria"))
const Coleta = lazy(() => import("@/pages/Coleta"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const Gerentes = lazy(() => import("@/pages/Gerentes"))
const Historico = lazy(() => import("@/pages/Historico"))
const Motoristas = lazy(() => import("@/pages/Motoristas"))
const Parametros = lazy(() => import("@/pages/Parametros"))
const Pontos = lazy(() => import("@/pages/Pontos"))
const RoteiroDetalhe = lazy(() => import("@/pages/RoteiroDetalhe"))
const RoteiroForm = lazy(() => import("@/pages/RoteiroForm"))
const Roteiros = lazy(() => import("@/pages/Roteiros"))
const Usuarios = lazy(() => import("@/pages/Usuarios"))

const GESTORES: Perfil[] = ["ADMIN", "GERENTE"]

function Protegida({ perfis, children }: { perfis?: Perfil[]; children: ReactNode }) {
  const { usuario, carregando } = useAuth()
  if (carregando) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }
  if (!usuario) return <Navigate to="/login" replace />
  if (perfis && !perfis.includes(usuario.perfil)) return <Navigate to={rotaInicial(usuario.perfil)} replace />
  return children
}

function Inicio() {
  const { usuario } = useAuth()
  return <Navigate to={usuario ? rotaInicial(usuario.perfil) : "/login"} replace />
}

const so = (perfis: Perfil[] | undefined, elemento: ReactNode) => <Protegida perfis={perfis}>{elemento}</Protegida>

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: so(undefined, <AppLayout />),
    children: [
      { index: true, element: <Inicio /> },
      { path: "minha-rota", element: so(["MOTORISTA"], <Coleta />) },
      { path: "coleta", element: so(GESTORES, <Coleta />) },
      { path: "historico", element: <Historico /> },
      { path: "dashboard", element: so(GESTORES, <Dashboard />) },
      { path: "roteiros", element: so(GESTORES, <Roteiros />) },
      { path: "roteiros/novo", element: so(GESTORES, <RoteiroForm />) },
      { path: "roteiros/:id", element: <RoteiroDetalhe /> },
      { path: "roteiros/:id/editar", element: so(GESTORES, <RoteiroForm />) },
      { path: "pontos", element: so(GESTORES, <Pontos />) },
      { path: "motoristas", element: so(GESTORES, <Motoristas />) },
      { path: "gerentes", element: so(["ADMIN"], <Gerentes />) },
      { path: "parametros", element: so(GESTORES, <Parametros />) },
      { path: "usuarios", element: so(["ADMIN"], <Usuarios />) },
      { path: "auditoria", element: so(["ADMIN"], <Auditoria />) },
      { path: "*", element: <Inicio /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
