from datetime import date, timedelta

from fastapi import APIRouter

from app.api.comum import intervalo
from app.core.deps import DbSession, Gestor, escopo_motoristas
from app.models import Usuario
from app.schemas.dashboard import DashboardDia, DashboardPeriodo, PontoSerie, Resumo
from app.services import consultas
from app.services.consultas import Filtro
from app.services.roteiros import hoje_local, obter_parametros

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _filtro(db: DbSession, usuario: Usuario, inicio: date, fim: date, motorista_id: int | None) -> Filtro:
    return Filtro(inicio, fim, motorista_id, escopo_motoristas(db, usuario))


@router.get("/resumo", response_model=Resumo)
def resumo(
    db: DbSession, usuario: Gestor, inicio: date | None = None, fim: date | None = None, motorista_id: int | None = None
) -> Resumo:
    inicio, fim = intervalo(inicio, fim)
    return consultas.resumo(db, _filtro(db, usuario, inicio, fim, motorista_id), obter_parametros(db))


@router.get("/dia", response_model=DashboardDia)
def dia(db: DbSession, usuario: Gestor, data: date | None = None, motorista_id: int | None = None) -> DashboardDia:
    """Recorte por dia: cada tempo parado com endereço e horários de chegada/saída."""
    data = data or hoje_local()
    filtro = _filtro(db, usuario, data, data, motorista_id)
    return DashboardDia(
        resumo=consultas.resumo(db, filtro, obter_parametros(db)),
        paradas=consultas.todas_paradas(db, filtro),
    )


@router.get("/por-dia", response_model=list[PontoSerie])
def por_dia(
    db: DbSession, usuario: Gestor, inicio: date | None = None, fim: date | None = None, motorista_id: int | None = None
) -> list[PontoSerie]:
    inicio, fim = intervalo(inicio, fim)
    return consultas.serie_por_dia(db, _filtro(db, usuario, inicio, fim, motorista_id), obter_parametros(db))


@router.get("/por-mes", response_model=list[PontoSerie])
def por_mes(
    db: DbSession, usuario: Gestor, inicio: date | None = None, fim: date | None = None, motorista_id: int | None = None
) -> list[PontoSerie]:
    """Série mensal; por padrão os últimos 12 meses."""
    fim = fim or hoje_local()
    inicio = inicio or (fim.replace(day=1) - timedelta(days=335)).replace(day=1)
    inicio, fim = intervalo(inicio, fim)
    return consultas.serie_por_mes(db, _filtro(db, usuario, inicio, fim, motorista_id), obter_parametros(db))


@router.get("/por-periodo", response_model=DashboardPeriodo)
def por_periodo(
    db: DbSession, usuario: Gestor, inicio: date | None = None, fim: date | None = None, motorista_id: int | None = None
) -> DashboardPeriodo:
    inicio, fim = intervalo(inicio, fim)
    return consultas.periodo(db, _filtro(db, usuario, inicio, fim, motorista_id), obter_parametros(db))
