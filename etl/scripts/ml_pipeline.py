"""
ml_pipeline.py
--------------
ETAPA 3 do pipeline: Modelagem com Machine Learning.

Executa três análises:
  1. K-Means   — agrupa egressos em perfis (clusters)
  2. Random Forest — classifica faixa de desempenho e mede importância das features
  3. PCA       — reduz dimensionalidade para visualização 2D no dashboard

Os modelos treinados são salvos em data/models/ com joblib.
Os resultados (cluster_id, pca_x, pca_y, faixa_prevista) são adicionados
como colunas no DataFrame, que depois vai para o banco.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from loguru import logger

from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.decomposition import PCA
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from config import (
    MODELS_DIR,
    FEATURES_ML,
    TARGET_ML,
    ML_N_CLUSTERS,
    ML_RANDOM_STATE,
    ML_TEST_SIZE,
    ML_N_ESTIMATORS,
)


def _preparar_matriz_features(df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
    """
    Seleciona as features de ML e imputa medianas nos valores ausentes.
    Retorna o subset do DataFrame e a matriz numpy pronta para os modelos.
    """
    features_disponiveis = [f for f in FEATURES_ML if f in df.columns]
    df_feat = df[features_disponiveis].copy()

    # Imputa mediana por coluna (simples e adequado para árvores)
    for col in df_feat.columns:
        mediana = df_feat[col].median()
        df_feat[col] = df_feat[col].fillna(mediana)

    return df_feat, df_feat.values


# ── 1. K-Means ────────────────────────────────────────────────

def treinar_kmeans(df: pd.DataFrame) -> pd.DataFrame:
    """
    Treina K-Means e adiciona a coluna 'CLUSTER_ID' ao DataFrame.

    O número de clusters é definido em config.py (ML_N_CLUSTERS).
    Antes de treinar, os dados são padronizados (StandardScaler)
    pois K-Means é sensível a escala.
    """
    logger.info(f"Treinando K-Means com {ML_N_CLUSTERS} clusters...")

    df_feat, X = _preparar_matriz_features(df)

    # Pipeline: escala → K-Means
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("kmeans", KMeans(
            n_clusters=ML_N_CLUSTERS,
            random_state=ML_RANDOM_STATE,
            n_init=10,       # 10 inicializações diferentes (evita mínimo local)
            max_iter=300,
        ))
    ])

    pipeline.fit(X)
    labels = pipeline.named_steps["kmeans"].labels_

    df = df.copy()
    df["CLUSTER_ID"] = labels

    # Salva o modelo para o backend poder usar depois
    caminho_modelo = MODELS_DIR / "kmeans_pipeline.joblib"
    joblib.dump(pipeline, caminho_modelo)
    logger.success(f"K-Means salvo em: {caminho_modelo}")

    # Log de tamanho de cada cluster
    contagem = pd.Series(labels).value_counts().sort_index()
    for cluster, qtd in contagem.items():
        logger.info(f"  Cluster {cluster}: {qtd:,} estudantes")

    return df


# ── 2. Random Forest ──────────────────────────────────────────

def treinar_random_forest(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Treina Random Forest para classificar FAIXA_NOTA.

    Retorna o DataFrame com a coluna 'FAIXA_PREVISTA' adicionada
    e um dicionário com as métricas e importâncias de features.
    """
    logger.info("Treinando Random Forest...")

    # Remove linhas sem o target
    df_modelo = df[df["FAIXA_NOTA"].notna()].copy()

    df_feat, X = _preparar_matriz_features(df_modelo)
    y = df_modelo["FAIXA_NOTA"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=ML_TEST_SIZE, random_state=ML_RANDOM_STATE, stratify=y
    )

    modelo = RandomForestClassifier(
        n_estimators=ML_N_ESTIMATORS,
        random_state=ML_RANDOM_STATE,
        n_jobs=-1,           # usa todos os CPUs disponíveis
        class_weight="balanced",  # compensa desbalanceamento de classes
    )
    modelo.fit(X_train, y_train)

    # Avaliação
    y_pred = modelo.predict(X_test)
    acuracia = accuracy_score(y_test, y_pred)
    relatorio = classification_report(y_test, y_pred, output_dict=True)

    logger.success(f"Random Forest — acurácia no teste: {acuracia:.2%}")

    # Importância das features
    features_nomes = [f for f in FEATURES_ML if f in df.columns]
    importancias = dict(zip(features_nomes, modelo.feature_importances_))
    importancias_ordenadas = dict(sorted(importancias.items(), key=lambda x: x[1], reverse=True))

    logger.info("Importância das features:")
    for feat, imp in importancias_ordenadas.items():
        logger.info(f"  {feat}: {imp:.4f}")

    # Adiciona predições ao DataFrame completo
    df = df.copy()
    _, X_completo = _preparar_matriz_features(df)
    df["FAIXA_PREVISTA"] = modelo.predict(X_completo)

    # Salva o modelo
    caminho_modelo = MODELS_DIR / "random_forest.joblib"
    joblib.dump(modelo, caminho_modelo)
    logger.success(f"Random Forest salvo em: {caminho_modelo}")

    metricas = {
        "acuracia": acuracia,
        "relatorio": relatorio,
        "importancias": importancias_ordenadas,
        "features_usadas": features_nomes,
    }

    return df, metricas


# ── 3. PCA para visualização 2D ───────────────────────────────

def aplicar_pca(df: pd.DataFrame) -> pd.DataFrame:
    """
    Reduz as features para 2 componentes principais.
    As colunas PCA_X e PCA_Y serão usadas no scatter plot do dashboard.
    """
    logger.info("Aplicando PCA para visualização 2D...")

    df_feat, X = _preparar_matriz_features(df)

    # Padroniza antes do PCA (obrigatório)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    pca = PCA(n_components=2, random_state=ML_RANDOM_STATE)
    componentes = pca.fit_transform(X_scaled)

    df = df.copy()
    df["PCA_X"] = componentes[:, 0].round(4)
    df["PCA_Y"] = componentes[:, 1].round(4)

    variancia = pca.explained_variance_ratio_
    logger.info(
        f"PCA: variância explicada — PC1: {variancia[0]:.1%}, "
        f"PC2: {variancia[1]:.1%}, total: {sum(variancia):.1%}"
    )

    # Salva o pipeline PCA para uso posterior
    pipeline_pca = {"scaler": scaler, "pca": pca}
    joblib.dump(pipeline_pca, MODELS_DIR / "pca_pipeline.joblib")

    return df


# ── Pipeline completo de ML ───────────────────────────────────

def executar_ml(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Executa K-Means, Random Forest e PCA em sequência.
    Ponto de entrada para o run.py.

    Retorna
    -------
    df : pd.DataFrame
        DataFrame com colunas CLUSTER_ID, FAIXA_PREVISTA, PCA_X, PCA_Y adicionadas.
    metricas : dict
        Métricas de avaliação do Random Forest.
    """
    logger.info("=== Iniciando pipeline de Machine Learning ===")

    df = treinar_kmeans(df)
    df, metricas = treinar_random_forest(df)
    df = aplicar_pca(df)

    logger.success("Pipeline de ML concluído.")
    return df, metricas


if __name__ == "__main__":
    # Teste: python ml_pipeline.py
    from extract import extrair_todos_os_anos
    from transform import transformar

    df_raw   = extrair_todos_os_anos()
    df_limpo = transformar(df_raw)
    df_ml, metricas = executar_ml(df_limpo)

    print(df_ml[["NT_GER", "CLUSTER_ID", "FAIXA_NOTA", "FAIXA_PREVISTA", "PCA_X", "PCA_Y"]].head(10))
    print(f"\nAcurácia: {metricas['acuracia']:.2%}")
    print(f"\nImportâncias: {metricas['importancias']}")
