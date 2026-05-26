"""
extract.py - Concat axis=1 (sem merge).
Todos os fragmentos têm exatamente o mesmo número de linhas na mesma ordem.
Basta ler só a coluna de dado de cada fragmento e concatenar horizontalmente.
"""

import pandas as pd
from pathlib import Path
from loguru import logger
from tqdm import tqdm

from config import (
    DATA_RAW_DIR, ANOS_ENADE, PASTAS_ANO,
    CURSOS_COMPUTACAO, COLUNAS_SELECAO, COLUNAS_OPCIONAIS,
)


def carregar_ano(ano: int) -> pd.DataFrame:
    pasta_base = PASTAS_ANO.get(ano)
    if not pasta_base or not pasta_base.exists():
        raise FileNotFoundError(f"Pasta não encontrada: {pasta_base}")

    fragmentos = sorted(pasta_base.rglob("*.txt"))
    logger.info(f"[{ano}] {len(fragmentos)} fragmentos")

    codigos_grupo = [str(c) for c in CURSOS_COMPUTACAO.keys()]
    colunas_quero = set(COLUNAS_SELECAO)

    # Lê cada fragmento pegando só a coluna útil (sem CO_CURSO duplicado)
    colunas_lidas = {}  # nome_coluna -> Series

    for arq in tqdm(fragmentos, desc=f"  {ano}", unit="arq"):
        try:
            cols = pd.read_csv(
                arq, sep=";", encoding="latin-1", nrows=0
            ).columns.tolist()

            cols_novas = [c for c in cols
                          if c in colunas_quero and c not in colunas_lidas]

            if not cols_novas and "CO_GRUPO" not in cols:
                continue

            # Sempre lê CO_CURSO para poder filtrar depois
            cols_ler = list(set(cols_novas + ["CO_CURSO"]))
            if "CO_GRUPO" in cols:
                cols_ler.append("CO_GRUPO")

            df_frag = pd.read_csv(
                arq, sep=";", encoding="latin-1",
                usecols=cols_ler, dtype=str, low_memory=False
            )

            for col in cols_novas:
                if col in df_frag.columns:
                    colunas_lidas[col] = df_frag[col]

            # Guarda CO_CURSO e CO_GRUPO do fragmento de identificação
            if "CO_GRUPO" in df_frag.columns:
                colunas_lidas["CO_CURSO"] = df_frag["CO_CURSO"]
                colunas_lidas["CO_GRUPO"] = df_frag["CO_GRUPO"]

            del df_frag

        except Exception as e:
            logger.warning(f"  Erro em {arq.name}: {e}")

    if "CO_GRUPO" not in colunas_lidas:
        logger.warning(f"[{ano}] CO_GRUPO não encontrado.")
        return pd.DataFrame()

    # Monta DataFrame de uma vez — concat de Series é muito leve
    logger.info(f"[{ano}] Montando DataFrame...")
    df = pd.DataFrame(colunas_lidas)

    # Filtra cursos de Computação
    df = df[df["CO_GRUPO"].isin(codigos_grupo)].copy()

    # Garante NU_ANO
    df["NU_ANO"] = str(ano)

    # Garante colunas opcionais ausentes
    for col in COLUNAS_OPCIONAIS:
        if col not in df.columns:
            df[col] = pd.NA

    logger.success(f"[{ano}] {len(df):,} estudantes | {len(df.columns)} colunas")
    return df


def extrair_todos_os_anos() -> pd.DataFrame:
    dfs = []
    for ano in ANOS_ENADE:
        logger.info(f"Extraindo ano {ano}...")
        try:
            df = carregar_ano(ano)
            if len(df) > 0:
                dfs.append(df)
        except FileNotFoundError as e:
            logger.error(str(e))
        except Exception as e:
            logger.error(f"[{ano}] Erro inesperado: {e}")
            raise

    if not dfs:
        raise RuntimeError("Nenhum dado extraído.")

    df_total = pd.concat(dfs, ignore_index=True)
    logger.success(f"Extração concluída: {len(df_total):,} registros totais")
    return df_total


if __name__ == "__main__":
    df = extrair_todos_os_anos()
    print(df.head())
    print(f"\nColunas: {df.columns.tolist()}")
    print(f"\nPor ano:\n{df['NU_ANO'].value_counts().sort_index()}")
    print(f"\nPor curso:\n{df['CO_GRUPO'].value_counts()}")
