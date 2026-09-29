import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.gerente import Gerente
    from app.models.motorista import Motorista


class Perfil(str, enum.Enum):
    ADMIN = "ADMIN"
    GERENTE = "GERENTE"
    MOTORISTA = "MOTORISTA"


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(200))
    perfil: Mapped[Perfil] = mapped_column(Enum(Perfil, native_enum=False, length=20))
    ativo: Mapped[bool] = mapped_column(default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    gerente: Mapped["Gerente | None"] = relationship(back_populates="usuario")
    motorista: Mapped["Motorista | None"] = relationship(back_populates="usuario")
