"""Tratamento de dados pessoais dos profissionais de campo (RNF06 — LGPD)."""

import secrets
from datetime import UTC, datetime

from app.core.security import hash_senha
from app.models import Motorista


def mascarar_documento(documento: str | None) -> str | None:
    """Mantém só os 4 últimos dígitos: 123.456.789-01 → ***.***.*89-01."""
    if not documento:
        return documento
    total_digitos = sum(c.isdigit() for c in documento)
    visiveis_a_partir = total_digitos - 4
    resultado, vistos = [], 0
    for c in documento:
        if c.isdigit():
            resultado.append(c if vistos >= visiveis_a_partir else "*")
            vistos += 1
        else:
            resultado.append(c)
    return "".join(resultado)


def anonimizar_motorista(motorista: Motorista) -> None:
    """Remove os dados pessoais e mantém os roteiros para fins estatísticos."""
    motorista.nome = f"Motorista anonimizado #{motorista.id}"
    motorista.telefone = None
    motorista.documento = None
    motorista.placa = None
    motorista.ativo = False
    motorista.anonimizado_em = datetime.now(UTC)
    if motorista.usuario is not None:
        usuario = motorista.usuario
        usuario.nome = motorista.nome
        usuario.email = f"anonimizado-{usuario.id}@anonimizado.local"
        usuario.senha_hash = hash_senha(secrets.token_urlsafe(24))
        usuario.ativo = False
