"""
run.py
------
Ponto de entrada do pipeline ETL completo.

Execute com:
    cd etl
    python scripts/run.py

Ou para rodar apenas uma etapa específica:
    python scripts/run.py --etapa extract
    python scripts/run.py --etapa transform
    python scripts/run.py --etapa ml
    python scripts/run.py --etapa load
    python scripts/run.py --etapa all   (padrão)
"""

import argparse
import sys
from pathlib import Path
from loguru import logger

# Configura o logger para mostrar data/hora e nível colorido no terminal
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}",
    colorize=True,
)
# Também salva em arquivo para referência
logger.add(
    Path(__file__).parent.parent / "etl_pipeline.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
    rotation="5 MB",
    retention="7 days",
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Pipeline ETL — Microdados ENADE"
    )
    parser.add_argument(
        "--etapa",
        choices=["extract", "transform", "ml", "load", "all"],
        default="all",
        help="Etapa a executar (padrão: all)",
    )
    parser.add_argument(
        "--salvar-csv",
        action="store_true",
        help="Salva o DataFrame processado como CSV em data/processed/",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    etapa = args.etapa

    logger.info("=" * 60)
    logger.info("  Pipeline ETL — Análise de Egressos ENADE")
    logger.info("=" * 60)

    # ── Extração ──────────────────────────────────────────────
    if etapa in ("extract", "all"):
        from extract import extrair_todos_os_anos
        logger.info("▶ ETAPA 1/4: Extração")
        df_raw = extrair_todos_os_anos()
        logger.info(f"  {len(df_raw):,} registros extraídos")

    # ── Transformação ─────────────────────────────────────────
    if etapa in ("transform", "all"):
        if etapa == "transform":
            from extract import extrair_todos_os_anos
            df_raw = extrair_todos_os_anos()

        from transform import transformar
        logger.info("▶ ETAPA 2/4: Transformação")
        df_limpo = transformar(df_raw)

        if args.salvar_csv:
            from config import DATA_PROC_DIR
            caminho_csv = DATA_PROC_DIR / "egressos_processado.csv"
            df_limpo.to_csv(caminho_csv, index=False)
            logger.info(f"  CSV salvo em: {caminho_csv}")

    # ── Machine Learning ──────────────────────────────────────
    if etapa in ("ml", "all"):
        if etapa == "ml":
            from extract import extrair_todos_os_anos
            from transform import transformar
            df_raw   = extrair_todos_os_anos()
            df_limpo = transformar(df_raw)

        from ml_pipeline import executar_ml
        logger.info("▶ ETAPA 3/4: Machine Learning")
        df_ml, metricas = executar_ml(df_limpo)
        logger.info(f"  Acurácia Random Forest: {metricas['acuracia']:.2%}")

    # ── Carga no banco ────────────────────────────────────────
    if etapa in ("load", "all"):
        if etapa == "load":
            from extract import extrair_todos_os_anos
            from transform import transformar
            from ml_pipeline import executar_ml
            df_raw       = extrair_todos_os_anos()
            df_limpo     = transformar(df_raw)
            df_ml, metricas = executar_ml(df_limpo)

        from load import carregar
        logger.info("▶ ETAPA 4/4: Carga no PostgreSQL")
        carregar(df_ml, metricas)

    logger.success("=" * 60)
    logger.success("  Pipeline concluído com sucesso!")
    logger.success("=" * 60)


if __name__ == "__main__":
    main()
