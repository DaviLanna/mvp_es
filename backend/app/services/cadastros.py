from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_senha
from app.models import Gerente, Motorista, Perfil, Usuario
from app.schemas.cadastros import GerenteOut, MotoristaOut, UsuarioOut
from app.services.lgpd import mascarar_documento
from app.services.roteiros import RegraNegocioError


def email_em_uso(db: Session, email: str, exceto_usuario_id: int | None = None) -> bool:
    stmt = select(Usuario.id).where(func.lower(Usuario.email) == email.lower())
    if exceto_usuario_id is not None:
        stmt = stmt.where(Usuario.id != exceto_usuario_id)
    return db.scalar(stmt) is not None


def criar_usuario(db: Session, *, nome: str, email: str, senha: str, perfil: Perfil) -> Usuario:
    if email_em_uso(db, email):
        raise RegraNegocioError(f"Já existe um usuário com o e-mail {email}.")
    usuario = Usuario(nome=nome, email=email.lower(), senha_hash=hash_senha(senha), perfil=perfil)
    db.add(usuario)
    db.flush()
    return usuario


def usuario_out(usuario: Usuario) -> UsuarioOut:
    return UsuarioOut(
        id=usuario.id,
        nome=usuario.nome,
        email=usuario.email,
        perfil=usuario.perfil,
        ativo=usuario.ativo,
        motorista_id=usuario.motorista.id if usuario.motorista else None,
        gerente_id=usuario.gerente.id if usuario.gerente else None,
    )


def gerente_out(gerente: Gerente) -> GerenteOut:
    return GerenteOut(
        id=gerente.id,
        nome=gerente.nome,
        cargo=gerente.cargo,
        telefone=gerente.telefone,
        email=gerente.email,
        usuario_id=gerente.usuario_id,
        qtd_motoristas=sum(1 for m in gerente.motoristas if m.ativo),
    )


def motorista_out(motorista: Motorista, visualizador: Usuario) -> MotoristaOut:
    """Admin vê o documento completo; os demais perfis veem o documento mascarado (LGPD)."""
    documento = motorista.documento
    if visualizador.perfil != Perfil.ADMIN:
        documento = mascarar_documento(documento)
    return MotoristaOut(
        id=motorista.id,
        nome=motorista.nome,
        telefone=motorista.telefone,
        documento=documento,
        veiculo=motorista.veiculo,
        placa=motorista.placa,
        km_por_litro=motorista.km_por_litro,
        ativo=motorista.ativo,
        anonimizado_em=motorista.anonimizado_em,
        gerente_id=motorista.gerente_id,
        gerente_nome=motorista.gerente.nome if motorista.gerente else None,
        usuario_id=motorista.usuario_id,
        email_acesso=motorista.usuario.email if motorista.usuario else None,
    )
