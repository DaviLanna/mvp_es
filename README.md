# MVP — Monitoramento de Tempo Parado em Roteiros

Engenharia de Software II (PUC Minas) — 2º trabalho. Mede quanto tempo o motorista/motoboy fica parado em cada ponto do roteiro diário, mostra um dashboard por dia/mês/período e calcula o custo do trajeto.

| Camada | Tecnologias |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16 |
| Frontend | React 19, Vite, TypeScript, Tailwind v4, shadcn/ui, Recharts, TanStack Query |

## Como rodar

Pré-requisitos: Docker, Python 3.12+ e Node 20.19+.

```bash
# 1) Banco (Postgres na porta 5435 do host)
docker compose up -d db

# 2) Backend — http://localhost:8000/docs
cd backend
python -m venv .venv
.venv/Scripts/activate        # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # se ainda não existir
alembic upgrade head
python -m app.seed            # dados de demonstração (--reset para recriar)
uvicorn app.main:app --reload

# 3) Frontend — http://localhost:5173
cd frontend
npm install
npm run dev
```

O Vite encaminha `/api` para `localhost:8000`.

### Acessos de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@mvp.local | admin123 |
| Gerente (equipe: João, Ana, Marcos) | gerente@mvp.local | gerente123 |
| Motorista | joao@mvp.local (também ana, marcos, lucas) | motorista123 |

O seed cria cerca de 12 meses de histórico, os roteiros A, B e C do enunciado (com data de ontem) e dois roteiros de hoje: um planejado para o João e um em andamento para a Ana.

## Testes

```bash
cd backend && pytest        # usa o banco mvp_test (criado pelo docker compose)
cd frontend && npm run build
```

## Regras de negócio implementadas

- **RN01/RN02**: o ponto de partida não conta tempo parado. Nos demais, tempo parado = saída − chegada.
- **RN03**: o tempo total do roteiro é a soma dos pontos, exceto a partida.
- **RN04**: o % da jornada é calculado como tempo parado ÷ (dias trabalhados × jornada padrão de 8 h).
- **RN05/RN06**: cada roteiro tem um motorista, uma data e pontos em ordem sequencial.
- **RN07**: custo = distância × (combustível ÷ km/l + custo adicional por km).

As regras ficam em [backend/app/services/calculo.py](backend/app/services/calculo.py). Os parâmetros são editáveis na tela **Parâmetros**, sem mudar código.

## Estrutura

```
backend/app/
  api/        rotas REST (/api/...)
  models/     SQLAlchemy (usuario, gerente, motorista, ponto, roteiro, ponto_roteiro, parametro, auditoria)
  services/   calculo, roteiros (montagem/coleta), consultas (histórico/dashboard), auditoria, lgpd, relatorios, geocoding
  seed.py     dados de demonstração
frontend/src/
  pages/      Dashboard, Coleta (Minha rota), Histórico, Roteiros, Pontos, Motoristas, Gerentes, Parâmetros, Usuários, Auditoria
  lib/        cliente da API, autenticação, formatação
```
