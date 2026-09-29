from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decodificar_token
from app.db.session import get_db
from app.models import Gerente, Motorista, Perfil, Usuario
from app.services.auditoria import definir_usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession, token: Annotated[str, Depends(oauth2_scheme)]) -> Usuario:
    nao_autorizado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decodificar_token(token)
        usuario_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise nao_autorizado
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or not usuario.ativo:
        raise nao_autorizado
    definir_usuario(db, usuario.id, usuario.email)
    return usuario


CurrentUser = Annotated[Usuario, Depends(get_current_user)]


def require_perfil(*perfis: Perfil) -> Callable[[Usuario], Usuario]:
    def dependencia(usuario: CurrentUser) -> Usuario:
        if usuario.perfil not in perfis:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso não permitido para o seu perfil.")
        return usuario

    return dependencia


Admin = Annotated[Usuario, Depends(require_perfil(Perfil.ADMIN))]
Gestor = Annotated[Usuario, Depends(require_perfil(Perfil.ADMIN, Perfil.GERENTE))]


def gerente_do_usuario(db: Session, usuario: Usuario) -> Gerente | None:
    return db.scalar(select(Gerente).where(Gerente.usuario_id == usuario.id))


def motorista_do_usuario(db: Session, usuario: Usuario) -> Motorista | None:
    return db.scalar(select(Motorista).where(Motorista.usuario_id == usuario.id))


def escopo_motoristas(db: Session, usuario: Usuario) -> list[int] | None:
    """IDs de motoristas visíveis ao usuário; None significa sem restrição (admin)."""
    if usuario.perfil == Perfil.ADMIN:
        return None
    if usuario.perfil == Perfil.GERENTE:
        gerente = gerente_do_usuario(db, usuario)
        if gerente is None:
            return []
        return list(db.scalars(select(Motorista.id).where(Motorista.gerente_id == gerente.id)))
    motorista = motorista_do_usuario(db, usuario)
    return [motorista.id] if motorista else []


def exigir_motorista_no_escopo(db: Session, usuario: Usuario, motorista_id: int) -> None:
    escopo = escopo_motoristas(db, usuario)
    if escopo is not None and motorista_id not in escopo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Motorista fora da sua equipe.")
