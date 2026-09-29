from datetime import date

from fastapi import APIRouter, Query

from app.api.comum import intervalo
from app.core.deps import CurrentUser, DbSession, escopo_motoristas
from app.schemas.roteiros import HistoricoItem, Pagina
from app.services.consultas import Filtro, listar_paradas

router = APIRouter(prefix="/historico", tags=["Histórico"])


@router.get("", response_model=Pagina[HistoricoItem])
def historico(
    db: DbSession,
    usuario: CurrentUser,
    inicio: date | None = None,
    fim: date | None = None,
    motorista_id: int | None = None,
    busca: str | None = Query(default=None, description="Filtra por endereço ou descrição do ponto"),
    somente_com_tempo: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
) -> Pagina[HistoricoItem]:
    """Histórico de pontos e tempos parados por período, com endereços (RF07)."""
    inicio, fim = intervalo(inicio, fim)
    filtro = Filtro(inicio, fim, motorista_id, escopo_motoristas(db, usuario))
    itens, total = listar_paradas(db, filtro, busca, page, page_size, somente_com_tempo)
    return Pagina(items=itens, total=total, page=page, page_size=page_size)
