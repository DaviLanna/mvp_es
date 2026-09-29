from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import or_, select

from app.api.comum import nao_encontrado
from app.core.deps import DbSession, Gestor
from app.models import Ponto, PontoRoteiro
from app.schemas.cadastros import GeocodeResultado, PontoCreate, PontoOut, PontoUpdate
from app.services.geocoding import GeocodingError, geocodificar

router = APIRouter(prefix="/pontos", tags=["Pontos"])


@router.get("/geocode", response_model=list[GeocodeResultado])
def geocode(_: Gestor, q: str = Query(min_length=3)) -> list[GeocodeResultado]:
    """Busca coordenadas de um endereço (Nominatim / OpenStreetMap)."""
    try:
        return geocodificar(q)
    except GeocodingError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc


@router.get("", response_model=list[PontoOut])
def listar(db: DbSession, _: Gestor, busca: str | None = None, ativos: bool | None = None) -> list[Ponto]:
    stmt = select(Ponto)
    if busca:
        termo = f"%{busca.strip()}%"
        stmt = stmt.where(or_(Ponto.descricao.ilike(termo), Ponto.endereco.ilike(termo)))
    if ativos is not None:
        stmt = stmt.where(Ponto.ativo == ativos)
    return list(db.scalars(stmt.order_by(Ponto.descricao)))


@router.post("", response_model=PontoOut, status_code=status.HTTP_201_CREATED)
def criar(dados: PontoCreate, db: DbSession, _: Gestor) -> Ponto:
    ponto = Ponto(**dados.model_dump())
    db.add(ponto)
    db.commit()
    return ponto


@router.put("/{ponto_id}", response_model=PontoOut)
def atualizar(ponto_id: int, dados: PontoUpdate, db: DbSession, _: Gestor) -> Ponto:
    ponto = db.get(Ponto, ponto_id)
    if ponto is None:
        raise nao_encontrado("Ponto")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(ponto, campo, valor)
    db.commit()
    return ponto


@router.delete("/{ponto_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(ponto_id: int, db: DbSession, _: Gestor) -> Response:
    """Exclui o ponto; se já foi usado em roteiros, apenas desativa (preserva o histórico)."""
    ponto = db.get(Ponto, ponto_id)
    if ponto is None:
        raise nao_encontrado("Ponto")
    em_uso = db.scalar(select(PontoRoteiro.id).where(PontoRoteiro.ponto_id == ponto_id).limit(1))
    if em_uso:
        ponto.ativo = False
    else:
        db.delete(ponto)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
