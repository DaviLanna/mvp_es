from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.comum import intervalo
from app.core.config import settings
from app.core.deps import Admin, DbSession
from app.models import Auditoria
from app.schemas.cadastros import AuditoriaOut
from app.schemas.roteiros import Pagina

router = APIRouter(prefix="/auditoria", tags=["Auditoria"])


@router.get("", response_model=Pagina[AuditoriaOut])
def listar(
    db: DbSession,
    _: Admin,
    entidade: str | None = None,
    entidade_id: int | None = None,
    inicio: date | None = None,
    fim: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> Pagina[AuditoriaOut]:
    inicio, fim = intervalo(inicio, fim)
    stmt = select(Auditoria).where(
        Auditoria.criado_em >= datetime.combine(inicio, time.min, settings.tz),
        Auditoria.criado_em < datetime.combine(fim + timedelta(days=1), time.min, settings.tz),
    )
    if entidade:
        stmt = stmt.where(Auditoria.entidade == entidade)
    if entidade_id is not None:
        stmt = stmt.where(Auditoria.entidade_id == entidade_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    itens = db.scalars(
        stmt.order_by(Auditoria.criado_em.desc(), Auditoria.id.desc()).limit(page_size).offset((page - 1) * page_size)
    ).all()
    return Pagina(
        items=[AuditoriaOut.model_validate(i) for i in itens], total=total, page=page, page_size=page_size
    )
