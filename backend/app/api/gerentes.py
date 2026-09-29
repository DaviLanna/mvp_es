from fastapi import APIRouter, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.comum import nao_encontrado
from app.core.deps import Admin, DbSession, Gestor
from app.models import Gerente, Perfil
from app.schemas.cadastros import GerenteCreate, GerenteOut, GerenteUpdate
from app.services.cadastros import criar_usuario, email_em_uso, gerente_out
from app.services.roteiros import RegraNegocioError

router = APIRouter(prefix="/gerentes", tags=["Gerentes / coordenadores"])


def _carregar(db: DbSession, gerente_id: int) -> Gerente:
    gerente = db.get(Gerente, gerente_id)
    if gerente is None:
        raise nao_encontrado("Gerente")
    return gerente


@router.get("", response_model=list[GerenteOut])
def listar(db: DbSession, _: Gestor) -> list[GerenteOut]:
    gerentes = db.scalars(select(Gerente).options(selectinload(Gerente.motoristas)).order_by(Gerente.nome))
    return [gerente_out(g) for g in gerentes]


@router.post("", response_model=GerenteOut, status_code=status.HTTP_201_CREATED)
def criar(dados: GerenteCreate, db: DbSession, _: Admin) -> GerenteOut:
    gerente = Gerente(**dados.model_dump(exclude={"senha"}))
    if dados.senha:
        gerente.usuario = criar_usuario(
            db, nome=dados.nome, email=dados.email, senha=dados.senha, perfil=Perfil.GERENTE
        )
    db.add(gerente)
    db.commit()
    return gerente_out(gerente)


@router.put("/{gerente_id}", response_model=GerenteOut)
def atualizar(gerente_id: int, dados: GerenteUpdate, db: DbSession, _: Admin) -> GerenteOut:
    gerente = _carregar(db, gerente_id)
    campos = dados.model_dump(exclude_unset=True)
    if "email" in campos and gerente.usuario is not None:
        if email_em_uso(db, campos["email"], exceto_usuario_id=gerente.usuario.id):
            raise RegraNegocioError(f"Já existe um usuário com o e-mail {campos['email']}.")
        gerente.usuario.email = campos["email"].lower()
    for campo, valor in campos.items():
        setattr(gerente, campo, valor)
    if gerente.usuario is not None and "nome" in campos:
        gerente.usuario.nome = campos["nome"]
    db.commit()
    return gerente_out(gerente)


@router.delete("/{gerente_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(gerente_id: int, db: DbSession, _: Admin) -> Response:
    gerente = _carregar(db, gerente_id)
    if gerente.usuario is not None:
        gerente.usuario.ativo = False
    db.delete(gerente)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
