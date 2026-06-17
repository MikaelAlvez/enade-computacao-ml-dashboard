import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const registros = await prisma.ml_metricas.findMany({
      orderBy: { id: "asc" },
    });

    // ── Acurácia geral ──────────────────────────────────────
    const acuraciaRow = registros.find(
      (r: any) => r.metrica === "acuracia_geral"
    );
    const acuracia = acuraciaRow ? Number(acuraciaRow.valor) : null;

    // ── Importância das features ────────────────────────────
    const importancias = registros
      .filter((r: any) => r.metrica === "importancia_feature")
      .map((r: any) => ({
        feature: r.chave,
        valor: Number(r.valor),
      }))
      .sort((a: any, b: any) => b.valor - a.valor);

    // ── Métricas por classe ─────────────────────────────────
    const classesPrincipais = ["alto", "medio", "baixo"];
    const metricas_classe = registros
      .filter(
        (r: any) =>
          r.metrica === "metricas_classe" &&
          classesPrincipais.includes(r.chave)
      )
      .map((r: any) => {
        const detalhe = r.detalhe ? JSON.parse(r.detalhe) : {};
        return {
          classe: r.chave,
          f1: Number(r.valor),
          precision: detalhe.precision ?? null,
          recall: detalhe.recall ?? null,
          support: detalhe.support ?? null,
        };
      });

    // ── Matriz de confusão
    const matrizRow = registros.find(
      (r: any) => r.metrica === "matriz_confusao"
    );
    const matriz_confusao = matrizRow?.detalhe
      ? JSON.parse(matrizRow.detalhe)
      : null;
    // Formato retornado:
    // {
    //   classes: ["alto", "medio", "baixo"],
    //   matrix: [[8539, 111, 0], [405, 7496, 495], [0, 110, 8293]],
    //   total_teste: 25449
    // }

    return NextResponse.json({
      acuracia,
      importancias,
      metricas_classe,
      matriz_confusao,
    });
  } catch (error) {
    console.error("[ml-metricas] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar métricas de ML" },
      { status: 500 }
    );
  }
}