from datetime import datetime, timedelta

import pytest

from app.services import calculo

T0 = datetime(2026, 9, 28, 10, 0)


def test_ponto_de_partida_nao_conta_tempo_parado():
    """RN01 / critério de aceitação: a partida nunca acumula tempo parado."""
    assert calculo.tempo_parado_min(1, T0, T0 + timedelta(minutes=30)) is None


def test_tempo_parado_e_saida_menos_chegada():
    """RN02."""
    assert calculo.tempo_parado_min(2, T0, T0 + timedelta(minutes=15)) == 15


def test_coleta_incompleta_nao_tem_tempo():
    assert calculo.tempo_parado_min(2, T0, None) is None
    assert calculo.tempo_parado_min(3, None, T0) is None


def test_tempo_minimo_de_parada_zera_paradas_curtas():
    assert calculo.tempo_parado_min(2, T0, T0 + timedelta(minutes=2), tempo_minimo_min=3) == 0
    assert calculo.tempo_parado_min(2, T0, T0 + timedelta(minutes=5), tempo_minimo_min=3) == 5


def test_saida_antes_da_chegada_e_invalida():
    with pytest.raises(ValueError):
        calculo.tempo_parado_min(2, T0, T0 - timedelta(minutes=1))


def test_total_do_roteiro_exclui_a_partida():
    """RN03 — exemplo do Roteiro A do enunciado: 15 + 10 + 50 = 75 min."""
    assert calculo.tempo_total_parado([(1, 999), (2, 15), (3, 10), (4, 50)]) == 75
    assert calculo.tempo_total_parado([(1, None), (2, 10), (3, None)]) == 10


def test_percentual_da_jornada_padrao():
    """RN04: 2 h parado em 1 dia de 8 h = 25%."""
    assert calculo.percentual_jornada(120, 1, 8) == 25.0
    assert calculo.percentual_jornada(120, 2, 8) == 12.5
    assert calculo.percentual_jornada(120, 0, 8) == 0


def test_haversine():
    assert calculo.haversine_km(0, 0, 0, 1) == pytest.approx(111.19, abs=0.01)


def test_distancia_do_trajeto_ignora_pontos_sem_coordenadas():
    trajeto = [(0, 0), (None, None), (0, 1), (0, 2)]
    assert calculo.distancia_trajeto_km(trajeto) == pytest.approx(222.39, abs=0.01)


def test_custo_por_km_e_custo_estimado():
    """RN07: R$ 6,00 / 10 km/l + R$ 0,20 = R$ 0,80 por km."""
    custo_km = calculo.custo_por_km(6.0, 10.0, 0.2)
    assert custo_km == pytest.approx(0.8)
    assert calculo.custo_estimado(100, custo_km) == 80.0
    with pytest.raises(ValueError):
        calculo.custo_por_km(6.0, 0)
