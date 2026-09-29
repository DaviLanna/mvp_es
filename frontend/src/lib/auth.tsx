import { useQueryClient } from "@tanstack/react-query"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { api, TOKEN_KEY } from "@/lib/api"
import type { Perfil, Token, Usuario } from "@/lib/types"

interface AuthContextValue {
  usuario: Usuario | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<Usuario>
  sair: () => void
  temPerfil: (...perfis: Perfil[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    api
      .get<Usuario>("/auth/me")
      .then((r) => setUsuario(r.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setCarregando(false))
  }, [])

  const entrar = useCallback(async (email: string, senha: string) => {
    const form = new URLSearchParams({ username: email, password: senha })
    const { data } = await api.post<Token>("/auth/login", form)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setUsuario(data.usuario)
    return data.usuario
  }, [])

  const sair = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    queryClient.clear()
    setUsuario(null)
  }, [queryClient])

  const temPerfil = useCallback((...perfis: Perfil[]) => !!usuario && perfis.includes(usuario.perfil), [usuario])

  const value = useMemo(
    () => ({ usuario, carregando, entrar, sair, temPerfil }),
    [usuario, carregando, entrar, sair, temPerfil],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>")
  return ctx
}

export const GESTORES: Perfil[] = ["ADMIN", "GERENTE"]

/** Página inicial de cada perfil. */
export const rotaInicial = (perfil: Perfil) => (perfil === "MOTORISTA" ? "/minha-rota" : "/dashboard")
