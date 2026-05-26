"""
load.py
-------
ETAPA 4 do pipeline: Carga dos dados no PostgreSQL.
"""

import pandas as pd
import json
from loguru import logger
from sqlalchemy import create_engine, text

from config import DB_URL, MODELS_DIR


def _criar_engine():
    try:
        engine = create_engine(DB_URL, echo=False)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.success("Conexão com PostgreSQL estabelecida.")
        return engine
    except Exception as e:
        raise ConnectionError(
            f"Não foi possível conectar ao PostgreSQL.\n"
            f"Verifique as credenciais no arquivo .env\n"
            f"Erro: {e}"
        )


def carregar_egressos(df: pd.DataFrame, engine) -> None:
    logger.info(f"Carregando {len(df):,} registros na tabela 'egressos'...")

    colunas_banco = {
        "NU_ANO"           : "nu_ano",
        "CO_GRUPO"         : "co_grupo",
        "CURSO_LABEL"      : "curso_nome",
        "CO_REGIAO_CURSO"  : "co_regiao",
        "REGIAO_LABEL"     : "regiao_nome",
        "CO_CATEGAD"       : "co_categad",
        "CATEGAD_LABEL"    : "tipo_ies",
        "CO_ORGACAD"       : "co_orgacad",
        # Novas colunas
        "CO_MODALIDADE"    : "co_modalidade",
        "MODALIDADE_LABEL" : "modalidade",
        "CO_UF_CURSO"      : "co_uf",
        "UF_SIGLA"         : "uf_sigla",
        "UF_NOME"          : "uf_nome",
        "CO_MUNIC_CURSO"   : "co_municipio",
        "CO_IES"           : "co_ies",
        "NO_IES"           : "no_ies",
        "TIPO_ENSINO"      : "tipo_ensino",
        # Notas
        "NT_GER"           : "nt_ger",
        "NT_FG"            : "nt_fg",
        "NT_CE"            : "nt_ce",
        "NT_GER_NORM"      : "nt_ger_norm",
        "FAIXA_NOTA"       : "faixa_nota",
        "FAIXA_PREVISTA"   : "faixa_prevista",
        # Socioeconômico
        "QE_I01"           : "qe_estado_civil",
        "QE_I02"           : "qe_escola_em",
        "ESCOLA_EM_LABEL"  : "escola_em_nome",
        "QE_I04"           : "qe_raca_cor",
        "QE_I05"           : "qe_renda",
        "RENDA_LABEL"      : "renda_nome",
        "QE_I08"           : "qe_financiamento",
        "QE_I17"           : "qe_horas_estudo",
        "QE_I18"           : "qe_trabalha",
        "QE_I19"           : "qe_horas_trabalho",
        "QE_I21"           : "qe_uso_biblioteca",
        "QE_I23"           : "qe_acesso_internet",
        # IES
        "QI_1"             : "qi_laboratorios",
        "QI_2"             : "qi_biblioteca",
        "QI_4"             : "qi_docentes",
        "QI_5"             : "qi_projeto_ped",
        "QI_7"             : "qi_extracurr",
        # ML
        "CLUSTER_ID"       : "cluster_id",
        "PCA_X"            : "pca_x",
        "PCA_Y"            : "pca_y",
    }

    colunas_disponiveis = {k: v for k, v in colunas_banco.items() if k in df.columns}
    df_banco = df[list(colunas_disponiveis.keys())].rename(columns=colunas_disponiveis)

    df_banco.to_sql(
        name="egressos",
        con=engine,
        if_exists="replace",
        index=True,
        index_label="id",
        chunksize=5000,
        method="multi",
    )

    logger.success(f"Tabela 'egressos' populada com {len(df_banco):,} registros.")


def carregar_metricas_ml(metricas: dict, engine) -> None:
    logger.info("Salvando métricas de ML no banco...")
    registros = []

    for feature, importancia in metricas.get("importancias", {}).items():
        registros.append({
            "metrica": "importancia_feature",
            "chave"  : feature,
            "valor"  : round(float(importancia), 6),
            "detalhe": None,
        })

    registros.append({
        "metrica": "acuracia_geral",
        "chave"  : "random_forest",
        "valor"  : round(float(metricas.get("acuracia", 0)), 6),
        "detalhe": None,
    })

    for classe, vals in metricas.get("relatorio", {}).items():
        if isinstance(vals, dict):
            registros.append({
                "metrica": "metricas_classe",
                "chave"  : classe,
                "valor"  : round(float(vals.get("f1-score", 0)), 6),
                "detalhe": json.dumps(vals),
            })

    pd.DataFrame(registros).to_sql(
        name="ml_metricas", con=engine,
        if_exists="replace", index=True, index_label="id",
    )
    logger.success(f"Tabela 'ml_metricas' populada com {len(registros)} registros.")


def criar_indices(engine) -> None:
    logger.info("Criando índices no banco...")

    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'egressos'"
        ))
        colunas_existentes = {row[0] for row in result}

    indices = {
        "idx_egressos_ano"       : "nu_ano",
        "idx_egressos_curso"     : "co_grupo",
        "idx_egressos_regiao"    : "co_regiao",
        "idx_egressos_cluster"   : "cluster_id",
        "idx_egressos_faixa"     : "faixa_nota",
        "idx_egressos_modalidade": "co_modalidade",
        "idx_egressos_uf"        : "co_uf",
        "idx_egressos_municipio" : "co_municipio",
        "idx_egressos_tipo"      : "tipo_ensino",
        "idx_egressos_ies"       : "co_ies",
    }

    with engine.connect() as conn:
        for nome, coluna in indices.items():
            if coluna in colunas_existentes:
                conn.execute(text(
                    f"CREATE INDEX IF NOT EXISTS {nome} ON egressos({coluna});"
                ))
                logger.info(f"  Índice criado: {nome}")
            else:
                logger.warning(f"  Coluna '{coluna}' não existe — {nome} ignorado.")
        conn.commit()

    logger.success("Índices criados.")


def carregar(df: pd.DataFrame, metricas: dict) -> None:
    logger.info("=== Iniciando carga no PostgreSQL ===")
    engine = _criar_engine()
    carregar_egressos(df, engine)
    carregar_metricas_ml(metricas, engine)
    criar_indices(engine)
    logger.success("Carga no banco concluída com sucesso!")
    engine.dispose()


if __name__ == "__main__":
    from extract import extrair_todos_os_anos
    from transform import transformar
    from ml_pipeline import executar_ml

    df_raw       = extrair_todos_os_anos()
    df_limpo     = transformar(df_raw)
    df_ml, metricas = executar_ml(df_limpo)
    carregar(df_ml, metricas)
