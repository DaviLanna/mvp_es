from datetime import date, timedelta

from fastapi import HTTPException, status

from app.services.roteiros import hoje_local

MAX_DIAS_CONSULTA = 740  # ~24 meses


def intervalo(inicio: date | None, fim: date | None, dias_padrao: int = 30) -> tuple[date, date]:
    fim = fim or hoje_local()
    inicio = inicio or fim - timedelta(days=dias_padrao - 1)
    if inicio > fim:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A data inicial deve ser anterior à final.")
    if (fim - inicio).days > MAX_DIAS_CONSULTA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Período máximo de consulta: 24 meses.")
    return inicio, fim


def nao_encontrado(entidade: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{entidade} não encontrado(a).")
