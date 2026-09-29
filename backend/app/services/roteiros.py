"""Montagem de roteiros, coleta de chegada/saída e recálculo dos indicadores."""

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Motorista, Parametro, Ponto, PontoRoteiro, Roteiro, StatusRoteiro
from app.schemas.roteiros import (
    ColetaIn,
    ParadaCorrecao,
    ParadaOut,
    RoteiroDetalhe,
    RoteiroResumo,
)
from app.services import calculo


class RegraNegocioError(Exception):
    """Violação de regra de negócio; a API responde 400 com a mensagem."""


# ---------- Parâmetros ----------


def obter_parametros(db: Session) -> Parametro:
    parametros = db.get(Parametro, 1)
    if parametros is None:
        parametros = Parametro(id=1)
        db.add(parametros)
        db.flush()
    return parametros


def custo_por_km_do_motorista(motorista: Motorista, parametros: Parametro) -> float:
    km_por_litro = motorista.km_por_litro or parametros.km_por_litro_padrao
    return calculo.custo_por_km(
        parametros.valor_combustivel_litro, km_por_litro, parametros.custo_adicional_km
    )


# ---------- Cálculo ----------


def _ordenadas(roteiro: Roteiro) -> list[PontoRoteiro]:
    return sorted(roteiro.paradas, key=lambda p: p.ordem)


def recalcular_roteiro(db: Session, roteiro: Roteiro, parametros: Parametro | None = None) -> None:
    """Recalcula tempo parado por ponto, total, distância e custo (RN01–RN03, RN07)."""
    parametros = parametros or obter_parametros(db)
    paradas = _ordenadas(roteiro)
    for parada in paradas:
        parada.tempo_parado_min = calculo.tempo_parado_min(
            parada.ordem, parada.chegada_em, parada.saida_em, parametros.tempo_minimo_parada_min
        )
    roteiro.tempo_total_parado_min = calculo.tempo_total_parado(
        (p.ordem, p.tempo_parado_min) for p in paradas
    )
    if not roteiro.distancia_manual:
        roteiro.distancia_total_km = calculo.distancia_trajeto_km(
            [(p.ponto.latitude, p.ponto.longitude) for p in paradas]
        )
    roteiro.custo_por_km = custo_por_km_do_motorista(roteiro.motorista, parametros)
    roteiro.custo_estimado = calculo.custo_estimado(roteiro.distancia_total_km, roteiro.custo_por_km)


def atualizar_status(roteiro: Roteiro) -> None:
    paradas = _ordenadas(roteiro)
    if paradas and paradas[-1].saida_em is not None:
        roteiro.status = StatusRoteiro.CONCLUIDO
    elif any(p.chegada_em or p.saida_em for p in paradas):
        roteiro.status = StatusRoteiro.EM_ANDAMENTO
    else:
        roteiro.status = StatusRoteiro.PLANEJADO


def validar_sequencia(roteiro: Roteiro) -> None:
    """Os horários devem seguir a ordem do trajeto: saída(1) ≤ chegada(2) ≤ saída(2) ≤ chegada(3)…"""
    marcos: list[tuple[datetime | None, str]] = []
    for parada in _ordenadas(roteiro):
        if not calculo.eh_partida(parada.ordem):
            if parada.saida_em and not parada.chegada_em:
                raise RegraNegocioError(f"Ponto {parada.ordem}: saída informada sem chegada.")
            marcos.append((parada.chegada_em, f"a chegada no ponto {parada.ordem}"))
        marcos.append((parada.saida_em, f"a saída do ponto {parada.ordem}"))

    anterior: tuple[datetime, str] | None = None
    for momento, rotulo in marcos:
        if momento is None:
            continue
        if anterior and momento < anterior[0]:
            raise RegraNegocioError(f"Horários fora de ordem: {rotulo} é anterior a {anterior[1]}.")
        anterior = (momento, rotulo)


# ---------- Montagem (RF04) ----------


def _carregar_pontos(db: Session, ponto_ids: list[int]) -> list[Ponto]:
    encontrados = {p.id: p for p in db.scalars(select(Ponto).where(Ponto.id.in_(ponto_ids)))}
    faltando = sorted({i for i in ponto_ids if i not in encontrados})
    if faltando:
        raise RegraNegocioError(f"Pontos inexistentes: {faltando}.")
    return [encontrados[i] for i in ponto_ids]


def _coleta_iniciada(roteiro: Roteiro) -> bool:
    return any(p.chegada_em or p.saida_em for p in roteiro.paradas)


def definir_sequencia(db: Session, roteiro: Roteiro, ponto_ids: list[int]) -> None:
    """Define os pontos do roteiro na ordem informada (1, 2, 3…), reaproveitando as linhas existentes."""
    if _coleta_iniciada(roteiro):
        raise RegraNegocioError(
            "A coleta já começou; não é possível reordenar. Adicione ou remova pontos pendentes."
        )
    pontos = _carregar_pontos(db, ponto_ids)
    atuais = _ordenadas(roteiro)
    for ordem, ponto in enumerate(pontos, start=1):
        if ordem <= len(atuais):
            parada = atuais[ordem - 1]
            parada.ordem = ordem
            parada.ponto_id = ponto.id
            parada.ponto = ponto
        else:
            roteiro.paradas.append(PontoRoteiro(ordem=ordem, ponto_id=ponto.id, ponto=ponto))
    for excedente in atuais[len(pontos):]:
        roteiro.paradas.remove(excedente)


def criar_roteiro(
    db: Session, *, nome: str | None, data: date, motorista: Motorista, ponto_ids: list[int]
) -> Roteiro:
    roteiro = Roteiro(nome=nome, data=data, motorista=motorista, motorista_id=motorista.id)
    db.add(roteiro)
    definir_sequencia(db, roteiro, ponto_ids)
    recalcular_roteiro(db, roteiro)
    return roteiro


def adicionar_parada(db: Session, roteiro: Roteiro, ponto_id: int) -> PontoRoteiro:
    if roteiro.status == StatusRoteiro.CONCLUIDO:
        raise RegraNegocioError("Roteiro concluído não pode receber novos pontos.")
    (ponto,) = _carregar_pontos(db, [ponto_id])
    ordem = max((p.ordem for p in roteiro.paradas), default=0) + 1
    parada = PontoRoteiro(ordem=ordem, ponto_id=ponto.id, ponto=ponto)
    roteiro.paradas.append(parada)
    recalcular_roteiro(db, roteiro)
    return parada


def remover_parada(db: Session, roteiro: Roteiro, parada: PontoRoteiro) -> None:
    if parada.chegada_em or parada.saida_em:
        raise RegraNegocioError("Não é possível remover um ponto que já tem horários registrados.")
    if len(roteiro.paradas) <= 2:
        raise RegraNegocioError("O roteiro precisa de pelo menos 2 pontos (partida e um destino).")
    ordem_removida = parada.ordem
    roteiro.paradas.remove(parada)
    for p in roteiro.paradas:
        if p.ordem > ordem_removida:
            p.ordem -= 1
    atualizar_status(roteiro)
    recalcular_roteiro(db, roteiro)


# ---------- Coleta (RF05) ----------


def agora() -> datetime:
    return datetime.now(UTC)


def hoje_local() -> date:
    return datetime.now(settings.tz).date()


def _parada_por_ordem(roteiro: Roteiro, ordem: int) -> PontoRoteiro | None:
    return next((p for p in roteiro.paradas if p.ordem == ordem), None)


def registrar_chegada(
    db: Session, roteiro: Roteiro, parada: PontoRoteiro, coleta: ColetaIn, momento: datetime | None = None
) -> None:
    if roteiro.status == StatusRoteiro.CONCLUIDO:
        raise RegraNegocioError("Roteiro já concluído.")
    if calculo.eh_partida(parada.ordem):
        raise RegraNegocioError("O ponto de partida não registra chegada. Use 'Iniciar roteiro'.")
    if parada.chegada_em is not None:
        raise RegraNegocioError("Chegada já registrada neste ponto.")
    anterior = _parada_por_ordem(roteiro, parada.ordem - 1)
    if anterior is None or anterior.saida_em is None:
        raise RegraNegocioError("Registre a saída do ponto anterior primeiro.")
    parada.chegada_em = momento or agora()
    parada.chegada_lat, parada.chegada_lng = coleta.lat, coleta.lng
    atualizar_status(roteiro)
    recalcular_roteiro(db, roteiro)


def registrar_saida(
    db: Session, roteiro: Roteiro, parada: PontoRoteiro, coleta: ColetaIn, momento: datetime | None = None
) -> None:
    if roteiro.status == StatusRoteiro.CONCLUIDO:
        raise RegraNegocioError("Roteiro já concluído.")
    if parada.saida_em is not None:
        raise RegraNegocioError("Saída já registrada neste ponto.")
    if not calculo.eh_partida(parada.ordem) and parada.chegada_em is None:
        raise RegraNegocioError("Registre a chegada neste ponto primeiro.")
    parada.saida_em = momento or agora()
    parada.saida_lat, parada.saida_lng = coleta.lat, coleta.lng
    atualizar_status(roteiro)
    recalcular_roteiro(db, roteiro)


def _com_fuso(momento: datetime | None) -> datetime | None:
    if momento is not None and momento.tzinfo is None:
        return momento.replace(tzinfo=settings.tz)
    return momento


def corrigir_horarios(db: Session, roteiro: Roteiro, parada: PontoRoteiro, dados: ParadaCorrecao) -> None:
    campos = dados.model_fields_set
    if "chegada_em" in campos:
        if calculo.eh_partida(parada.ordem) and dados.chegada_em is not None:
            raise RegraNegocioError("O ponto de partida não tem horário de chegada.")
        parada.chegada_em = _com_fuso(dados.chegada_em)
    if "saida_em" in campos:
        parada.saida_em = _com_fuso(dados.saida_em)
    validar_sequencia(roteiro)
    atualizar_status(roteiro)
    recalcular_roteiro(db, roteiro)


# ---------- Serialização ----------


def parada_out(parada: PontoRoteiro) -> ParadaOut:
    return ParadaOut(
        id=parada.id,
        ordem=parada.ordem,
        eh_partida=calculo.eh_partida(parada.ordem),
        ponto_id=parada.ponto_id,
        ponto_descricao=parada.ponto.descricao,
        endereco=parada.ponto.endereco,
        latitude=parada.ponto.latitude,
        longitude=parada.ponto.longitude,
        chegada_em=parada.chegada_em,
        saida_em=parada.saida_em,
        chegada_lat=parada.chegada_lat,
        chegada_lng=parada.chegada_lng,
        saida_lat=parada.saida_lat,
        saida_lng=parada.saida_lng,
        tempo_parado_min=parada.tempo_parado_min,
    )


def roteiro_resumo(roteiro: Roteiro) -> RoteiroResumo:
    return RoteiroResumo(
        id=roteiro.id,
        nome=roteiro.nome,
        data=roteiro.data,
        motorista_id=roteiro.motorista_id,
        motorista_nome=roteiro.motorista.nome,
        status=roteiro.status,
        qtd_pontos=len(roteiro.paradas),
        distancia_total_km=roteiro.distancia_total_km,
        tempo_total_parado_min=roteiro.tempo_total_parado_min,
        custo_estimado=roteiro.custo_estimado,
    )


def roteiro_detalhe(roteiro: Roteiro, parametros: Parametro) -> RoteiroDetalhe:
    return RoteiroDetalhe(
        **roteiro_resumo(roteiro).model_dump(),
        distancia_manual=roteiro.distancia_manual,
        custo_por_km=roteiro.custo_por_km,
        percentual_jornada=calculo.percentual_jornada(
            roteiro.tempo_total_parado_min, 1, parametros.jornada_padrao_horas
        ),
        jornada_padrao_horas=parametros.jornada_padrao_horas,
        paradas=[parada_out(p) for p in _ordenadas(roteiro)],
    )
