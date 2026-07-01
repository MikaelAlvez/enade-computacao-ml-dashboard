# enade-computacao-ml-dashboard

> Análise de perfil de egressos de cursos de Computação a partir dos microdados do ENADE (2014, 2017, 2021) com pipeline ETL em Python, modelos de Machine Learning e dashboard interativo em Next.js.

**TCC — Ciência da Computação · UFERSA 2026.1**  
**Autor:** José Mikael da Silva Alves  
**Orientadora:** Kátia Cilene da Silva Moura  
**Dashboard:** https://enade-computacao-ml-dashboard.vercel.app/dashboard

---

## Sobre o Projeto

Este trabalho propõe e implementa uma solução integrada para análise do perfil de egressos de cursos de Computação a partir dos microdados públicos do ENADE, disponibilizados pelo INEP no formato LGPD (Layout de Geração de Dados Públicos). A solução combina:

- **Pipeline ETL** automatizado em Python para processamento de 127 fragmentos LGPD
- **Modelos de Machine Learning** para segmentação de perfis (K-Means), classificação de desempenho (Random Forest) e visualização dimensional (PCA)
- **Dashboard interativo** em Next.js com 6 abas de análise, filtros dinâmicos em cascata e 30+ gráficos

### Dados analisados

| Métrica | Valor |
|---------|-------|
| Registros extraídos | 164.814 |
| Registros com nota válida | 127.243 (77,2%) |
| Edições do ENADE | 2014, 2017 e 2021 |
| Cursos de Computação | 8 |
| Variáveis por registro | 41 colunas |

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
│   │   │   └── page.tsx          # Dashboard principal (1.370 linhas)
│   │   └── api/
│   │       ├── estatisticas/     # KPIs e distribuições gerais
│   │       ├── socioeconomico/   # Renda, escola, financiamento, estado civil
│   │       ├── clusters/         # K-Means e PCA
│   │       ├── ml-metricas/      # Métricas do Random Forest
│   │       ├── filtros/          # Opções dinâmicas de filtro
│   │       ├── habitos/          # Hábitos de estudo e trabalho
│   │       ├── raca/             # Raça/cor × desempenho
│   │       ├── visao-geral/      # Modalidade, rede, UF, cobertura
│   │       ├── analise/          # Evolução por curso, histograma, matriz RF
│   │       ├── bivariado/        # Cruzamentos entre variáveis
│   │       └── previsao/         # Tendências e projeções 2024/2027
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
| joblib | 1.5.3 | Serialização dos modelos |
| loguru | — | Logging do pipeline |
| tqdm | — | Barras de progresso |

### Backend & Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Next.js | 16.2.6 | Framework full-stack |
| React | 19 | Interface do dashboard |
| Prisma ORM | 6.19.3 | Acesso ao banco de dados |
| Prisma Accelerate | — | Connection pooling serverless |
| Recharts | 2.x | Gráficos interativos |
| Tailwind CSS | 4.x | Estilização |
| PostgreSQL | 15 | Banco de dados (Neon cloud) |
| Vercel | — | Deploy e hospedagem |

---

## Como Executar

### Pré-requisitos

- Python 3.12+
- Node.js 18+
- PostgreSQL 15 (local ou Neon cloud)
- Microdados ENADE 2014, 2017 e 2021 no formato LGPD — download no portal do [INEP](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enade)

### 1. Clone o repositório

```bash
git clone https://github.com/MikaelAlvez/enade-computacao-ml-dashboard.git
cd enade-computacao-ml-dashboard
```

### 2. Configure o ETL

```bash
cd etl
python -m venv .venv
source .venv/bin/activate       # Linux/Mac
# .venv\Scripts\activate        # Windows

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

1. **Extração** — lê os 127 fragmentos LGPD (latin-1, separador `;`)
2. **Transformação** — limpeza, normalização min-max por ano, criação de faixas por tercis e feature engineering
3. **Machine Learning** — K-Means (K=4), Random Forest (100 árvores, hold-out 20%) e PCA (2 componentes)
4. **Carga** — persiste no PostgreSQL com 11 índices B-tree nas colunas mais consultadas

Para rodar em banco remoto (ex: Neon):

```bash
export DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
python scripts/run.py
```

### 4. Configure e rode o dashboard

```bash
cd ../web
npm install
```

Crie o arquivo `.env` na pasta `web/`:

```env
# Conexão direta (desenvolvimento local)
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/enade_tcc

# Ou via Prisma Accelerate (produção)
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=sua_chave
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

| Aba | Gráficos | Conteúdo principal |
|-----|----------|--------------------|
| **Visão Geral** | 9 | KPIs, evolução por ano, faixas, modalidade, rede, cursos, estados, regiões, cobertura, histograma de notas, NT_FG vs NT_CE |
| **Socioeconômico** | 8 | Renda × nota, evolução temporal por renda, escola EM, tipo IES, renda × rede, financiamento × rede, estado civil, renda × faixa 100% |
| **Raça/Cor** | 5 | Raça × nota, distribuição racial, composição racial por renda, heatmap raça × renda, tabela de desigualdade |
| **Hábitos** | 7 | Horas de estudo, horas de trabalho, uso de biblioteca, acesso à internet × nota, comparativo estudo vs trabalho |
| **Clusters & ML** | 5 | ScatterPCA interativo, radar por cluster, importâncias Random Forest, métricas F1 por classe, matriz de confusão |
| **Previsão** | 3 | Tendência geral com projeção 2024/2027, por curso (R²≥0,75), pública vs privada — com aviso de limitações metodológicas |

### APIs disponíveis

| Endpoint | Descrição |
|----------|-----------|
| `/api/estatisticas` | KPIs, distribuição por ano, curso, região e faixa |
| `/api/socioeconomico` | Renda, escola, trabalha, estudo, tipo IES, financiamento, estado civil, NT_FG/NT_CE |
| `/api/clusters` | Pontos PCA e estatísticas por cluster |
| `/api/ml-metricas` | Acurácia, F1-score, importâncias, métricas por classe |
| `/api/filtros` | Opções dinâmicas de curso, tipo, UF e município |
| `/api/habitos` | 5 variáveis de hábito com distribuição e média NT_GER |
| `/api/raca` | Distribuição e média por raça/cor |
| `/api/visao-geral` | Modalidade, rede, por UF, por região, cobertura |
| `/api/analise` | Evolução por curso, renda × faixa, acesso internet, histograma, matriz confusão |
| `/api/bivariado` | Renda × rede, curso × rede, raça × renda heatmap, financiamento × rede, composição racial |
| `/api/previsao` | Tendências lineares e projeções 2024/2027 |

---

## Modelos de Machine Learning

### K-Means (K=4)

Identificou 4 perfis distintos de egressos com base em 9 variáveis socioeconômicas:

| Cluster | N | % | Nota média | Perfil identificado |
|---------|---|---|-----------|---------------------|
| 0 | 65.451 | 51,4% | 31,7 pts | Desempenho médio · IES privada · Renda média |
| 1 | 27.646 | 21,7% | 62,6 pts | Baixo desempenho · IES pública federal · Renda baixa |
| 2 | 29.014 | 22,8% | 50,8 pts | Baixo desempenho · IES privada · Renda baixa |
| 3 | 5.132 | 4,0% | 74,9 pts | Alto desempenho · Renda elevada · Mais estudo |

**PCA:** PC1 = 63,4% da variância · PC2 = 12,8% · Total = 76,2%

### Random Forest (classificação de faixa de nota)

| Métrica | Valor |
|---------|-------|
| Acurácia geral | 95,60% |
| F1-score — faixa alto | 98,63% |
| F1-score — faixa baixo | 94,95% |
| F1-score — faixa médio | 93,04% |
| Árvores | 100 |
| Hold-out de teste | 20% |

**Principais variáveis preditoras:**

| Variável | Importância |
|----------|-------------|
| Renda familiar (QE_I05) | 28,56% |
| Horas de trabalho (QE_I19) | 19,32% |
| Trabalha atualmente (QE_I18) | 15,95% |
| Financiamento estudantil (QE_I08) | 14,85% |
| Tipo de escola no EM (QE_I02) | 9,83% |

---

## Principais Achados

| Achado | Dados |
|--------|-------|
| Queda na nota geral | 47,2 pts (2014) → 41,3 pts (2021) — redução de 12,4% |
| Desigualdade por renda | 29,8 pts (≤1,5SM) vs 75,9 pts (6-10SM) — fator 2,5× |
| Correlação renda × nota | r = 0,951 (R² = 90,4%) sobre registros individuais |
| Renda × rede | Dentro da mesma faixa de renda, pública e privada têm Δ ≤ 3 pts |
| Acesso à internet | 14,1 pts (sem acesso) → 72,3 pts (sempre acessa) — fator 5× |
| CC Bacharelado | Queda de 47,7 pts (2014) → 27,7 pts (2021) — maior declínio entre os cursos |
| Segregação racial | Cada grupo racial concentra-se em 1-2 faixas de renda sem sobreposição |

---

## Limitações Conhecidas

- **TP_SEXO não associável individualmente:** o arquivo LGPD do INEP distribui a variável de sexo em ordem diferente dos demais fragmentos, sem identificador único por estudante. A análise de gênero foi removida por falta de dados confiáveis.
- **Apenas 3 edições no tempo:** as projeções da aba Previsão são exploratórias — com n=3, qualquer regressão linear tem R² elevado por construção.
- **COVID-19 em 2021:** a queda nessa edição pode ser atípica e estar inflando a tendência de declínio.

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
- CHEN, Peter P. The entity-relationship model — toward a unified view of data. ACM TODS, v. 1, n. 1, p. 9–36, 1976