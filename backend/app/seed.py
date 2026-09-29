"""Popula o banco com dados de demonstração.

Uso:
    python -m app.seed           # só popula se o banco estiver vazio
    python -m app.seed --reset   # apaga tudo e popula de novo
"""

import random
import sys
from datetime import date, datetime, time, timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_senha
from app.db.session import SessionLocal
from app.models import Gerente, Motorista, Parametro, Perfil, Ponto, PontoRoteiro, Roteiro, Usuario
from app.services import calculo
from app.services.auditoria import INFO_DESATIVADA
from app.services.roteiros import atualizar_status, recalcular_roteiro

TZ = settings.tz
DIAS_HISTORICO = 365

# (descrição, endereço, lat, lng, faixa de minutos parados típica)
PONTOS = [
    ("Base — Seg. Família", "Av. Amazonas, 5855 - Gameleira, Belo Horizonte - MG", -19.9380, -43.9900, (0, 0)),
    ("Cliente Rua Peru", "Rua Peru, 55 - Sion, Belo Horizonte - MG", -19.9535, -43.9330, (8, 20)),
    ("Cliente Rua X", "Rua X, 5 - Centro, Belo Horizonte - MG", -19.9275, -43.9520, (5, 15)),
    ("Av. João César", "Av. João César de Oliveira, 1200 - Eldorado, Contagem - MG", -19.9245, -44.0513, (20, 55)),
    ("Mercado Central", "Av. Augusto de Lima, 744 - Centro, Belo Horizonte - MG", -19.9230, -43.9436, (15, 35)),
    ("CeasaMinas", "BR-040, km 688 - Guanabara, Contagem - MG", -19.8835, -44.0520, (30, 70)),
    ("Shopping Del Rey", "Av. Pres. Carlos Luz, 3001 - Caiçara, Belo Horizonte - MG", -19.8716, -43.9772, (10, 25)),
    ("Savassi", "Praça Diogo de Vasconcelos - Savassi, Belo Horizonte - MG", -19.9387, -43.9336, (5, 15)),
    ("BH Shopping", "Rod. BR-356, 3049 - Belvedere, Belo Horizonte - MG", -19.9765, -43.9447, (12, 30)),
    ("Hospital Odilon Behrens", "R. Formiga, 50 - São Cristóvão, Belo Horizonte - MG", -19.8995, -43.9425, (20, 45)),
    ("Barreiro", "Av. Afonso Vaz de Melo, 640 - Barreiro, Belo Horizonte - MG", -19.9763, -44.0249, (8, 22)),
    ("Venda Nova", "R. Padre Pedro Pinto, 1300 - Venda Nova, Belo Horizonte - MG", -19.8174, -43.9540, (6, 18)),
    ("Estação Eldorado", "Av. João César de Oliveira, 5 - Eldorado, Contagem - MG", -19.9387, -44.0343, (5, 12)),
    ("PUC Minas Coração Eucarístico", "Av. Dom José Gaspar, 500 - Coração Eucarístico, Belo Horizonte - MG", -19.9227, -43.9927, (5, 15)),
]

# Exemplo do enunciado: minutos parados nos pontos 2, 3 e 4 (o ponto 1 é a partida)
EXEMPLO_ENUNCIADO = {
    "Roteiro A": ["Cliente Rua Peru", "Cliente Rua X", "Av. João César", [15, 10, 50]],
    "Roteiro B": ["Mercado Central", "Savassi", "BH Shopping", [10, 5, 26]],
    "Roteiro C": ["Barreiro", "Estação Eldorado", "CeasaMinas", [5, 10, 30]],
}


def _local(dia: date, hora: time) -> datetime:
    return datetime.combine(dia, hora, TZ)


def _minutos_viagem(a: Ponto, b: Ponto, rng: random.Random) -> float:
    km = calculo.haversine_km(a.latitude, a.longitude, b.latitude, b.longitude) * 1.4
    return max(5.0, km / 25 * 60 * rng.uniform(0.8, 1.4))


def _preencher_horarios(
    roteiro: Roteiro, rng: random.Random, paradas_min: list[float], ate_ordem: int | None = None
) -> None:
    """Simula a coleta: saída da partida, depois chegada/saída em cada ponto."""
    paradas = sorted(roteiro.paradas, key=lambda p: p.ordem)
    momento = _local(roteiro.data, time(7, 30)) + timedelta(minutes=rng.randint(0, 60))
    for i, parada in enumerate(paradas):
        if ate_ordem is not None and parada.ordem > ate_ordem:
            break
        if i == 0:
            parada.saida_em = momento
            continue
        momento += timedelta(minutes=_minutos_viagem(paradas[i - 1].ponto, parada.ponto, rng))
        parada.chegada_em = momento
        momento += timedelta(minutes=paradas_min[i - 1])
        parada.saida_em = momento


def _novo_roteiro(nome: str | None, dia: date, motorista: Motorista, pontos: list[Ponto]) -> Roteiro:
    roteiro = Roteiro(nome=nome, data=dia, motorista=motorista)
    for ordem, ponto in enumerate(pontos, start=1):
        roteiro.paradas.append(PontoRoteiro(ordem=ordem, ponto=ponto))
    return roteiro


def limpar(db: Session) -> None:
    tabelas = "auditoria, ponto_roteiro, roteiro, ponto, motorista, gerente, usuario, parametro"
    db.execute(text(f"TRUNCATE {tabelas} RESTART IDENTITY CASCADE"))
    db.commit()


def popular(db: Session) -> None:
    rng = random.Random(42)
    db.info[INFO_DESATIVADA] = True

    parametros = Parametro(
        id=1, valor_combustivel_litro=6.29, km_por_litro_padrao=10.0, custo_adicional_km=0.15,
        jornada_padrao_horas=8.0, tempo_minimo_parada_min=0.0,
    )
    db.add(parametros)

    def usuario(nome: str, email: str, senha: str, perfil: Perfil) -> Usuario:
        u = Usuario(nome=nome, email=email, senha_hash=hash_senha(senha), perfil=perfil)
        db.add(u)
        return u

    usuario("Administrador", "admin@mvp.local", "admin123", Perfil.ADMIN)
    carla = Gerente(
        nome="Carla Souza", cargo="Coordenadora", telefone="(31) 98888-1000", email="gerente@mvp.local",
        usuario=usuario("Carla Souza", "gerente@mvp.local", "gerente123", Perfil.GERENTE),
    )
    roberto = Gerente(
        nome="Roberto Lima", cargo="Dono da transportadora", telefone="(31) 97777-2000",
        email="roberto@transportadora.local",
    )
    db.add_all([carla, roberto])

    dados_motoristas = [
        ("João Pereira", "joao", "123.456.789-01", "Moto Honda CG 160", "QWE1A23", 38.0, carla),
        ("Ana Ribeiro", "ana", "234.567.890-12", "Fiat Fiorino", "RTY2B34", 11.0, carla),
        ("Marcos Tavares", "marcos", "345.678.901-23", "VW Delivery 9.170", "UIO3C45", 7.0, carla),
        ("Lucas Almeida", "lucas", "456.789.012-34", "Moto Yamaha Factor 150", "PAS4D56", 35.0, roberto),
    ]
    motoristas: list[Motorista] = []
    for i, (nome, login, doc, veiculo, placa, kml, gerente) in enumerate(dados_motoristas):
        m = Motorista(
            nome=nome, telefone=f"(31) 9{i + 1}{i + 1}{i + 1}{i + 1}-000{i}", documento=doc, veiculo=veiculo,
            placa=placa, km_por_litro=kml, gerente=gerente,
            usuario=usuario(nome, f"{login}@mvp.local", "motorista123", Perfil.MOTORISTA),
        )
        motoristas.append(m)
    db.add_all(motoristas)

    pontos = {d: Ponto(descricao=d, endereco=e, latitude=lat, longitude=lng) for d, e, lat, lng, _ in PONTOS}
    faixas = {d: faixa for d, *_, faixa in PONTOS}
    db.add_all(pontos.values())
    db.flush()

    base = pontos["Base — Seg. Família"]
    destinos = [p for d, p in pontos.items() if p is not base]
    hoje = datetime.now(TZ).date()
    ontem = hoje - timedelta(days=1)
    roteiros: list[Roteiro] = []

    # 1) Histórico sintético (segunda a sábado) — alimenta o dashboard
    for delta in range(DIAS_HISTORICO, 1, -1):
        dia = hoje - timedelta(days=delta)
        if dia.weekday() == 6:
            continue
        for motorista in motoristas:
            if rng.random() < 0.08:  # folgas/faltas
                continue
            escolhidos = rng.sample(destinos, rng.randint(3, 7))
            roteiro = _novo_roteiro(None, dia, motorista, [base, *escolhidos])
            sazonal = 1.15 if dia.month in (11, 12) else 1.0  # fim de ano mais carregado
            minutos = [rng.uniform(*faixas[p.descricao]) * sazonal for p in escolhidos]
            _preencher_horarios(roteiro, rng, minutos)
            roteiros.append(roteiro)

    # 2) Roteiros A, B e C do enunciado (ontem)
    for (nome, (p2, p3, p4, minutos)), motorista in zip(EXEMPLO_ENUNCIADO.items(), motoristas):
        roteiro = _novo_roteiro(nome, ontem, motorista, [base, pontos[p2], pontos[p3], pontos[p4]])
        _preencher_horarios(roteiro, rng, minutos)
        roteiros.append(roteiro)

    # 3) Roteiros de hoje: um planejado (para testar a coleta) e um em andamento
    roteiros.append(
        _novo_roteiro("Roteiro do dia", hoje, motoristas[0],
                      [base, pontos["Cliente Rua Peru"], pontos["Mercado Central"], pontos["Savassi"], pontos["CeasaMinas"]])
    )
    em_andamento = _novo_roteiro("Entregas manhã", hoje, motoristas[1],
                                 [base, pontos["Shopping Del Rey"], pontos["Venda Nova"], pontos["Hospital Odilon Behrens"]])
    _preencher_horarios(em_andamento, rng, [18, 0, 0], ate_ordem=2)
    roteiros.append(em_andamento)

    for roteiro in roteiros:
        atualizar_status(roteiro)
        recalcular_roteiro(db, roteiro, parametros)
    db.add_all(roteiros)
    db.commit()
    db.info.pop(INFO_DESATIVADA, None)

    print(f"Seed concluído: {len(roteiros)} roteiros, {len(pontos)} pontos, {len(motoristas)} motoristas.")
    print("Acessos: admin@mvp.local/admin123 · gerente@mvp.local/gerente123 · joao@mvp.local/motorista123")


def main() -> None:
    with SessionLocal() as db:
        if "--reset" in sys.argv:
            limpar(db)
        elif db.scalar(select(Usuario.id).limit(1)) is not None:
            print("Banco já populado. Use --reset para recriar os dados de demonstração.")
            return
        popular(db)


if __name__ == "__main__":
    main()
