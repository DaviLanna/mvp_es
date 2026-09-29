from fastapi import APIRouter, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    auditoria,
    auth,
    coleta,
    dashboard,
    gerentes,
    historico,
    motoristas,
    parametros,
    pontos,
    relatorios,
    roteiros,
    usuarios,
)
from app.services import auditoria as _registro_auditoria  # noqa: F401  (registra o listener)
from app.services.roteiros import RegraNegocioError

app = FastAPI(
    title="MVP — Monitoramento de Tempo Parado em Roteiros",
    version="0.1.0",
    description="API do MVP de Engenharia de Software II (PUC Minas).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RegraNegocioError)
def _regra_negocio(_: Request, exc: RegraNegocioError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)})


api = APIRouter(prefix="/api")


@api.get("/health", tags=["Infra"])
def health() -> dict[str, str]:
    return {"status": "ok"}


for modulo in (
    auth,
    usuarios,
    gerentes,
    motoristas,
    pontos,
    parametros,
    roteiros,
    coleta,
    historico,
    dashboard,
    relatorios,
    auditoria,
):
    api.include_router(modulo.router)

app.include_router(api)
