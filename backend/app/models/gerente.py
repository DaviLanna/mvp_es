from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.motorista import Motorista
    from app.models.usuario import Usuario


class Gerente(Base):
    """Gerente / coordenador / dono da transportadora."""

    __tablename__ = "gerente"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    cargo: Mapped[str] = mapped_column(String(40), default="Gerente")
    telefone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str] = mapped_column(String(160))
    usuario_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL"), unique=True
    )

    usuario: Mapped["Usuario | None"] = relationship(back_populates="gerente")
    motoristas: Mapped[list["Motorista"]] = relationship(back_populates="gerente")
