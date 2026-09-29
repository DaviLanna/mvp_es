from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Ponto(Base):
    """Endereço cadastrado que pode ser usado em vários roteiros."""

    __tablename__ = "ponto"

    id: Mapped[int] = mapped_column(primary_key=True)
    descricao: Mapped[str] = mapped_column(String(120))
    endereco: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
    ativo: Mapped[bool] = mapped_column(default=True)
