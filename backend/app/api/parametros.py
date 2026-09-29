from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from app.api.comum import intervalo
from app.core.deps import Admin, DbSession, Gestor
from app.models import Parametro, PontoRoteiro, Roteiro
from app.schemas.cadastros import ParametroOut, ParametroUpdate
from app.services import calculo
from app.services.roteiros import obter_parametros, recalcular_roteiro

router = APIRouter(prefix="/parametros", tags=["Parâmetros"])


def _out(p: Parametro) -> ParametroOut:
    return ParametroOut(
        valor_combustivel_litro=p.valor_combustivel_litro,
        km_por_litro_padrao=p.km_por_litro_padrao,
        custo_adicional_km=p.custo_adicional_km,
        jornada_padrao_horas=p.jornada_padrao_horas,
        tempo_minimo_parada_min=p.tempo_minimo_parada_min,
        custo_por_km_padrao=calculo.custo_por_km(
            p.valor_combustivel_litro, p.km_por_litro_padrao, p.custo_adicional_km
        ),
        atualizado_em=p.atualizado_em,
    )


@router.get("", response_model=ParametroOut)
def obter(db: DbSession, _: Gestor) -> ParametroOut:
    parametros = obter_parametros(db)
    db.commit()
    return _out(parametros)


@router.put("", response_model=ParametroOut)
def atualizar(dados: ParametroUpdate, db: DbSession, _: Admin) -> ParametroOut:
    parametros = obter_parametros(db)
    for campo, valor in dados.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(parametros, campo, valor)
    db.commit()
    db.refresh(parametros)
    return _out(parametros)


class RecalculoOut(BaseModel):
    roteiros_recalculados: int


@router.post("/recalcular", response_model=RecalculoOut)
def recalcular_periodo(db: DbSession, _: Admin, inicio: date | None = None, fim: date | None = None) -> RecalculoOut:
    """Aplica os parâmetros atuais aos roteiros do período (os demais mantêm o custo calculado na época)."""
    inicio, fim = intervalo(inicio, fim)
    parametros = obter_parametros(db)
    roteiros = db.scalars(
        select(Roteiro)
        .options(selectinload(Roteiro.paradas).joinedload(PontoRoteiro.ponto), joinedload(Roteiro.motorista))
        .where(Roteiro.data.between(inicio, fim))
    ).all()
    for roteiro in roteiros:
        recalcular_roteiro(db, roteiro, parametros)
    db.commit()
    return RecalculoOut(roteiros_recalculados=len(roteiros))
