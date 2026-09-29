from tests.conftest import Cenario


def test_sem_token_retorna_401(cenario: Cenario):
    assert cenario.client.get("/api/roteiros").status_code == 401
    resp = cenario.client.get("/api/roteiros", headers={"Authorization": "Bearer invalido"})
    assert resp.status_code == 401


def test_login_invalido(cenario: Cenario):
    resp = cenario.client.post("/api/auth/login", data={"username": "admin@t.local", "password": "errada"})
    assert resp.status_code == 401


def test_motorista_nao_acessa_areas_de_gestao(cenario: Cenario):
    c = cenario
    for url in ("/api/dashboard/resumo", "/api/motoristas", "/api/pontos", "/api/auditoria", "/api/usuarios"):
        assert c.client.get(url, headers=c.motorista).status_code == 403, url


def test_gerente_ve_somente_a_propria_equipe(cenario: Cenario):
    c = cenario
    motoristas = c.client.get("/api/motoristas", headers=c.gerente).json()
    assert [m["id"] for m in motoristas] == [c.motorista_id]
    assert c.client.get(f"/api/motoristas/{c.outro_motorista_id}", headers=c.gerente).status_code == 403
    todos = c.client.get("/api/motoristas", headers=c.admin).json()
    assert len(todos) == 2


def test_somente_admin_altera_parametros_e_ve_auditoria(cenario: Cenario):
    c = cenario
    assert c.client.put("/api/parametros", headers=c.gerente, json={"jornada_padrao_horas": 6}).status_code == 403
    assert c.client.get("/api/parametros", headers=c.gerente).status_code == 200
    assert c.client.get("/api/auditoria", headers=c.gerente).status_code == 403
    assert c.client.put("/api/parametros", headers=c.admin, json={"jornada_padrao_horas": 6}).status_code == 200


def test_documento_mascarado_para_gerente_e_completo_para_admin(cenario: Cenario):
    c = cenario
    gerente_ve = c.client.get(f"/api/motoristas/{c.motorista_id}", headers=c.gerente).json()
    admin_ve = c.client.get(f"/api/motoristas/{c.motorista_id}", headers=c.admin).json()
    assert gerente_ve["documento"] == "***.***.*89-01"
    assert admin_ve["documento"] == "123.456.789-01"


def test_anonimizacao_lgpd_remove_dados_e_bloqueia_acesso(cenario: Cenario):
    c = cenario
    assert c.client.post(f"/api/motoristas/{c.motorista_id}/anonimizar", headers=c.gerente).status_code == 403
    resp = c.client.post(f"/api/motoristas/{c.motorista_id}/anonimizar", headers=c.admin)
    assert resp.status_code == 200
    dados = resp.json()
    assert dados["documento"] is None and dados["telefone"] is None and not dados["ativo"]
    assert "anonimizado" in dados["nome"].lower()
    login = c.client.post("/api/auth/login", data={"username": "moto@t.local", "password": "senha123"})
    assert login.status_code == 401


def test_gerente_cadastra_motorista_na_propria_equipe_com_acesso(cenario: Cenario):
    c = cenario
    resp = c.client.post(
        "/api/motoristas",
        headers=c.gerente,
        json={"nome": "Novo", "veiculo": "Moto", "email": "novo@t.local", "senha": "senha123"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["gerente_nome"] == "Gerente"
    login = c.client.post("/api/auth/login", data={"username": "novo@t.local", "password": "senha123"})
    assert login.json()["usuario"]["perfil"] == "MOTORISTA"
