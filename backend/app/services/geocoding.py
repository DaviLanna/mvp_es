"""Geocodificação de endereços via Nominatim (OpenStreetMap).

A política de uso do Nominatim exige no máximo 1 requisição por segundo e um User-Agent
identificável, por isso as chamadas são serializadas.
"""

import threading
import time

import httpx

from app.core.config import settings
from app.schemas.cadastros import GeocodeResultado

_lock = threading.Lock()
_ultima_chamada = 0.0


class GeocodingError(Exception):
    pass


def geocodificar(endereco: str, limite: int = 5) -> list[GeocodeResultado]:
    global _ultima_chamada
    with _lock:
        espera = 1.0 - (time.monotonic() - _ultima_chamada)
        if espera > 0:
            time.sleep(espera)
        try:
            resposta = httpx.get(
                settings.nominatim_url,
                params={"q": endereco, "format": "jsonv2", "limit": limite, "countrycodes": "br"},
                headers={"User-Agent": settings.nominatim_user_agent, "Accept-Language": "pt-BR"},
                timeout=10,
            )
            resposta.raise_for_status()
        except httpx.HTTPError as exc:
            raise GeocodingError(f"Falha ao consultar o serviço de geocodificação: {exc}") from exc
        finally:
            _ultima_chamada = time.monotonic()

    return [
        GeocodeResultado(endereco=item["display_name"], latitude=float(item["lat"]), longitude=float(item["lon"]))
        for item in resposta.json()
    ]
