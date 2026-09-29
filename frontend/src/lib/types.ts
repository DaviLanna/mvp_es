export type Perfil = "ADMIN" | "GERENTE" | "MOTORISTA"
export type StatusRoteiro = "PLANEJADO" | "EM_ANDAMENTO" | "CONCLUIDO"

export interface Usuario {
  id: number
  nome: string
  email: string
  perfil: Perfil
  ativo: boolean
  motorista_id: number | null
  gerente_id: number | null
}

export interface Token {
  access_token: string
  token_type: string
  usuario: Usuario
}

export interface Gerente {
  id: number
  nome: string
  cargo: string
  telefone: string | null
  email: string
  usuario_id: number | null
  qtd_motoristas: number
}

export interface Motorista {
  id: number
  nome: string
  telefone: string | null
  documento: string | null
  veiculo: string
  placa: string | null
  km_por_litro: number | null
  ativo: boolean
  anonimizado_em: string | null
  gerente_id: number | null
  gerente_nome: string | null
  usuario_id: number | null
  email_acesso: string | null
}

export interface Ponto {
  id: number
  descricao: string
  endereco: string
  latitude: number | null
  longitude: number | null
  ativo: boolean
}

export interface GeocodeResultado {
  endereco: string
  latitude: number
  longitude: number
}

export interface Parametros {
  valor_combustivel_litro: number
  km_por_litro_padrao: number
  custo_adicional_km: number
  jornada_padrao_horas: number
  tempo_minimo_parada_min: number
  custo_por_km_padrao: number
  atualizado_em: string | null
}

export interface Parada {
  id: number
  ordem: number
  eh_partida: boolean
  ponto_id: number
  ponto_descricao: string
  endereco: string
  latitude: number | null
  longitude: number | null
  chegada_em: string | null
  saida_em: string | null
  chegada_lat: number | null
  chegada_lng: number | null
  saida_lat: number | null
  saida_lng: number | null
  tempo_parado_min: number | null
}

export interface RoteiroResumo {
  id: number
  nome: string | null
  data: string
  motorista_id: number
  motorista_nome: string
  status: StatusRoteiro
  qtd_pontos: number
  distancia_total_km: number
  tempo_total_parado_min: number
  custo_estimado: number
}

export interface RoteiroDetalhe extends RoteiroResumo {
  distancia_manual: boolean
  custo_por_km: number
  percentual_jornada: number
  jornada_padrao_horas: number
  paradas: Parada[]
}

export interface HistoricoItem {
  parada_id: number
  roteiro_id: number
  roteiro_nome: string | null
  data: string
  motorista_id: number
  motorista_nome: string
  ordem: number
  eh_partida: boolean
  ponto_descricao: string
  endereco: string
  chegada_em: string | null
  saida_em: string | null
  tempo_parado_min: number | null
}

export interface Pagina<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Resumo {
  inicio: string
  fim: string
  qtd_roteiros: number
  qtd_paradas: number
  dias_motorista: number
  tempo_total_parado_min: number
  media_por_roteiro_min: number
  media_por_parada_min: number
  percentual_jornada: number
  jornada_padrao_horas: number
  distancia_total_km: number
  custo_total: number
}

export interface PontoSerie {
  chave: string
  tempo_parado_min: number
  qtd_roteiros: number
  percentual_jornada: number
  custo_total: number
}

export interface RankingEndereco {
  ponto_id: number
  descricao: string
  endereco: string
  tempo_parado_min: number
  qtd_paradas: number
  media_min: number
}

export interface RankingMotorista {
  motorista_id: number
  nome: string
  tempo_parado_min: number
  qtd_roteiros: number
  percentual_jornada: number
}

export interface DashboardDia {
  resumo: Resumo
  paradas: HistoricoItem[]
}

export interface DashboardPeriodo {
  resumo: Resumo
  por_endereco: RankingEndereco[]
  por_motorista: RankingMotorista[]
}

export interface AuditoriaItem {
  id: number
  usuario_email: string | null
  entidade: string
  entidade_id: number | null
  acao: "CREATE" | "UPDATE" | "DELETE"
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  criado_em: string
}
