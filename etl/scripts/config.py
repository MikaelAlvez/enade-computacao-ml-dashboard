"""
config.py
---------
Configurações centrais do pipeline ETL.
Todos os outros módulos importam daqui — nunca coloque
constantes espalhadas pelo código.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Diretórios ────────────────────────────────────────────────
BASE_DIR       = Path(__file__).parent.parent
DATA_RAW_DIR   = Path(os.getenv("DATA_DIR",       BASE_DIR / "data" / "raw"))
DATA_PROC_DIR  = Path(os.getenv("PROCESSED_DIR",  BASE_DIR / "data" / "processed"))
MODELS_DIR     = Path(os.getenv("MODELS_DIR",     BASE_DIR / "data" / "models"))

for _dir in [DATA_RAW_DIR, DATA_PROC_DIR, MODELS_DIR]:
    _dir.mkdir(parents=True, exist_ok=True)

# ── Banco de dados ────────────────────────────────────────────
DB_URL = (
    f"postgresql://{os.getenv('DB_USER', 'postgres')}"
    f":{os.getenv('DB_PASSWORD', '')}"
    f"@{os.getenv('DB_HOST', 'localhost')}"
    f":{os.getenv('DB_PORT', '5432')}"
    f"/{os.getenv('DB_NAME', 'enade_tcc')}"
)

# ── Edições do ENADE a processar ─────────────────────────────
ANOS_ENADE = [2014, 2017, 2021]

PASTAS_ANO = {
    2014: DATA_RAW_DIR / "microdados_enade_2014_LGPD",
    2017: DATA_RAW_DIR / "microdados_enade_2017_LGPD",
    2021: DATA_RAW_DIR / "microdados_enade_2021",
}

# ── Todos os cursos de Computação por edição ─────────────────
# 2014: 72, 79, 4004, 4005, 4006, 5809
# 2017: 72, 79, 4003, 4004, 4005, 4006, 6409
# 2021: 72, 79, 4004, 4005, 4006, 6409
CURSOS_COMPUTACAO = {
    72:   "Tecnologia em Análise e Desenvolvimento de Sistemas",
    79:   "Tecnologia em Redes de Computadores",
    4003: "Engenharia da Computação",
    4004: "Ciência da Computação (Bacharelado)",
    4005: "Ciência da Computação (Licenciatura)",
    4006: "Sistemas de Informação",
    5809: "Engenharia de Computação",
    6409: "Tecnologia em Gestão da Tecnologia da Informação",
}

# ── Tipo de ensino derivado do código do curso ────────────────
TIPO_ENSINO = {
    72:   "Tecnologia",
    79:   "Tecnologia",
    4003: "Bacharelado",
    4004: "Bacharelado",
    4005: "Licenciatura",
    4006: "Bacharelado",
    5809: "Bacharelado",
    6409: "Tecnologia",
}

# ── Mapa de UFs ───────────────────────────────────────────────
MAPA_UF = {
    11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA",
    16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE",
    24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE",
    29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP",
    41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT",
    52: "GO", 53: "DF",
}

# UFs por região
UFS_POR_REGIAO = {
    1: [11, 12, 13, 14, 15, 16, 17],          # Norte
    2: [21, 22, 23, 24, 25, 26, 27, 28, 29],  # Nordeste
    3: [50, 51, 52, 53],                        # Centro-Oeste
    4: [31, 32, 33, 35],                        # Sudeste
    5: [41, 42, 43],                            # Sul
}

# ── Variáveis selecionadas dos microdados ────────────────────
COLUNAS_SELECAO = [
    # Identificação
    "NU_ANO",
    "CO_GRUPO",
    "CO_CURSO",
    "CO_REGIAO_CURSO",
    "CO_CATEGAD",
    "CO_ORGACAD",
    "CO_MODALIDADE",    # 1=Presencial, 2=EAD
    "CO_UF_CURSO",      # código da UF (11=RO, 12=AC … 53=DF)
    "CO_MUNIC_CURSO",   # código IBGE do município
    "CO_IES",           # código da instituição
    "NO_IES",           # nome da instituição

    # Desempenho
    "TP_PRES",
    "TP_PR_GER",
    "NT_GER",
    "NT_FG",
    "NT_CE",

    # Perfil socioeconômico
    "QE_I01",
    "QE_I02",
    "QE_I04",
    "QE_I05",
    "QE_I08",

    # Hábitos de estudo
    "QE_I17",
    "QE_I18",
    "QE_I19",
    "QE_I21",
    "QE_I23",

    # Percepção da IES
    "QI_1",
    "QI_2",
    "QI_4",
    "QI_5",
    "QI_7",
]

COLUNAS_OPCIONAIS = [
    "QI_1", "QI_2", "QI_4", "QI_5", "QI_7",
    "CO_MODALIDADE", "CO_UF_CURSO", "CO_MUNIC_CURSO", "CO_IES", "NO_IES",
]

# ── Parâmetros de ML ─────────────────────────────────────────
ML_RANDOM_STATE  = 42
ML_N_CLUSTERS    = 4
ML_TEST_SIZE     = 0.2
ML_N_ESTIMATORS  = 100

FEATURES_ML = [
    "CO_REGIAO_CURSO",
    "CO_CATEGAD",
    "QE_I02",
    "QE_I04",
    "QE_I05",
    "QE_I08",
    "QE_I17",
    "QE_I18",
    "QE_I19",
]

TARGET_ML = "NT_GER"
