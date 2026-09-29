from datetime import date

from fastapi import APIRouter, Response
from sqlalchemy import select

from app.api.comum import intervalo
from app.api.roteiros import CARREGAR_ROTEIRO
from app.core.deps import CurrentUser, DbSession, escopo_motoristas
from app.models import Roteiro
from app.services import relatorios
from app.services.consultas import Filtro, todas_paradas
from app.services.roteiros import roteiro_resumo

router = APIRouter(prefix="/relatorios", tags=["Relatórios"])


def _csv(conteudo: str, nome: str) -> Response:
    return Response(
        content=conteudo.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )


@router.get("/paradas.csv")
def paradas_csv(
    db: DbSession,
    usuario: CurrentUser,
    inicio: date | None = None,
    fim: date | None = None,
    motorista_id: int | None = None,
    busca: str | None = None,
) -> Response:
    """Exporta os tempos parados do período consultado (RF12)."""
    inicio, fim = intervalo(inicio, fim)
    filtro = Filtro(inicio, fim, motorista_id, escopo_motoristas(db, usuario))
    return _csv(relatorios.csv_paradas(todas_paradas(db, filtro, busca)), f"paradas_{inicio}_{fim}.csv")


@router.get("/roteiros.csv")
def roteiros_csv(
    db: DbSession,
    usuario: CurrentUser,
    inicio: date | None = None,
    fim: date | None = None,
    motorista_id: int | None = None,
) -> Response:
    inicio, fim = intervalo(inicio, fim)
    filtro = Filtro(inicio, fim, motorista_id, escopo_motoristas(db, usuario))
    roteiros = db.scalars(
        filtro.aplicar(select(Roteiro).options(*CARREGAR_ROTEIRO)).order_by(Roteiro.data, Roteiro.id)
    ).all()
    return _csv(relatorios.csv_roteiros(roteiro_resumo(r) for r in roteiros), f"roteiros_{inicio}_{fim}.csv")
