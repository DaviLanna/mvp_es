from collections.abc import Iterator
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import hash_senha
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Gerente, Motorista, Parametro, Perfil, Ponto, Usuario

engine = create_engine(settings.test_database_url)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
def _schema() -> Iterator[None]:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _limpar_tabelas() -> Iterator[None]:
    yield
    tabelas = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tabelas} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db() -> Iterator[Session]:
    with TestingSession() as session:
        yield session


@pytest.fixture
def client() -> Iterator[TestClient]:
    def _get_db() -> Iterator[Session]:
        with TestingSession() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@dataclass
class Cenario:
    client: TestClient
    admin: dict[str, str]
    gerente: dict[str, str]
    motorista: dict[str, str]
    outro_motorista: dict[str, str]
    motorista_id: int
    outro_motorista_id: int
    pontos: list[int]


def _login(client: TestClient, email: str, senha: str) -> dict[str, str]:
    resp = client.post("/api/auth/login", data={"username": email, "password": senha})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def cenario(client: TestClient, db: Session) -> Cenario:
    """Admin, um gerente com um motorista na equipe e outro motorista fora da equipe."""
    db.add(Parametro(id=1, valor_combustivel_litro=6.0, km_por_litro_padrao=10.0, custo_adicional_km=0.2))

    def usuario(email: str, perfil: Perfil) -> Usuario:
        u = Usuario(nome=email.split("@")[0], email=email, senha_hash=hash_senha("senha123"), perfil=perfil)
        db.add(u)
        return u

    usuario("admin@t.local", Perfil.ADMIN)
    gerente = Gerente(nome="Gerente", email="gerente@t.local", usuario=usuario("gerente@t.local", Perfil.GERENTE))
    motorista = Motorista(
        nome="Motorista Equipe", documento="123.456.789-01", telefone="(31) 90000-0000", veiculo="Moto",
        km_por_litro=30.0, gerente=gerente, usuario=usuario("moto@t.local", Perfil.MOTORISTA),
    )
    outro = Motorista(
        nome="Motorista Fora", veiculo="Carro", usuario=usuario("outro@t.local", Perfil.MOTORISTA)
    )
    pontos = [
        Ponto(descricao="Base", endereco="Av. Amazonas, 5855", latitude=-19.9380, longitude=-43.9900),
        Ponto(descricao="Cliente A", endereco="Rua Peru, 55", latitude=-19.9535, longitude=-43.9330),
        Ponto(descricao="Cliente B", endereco="Rua X, 5", latitude=-19.9275, longitude=-43.9520),
        Ponto(descricao="Cliente C", endereco="Av. João César, 1200", latitude=-19.9245, longitude=-44.0513),
    ]
    db.add_all([gerente, motorista, outro, *pontos])
    db.commit()

    return Cenario(
        client=client,
        admin=_login(client, "admin@t.local", "senha123"),
        gerente=_login(client, "gerente@t.local", "senha123"),
        motorista=_login(client, "moto@t.local", "senha123"),
        outro_motorista=_login(client, "outro@t.local", "senha123"),
        motorista_id=motorista.id,
        outro_motorista_id=outro.id,
        pontos=[p.id for p in pontos],
    )
