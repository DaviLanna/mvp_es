from datetime import date, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

from app.models import StatusRoteiro

T = TypeVar("T")


class Pagina(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class RoteiroCreate(BaseModel):
    nome: str | None = Field(default=None, max_length=80)
    data: date
    motorista_id: int
    ponto_ids: list[int] = Field(min_length=2, description="Pontos em ordem; o primeiro é a partida")


class RoteiroUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=80)
    data: date | None = None
    motorista_id: int | None = None
    ponto_ids: list[int] | None = Field(default=None, min_length=2)
    distancia_total_km: float | None = Field(default=None, ge=0)
    distancia_manual: bool | None = None


class ParadaAdd(BaseModel):
    ponto_id: int


class ParadaCorrecao(BaseModel):
    """Correção manual de horários pelo gerente/admin (auditada)."""

    chegada_em: datetime | None = None
    saida_em: datetime | None = None


class ColetaIn(BaseModel):
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class ParadaOut(BaseModel):
    id: int
    ordem: int
    eh_partida: bool
    ponto_id: int
    ponto_descricao: str
    endereco: str
    latitude: float | None
    longitude: float | None
    chegada_em: datetime | None
    saida_em: datetime | None
    chegada_lat: float | None
    chegada_lng: float | None
    saida_lat: float | None
    saida_lng: float | None
    tempo_parado_min: float | None


class RoteiroResumo(BaseModel):
    id: int
    nome: str | None
    data: date
    motorista_id: int
    motorista_nome: str
    status: StatusRoteiro
    qtd_pontos: int
    distancia_total_km: float
    tempo_total_parado_min: float
    custo_estimado: float


class RoteiroDetalhe(RoteiroResumo):
    distancia_manual: bool
    custo_por_km: float
    percentual_jornada: float
    jornada_padrao_horas: float
    paradas: list[ParadaOut]


class HistoricoItem(BaseModel):
    parada_id: int
    roteiro_id: int
    roteiro_nome: str | None
    data: date
    motorista_id: int
    motorista_nome: str
    ordem: int
    eh_partida: bool
    ponto_descricao: str
    endereco: str
    chegada_em: datetime | None
    saida_em: datetime | None
    tempo_parado_min: float | None
