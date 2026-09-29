from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.comum import nao_encontrado
from app.core.deps import Admin, DbSession
from app.core.security import hash_senha
from app.models import Usuario
from app.schemas.cadastros import UsuarioCreate, UsuarioOut, UsuarioUpdate
from app.services.cadastros import criar_usuario, usuario_out

router = APIRouter(prefix="/usuarios", tags=["Usuários"])


@router.get("", response_model=list[UsuarioOut])
def listar(db: DbSession, _: Admin) -> list[UsuarioOut]:
    return [usuario_out(u) for u in db.scalars(select(Usuario).order_by(Usuario.perfil, Usuario.nome))]


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def criar(dados: UsuarioCreate, db: DbSession, _: Admin) -> UsuarioOut:
    usuario = criar_usuario(db, nome=dados.nome, email=dados.email, senha=dados.senha, perfil=dados.perfil)
    db.commit()
    return usuario_out(usuario)


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def atualizar(usuario_id: int, dados: UsuarioUpdate, db: DbSession, admin: Admin) -> UsuarioOut:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise nao_encontrado("Usuário")
    if dados.ativo is False and usuario.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Você não pode desativar o próprio acesso.")
    if dados.nome is not None:
        usuario.nome = dados.nome
    if dados.ativo is not None:
        usuario.ativo = dados.ativo
    if dados.senha:
        usuario.senha_hash = hash_senha(dados.senha)
    db.commit()
    return usuario_out(usuario)
