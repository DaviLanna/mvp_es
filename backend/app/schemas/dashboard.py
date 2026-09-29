from datetime import date

from pydantic import BaseModel

from app.schemas.roteiros import HistoricoItem


class Resumo(BaseModel):
    inicio: date
    fim: date
    qtd_roteiros: int
    qtd_paradas: int
    dias_motorista: int
    tempo_total_parado_min: float
    media_por_roteiro_min: float
    media_por_parada_min: float
    percentual_jornada: float
    jornada_padrao_horas: float
    distancia_total_km: float
    custo_total: float


class PontoSerie(BaseModel):
    chave: str  # "2026-09-28" (dia) ou "2026-09" (mês)
    tempo_parado_min: float
    qtd_roteiros: int
    percentual_jornada: float
    custo_total: float


class RankingEndereco(BaseModel):
    ponto_id: int
    descricao: str
    endereco: str
    tempo_parado_min: float
    qtd_paradas: int
    media_min: float


class RankingMotorista(BaseModel):
    motorista_id: int
    nome: str
    tempo_parado_min: float
    qtd_roteiros: int
    percentual_jornada: float


class DashboardDia(BaseModel):
    resumo: Resumo
    paradas: list[HistoricoItem]


class DashboardPeriodo(BaseModel):
    resumo: Resumo
    por_endereco: list[RankingEndereco]
    por_motorista: list[RankingMotorista]
