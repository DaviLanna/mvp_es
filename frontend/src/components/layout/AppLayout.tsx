import {
  BarChart3,
  ClipboardList,
  History,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Route,
  Settings2,
  ShieldCheck,
  Timer,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import { Suspense, useState } from "react"
import { NavLink, Outlet } from "react-router"

import { Carregando } from "@/components/comum"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth"
import { APP_NAME, PERFIL_LABEL } from "@/lib/format"
import type { Perfil } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ItemMenu {
  para: string
  rotulo: string
  icone: LucideIcon
  perfis: Perfil[]
}

interface GrupoMenu {
  titulo?: string
  itens: ItemMenu[]
}

const TODOS: Perfil[] = ["ADMIN", "GERENTE", "MOTORISTA"]
const GESTORES: Perfil[] = ["ADMIN", "GERENTE"]
const ADMIN: Perfil[] = ["ADMIN"]

const MENU: GrupoMenu[] = [
  {
    itens: [
      { para: "/minha-rota", rotulo: "Minha rota", icone: Navigation, perfis: ["MOTORISTA"] },
      { para: "/dashboard", rotulo: "Dashboard", icone: BarChart3, perfis: GESTORES },
      { para: "/coleta", rotulo: "Coleta do dia", icone: Timer, perfis: GESTORES },
      { para: "/historico", rotulo: "Histórico", icone: History, perfis: TODOS },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { para: "/roteiros", rotulo: "Roteiros", icone: Route, perfis: GESTORES },
      { para: "/pontos", rotulo: "Pontos", icone: MapPin, perfis: GESTORES },
      { para: "/motoristas", rotulo: "Motoristas", icone: UsersRound, perfis: GESTORES },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { para: "/gerentes", rotulo: "Gerentes", icone: UserCog, perfis: ADMIN },
      { para: "/parametros", rotulo: "Parâmetros", icone: Settings2, perfis: GESTORES },
      { para: "/usuarios", rotulo: "Usuários", icone: Users, perfis: ADMIN },
      { para: "/auditoria", rotulo: "Auditoria", icone: ShieldCheck, perfis: ADMIN },
    ],
  },
]

function Marca() {
  return (
    <div className="flex items-center gap-2 px-3">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ClipboardList className="size-4" />
      </div>
      <div className="leading-tight">
        <p className="font-semibold">{APP_NAME}</p>
        <p className="text-xs text-muted-foreground">Tempo parado em roteiros</p>
      </div>
    </div>
  )
}

function Navegacao({ onNavegar }: { onNavegar?: () => void }) {
  const { usuario } = useAuth()
  if (!usuario) return null
  return (
    <nav className="flex flex-col gap-4">
      {MENU.map((grupo, i) => {
        const itens = grupo.itens.filter((item) => item.perfis.includes(usuario.perfil))
        if (!itens.length) return null
        return (
          <div key={i} className="flex flex-col gap-0.5">
            {grupo.titulo && (
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">{grupo.titulo}</p>
            )}
            {itens.map(({ para, rotulo, icone: Icone }) => (
              <NavLink
                key={para}
                to={para}
                onClick={onNavegar}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    isActive && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                  )
                }
              >
                <Icone className="size-4" />
                {rotulo}
              </NavLink>
            ))}
          </div>
        )
      })}
    </nav>
  )
}

function CartaoUsuario() {
  const { usuario, sair } = useAuth()
  if (!usuario) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {usuario.nome
          .split(" ")
          .slice(0, 2)
          .map((p) => p[0])
          .join("")
          .toUpperCase()}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{usuario.nome}</p>
        <p className="truncate text-xs text-muted-foreground">{PERFIL_LABEL[usuario.perfil]}</p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={sair} title="Sair" aria-label="Sair">
        <LogOut />
      </Button>
    </div>
  )
}

export function AppLayout() {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="min-h-svh bg-muted/40">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-r bg-background py-4 lg:flex">
        <Marca />
        <div className="flex-1 overflow-y-auto px-2">
          <Navegacao />
        </div>
        <div className="px-2">
          <CartaoUsuario />
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col gap-6 p-0 py-4">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Navegação principal</SheetDescription>
            </SheetHeader>
            <Marca />
            <div className="flex-1 overflow-y-auto px-2">
              <Navegacao onNavegar={() => setMenuAberto(false)} />
            </div>
            <div className="px-2">
              <CartaoUsuario />
            </div>
          </SheetContent>
        </Sheet>
        <p className="font-semibold">{APP_NAME}</p>
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<Carregando linhas={6} />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
