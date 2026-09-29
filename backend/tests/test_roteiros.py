from datetime import date

from app.services.roteiros import hoje_local
from tests.conftest import Cenario


def criar_roteiro(c: Cenario, data: date | None = None, motorista_id: int | None = None) -> dict:
    resp = c.client.post(
        "/api/roteiros",
        headers=c.gerente,
        json={
            "nome": "Teste",
            "data": (data or hoje_local()).isoformat(),
            "motorista_id": motorista_id or c.motorista_id,
            "ponto_ids": c.pontos,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def corrigir(c: Cenario, roteiro_id: int, parada_id: int, **horarios: str):
    return c.client.put(f"/api/roteiros/{roteiro_id}/paradas/{parada_id}", headers=c.gerente, json=horarios)


def test_montar_roteiro_com_pontos_em_ordem(cenario: Cenario):
    roteiro = criar_roteiro(cenario)
    assert roteiro["status"] == "PLANEJADO"
    assert [p["ordem"] for p in roteiro["paradas"]] == [1, 2, 3, 4]
    assert [p["ponto_id"] for p in roteiro["paradas"]] == cenario.pontos
    assert roteiro["paradas"][0]["eh_partida"] is True
    assert roteiro["distancia_total_km"] > 0
    # custo = distância × (6,00 / 30 km/l + 0,20)
    assert roteiro["custo_estimado"] == round(roteiro["distancia_total_km"] * 0.4, 2)


def test_fluxo_de_coleta_do_motorista(cenario: Cenario):
    c = cenario
    roteiro = criar_roteiro(c)
    rid, paradas = roteiro["id"], roteiro["paradas"]
    url = lambda i, acao: f"/api/roteiros/{rid}/paradas/{paradas[i]['id']}/{acao}"  # noqa: E731

    # não pode chegar no ponto 2 sem ter saído da partida
    resp = c.client.post(url(1, "chegada"), headers=c.motorista, json={})
    assert resp.status_code == 400

    # partida não tem chegada
    assert c.client.post(url(0, "chegada"), headers=c.motorista, json={}).status_code == 400

    resp = c.client.post(url(0, "saida"), headers=c.motorista, json={"lat": -19.93, "lng": -43.99})
    assert resp.status_code == 200
    assert resp.json()["status"] == "EM_ANDAMENTO"

    for i in (1, 2, 3):
        assert c.client.post(url(i, "chegada"), headers=c.motorista, json={}).status_code == 200
        resp = c.client.post(url(i, "saida"), headers=c.motorista, json={})
        assert resp.status_code == 200, resp.text

    final = resp.json()
    assert final["status"] == "CONCLUIDO"
    assert final["paradas"][0]["tempo_parado_min"] is None
    assert all(p["tempo_parado_min"] is not None for p in final["paradas"][1:])
    assert final["paradas"][0]["saida_lat"] == -19.93

    # roteiro concluído não aceita mais registros
    assert c.client.post(url(3, "saida"), headers=c.motorista, json={}).status_code == 400


def test_correcao_de_horarios_calcula_tempo_e_gera_auditoria(cenario: Cenario):
    c = cenario
    roteiro = criar_roteiro(c)
    rid, p = roteiro["id"], roteiro["paradas"]
    dia = roteiro["data"]

    assert corrigir(c, rid, p[0]["id"], saida_em=f"{dia}T08:00:00-03:00").status_code == 200
    assert corrigir(c, rid, p[1]["id"], chegada_em=f"{dia}T08:20:00-03:00", saida_em=f"{dia}T08:35:00-03:00").status_code == 200
    resp = corrigir(c, rid, p[2]["id"], chegada_em=f"{dia}T09:00:00-03:00", saida_em=f"{dia}T09:10:00-03:00")
    assert resp.status_code == 200

    detalhe = resp.json()
    assert [x["tempo_parado_min"] for x in detalhe["paradas"]] == [None, 15, 10, None]
    assert detalhe["tempo_total_parado_min"] == 25
    assert detalhe["percentual_jornada"] == round(25 / 480 * 100, 2)

    auditoria = c.client.get(
        "/api/auditoria", headers=c.admin, params={"entidade": "ponto_roteiro", "entidade_id": p[1]["id"]}
    ).json()
    atualizacoes = [a for a in auditoria["items"] if a["acao"] == "UPDATE"]
    assert atualizacoes and atualizacoes[0]["usuario_email"] == "gerente@t.local"
    assert "chegada_em" in atualizacoes[0]["depois"]


def test_horarios_fora_de_ordem_sao_rejeitados(cenario: Cenario):
    c = cenario
    roteiro = criar_roteiro(c)
    rid, p, dia = roteiro["id"], roteiro["paradas"], roteiro["data"]
    corrigir(c, rid, p[0]["id"], saida_em=f"{dia}T08:00:00-03:00")
    resp = corrigir(c, rid, p[1]["id"], chegada_em=f"{dia}T07:50:00-03:00")
    assert resp.status_code == 400
    resp = corrigir(c, rid, p[1]["id"], chegada_em=f"{dia}T08:30:00-03:00", saida_em=f"{dia}T08:10:00-03:00")
    assert resp.status_code == 400


def test_motorista_nao_registra_coleta_de_outro_motorista_nem_de_outro_dia(cenario: Cenario):
    c = cenario
    roteiro = criar_roteiro(c)
    url = f"/api/roteiros/{roteiro['id']}/paradas/{roteiro['paradas'][0]['id']}/saida"
    assert c.client.post(url, headers=c.outro_motorista, json={}).status_code == 403

    passado = criar_roteiro(c, data=date(2026, 1, 5))
    url = f"/api/roteiros/{passado['id']}/paradas/{passado['paradas'][0]['id']}/saida"
    assert c.client.post(url, headers=c.motorista, json={}).status_code == 400


def test_reordenar_so_antes_da_coleta_e_remover_renumera(cenario: Cenario):
    c = cenario
    roteiro = criar_roteiro(c)
    rid = roteiro["id"]
    pontos = c.pontos

    resp = c.client.put(f"/api/roteiros/{rid}", headers=c.gerente, json={"ponto_ids": [pontos[0], pontos[3], pontos[1]]})
    assert resp.status_code == 200
    assert [x["ponto_id"] for x in resp.json()["paradas"]] == [pontos[0], pontos[3], pontos[1]]

    paradas = resp.json()["paradas"]
    resp = c.client.delete(f"/api/roteiros/{rid}/paradas/{paradas[1]['id']}", headers=c.gerente)
    assert [(x["ordem"], x["ponto_id"]) for x in resp.json()["paradas"]] == [(1, pontos[0]), (2, pontos[1])]

    # com a coleta iniciada não é possível reordenar
    c.client.post(f"/api/roteiros/{rid}/paradas/{paradas[0]['id']}/saida", headers=c.motorista, json={})
    resp = c.client.put(f"/api/roteiros/{rid}", headers=c.gerente, json={"ponto_ids": [pontos[1], pontos[0]]})
    assert resp.status_code == 400


def test_parametros_alteram_custo_sem_mudar_codigo(cenario: Cenario):
    """Critério de aceitação 4: custo e jornada parametrizáveis."""
    c = cenario
    roteiro = criar_roteiro(c)
    custo_antes = roteiro["custo_estimado"]

    resp = c.client.put("/api/parametros", headers=c.admin, json={"valor_combustivel_litro": 12.0, "jornada_padrao_horas": 6})
    assert resp.status_code == 200
    assert resp.json()["custo_por_km_padrao"] == round(12.0 / 10 + 0.2, 4)

    depois = c.client.post(f"/api/roteiros/{roteiro['id']}/recalcular", headers=c.gerente).json()
    assert depois["custo_estimado"] > custo_antes
    assert depois["custo_por_km"] == round(12.0 / 30 + 0.2, 4)
    assert depois["jornada_padrao_horas"] == 6
