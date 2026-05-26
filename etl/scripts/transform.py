"""
transform.py
------------
ETAPA 2 do pipeline: Limpeza, normalização e feature engineering.
"""

import pandas as pd
import numpy as np
from loguru import logger

from config import CURSOS_COMPUTACAO, FEATURES_ML, TARGET_ML, TIPO_ENSINO, MAPA_UF


# ── 1. Converter tipos ────────────────────────────────────────

def converter_tipos(df: pd.DataFrame) -> pd.DataFrame:
    logger.info("Convertendo tipos de dados...")
    df = df.copy()

    df.replace({"." : np.nan, "" : np.nan, " " : np.nan, "NA": np.nan}, inplace=True)

    colunas_numericas = [
        "NT_GER", "NT_FG", "NT_CE", "NU_ANO", "CO_GRUPO",
        "CO_REGIAO_CURSO", "CO_CATEGAD", "CO_ORGACAD",
        "CO_MODALIDADE", "CO_UF_CURSO", "CO_MUNIC_CURSO",
    ]
    for col in colunas_numericas:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


# ── 2. Filtrar presentes com nota válida ──────────────────────

def filtrar_presentes(df: pd.DataFrame) -> pd.DataFrame:
    logger.info(f"Antes do filtro de nota válida: {len(df):,} registros")

    mask_nota = df["NT_GER"].notna()

    if "TP_PRES" in df.columns:
        mask_presenca = df["TP_PRES"].astype(str).str.strip() == "555"
        df = df[mask_presenca & mask_nota].copy()
    else:
        logger.warning("Coluna TP_PRES ausente (formato LGPD) — filtrando apenas por NT_GER válida.")
        df = df[mask_nota].copy()

    logger.info(f"Após filtro: {len(df):,} registros")
    return df


# ── 3. Normalizar notas entre os anos ────────────────────────

def normalizar_notas(df: pd.DataFrame) -> pd.DataFrame:
    logger.info("Normalizando notas por ano...")
    df = df.copy()

    df["NU_ANO"] = pd.to_numeric(df["NU_ANO"], errors="coerce")

    df["NT_GER_NORM"] = df.groupby("NU_ANO")["NT_GER"].transform(
        lambda x: (x - x.min()) / (x.max() - x.min()) * 100
        if x.max() != x.min() else 50.0
    )
    return df


# ── 4. Criar faixa de desempenho ──────────────────────────────

def criar_faixa_nota(df: pd.DataFrame) -> pd.DataFrame:
    logger.info("Criando faixa de nota (baixo / médio / alto)...")
    df = df.copy()

    q33 = df["NT_GER_NORM"].quantile(0.33)
    q66 = df["NT_GER_NORM"].quantile(0.66)

    conditions = [
        df["NT_GER_NORM"] <= q33,
        (df["NT_GER_NORM"] > q33) & (df["NT_GER_NORM"] <= q66),
        df["NT_GER_NORM"] > q66,
    ]
    df["FAIXA_NOTA"] = np.select(conditions, ["baixo", "medio", "alto"], default=None)

    logger.info(f"Distribuição das faixas:\n{df['FAIXA_NOTA'].value_counts()}")
    return df


# ── 5. Mapear códigos para rótulos legíveis ───────────────────

MAPA_REGIAO = {1: "Norte", 2: "Nordeste", 3: "Centro-Oeste", 4: "Sudeste", 5: "Sul"}
MAPA_CATEGAD = {
    1: "Pública Federal", 2: "Pública Estadual", 3: "Pública Municipal",
    4: "Privada com fins lucrativos", 5: "Privada sem fins lucrativos",
    7: "Especial",
}
MAPA_RENDA = {
    "A": "Até 1,5 SM", "B": "1,5 a 3 SM", "C": "3 a 4,5 SM",
    "D": "4,5 a 6 SM", "E": "6 a 10 SM",  "F": "10 a 30 SM", "G": "Mais de 30 SM",
}
MAPA_ESCOLA_EM = {
    "A": "Todo em escola pública",
    "B": "Maior parte em escola pública",
    "C": "Metade em escola pública",
    "D": "Maior parte em escola privada",
    "E": "Todo em escola privada",
}
MAPA_MODALIDADE = {1: "Presencial", 2: "EAD"}

# Nomes completos dos estados
MAPA_UF_NOME = {
    11: "Rondônia",       12: "Acre",             13: "Amazonas",
    14: "Roraima",        15: "Pará",              16: "Amapá",
    17: "Tocantins",      21: "Maranhão",          22: "Piauí",
    23: "Ceará",          24: "Rio Grande do Norte",25: "Paraíba",
    26: "Pernambuco",     27: "Alagoas",           28: "Sergipe",
    29: "Bahia",          31: "Minas Gerais",      32: "Espírito Santo",
    33: "Rio de Janeiro", 35: "São Paulo",         41: "Paraná",
    42: "Santa Catarina", 43: "Rio Grande do Sul", 50: "Mato Grosso do Sul",
    51: "Mato Grosso",    52: "Goiás",             53: "Distrito Federal",
}

def mapear_rotulos(df: pd.DataFrame) -> pd.DataFrame:
    logger.info("Mapeando códigos para rótulos...")
    df = df.copy()

    df["REGIAO_LABEL"]    = df["CO_REGIAO_CURSO"].map(MAPA_REGIAO)
    df["CATEGAD_LABEL"]   = df["CO_CATEGAD"].map(MAPA_CATEGAD)
    df["CURSO_LABEL"]     = df["CO_GRUPO"].map(CURSOS_COMPUTACAO)
    df["RENDA_LABEL"]     = df["QE_I05"].map(MAPA_RENDA)
    df["ESCOLA_EM_LABEL"] = df["QE_I02"].map(MAPA_ESCOLA_EM)

    # Modalidade: Presencial / EAD
    if "CO_MODALIDADE" in df.columns:
        df["MODALIDADE_LABEL"] = pd.to_numeric(
            df["CO_MODALIDADE"], errors="coerce"
        ).map(MAPA_MODALIDADE)
    else:
        df["MODALIDADE_LABEL"] = np.nan

    # Tipo de ensino derivado do código do curso
    df["TIPO_ENSINO"] = pd.to_numeric(
        df["CO_GRUPO"], errors="coerce"
    ).map(TIPO_ENSINO)

    # Sigla e nome do estado
    if "CO_UF_CURSO" in df.columns:
        uf_num = pd.to_numeric(df["CO_UF_CURSO"], errors="coerce")
        df["UF_SIGLA"] = uf_num.map(MAPA_UF)
        df["UF_NOME"]  = uf_num.map(MAPA_UF_NOME)
    else:
        df["UF_SIGLA"] = np.nan
        df["UF_NOME"]  = np.nan

    return df


# ── 6. Encoding para modelos de ML ───────────────────────────

def preparar_features_ml(df: pd.DataFrame) -> pd.DataFrame:
    logger.info("Preparando features para ML...")
    df = df.copy()

    for col in FEATURES_ML:
        if col not in df.columns:
            logger.warning(f"Feature '{col}' não encontrada, pulando encoding.")
            continue
        df[col] = df[col].astype(str).replace({"nan": np.nan, "None": np.nan})
        df[col] = pd.Categorical(df[col]).codes
        df[col] = df[col].replace(-1, np.nan)

    return df


# ── 7. Remover colunas de controle ────────────────────────────

def limpar_colunas_controle(df: pd.DataFrame) -> pd.DataFrame:
    colunas_remover = ["TP_PRES", "TP_PR_GER"]
    colunas_presentes = [c for c in colunas_remover if c in df.columns]
    return df.drop(columns=colunas_presentes)


# ── Pipeline completo ─────────────────────────────────────────

def transformar(df: pd.DataFrame) -> pd.DataFrame:
    logger.info("=== Iniciando transformação dos dados ===")

    df = converter_tipos(df)
    df = filtrar_presentes(df)
    df = normalizar_notas(df)
    df = criar_faixa_nota(df)
    df = mapear_rotulos(df)
    df = preparar_features_ml(df)
    df = limpar_colunas_controle(df)

    logger.success(f"Transformação concluída: {len(df):,} registros, {len(df.columns)} colunas")
    logger.info(f"Colunas finais: {df.columns.tolist()}")
    return df


if __name__ == "__main__":
    from extract import extrair_todos_os_anos
    df_raw   = extrair_todos_os_anos()
    df_limpo = transformar(df_raw)
    print(df_limpo.head())
    print(f"\nNulos por coluna:\n{df_limpo.isnull().sum()}")
