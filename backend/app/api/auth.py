from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession
from app.core.security import criar_token, verificar_senha
from app.models import Usuario
from app.schemas.cadastros import Token, UsuarioOut
from app.services.cadastros import usuario_out

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post("/login", response_model=Token)
def login(db: DbSession, form: Annotated[OAuth2PasswordRequestForm, Depends()]) -> Token:
    usuario = db.scalar(select(Usuario).where(func.lower(Usuario.email) == form.username.strip().lower()))
    if usuario is None or not usuario.ativo or not verificar_senha(form.password, usuario.senha_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha inválidos.")
    return Token(access_token=criar_token(usuario.id, usuario.perfil.value), usuario=usuario_out(usuario))


@router.get("/me", response_model=UsuarioOut)
def me(usuario: CurrentUser) -> UsuarioOut:
    return usuario_out(usuario)
