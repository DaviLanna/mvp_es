import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Gerente, Motorista, Parametros, Ponto } from "@/lib/types"

export function useMotoristas(opcoes: { ativos?: boolean; enabled?: boolean } = {}) {
  const { temPerfil } = useAuth()
  return useQuery({
    queryKey: ["motoristas", { ativos: opcoes.ativos }],
    queryFn: async () => (await api.get<Motorista[]>("/motoristas", { params: { ativos: opcoes.ativos } })).data,
    enabled: (opcoes.enabled ?? true) && temPerfil("ADMIN", "GERENTE"),
  })
}

export function usePontos(opcoes: { ativos?: boolean } = {}) {
  return useQuery({
    queryKey: ["pontos", { ativos: opcoes.ativos }],
    queryFn: async () => (await api.get<Ponto[]>("/pontos", { params: { ativos: opcoes.ativos } })).data,
  })
}

export function useGerentes(enabled = true) {
  return useQuery({
    queryKey: ["gerentes"],
    queryFn: async () => (await api.get<Gerente[]>("/gerentes")).data,
    enabled,
  })
}

export function useParametros() {
  return useQuery({
    queryKey: ["parametros"],
    queryFn: async () => (await api.get<Parametros>("/parametros")).data,
  })
}
