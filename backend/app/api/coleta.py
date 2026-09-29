from datetime import date

from fastapi import APIRouter
from sqlalchemy import select

from app.api.roteiros import CARREGAR_ROTEIRO
from app.core.deps import CurrentUser, DbSession, escopo_motoristas
from app.models import Roteiro
from app.schemas.roteiros import RoteiroDetalhe
from app.services import roteiros as svc

router = APIRouter(prefix="/coleta", tags=["Coleta"])


@router.get("/hoje", response_model=list[RoteiroDetalhe])
def roteiros_do_dia(db: DbSession, usuario: CurrentUser, data: date | None = None) -> list[RoteiroDetalhe]:
    """Roteiros do dia do usuário logado (motorista) ou da sua equipe (gerente/admin)."""
    stmt = select(Roteiro).options(*CARREGAR_ROTEIRO).where(Roteiro.data == (data or svc.hoje_local()))
    escopo = escopo_motoristas(db, usuario)
    if escopo is not None:
        stmt = stmt.where(Roteiro.motorista_id.in_(escopo))
    parametros = svc.obter_parametros(db)
    return [svc.roteiro_detalhe(r, parametros) for r in db.scalars(stmt.order_by(Roteiro.id))]
