"""Auditoria automática (RNF05) das alterações em pontos, horários, roteiros e parâmetros.

Um listener `after_flush` compara o estado anterior e o novo de cada objeto auditado
e grava na tabela `auditoria`. O usuário responsável vem de `session.info`, preenchido
em `get_current_user`.
"""

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import event, inspect, insert
from sqlalchemy.orm import Session

from app.models import Auditoria, Parametro, Ponto, PontoRoteiro, Roteiro

ENTIDADES_AUDITADAS: dict[type, str] = {
    Ponto: "ponto",
    PontoRoteiro: "ponto_roteiro",
    Roteiro: "roteiro",
    Parametro: "parametro",
}
CAMPOS_IGNORADOS = {"atualizado_em", "criado_em"}

INFO_USUARIO_ID = "usuario_id"
INFO_USUARIO_EMAIL = "usuario_email"
INFO_DESATIVADA = "auditoria_desativada"


def definir_usuario(session: Session, usuario_id: int | None, email: str | None) -> None:
    session.info[INFO_USUARIO_ID] = usuario_id
    session.info[INFO_USUARIO_EMAIL] = email


def _serializar(valor: Any) -> Any:
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    if isinstance(valor, enum.Enum):
        return valor.value
    if isinstance(valor, Decimal):
        return float(valor)
    return valor


def _estado(obj: Any) -> dict[str, Any]:
    mapper = inspect(obj).mapper
    return {
        attr.key: _serializar(getattr(obj, attr.key))
        for attr in mapper.column_attrs
        if attr.key not in CAMPOS_IGNORADOS
    }


def _diferencas(obj: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    estado = inspect(obj)
    antes: dict[str, Any] = {}
    depois: dict[str, Any] = {}
    for attr in estado.mapper.column_attrs:
        if attr.key in CAMPOS_IGNORADOS:
            continue
        hist = estado.attrs[attr.key].history
        if not hist.has_changes():
            continue
        antigo = hist.deleted[0] if hist.deleted else None
        novo = hist.added[0] if hist.added else None
        if antigo == novo:
            continue
        antes[attr.key] = _serializar(antigo)
        depois[attr.key] = _serializar(novo)
    return antes, depois


@event.listens_for(Session, "after_flush")
def _registrar_auditoria(session: Session, _flush_context: Any) -> None:
    if session.info.get(INFO_DESATIVADA):
        return

    base = {
        "usuario_id": session.info.get(INFO_USUARIO_ID),
        "usuario_email": session.info.get(INFO_USUARIO_EMAIL),
    }
    registros: list[dict[str, Any]] = []

    for obj in session.new:
        if (entidade := ENTIDADES_AUDITADAS.get(type(obj))) is not None:
            registros.append(
                {**base, "entidade": entidade, "entidade_id": obj.id, "acao": "CREATE",
                 "antes": None, "depois": _estado(obj)}
            )

    for obj in session.dirty:
        if (entidade := ENTIDADES_AUDITADAS.get(type(obj))) is None:
            continue
        antes, depois = _diferencas(obj)
        if depois:
            registros.append(
                {**base, "entidade": entidade, "entidade_id": obj.id, "acao": "UPDATE",
                 "antes": antes, "depois": depois}
            )

    for obj in session.deleted:
        if (entidade := ENTIDADES_AUDITADAS.get(type(obj))) is not None:
            registros.append(
                {**base, "entidade": entidade, "entidade_id": obj.id, "acao": "DELETE",
                 "antes": _estado(obj), "depois": None}
            )

    if registros:
        session.connection().execute(insert(Auditoria.__table__), registros)
