"""Regras de negócio de tempo parado e custo (funções puras, sem acesso a banco).

RN01/RN02: o ponto de partida (ordem 1) não conta tempo parado; nos demais,
           tempo parado = saída − chegada.
RN03:      tempo total do roteiro = soma dos pontos, exceto a partida.
RN04:      a jornada padrão (8 h/dia) é a base percentual dos indicadores.
RN07:      custo = distância × (valor do combustível / km por litro + custo adicional por km).
"""

from collections.abc import Iterable, Sequence
from datetime import datetime
from math import asin, cos, radians, sin, sqrt

RAIO_TERRA_KM = 6371.0088
ORDEM_PARTIDA = 1


def eh_partida(ordem: int) -> bool:
    return ordem <= ORDEM_PARTIDA


def tempo_parado_min(
    ordem: int,
    chegada: datetime | None,
    saida: datetime | None,
    tempo_minimo_min: float = 0,
) -> float | None:
    """Minutos parados no ponto; None para a partida ou quando a coleta está incompleta."""
    if eh_partida(ordem) or chegada is None or saida is None:
        return None
    minutos = (saida - chegada).total_seconds() / 60
    if minutos < 0:
        raise ValueError("A saída não pode ser anterior à chegada.")
    if minutos < tempo_minimo_min:
        return 0.0
    return round(minutos, 2)


def tempo_total_parado(tempos_por_ordem: Iterable[tuple[int, float | None]]) -> float:
    return round(
        sum(t for ordem, t in tempos_por_ordem if not eh_partida(ordem) and t is not None), 2
    )


def percentual_jornada(total_parado_min: float, dias_trabalhados: int, jornada_horas: float) -> float:
    base_min = dias_trabalhados * jornada_horas * 60
    if base_min <= 0:
        return 0.0
    return round(total_parado_min / base_min * 100, 2)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * RAIO_TERRA_KM * asin(sqrt(a))


def distancia_trajeto_km(coordenadas: Sequence[tuple[float | None, float | None]]) -> float:
    """Soma das distâncias em linha reta entre pontos consecutivos com coordenadas."""
    validas = [(lat, lon) for lat, lon in coordenadas if lat is not None and lon is not None]
    total = sum(haversine_km(*a, *b) for a, b in zip(validas, validas[1:]))
    return round(total, 2)


def custo_por_km(valor_combustivel_litro: float, km_por_litro: float, custo_adicional_km: float = 0) -> float:
    if km_por_litro <= 0:
        raise ValueError("O rendimento (km/litro) deve ser maior que zero.")
    return round(valor_combustivel_litro / km_por_litro + custo_adicional_km, 4)


def custo_estimado(distancia_km: float, custo_km: float) -> float:
    return round(distancia_km * custo_km, 2)
