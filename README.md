# MVP — PontoaPonto

Engenharia de Software II (PUC Minas) — 2º trabalho.
Mede quanto tempo o motorista/motoboy fica parado em cada ponto do roteiro diário, mostra um dashboard por dia/mês/período e calcula o custo do trajeto.

| Camada | Tecnologias |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16 |
| Frontend | React 19, Vite, TypeScript, Tailwind v4, shadcn/ui, Recharts, TanStack Query |

## Pré-requisitos

Instale na sua máquina:

| Ferramenta | Versão | Para quê | Onde baixar |
|---|---|---|---|
| **Git** | qualquer recente | clonar o repositório | https://git-scm.com/downloads |
| **Docker Desktop** (Windows/macOS) ou Docker Engine + Compose (Linux) | recente | roda o banco PostgreSQL | https://www.docker.com/products/docker-desktop |
| **Python** | 3.12 ou mais | backend (API) | https://www.python.org/downloads (no Windows, marque *Add python.exe to PATH*) |
| **Node.js** (já vem com o npm) | 20.19+ ou 22.12+ | frontend | https://nodejs.org (versão LTS) |

> ⚠️ **O Docker precisa estar instalado e rodando** antes de qualquer comando. No Windows/macOS, abra o
> Docker Desktop e espere aparecer *Engine running* (ícone verde). Sem isso, o banco não sobe e a API não
> inicia. No Windows, o instalador do Docker Desktop pede para ativar o WSL 2; aceite e reinicie se ele pedir.

Não é preciso instalar o PostgreSQL: ele roda dentro do Docker, na porta **5435**, e não conflita com um
Postgres local nas portas 5432 e 5433. Também precisam estar livres as portas **8000** (API) e **5173** (app).
Na primeira instalação é preciso internet, para baixar pacotes do pip e do npm e a imagem do Postgres.

### Conferir se está tudo instalado

```powershell
git --version
docker --version
docker info          # se der "error during connect", o Docker Desktop não está aberto
python --version     # 3.12 ou mais
node --version       # v20.19+ ou v22.12+
npm --version
```

## Como rodar

Os comandos abaixo são para o PowerShell (Windows). No macOS/Linux, use `python3`, ative o venv com
`source .venv/bin/activate` e copie o `.env` com `cp .env.example .env`.

**Primeira vez (instalação):**

```powershell
git clone https://github.com/DaviLanna/mvp_es.git
cd mvp_es

docker compose up -d db                  # Postgres na porta 5435 do host

cd backend
python -m venv .venv                     # só na primeira vez (falha se o venv já estiver ativo)
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
alembic upgrade head
python -m app.seed                       # dados de demonstração (--reset para recriar)

cd ..\frontend
npm install
cd ..
```

**Para rodar (dois terminais, porque cada servidor fica ocupando o seu):**

```powershell
# Terminal 1 — API em http://localhost:8000/docs
docker compose up -d db
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

```powershell
# Terminal 2 — app em http://localhost:5173
cd frontend
npm run dev
```

O Vite encaminha `/api` para `localhost:8000`. Abra http://localhost:5173 e entre com um dos acessos abaixo.

### Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `error during connect ... dockerDesktopLinuxEngine` | O Docker Desktop não está aberto. Abra-o, espere *Engine running* e repita o comando. |
| `alembic upgrade head` trava ou dá erro de conexão | O banco não subiu. Rode `docker compose ps`: o `mvp_es_db` precisa estar `healthy`. |
| `Activate.ps1 não pode ser carregado` | Política do PowerShell. Rode `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` e ative de novo. |
| `Permission denied ... python.exe` ao criar o venv | O venv já existe e está ativo. Pule o `python -m venv .venv`. |
| `npm error enoent ... package.json` | O comando foi rodado na pasta errada. O `npm` roda dentro de `frontend`. |
| Porta 5435 ocupada | Rode `$env:DB_PORT=5440` antes do `docker compose up` e troque a porta no `DATABASE_URL` e no `TEST_DATABASE_URL` do `backend/.env`. |

### Acessos de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@mvp.local | admin123 |
| Gerente (equipe: João, Ana, Marcos) | gerente@mvp.local | gerente123 |
| Motorista | joao@mvp.local (também ana, marcos, lucas) | motorista123 |

O seed cria cerca de 12 meses de histórico, os roteiros A, B e C do enunciado (com data de ontem) e dois roteiros de hoje: um planejado para o João e um em andamento para a Ana.

## Testes

Com o Docker rodando, a partir da raiz do projeto:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest                      # usa o banco mvp_test (criado pelo docker compose)

cd ..\frontend
npm run build
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
mvp_es/
├── docker-compose.yml          # PostgreSQL 16 (contêiner mvp_es_db, porta 5435, volume pgdata)
├── backend/                    # API — Python + FastAPI
│   ├── .env.example            # modelo do .env (banco, JWT_SECRET, fuso, Nominatim)
│   ├── requirements.txt        # dependências da API (requirements-dev.txt inclui as de teste)
│   ├── pyproject.toml          # configuração do pytest
│   ├── alembic.ini
│   ├── alembic/versions/       # migrações do banco (esquema inicial)
│   ├── db-init/                # SQL executado na 1ª subida do contêiner (cria o banco mvp_test)
│   ├── app/
│   │   ├── main.py             # cria o FastAPI, CORS e monta as rotas sob /api
│   │   ├── seed.py             # dados de demonstração (python -m app.seed [--reset])
│   │   ├── api/                # rotas REST: auth, usuarios, gerentes, motoristas, pontos, parametros,
│   │   │                       #   roteiros, coleta, historico, dashboard, relatorios, auditoria
│   │   ├── core/               # config (lê o .env), security (bcrypt, JWT), deps (usuário logado, perfil, escopo)
│   │   ├── db/                 # base declarativa e sessão do SQLAlchemy
│   │   ├── models/             # tabelas: usuario, gerente, motorista, ponto, roteiro + ponto_roteiro,
│   │   │                       #   parametro, auditoria
│   │   ├── schemas/            # Pydantic: entrada e saída da API (cadastros, roteiros, dashboard)
│   │   └── services/           # regras de negócio
│   │       ├── calculo.py      #   RN01–RN07: tempo parado, totais, % da jornada, distância, custo
│   │       ├── roteiros.py     #   montar roteiro, registrar chegada/saída, corrigir horários, recalcular
│   │       ├── consultas.py    #   histórico e agregações do dashboard (dia, mês, período)
│   │       ├── relatorios.py   #   exportação CSV
│   │       ├── auditoria.py    #   registra antes/depois de cada alteração (listener do SQLAlchemy)
│   │       ├── lgpd.py         #   mascaramento de documento e anonimização
│   │       ├── geocoding.py    #   coordenadas pelo endereço (Nominatim / OpenStreetMap)
│   │       └── cadastros.py    #   usuários e formatação de cadastros
│   └── tests/                  # pytest: cálculo, roteiros/coleta, permissões/LGPD, dashboard/CSV
├── frontend/                   # app web — React + Vite + TypeScript
│   ├── .env.example            # VITE_APP_NAME (nome exibido no app)
│   ├── index.html
│   ├── vite.config.ts          # porta 5173 e proxy de /api para localhost:8000
│   ├── components.json         # configuração do shadcn/ui
│   ├── public/                 # favicon
│   └── src/
│       ├── main.tsx            # providers (TanStack Query, autenticação, avisos)
│       ├── App.tsx             # rotas e acesso por perfil
│       ├── pages/              # Login, Coleta (Minha rota), Dashboard, Historico, Roteiros, RoteiroForm,
│       │                       #   RoteiroDetalhe, Pontos, Motoristas, Gerentes, Parametros, Usuarios, Auditoria
│       ├── components/
│       │   ├── layout/         # AppLayout: menu lateral (desktop) e menu do celular
│       │   ├── ui/             # componentes do shadcn/ui (botão, tabela, diálogo, combobox…)
│       │   ├── comum.tsx       # cabeçalho de página, cards de KPI, estados de carregando/vazio/erro
│       │   ├── filtros.tsx     # filtros de período e de motorista
│       │   ├── graficos.tsx    # gráficos do dashboard (Recharts)
│       │   └── SeletorPonto.tsx  # seleção de ponto com busca por nome ou endereço
│       ├── hooks/queries.ts    # consultas reutilizadas (motoristas, pontos, gerentes, parâmetros)
│       └── lib/                # api (axios + token), auth, format (datas, minutos, moeda), form (validação), types
└── docs/diagramas/             # diagramas UML em SVG e PNG
    ├── casosDeUso/             # casos de uso
    ├── robustez/               # robustez (ICONIX) dos casos UC03/04, UC05, UC07, UC08, UC10 e UC12
    ├── classes/                # classes (modelo de domínio e serviços)
    └── componentes/            # componentes (navegador, Vite, API, banco e serviços externos)
```

### Diagramas

| Diagrama | Arquivo |
|---|---|
| Casos de uso | [casos-de-uso.png](docs/diagramas/casosDeUso/casos-de-uso.png) |
| Robustez | [pasta robustez](docs/diagramas/robustez/): um diagrama por caso de uso |
| Classes | [diagrama-de-classes.png](docs/diagramas/classes/diagrama-de-classes.png) |
| Componentes | [diagrama-de-componentes.png](docs/diagramas/componentes/diagrama-de-componentes.png) |
