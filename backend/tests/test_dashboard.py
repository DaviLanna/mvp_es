from tests.conftest import Cenario
from tests.test_roteiros import corrigir, criar_roteiro
from datetime import date


def _roteiro_com_tempos(c: Cenario, dia: date, minutos: tuple[int, int, int]) -> dict:
    """Cria um roteiro e registra horários com os minutos parados informados nos pontos 2, 3 e 4."""
    roteiro = criar_roteiro(c, data=dia)
    rid, p, d = roteiro["id"], roteiro["paradas"], dia.isoformat()
    corrigir(c, rid, p[0]["id"], saida_em=f"{d}T08:00:00-03:00")
    hora = 9
    for parada, m in zip(p[1:], minutos):
        resp = corrigir(c, rid, parada["id"], chegada_em=f"{d}T{hora:02d}:00:00-03:00", saida_em=f"{d}T{hora:02d}:{m:02d}:00-03:00")
        assert resp.status_code == 200, resp.text
        hora += 1
    return resp.json()


def test_tres_recortes_do_dashboard(cenario: Cenario):
    """Critério de aceitação 2: dia, mês e período."""
    c = cenario
    _roteiro_com_tempos(c, date(2026, 8, 10), (15, 10, 50))  # 75 min
    _roteiro_com_tempos(c, date(2026, 9, 10), (10, 5, 26))   # 41 min
    params = {"inicio": "2026-08-01", "fim": "2026-09-30"}

    por_dia = c.client.get("/api/dashboard/por-dia", headers=c.gerente, params=params).json()
    assert len(por_dia) == 61
    valores = {p["chave"]: p["tempo_parado_min"] for p in por_dia if p["tempo_parado_min"]}
    assert valores == {"2026-08-10": 75, "2026-09-10": 41}

    por_mes = c.client.get("/api/dashboard/por-mes", headers=c.gerente, params=params).json()
    assert [(m["chave"], m["tempo_parado_min"]) for m in por_mes] == [("2026-08", 75), ("2026-09", 41)]
    assert por_mes[0]["percentual_jornada"] == round(75 / 480 * 100, 2)

    periodo = c.client.get("/api/dashboard/por-periodo", headers=c.gerente, params=params).json()
    assert periodo["resumo"]["tempo_total_parado_min"] == 116
    assert periodo["resumo"]["qtd_paradas"] == 6  # a partida não entra
    assert periodo["por_endereco"][0]["endereco"] == "Av. João César, 1200"  # 50 + 26
    assert periodo["por_motorista"][0]["qtd_roteiros"] == 2


def test_recorte_por_dia_vincula_tempo_a_endereco_e_horario(cenario: Cenario):
    """Critério de aceitação 3: todo tempo parado exibido tem endereço e data/hora."""
    c = cenario
    _roteiro_com_tempos(c, date(2026, 9, 10), (10, 5, 26))
    dia = c.client.get("/api/dashboard/dia", headers=c.gerente, params={"data": "2026-09-10"}).json()
    com_tempo = [p for p in dia["paradas"] if p["tempo_parado_min"] is not None]
    assert len(com_tempo) == 3
    for parada in com_tempo:
        assert parada["endereco"] and parada["chegada_em"] and parada["saida_em"]
    assert dia["resumo"]["tempo_total_parado_min"] == 41


def test_dashboard_respeita_escopo_do_gerente(cenario: Cenario):
    c = cenario
    criar = c.client.post(
        "/api/roteiros",
        headers=c.admin,
        json={"data": "2026-09-10", "motorista_id": c.outro_motorista_id, "ponto_ids": c.pontos},
    )
    assert criar.status_code == 201
    resumo_gerente = c.client.get("/api/dashboard/resumo", headers=c.gerente, params={"inicio": "2026-09-01", "fim": "2026-09-30"}).json()
    resumo_admin = c.client.get("/api/dashboard/resumo", headers=c.admin, params={"inicio": "2026-09-01", "fim": "2026-09-30"}).json()
    assert resumo_gerente["qtd_roteiros"] == 0
    assert resumo_admin["qtd_roteiros"] == 1


def test_exportacao_csv(cenario: Cenario):
    c = cenario
    _roteiro_com_tempos(c, date(2026, 9, 10), (10, 5, 26))
    resp = c.client.get("/api/relatorios/paradas.csv", headers=c.gerente, params={"inicio": "2026-09-10", "fim": "2026-09-10"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    linhas = resp.content.decode("utf-8-sig").strip().splitlines()
    assert len(linhas) == 5  # cabeçalho + 4 pontos
    assert "(partida)" in linhas[1]
    assert linhas[2].endswith(";10,00")
