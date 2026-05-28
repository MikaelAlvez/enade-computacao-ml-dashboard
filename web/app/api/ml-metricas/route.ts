// app/api/ml-metricas/route.ts
// Retorna acurácia e importância das features do Random Forest.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mapa de códigos para nomes legíveis
const NOMES_FEATURES: Record<string, string> = {
  QE_I08: "Financiamento estudantil",
  QE_I02: "Tipo de escola no EM",
  QE_I04: "Raça/Cor",
  QE_I05: "Renda familiar",
  QE_I19: "Horas de trabalho",
  QE_I17: "Horas de estudo",
  QE_I18: "Trabalha atualmente",
  CO_CATEGAD: "Categoria administrativa IES",
  CO_REGIAO_CURSO: "Região geográfica",
};

export async function GET() {
  try {
    const metricas = await prisma.ml_metricas.findMany();

    const acuracia = metricas.find(
      (m: any) => m.metrica === "acuracia_geral"
    )?.valor;

    const importancias = metricas
      .filter((m: any) => m.metrica === "importancia_feature")
      .map((m: any) => ({
        feature: m.chave,
        nome: m.chave ? NOMES_FEATURES[m.chave] ?? m.chave : m.chave,
        importancia: m.valor,
        percentual: Math.round((m.valor ?? 0) * 100 * 10) / 10,
      }))
      .sort((a: any, b: any) => (b.importancia ?? 0) - (a.importancia ?? 0));

    const metricas_classe = metricas
      .filter((m: any) => m.metrica === "metricas_classe")
      .map((m: any) => ({
        classe: m.chave,
        f1_score: m.valor,
        detalhe: m.detalhe ? JSON.parse(m.detalhe) : null,
      }));

    return NextResponse.json({
      acuracia,
      importancias,
      metricas_classe,
    });
  } catch (error) {
    console.error("[/api/ml-metricas]", error);
    return NextResponse.json(
      { error: "Erro ao buscar métricas" },
      { status: 500 }
    );
  }
}
