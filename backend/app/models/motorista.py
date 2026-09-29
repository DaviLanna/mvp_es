from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.gerente import Gerente
    from app.models.usuario import Usuario


class Motorista(Base):
    """Motorista / motoboy / transportador."""

    __tablename__ = "motorista"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    telefone: Mapped[str | None] = mapped_column(String(30))
    documento: Mapped[str | None] = mapped_column(String(30))
    veiculo: Mapped[str] = mapped_column(String(80))
    placa: Mapped[str | None] = mapped_column(String(10))
    km_por_litro: Mapped[float | None]
    ativo: Mapped[bool] = mapped_column(default=True)
    anonimizado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gerente_id: Mapped[int | None] = mapped_column(
        ForeignKey("gerente.id", ondelete="SET NULL"), index=True
    )
    usuario_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL"), unique=True
    )

    gerente: Mapped["Gerente | None"] = relationship(back_populates="motoristas")
    usuario: Mapped["Usuario | None"] = relationship(back_populates="motorista")
