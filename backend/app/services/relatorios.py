"""Exportação CSV (RF12) no formato do Excel pt-BR: separador ';', vírgula decimal e BOM UTF-8."""

import csv
import io
from collections.abc import Iterable, Sequence
from datetime import datetime

from app.core.config import settings
from app.schemas.roteiros import HistoricoItem, RoteiroResumo


def _num(valor: float | None, casas: int = 2) -> str:
    return "" if valor is None else f"{valor:.{casas}f}".replace(".", ",")


def _data_hora(valor: datetime | None) -> str:
    return "" if valor is None else valor.astimezone(settings.tz).strftime("%d/%m/%Y %H:%M")


def _gerar(cabecalho: Sequence[str], linhas: Iterable[Sequence[str]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(cabecalho)
    writer.writerows(linhas)
    return "﻿" + buffer.getvalue()


def csv_paradas(itens: Iterable[HistoricoItem]) -> str:
    return _gerar(
        ["Data", "Motorista", "Roteiro", "Ordem", "Ponto", "Endereço", "Chegada", "Saída", "Tempo parado (min)"],
        (
            [
                i.data.strftime("%d/%m/%Y"),
                i.motorista_nome,
                i.roteiro_nome or f"#{i.roteiro_id}",
                str(i.ordem),
                i.ponto_descricao + (" (partida)" if i.eh_partida else ""),
                i.endereco,
                _data_hora(i.chegada_em),
                _data_hora(i.saida_em),
                "" if i.eh_partida else _num(i.tempo_parado_min),
            ]
            for i in itens
        ),
    )


def csv_roteiros(roteiros: Iterable[RoteiroResumo]) -> str:
    return _gerar(
        ["Data", "Roteiro", "Motorista", "Status", "Pontos", "Distância (km)", "Tempo parado (min)", "Custo estimado (R$)"],
        (
            [
                r.data.strftime("%d/%m/%Y"),
                r.nome or f"#{r.id}",
                r.motorista_nome,
                r.status.value,
                str(r.qtd_pontos),
                _num(r.distancia_total_km),
                _num(r.tempo_total_parado_min),
                _num(r.custo_estimado),
            ]
            for r in roteiros
        ),
    )
