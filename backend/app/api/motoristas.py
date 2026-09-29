from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.comum import nao_encontrado
from app.core.deps import (
    Admin,
    DbSession,
    Gestor,
    escopo_motoristas,
    exigir_motorista_no_escopo,
    gerente_do_usuario,
)
from app.models import Gerente, Motorista, Perfil, Usuario
from app.schemas.cadastros import MotoristaCreate, MotoristaOut, MotoristaUpdate
from app.services.cadastros import criar_usuario, motorista_out
from app.services.lgpd import anonimizar_motorista
from app.services.roteiros import RegraNegocioError

router = APIRouter(prefix="/motoristas", tags=["Motoristas / motoboys"])


def _carregar(db: DbSession, usuario: Usuario, motorista_id: int) -> Motorista:
    motorista = db.get(Motorista, motorista_id)
    if motorista is None:
        raise nao_encontrado("Motorista")
    exigir_motorista_no_escopo(db, usuario, motorista.id)
    return motorista


def _validar_gerente(db: DbSession, gerente_id: int | None) -> None:
    if gerente_id is not None and db.get(Gerente, gerente_id) is None:
        raise RegraNegocioError("Gerente informado não existe.")


@router.get("", response_model=list[MotoristaOut])
def listar(db: DbSession, usuario: Gestor, ativos: bool | None = None) -> list[MotoristaOut]:
    stmt = select(Motorista).options(joinedload(Motorista.gerente), joinedload(Motorista.usuario))
    escopo = escopo_motoristas(db, usuario)
    if escopo is not None:
        stmt = stmt.where(Motorista.id.in_(escopo))
    if ativos is not None:
        stmt = stmt.where(Motorista.ativo == ativos)
    return [motorista_out(m, usuario) for m in db.scalars(stmt.order_by(Motorista.nome))]


@router.get("/{motorista_id}", response_model=MotoristaOut)
def obter(motorista_id: int, db: DbSession, usuario: Gestor) -> MotoristaOut:
    return motorista_out(_carregar(db, usuario, motorista_id), usuario)


@router.post("", response_model=MotoristaOut, status_code=status.HTTP_201_CREATED)
def criar(dados: MotoristaCreate, db: DbSession, usuario: Gestor) -> MotoristaOut:
    if bool(dados.email) != bool(dados.senha):
        raise RegraNegocioError("Para criar o acesso do motorista informe e-mail e senha.")
    motorista = Motorista(**dados.model_dump(exclude={"email", "senha"}))
    if usuario.perfil == Perfil.GERENTE:
        # gerente cadastra motoristas na própria equipe
        gerente = gerente_do_usuario(db, usuario)
        motorista.gerente_id = gerente.id if gerente else None
    else:
        _validar_gerente(db, dados.gerente_id)
    if dados.email and dados.senha:
        motorista.usuario = criar_usuario(
            db, nome=dados.nome, email=dados.email, senha=dados.senha, perfil=Perfil.MOTORISTA
        )
    db.add(motorista)
    db.commit()
    db.refresh(motorista)
    return motorista_out(motorista, usuario)


@router.put("/{motorista_id}", response_model=MotoristaOut)
def atualizar(motorista_id: int, dados: MotoristaUpdate, db: DbSession, usuario: Gestor) -> MotoristaOut:
    motorista = _carregar(db, usuario, motorista_id)
    if motorista.anonimizado_em is not None:
        raise RegraNegocioError("Motorista anonimizado não pode ser alterado.")
    campos = dados.model_dump(exclude_unset=True)
    if "gerente_id" in campos:
        if usuario.perfil == Perfil.GERENTE:
            campos.pop("gerente_id")
        else:
            _validar_gerente(db, campos["gerente_id"])
    for campo, valor in campos.items():
        setattr(motorista, campo, valor)
    if motorista.usuario is not None:
        motorista.usuario.nome = motorista.nome
        if "ativo" in campos:
            motorista.usuario.ativo = motorista.ativo
    db.commit()
    db.refresh(motorista)
    return motorista_out(motorista, usuario)


@router.post("/{motorista_id}/anonimizar", response_model=MotoristaOut)
def anonimizar(motorista_id: int, db: DbSession, usuario: Admin) -> MotoristaOut:
    """LGPD: remove dados pessoais mantendo os roteiros para estatística."""
    motorista = _carregar(db, usuario, motorista_id)
    if motorista.anonimizado_em is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Motorista já anonimizado.")
    anonimizar_motorista(motorista)
    db.commit()
    db.refresh(motorista)
    return motorista_out(motorista, usuario)
