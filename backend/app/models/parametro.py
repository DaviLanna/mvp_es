from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Parametro(Base):
    """Parâmetros de custo e de cálculo do tempo parado (linha única, id = 1)."""

    __tablename__ = "parametro"

    id: Mapped[int] = mapped_column(primary_key=True)
    valor_combustivel_litro: Mapped[float] = mapped_column(default=6.29)
    km_por_litro_padrao: Mapped[float] = mapped_column(default=10.0)
    custo_adicional_km: Mapped[float] = mapped_column(default=0.0)
    jornada_padrao_horas: Mapped[float] = mapped_column(default=8.0)
    tempo_minimo_parada_min: Mapped[float] = mapped_column(default=0.0)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
