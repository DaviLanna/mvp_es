from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models import Perfil

# Validação simples de e-mail: aceita domínios internos (ex.: empresa.local), que o EmailStr rejeita.
Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]

class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Usuário / Auth ----------


class UsuarioOut(OrmModel):
    id: int
    nome: str
    email: str
    perfil: Perfil
    ativo: bool
    motorista_id: int | None = None
    gerente_id: int | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class UsuarioCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: Email
    senha: str = Field(min_length=6, max_length=72)
    perfil: Perfil = Perfil.ADMIN


class UsuarioUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    ativo: bool | None = None
    senha: str | None = Field(default=None, min_length=6, max_length=72)


# ---------- Gerente ----------


class GerenteBase(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    cargo: str = Field(default="Gerente", max_length=40)
    telefone: str | None = Field(default=None, max_length=30)
    email: Email


class GerenteCreate(GerenteBase):
    senha: str | None = Field(default=None, min_length=6, max_length=72, description="Cria acesso ao sistema com o e-mail informado")


class GerenteUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    cargo: str | None = Field(default=None, max_length=40)
    telefone: str | None = Field(default=None, max_length=30)
    email: Email | None = None


class GerenteOut(OrmModel):
    id: int
    nome: str
    cargo: str
    telefone: str | None
    email: str
    usuario_id: int | None
    qtd_motoristas: int = 0


# ---------- Motorista ----------


class MotoristaBase(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    telefone: str | None = Field(default=None, max_length=30)
    documento: str | None = Field(default=None, max_length=30)
    veiculo: str = Field(min_length=2, max_length=80)
    placa: str | None = Field(default=None, max_length=10)
    km_por_litro: float | None = Field(default=None, gt=0)
    gerente_id: int | None = None


class MotoristaCreate(MotoristaBase):
    email: Email | None = Field(default=None, description="E-mail de acesso (opcional)")
    senha: str | None = Field(default=None, min_length=6, max_length=72)


class MotoristaUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    telefone: str | None = Field(default=None, max_length=30)
    documento: str | None = Field(default=None, max_length=30)
    veiculo: str | None = Field(default=None, min_length=2, max_length=80)
    placa: str | None = Field(default=None, max_length=10)
    km_por_litro: float | None = Field(default=None, gt=0)
    gerente_id: int | None = None
    ativo: bool | None = None


class MotoristaOut(OrmModel):
    id: int
    nome: str
    telefone: str | None
    documento: str | None
    veiculo: str
    placa: str | None
    km_por_litro: float | None
    ativo: bool
    anonimizado_em: datetime | None
    gerente_id: int | None
    gerente_nome: str | None = None
    usuario_id: int | None
    email_acesso: str | None = None


# ---------- Ponto ----------


class PontoBase(BaseModel):
    descricao: str = Field(min_length=1, max_length=120)
    endereco: str = Field(min_length=3, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class PontoCreate(PontoBase):
    pass


class PontoUpdate(BaseModel):
    descricao: str | None = Field(default=None, min_length=1, max_length=120)
    endereco: str | None = Field(default=None, min_length=3, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    ativo: bool | None = None


class PontoOut(OrmModel):
    id: int
    descricao: str
    endereco: str
    latitude: float | None
    longitude: float | None
    ativo: bool


class GeocodeResultado(BaseModel):
    endereco: str
    latitude: float
    longitude: float


# ---------- Parâmetros ----------


class ParametroUpdate(BaseModel):
    valor_combustivel_litro: float | None = Field(default=None, gt=0)
    km_por_litro_padrao: float | None = Field(default=None, gt=0)
    custo_adicional_km: float | None = Field(default=None, ge=0)
    jornada_padrao_horas: float | None = Field(default=None, gt=0, le=24)
    tempo_minimo_parada_min: float | None = Field(default=None, ge=0)


class ParametroOut(OrmModel):
    valor_combustivel_litro: float
    km_por_litro_padrao: float
    custo_adicional_km: float
    jornada_padrao_horas: float
    tempo_minimo_parada_min: float
    custo_por_km_padrao: float
    atualizado_em: datetime | None


# ---------- Auditoria ----------


class AuditoriaOut(OrmModel):
    id: int
    usuario_email: str | None
    entidade: str
    entidade_id: int | None
    acao: str
    antes: dict | None
    depois: dict | None
    criado_em: datetime
