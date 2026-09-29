from functools import lru_cache
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://mvp:mvp@localhost:5435/mvp"
    test_database_url: str = "postgresql+psycopg://mvp:mvp@localhost:5435/mvp_test"
    jwt_secret: str = "troque-este-segredo-por-um-valor-longo-e-aleatorio"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 720
    tz_local: str = "America/Sao_Paulo"
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    nominatim_user_agent: str = "mvp-tempo-parado/0.1"

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.tz_local)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
