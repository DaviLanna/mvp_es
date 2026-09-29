import enum
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.motorista import Motorista
from app.models.ponto import Ponto


class StatusRoteiro(str, enum.Enum):
    PLANEJADO = "PLANEJADO"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    CONCLUIDO = "CONCLUIDO"


class Roteiro(Base):
    """Roteiro diário: um motorista, uma data, pontos em ordem sequencial (RN05/RN06)."""

    __tablename__ = "roteiro"
    __table_args__ = (Index("ix_roteiro_data_motorista", "data", "motorista_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str | None] = mapped_column(String(80))
    data: Mapped[date] = mapped_column(Date)
    motorista_id: Mapped[int] = mapped_column(ForeignKey("motorista.id", ondelete="RESTRICT"))
    status: Mapped[StatusRoteiro] = mapped_column(
        Enum(StatusRoteiro, native_enum=False, length=20), default=StatusRoteiro.PLANEJADO
    )
    distancia_total_km: Mapped[float] = mapped_column(default=0)
    distancia_manual: Mapped[bool] = mapped_column(default=False)
    tempo_total_parado_min: Mapped[float] = mapped_column(default=0)
    custo_por_km: Mapped[float] = mapped_column(default=0)
    custo_estimado: Mapped[float] = mapped_column(default=0)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    motorista: Mapped[Motorista] = relationship()
    paradas: Mapped[list["PontoRoteiro"]] = relationship(
        back_populates="roteiro",
        order_by="PontoRoteiro.ordem",
        cascade="all, delete-orphan",
    )


class PontoRoteiro(Base):
    """Um ponto dentro de um roteiro, com a coleta de chegada/saída e o tempo parado calculado."""

    __tablename__ = "ponto_roteiro"
    __table_args__ = (
        UniqueConstraint(
            "roteiro_id", "ordem", name="uq_ponto_roteiro_ordem", deferrable=True, initially="DEFERRED"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    roteiro_id: Mapped[int] = mapped_column(ForeignKey("roteiro.id", ondelete="CASCADE"), index=True)
    ponto_id: Mapped[int] = mapped_column(ForeignKey("ponto.id", ondelete="RESTRICT"), index=True)
    ordem: Mapped[int]
    chegada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    saida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    chegada_lat: Mapped[float | None]
    chegada_lng: Mapped[float | None]
    saida_lat: Mapped[float | None]
    saida_lng: Mapped[float | None]
    tempo_parado_min: Mapped[float | None]

    roteiro: Mapped[Roteiro] = relationship(back_populates="paradas")
    ponto: Mapped[Ponto] = relationship()
