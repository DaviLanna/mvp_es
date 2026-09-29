from datetime import date

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from app.api.comum import nao_encontrado
from app.core.deps import (
    CurrentUser,
    DbSession,
    Gestor,
    escopo_motoristas,
    exigir_motorista_no_escopo,
)
from app.models import Motorista, Perfil, PontoRoteiro, Roteiro, StatusRoteiro, Usuario
from app.schemas.roteiros import (
    ColetaIn,
    Pagina,
    ParadaAdd,
    ParadaCorrecao,
    RoteiroCreate,
    RoteiroDetalhe,
    RoteiroResumo,
    RoteiroUpdate,
)
from app.services import roteiros as svc
from app.services.roteiros import RegraNegocioError

router = APIRouter(prefix="/roteiros", tags=["Roteiros"])

CARREGAR_ROTEIRO = (
    selectinload(Roteiro.paradas).joinedload(PontoRoteiro.ponto),
    joinedload(Roteiro.motorista),
)


def carregar_roteiro(db: DbSession, usuario: Usuario, roteiro_id: int) -> Roteiro:
    roteiro = db.scalar(select(Roteiro).options(*CARREGAR_ROTEIRO).where(Roteiro.id == roteiro_id))
    if roteiro is None:
        raise nao_encontrado("Roteiro")
    exigir_motorista_no_escopo(db, usuario, roteiro.motorista_id)
    return roteiro


def _parada(roteiro: Roteiro, parada_id: int) -> PontoRoteiro:
    parada = next((p for p in roteiro.paradas if p.id == parada_id), None)
    if parada is None:
        raise nao_encontrado("Ponto do roteiro")
    return parada


def _motorista_valido(db: DbSession, usuario: Usuario, motorista_id: int) -> Motorista:
    motorista = db.get(Motorista, motorista_id)
    if motorista is None:
        raise nao_encontrado("Motorista")
    exigir_motorista_no_escopo(db, usuario, motorista.id)
    if not motorista.ativo:
        raise RegraNegocioError("Motorista inativo não pode receber roteiros.")
    return motorista


def _detalhe(db: DbSession, roteiro: Roteiro) -> RoteiroDetalhe:
    db.commit()
    return svc.roteiro_detalhe(roteiro, svc.obter_parametros(db))


# ---------- Consulta ----------


@router.get("", response_model=Pagina[RoteiroResumo])
def listar(
    db: DbSession,
    usuario: CurrentUser,
    inicio: date | None = None,
    fim: date | None = None,
    motorista_id: int | None = None,
    status_roteiro: StatusRoteiro | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
) -> Pagina[RoteiroResumo]:
    stmt = select(Roteiro)
    escopo = escopo_motoristas(db, usuario)
    if escopo is not None:
        stmt = stmt.where(Roteiro.motorista_id.in_(escopo))
    if inicio:
        stmt = stmt.where(Roteiro.data >= inicio)
    if fim:
        stmt = stmt.where(Roteiro.data <= fim)
    if motorista_id:
        stmt = stmt.where(Roteiro.motorista_id == motorista_id)
    if status_roteiro:
        stmt = stmt.where(Roteiro.status == status_roteiro)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    roteiros = db.scalars(
        stmt.options(*CARREGAR_ROTEIRO)
        .order_by(Roteiro.data.desc(), Roteiro.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return Pagina(items=[svc.roteiro_resumo(r) for r in roteiros], total=total, page=page, page_size=page_size)


@router.get("/{roteiro_id}", response_model=RoteiroDetalhe)
def obter(roteiro_id: int, db: DbSession, usuario: CurrentUser) -> RoteiroDetalhe:
    return svc.roteiro_detalhe(carregar_roteiro(db, usuario, roteiro_id), svc.obter_parametros(db))


# ---------- Montagem (RF04) ----------


@router.post("", response_model=RoteiroDetalhe, status_code=status.HTTP_201_CREATED)
def criar(dados: RoteiroCreate, db: DbSession, usuario: Gestor) -> RoteiroDetalhe:
    motorista = _motorista_valido(db, usuario, dados.motorista_id)
    roteiro = svc.criar_roteiro(
        db, nome=dados.nome, data=dados.data, motorista=motorista, ponto_ids=dados.ponto_ids
    )
    return _detalhe(db, roteiro)


@router.put("/{roteiro_id}", response_model=RoteiroDetalhe)
def atualizar(roteiro_id: int, dados: RoteiroUpdate, db: DbSession, usuario: Gestor) -> RoteiroDetalhe:
    roteiro = carregar_roteiro(db, usuario, roteiro_id)
    campos = dados.model_fields_set
    if "nome" in campos:
        roteiro.nome = dados.nome
    if dados.data is not None:
        roteiro.data = dados.data
    if dados.motorista_id is not None and dados.motorista_id != roteiro.motorista_id:
        roteiro.motorista = _motorista_valido(db, usuario, dados.motorista_id)
        roteiro.motorista_id = roteiro.motorista.id
    if dados.ponto_ids is not None:
        svc.definir_sequencia(db, roteiro, dados.ponto_ids)
    if dados.distancia_manual is not None:
        roteiro.distancia_manual = dados.distancia_manual
    if dados.distancia_total_km is not None:
        roteiro.distancia_total_km = dados.distancia_total_km
        roteiro.distancia_manual = True
    svc.recalcular_roteiro(db, roteiro)
    return _detalhe(db, roteiro)


@router.delete("/{roteiro_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(roteiro_id: int, db: DbSession, usuario: Gestor) -> Response:
    roteiro = carregar_roteiro(db, usuario, roteiro_id)
    if roteiro.status != StatusRoteiro.PLANEJADO and usuario.perfil != Perfil.ADMIN:
        raise RegraNegocioError("Somente roteiros planejados podem ser excluídos pelo gerente.")
    db.delete(roteiro)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{roteiro_id}/recalcular", response_model=RoteiroDetalhe)
def recalcular(roteiro_id: int, db: DbSession, usuario: Gestor) -> RoteiroDetalhe:
    roteiro = carregar_roteiro(db, usuario, roteiro_id)
    svc.recalcular_roteiro(db, roteiro)
    return _detalhe(db, roteiro)


@router.post("/{roteiro_id}/paradas", response_model=RoteiroDetalhe, status_code=status.HTTP_201_CREATED)
def adicionar_parada(roteiro_id: int, dados: ParadaAdd, db: DbSession, usuario: Gestor) -> RoteiroDetalhe:
    roteiro = carregar_roteiro(db, usuario, roteiro_id)
    svc.adicionar_parada(db, roteiro, dados.ponto_id)
    return _detalhe(db, roteiro)


@router.delete("/{roteiro_id}/paradas/{parada_id}", response_model=RoteiroDetalhe)
def remover_parada(roteiro_id: int, parada_id: int, db: DbSession, usuario: Gestor) -> RoteiroDetalhe:
    roteiro = carregar_roteiro(db, usuario, roteiro_id)
    svc.remover_parada(db, roteiro, _parada(roteiro, parada_id))
    return _detalhe(db, roteiro)


@router.put("/{roteiro_id}/paradas/{parada_id}", response_model=RoteiroDetalhe)
def corrigir_horarios(
    roteiro_id: int, parada_id: int, dados: ParadaCorrecao, db: DbSession, usuario: Gestor
) -> RoteiroDetalhe:
    """Correção manual de horários (gerente/admin). Fica registrada na auditoria."""
    roteiro = carregar_roteiro(db, usuario, roteiro_id)
    svc.corrigir_horarios(db, roteiro, _parada(roteiro, parada_id), dados)
    return _detalhe(db, roteiro)


# ---------- Coleta (RF05) ----------


def _validar_coleta(usuario: Usuario, roteiro: Roteiro) -> None:
    if usuario.perfil == Perfil.MOTORISTA and roteiro.data != svc.hoje_local():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Só é possível registrar a coleta de roteiros do dia.")


@router.post("/{roteiro_id}/paradas/{parada_id}/chegada", response_model=RoteiroDetalhe)
def registrar_chegada(
    roteiro_id: int, parada_id: int, dados: ColetaIn, db: DbSession, usuario: CurrentUser
) -> RoteiroDetalhe:
    roteiro = carregar_roteiro(db, usuario, roteiro_id)
    _validar_coleta(usuario, roteiro)
    svc.registrar_chegada(db, roteiro, _parada(roteiro, parada_id), dados)
    return _detalhe(db, roteiro)


@router.post("/{roteiro_id}/paradas/{parada_id}/saida", response_model=RoteiroDetalhe)
def registrar_saida(
    roteiro_id: int, parada_id: int, dados: ColetaIn, db: DbSession, usuario: CurrentUser
) -> RoteiroDetalhe:
    roteiro = carregar_roteiro(db, usuario, roteiro_id)
    _validar_coleta(usuario, roteiro)
    svc.registrar_saida(db, roteiro, _parada(roteiro, parada_id), dados)
    return _detalhe(db, roteiro)
