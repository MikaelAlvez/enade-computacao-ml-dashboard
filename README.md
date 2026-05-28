# enade-computacao-ml-dashboard

> Análise de perfil de egressos de cursos de Computação a partir dos microdados do ENADE (2014, 2017, 2021) com pipeline ETL em Python, modelos de Machine Learning e dashboard interativo em Next.js.

**TCC — Ciência da Computação · UFERSA 2026.1**  
**Autor:** José Mikael da Silva Alves  
**Orientadora:** Kátia Cilene da Silva Moura

---

## Sobre o Projeto

Este trabalho propõe e implementa uma solução integrada para análise do perfil de egressos de cursos de Computação a partir dos microdados públicos do ENADE, disponibilizados pelo INEP. A solução combina:

- **Pipeline ETL** automatizado em Python para processamento dos microdados no formato LGPD
- **Modelos de Machine Learning** para segmentação de perfis (K-Means), classificação de desempenho (Random Forest) e visualização dimensional (PCA)
- **Dashboard interativo** em Next.js com filtros dinâmicos por ano, curso, tipo de ensino, região, estado e município

### Cursos analisados

| Código | Curso |
|--------|-------|
| 72 | Tecnologia em Análise e Desenvolvimento de Sistemas |
| 79 | Tecnologia em Redes de Computadores |
| 4003 | Engenharia da Computação |
| 4004 | Ciência da Computação (Bacharelado) |
| 4005 | Ciência da Computação (Licenciatura) |
| 4006 | Sistemas de Informação |
| 5809 | Engenharia de Computação |
| 6409 | Tecnologia em Gestão da Tecnologia da Informação |

---

## Estrutura do Projeto

```
enade-computacao-ml-dashboard/
│
├── etl/                          # Pipeline ETL + ML
│   ├── scripts/
│   │   ├── config.py             # Configurações centrais
│   │   ├── extract.py            # Extração dos fragmentos LGPD
│   │   ├── transform.py          # Limpeza, normalização, feature engineering
│   │   ├── ml_pipeline.py        # K-Means, Random Forest, PCA
│   │   ├── load.py               # Carga no PostgreSQL
│   │   └── run.py                # Orquestrador do pipeline
│   ├── data/
│   │   ├── raw/                  # Microdados INEP (não versionados)
│   │   ├── processed/            # Dados intermediários
│   │   └── models/               # Modelos serializados (.joblib)
│   ├── .env.example
│   └── requirements.txt
│
├── web/                          # Aplicação Next.js
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Dashboard principal
│   │   └── api/
│   │       ├── estatisticas/     # KPIs e distribuições
│   │       ├── socioeconomico/   # Análise socioeconômica
│   │       ├── clusters/         # K-Means e PCA
│   │       ├── ml-metricas/      # Métricas do Random Forest
│   │       └── filtros/          # Opções dinâmicas de filtro
│   ├── lib/
│   │   └── prisma.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
└── README.md
```

---

## Tecnologias

### ETL & Machine Learning
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Python | 3.12 | Pipeline ETL e ML |
| Pandas | 2.2.2 | Manipulação de dados |
| Scikit-learn | 1.4.2 | K-Means, Random Forest, PCA |
| SQLAlchemy | 2.0.30 | Conexão com PostgreSQL |
| loguru | — | Logging do pipeline |

### Backend & Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Next.js | 16.2.6 | Framework full-stack |
| React | 19 | Interface do dashboard |
| Prisma ORM | 6.19.3 | Acesso ao banco de dados |
| Recharts | 2.x | Gráficos interativos |
| Tailwind CSS | 4.x | Estilização |
| PostgreSQL | 15 | Banco de dados |

---

## Como Executar

### Pré-requisitos

- Python 3.12+
- Node.js 18+
- PostgreSQL 15
- Microdados ENADE 2014, 2017 e 2021 (download no portal do [INEP](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade))

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/enade-computacao-ml-dashboard.git
cd enade-computacao-ml-dashboard
```

### 2. Configure o ETL

```bash
cd etl
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

pip install -r requirements.txt
```

Crie o arquivo `.env` na pasta `etl/`:

```env
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_HOST=localhost
DB_PORT=5432
DB_NAME=enade_tcc
DATA_DIR=data/raw
```

Organize os microdados em `etl/data/raw/`:

```
data/raw/
├── microdados_enade_2014_LGPD/
├── microdados_enade_2017_LGPD/
└── microdados_enade_2021/
```

### 3. Execute o pipeline ETL

```bash
python scripts/run.py
```

O pipeline executa automaticamente as 4 etapas:
1. **Extração** — lê os 127 fragmentos LGPD
2. **Transformação** — limpeza, normalização e feature engineering
3. **Machine Learning** — K-Means, Random Forest e PCA
4. **Carga** — persiste no PostgreSQL com índices

### 4. Configure e rode o dashboard

```bash
cd ../web
npm install
```

Crie o arquivo `.env` na pasta `web/`:

```env
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/enade_tcc
```

```bash
# Sincroniza o schema com o banco
npx prisma db pull
npx prisma generate

# Inicia o servidor de desenvolvimento
npm run dev
```

Acesse **http://localhost:3000/dashboard**

---

## Funcionalidades do Dashboard

### Filtros disponíveis
- **Ano** — 2014, 2017 ou 2021
- **Tipo de ensino** — Bacharelado, Licenciatura ou Tecnologia
- **Curso** — 8 cursos da área de Computação
- **Localização em cascata** — Região → Estado → Município

### Abas de análise
| Aba | Conteúdo |
|-----|----------|
| Visão Geral | KPIs, distribuição por ano, curso e região |
| Socioeconômico | Renda × nota, tipo de escola, evolução temporal |
| Raça & Gênero | Desigualdade racial, composição por grupo |
| Hábitos | Horas de trabalho e estudo × desempenho |
| Clusters & ML | Visualização PCA, radar por cluster, importância das features, métricas do classificador |

---

## Modelos de Machine Learning

### K-Means (K=4)
Identificou 4 perfis distintos de egressos:

| Cluster | N | Nota média | Perfil |
|---------|---|-----------|--------|
| 0 | 65.451 | 53,8 | Desempenho médio · IES privada · Renda média |
| 1 | 27.646 | 30,1 | Baixo desempenho · IES pública federal · Baixa renda |
| 2 | 29.014 | 31,5 | Baixo desempenho · IES privada · Baixa renda |
| 3 | 5.132 | 68,6 | Alto desempenho · Renda elevada · Mais horas de estudo |

### Random Forest
- **Acurácia:** 97,18%
- **F1-score:** > 95% para todas as classes
- **Principais features:** Financiamento estudantil (29,7%) + Tipo de escola no EM (29,3%)

---

## Licença

Este projeto foi desenvolvido como Trabalho de Conclusão de Curso na Universidade Federal Rural do Semi-Árido (UFERSA) e está disponível para fins acadêmicos.

---

## Referências

- BRASIL. Lei nº 10.861/2004 — Sistema Nacional de Avaliação da Educação Superior (SINAES)
- INEP. Microdados do ENADE 2014, 2017 e 2021. Disponível em: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade
- BOA VISTA; FIQUEIRÓ; MOZZAQUATRO. Técnicas de mineração de dados aplicadas aos microdados do ENADE, 2018
- CUNHA; SALES; SANTOS. Análise automática com os microdados do ENADE, 2021
- CARDOSO et al. O uso de Learning Analytics em ambientes de aprendizagem online, 2022
- PEDREGOSA et al. Scikit-learn: Machine Learning in Python. JMLR, 2011
