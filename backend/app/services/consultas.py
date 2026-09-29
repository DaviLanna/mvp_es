"""Consultas de histórico (RF07) e agregações do dashboard (RF08)."""

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import Select, distinct, func, or_, select, tuple_
from sqlalchemy.orm import Session

from app.models import Motorista, Parametro, Ponto, PontoRoteiro, Roteiro
from app.schemas.dashboard import (
    DashboardPeriodo,
    PontoSerie,
    RankingEndereco,
    RankingMotorista,
    Resumo,
)
from app.schemas.roteiros import HistoricoItem
from app.services import calculo


@dataclass(frozen=True)
class Filtro:
    inicio: date
    fim: date
    motorista_id: int | None = None
    escopo: list[int] | None = None  # None = sem restrição (admin)

    def aplicar(self, stmt: Select) -> Select:
        stmt = stmt.where(Roteiro.data.between(self.inicio, self.fim))
        if self.motorista_id is not None:
            stmt = stmt.where(Roteiro.motorista_id == self.motorista_id)
        if self.escopo is not None:
            stmt = stmt.where(Roteiro.motorista_id.in_(self.escopo))
        return stmt


# ---------- Histórico ----------


def consulta_paradas(filtro: Filtro, busca: str | None = None, somente_com_tempo: bool = False) -> Select:
    stmt = (
        select(
            PontoRoteiro.id.label("parada_id"),
            Roteiro.id.label("roteiro_id"),
            Roteiro.nome.label("roteiro_nome"),
            Roteiro.data,
            Motorista.id.label("motorista_id"),
            Motorista.nome.label("motorista_nome"),
            PontoRoteiro.ordem,
            Ponto.descricao.label("ponto_descricao"),
            Ponto.endereco,
            PontoRoteiro.chegada_em,
            PontoRoteiro.saida_em,
            PontoRoteiro.tempo_parado_min,
        )
        .join(PontoRoteiro.roteiro)
        .join(Roteiro.motorista)
        .join(PontoRoteiro.ponto)
    )
    stmt = filtro.aplicar(stmt)
    if busca:
        termo = f"%{busca.strip()}%"
        stmt = stmt.where(or_(Ponto.endereco.ilike(termo), Ponto.descricao.ilike(termo)))
    if somente_com_tempo:
        stmt = stmt.where(PontoRoteiro.ordem > calculo.ORDEM_PARTIDA, PontoRoteiro.tempo_parado_min.is_not(None))
    return stmt.order_by(Roteiro.data.desc(), Motorista.nome, Roteiro.id, PontoRoteiro.ordem)


def _item(row) -> HistoricoItem:
    return HistoricoItem(**row._mapping, eh_partida=calculo.eh_partida(row.ordem))


def listar_paradas(
    db: Session, filtro: Filtro, busca: str | None = None, page: int = 1, page_size: int = 50,
    somente_com_tempo: bool = False,
) -> tuple[list[HistoricoItem], int]:
    stmt = consulta_paradas(filtro, busca, somente_com_tempo)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.limit(page_size).offset((page - 1) * page_size)).all()
    return [_item(r) for r in rows], total


def todas_paradas(db: Session, filtro: Filtro, busca: str | None = None) -> list[HistoricoItem]:
    return [_item(r) for r in db.execute(consulta_paradas(filtro, busca)).all()]


# ---------- Dashboard ----------


def resumo(db: Session, filtro: Filtro, parametros: Parametro) -> Resumo:
    roteiros = db.execute(
        filtro.aplicar(
            select(
                func.count(Roteiro.id),
                func.coalesce(func.sum(Roteiro.tempo_total_parado_min), 0),
                func.coalesce(func.sum(Roteiro.distancia_total_km), 0),
                func.coalesce(func.sum(Roteiro.custo_estimado), 0),
                func.count(distinct(tuple_(Roteiro.motorista_id, Roteiro.data))),
            )
        )
    ).one()
    qtd_roteiros, total_min, distancia, custo, dias_motorista = roteiros

    qtd_paradas = db.scalar(
        filtro.aplicar(
            select(func.count(PontoRoteiro.id))
            .join(PontoRoteiro.roteiro)
            .where(PontoRoteiro.ordem > calculo.ORDEM_PARTIDA, PontoRoteiro.tempo_parado_min.is_not(None))
        )
    ) or 0

    total_min = float(total_min)
    return Resumo(
        inicio=filtro.inicio,
        fim=filtro.fim,
        qtd_roteiros=qtd_roteiros,
        qtd_paradas=qtd_paradas,
        dias_motorista=dias_motorista,
        tempo_total_parado_min=round(total_min, 2),
        media_por_roteiro_min=round(total_min / qtd_roteiros, 2) if qtd_roteiros else 0,
        media_por_parada_min=round(total_min / qtd_paradas, 2) if qtd_paradas else 0,
        percentual_jornada=calculo.percentual_jornada(
            total_min, dias_motorista, parametros.jornada_padrao_horas
        ),
        jornada_padrao_horas=parametros.jornada_padrao_horas,
        distancia_total_km=round(float(distancia), 2),
        custo_total=round(float(custo), 2),
    )


def serie_por_dia(db: Session, filtro: Filtro, parametros: Parametro) -> list[PontoSerie]:
    rows = db.execute(
        filtro.aplicar(
            select(
                Roteiro.data,
                func.sum(Roteiro.tempo_total_parado_min),
                func.count(Roteiro.id),
                func.count(distinct(Roteiro.motorista_id)),
                func.sum(Roteiro.custo_estimado),
            )
        ).group_by(Roteiro.data)
    ).all()
    por_dia = {r[0]: r for r in rows}

    serie: list[PontoSerie] = []
    dia = filtro.inicio
    while dia <= filtro.fim:
        _, total, qtd, motoristas, custo = por_dia.get(dia, (dia, 0, 0, 0, 0))
        serie.append(
            PontoSerie(
                chave=dia.isoformat(),
                tempo_parado_min=round(float(total or 0), 2),
                qtd_roteiros=qtd,
                percentual_jornada=calculo.percentual_jornada(
                    float(total or 0), motoristas, parametros.jornada_padrao_horas
                ),
                custo_total=round(float(custo or 0), 2),
            )
        )
        dia += timedelta(days=1)
    return serie


def _meses(inicio: date, fim: date) -> list[str]:
    meses = []
    ano, mes = inicio.year, inicio.month
    while (ano, mes) <= (fim.year, fim.month):
        meses.append(f"{ano:04d}-{mes:02d}")
        ano, mes = (ano + 1, 1) if mes == 12 else (ano, mes + 1)
    return meses


def serie_por_mes(db: Session, filtro: Filtro, parametros: Parametro) -> list[PontoSerie]:
    mes = func.to_char(Roteiro.data, "YYYY-MM").label("mes")
    rows = db.execute(
        filtro.aplicar(
            select(
                mes,
                func.sum(Roteiro.tempo_total_parado_min),
                func.count(Roteiro.id),
                func.count(distinct(tuple_(Roteiro.motorista_id, Roteiro.data))),
                func.sum(Roteiro.custo_estimado),
            )
        ).group_by(mes)
    ).all()
    por_mes = {r[0]: r for r in rows}

    serie: list[PontoSerie] = []
    for chave in _meses(filtro.inicio, filtro.fim):
        _, total, qtd, dias_motorista, custo = por_mes.get(chave, (chave, 0, 0, 0, 0))
        serie.append(
            PontoSerie(
                chave=chave,
                tempo_parado_min=round(float(total or 0), 2),
                qtd_roteiros=qtd,
                percentual_jornada=calculo.percentual_jornada(
                    float(total or 0), dias_motorista, parametros.jornada_padrao_horas
                ),
                custo_total=round(float(custo or 0), 2),
            )
        )
    return serie


def ranking_enderecos(db: Session, filtro: Filtro, limite: int = 10) -> list[RankingEndereco]:
    total = func.sum(PontoRoteiro.tempo_parado_min)
    rows = db.execute(
        filtro.aplicar(
            select(
                Ponto.id,
                Ponto.descricao,
                Ponto.endereco,
                total,
                func.count(PontoRoteiro.id),
                func.avg(PontoRoteiro.tempo_parado_min),
            )
            .join(PontoRoteiro.ponto)
            .join(PontoRoteiro.roteiro)
            .where(PontoRoteiro.ordem > calculo.ORDEM_PARTIDA, PontoRoteiro.tempo_parado_min.is_not(None))
        )
        .group_by(Ponto.id)
        .order_by(total.desc())
        .limit(limite)
    ).all()
    return [
        RankingEndereco(
            ponto_id=r[0], descricao=r[1], endereco=r[2], tempo_parado_min=round(float(r[3]), 2),
            qtd_paradas=r[4], media_min=round(float(r[5]), 2),
        )
        for r in rows
    ]


def ranking_motoristas(db: Session, filtro: Filtro, parametros: Parametro) -> list[RankingMotorista]:
    total = func.sum(Roteiro.tempo_total_parado_min)
    rows = db.execute(
        filtro.aplicar(
            select(Motorista.id, Motorista.nome, total, func.count(Roteiro.id), func.count(distinct(Roteiro.data)))
            .join(Roteiro.motorista)
        )
        .group_by(Motorista.id)
        .order_by(total.desc())
    ).all()
    return [
        RankingMotorista(
            motorista_id=r[0], nome=r[1], tempo_parado_min=round(float(r[2]), 2), qtd_roteiros=r[3],
            percentual_jornada=calculo.percentual_jornada(float(r[2]), r[4], parametros.jornada_padrao_horas),
        )
        for r in rows
    ]


def periodo(db: Session, filtro: Filtro, parametros: Parametro) -> DashboardPeriodo:
    return DashboardPeriodo(
        resumo=resumo(db, filtro, parametros),
        por_endereco=ranking_enderecos(db, filtro),
        por_motorista=ranking_motoristas(db, filtro, parametros),
    )
