import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INET_LABEL: Record<string, string> = {
  A: "Não tem acesso",
  B: "Raramente",
  C: "Às vezes",
  D: "Frequentemente",
  E: "Sempre",
};

const CURSO_SHORT: Record<string, string> = {
  "Ciência da Computação (Bacharelado)":                   "CC Bacharelado",
  "Ciência da Computação (Licenciatura)":                  "CC Licenciatura",
  "Engenharia da Computação":                              "Eng. da Comp.",
  "Engenharia de Computação":                              "Eng. de Comp.",
  "Sistemas de Informação":                                "Sist. Informação",
  "Tecnologia em Análise e Desenvolvimento de Sistemas":   "Tec. ADS",
  "Tecnologia em Gestão da Tecnologia da Informação":      "Tec. GTI",
  "Tecnologia em Redes de Computadores":                   "Tec. Redes",
};

export async function GET() {
  try {
    // 1. Evolução por curso e ano
    const evolRaw = await prisma.$queryRaw<
      { curso: string; ano: bigint; media: number; total: bigint }[]
    >`
      SELECT curso_nome                              AS curso,
             nu_ano                                  AS ano,
             ROUND(AVG(nt_ger)::numeric, 2)::float   AS media,
             COUNT(*)                                AS total
      FROM   egressos
      WHERE  nt_ger IS NOT NULL AND curso_nome IS NOT NULL
      GROUP  BY curso_nome, nu_ano
      ORDER  BY curso_nome, nu_ano
    `;

    // Pivot: uma linha por curso com colunas 2014, 2017, 2021
    const evolMap: Record<string, Record<string, number | null>> = {};
    for (const r of evolRaw) {
      const short = CURSO_SHORT[r.curso] ?? r.curso;
      if (!evolMap[short]) evolMap[short] = { "2014": null, "2017": null, "2021": null };
      evolMap[short][String(r.ano)] = Number(r.media);
    }
    const evolucao_por_curso = Object.entries(evolMap).map(([curso, anos]) => ({
      curso,
      "2014": anos["2014"],
      "2017": anos["2017"],
      "2021": anos["2021"],
    }));

    // Também retornar formato linha para LineChart
    const evolucao_linhas = evolRaw.map(r => ({
      curso: CURSO_SHORT[r.curso] ?? r.curso,
      ano:   Number(r.ano),
      media: Number(r.media),
      total: Number(r.total),
    }));

    // 2. Renda × faixa de nota (100% stacked)
    const rendaFaixaRaw = await prisma.$queryRaw<
      { renda: string; faixa: string; total: bigint }[]
    >`
      SELECT qe_renda::text    AS renda,
             faixa_nota        AS faixa,
             COUNT(*)          AS total
      FROM   egressos
      WHERE  qe_renda IS NOT NULL AND faixa_nota IS NOT NULL
      GROUP  BY qe_renda, faixa_nota
      ORDER  BY qe_renda, faixa_nota
    `;

    const RENDA_LABEL: Record<string, string> = {
      "0": "Não decl.", "1": "Até 1,5SM", "2": "1,5–3SM",
      "3": "3–4,5SM",   "4": "4,5–6SM",  "5": "6–10SM",
    };

    const rendaMap: Record<string, Record<string, number>> = {};
    for (const r of rendaFaixaRaw) {
      if (!rendaMap[r.renda]) rendaMap[r.renda] = { baixo: 0, medio: 0, alto: 0 };
      rendaMap[r.renda][r.faixa] = Number(r.total);
    }

    const renda_vs_faixa = Object.entries(rendaMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([cod, d]) => {
        const total = d.baixo + d.medio + d.alto;
        return {
          nome:       RENDA_LABEL[cod] ?? cod,
          codigo:     cod,
          baixo:      d.baixo,
          medio:      d.medio,
          alto:       d.alto,
          total,
          pct_baixo:  total > 0 ? Math.round(d.baixo / total * 1000) / 10 : 0,
          pct_medio:  total > 0 ? Math.round(d.medio / total * 1000) / 10 : 0,
          pct_alto:   total > 0 ? Math.round(d.alto  / total * 1000) / 10 : 0,
        };
      });

    // 3. Acesso à internet × nota
    const inetRaw = await prisma.$queryRaw<
      { codigo: string; total: bigint; media: number }[]
    >`
      SELECT qe_acesso_internet::text              AS codigo,
             COUNT(*)                              AS total,
             ROUND(AVG(nt_ger)::numeric, 2)::float AS media
      FROM   egressos
      WHERE  qe_acesso_internet IS NOT NULL AND nt_ger IS NOT NULL
      GROUP  BY qe_acesso_internet
      ORDER  BY qe_acesso_internet
    `;

    const acesso_internet = inetRaw.map(r => ({
      nome:   INET_LABEL[r.codigo] ?? r.codigo,
      codigo: r.codigo,
      total:  Number(r.total),
      media:  Number(r.media),
    }));

    // 4. Histograma de notas por ano
    const histRaw = await prisma.$queryRaw<
      { ano: bigint; bucket: number; total: bigint }[]
    >`
      SELECT nu_ano                       AS ano,
             (FLOOR(nt_ger / 10) * 10)::int AS bucket,
             COUNT(*)                    AS total
      FROM   egressos
      WHERE  nt_ger IS NOT NULL
      GROUP  BY nu_ano, bucket
      ORDER  BY nu_ano, bucket
    `;

    // Pivot por ano
    const histMap: Record<string, Record<number, number>> = {};
    for (const r of histRaw) {
      const ano = String(r.ano);
      if (!histMap[ano]) histMap[ano] = {};
      histMap[ano][Number(r.bucket)] = Number(r.total);
    }

    const BUCKETS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
    const histograma = BUCKETS.map(b => {
      const entry: Record<string, number | string> = { faixa: `${b}–${b + 9}` };
      for (const ano of ["2014", "2017", "2021"]) {
        entry[ano] = histMap[ano]?.[b] ?? 0;
      }
      return entry;
    });

    // 5. Matriz de confusão RF
    const matrizRaw = await prisma.$queryRaw<
      { real: string; previsto: string; total: bigint }[]
    >`
      SELECT faixa_nota     AS real,
             faixa_prevista AS previsto,
             COUNT(*)       AS total
      FROM   egressos
      WHERE  faixa_nota IS NOT NULL AND faixa_prevista IS NOT NULL
      GROUP  BY faixa_nota, faixa_prevista
      ORDER  BY faixa_nota, faixa_prevista
    `;

    // Estrutura para heatmap
    const CLASSES = ["baixo", "medio", "alto"];
    const matrizMap: Record<string, Record<string, number>> = {};
    for (const cl of CLASSES) matrizMap[cl] = { baixo: 0, medio: 0, alto: 0 };
    for (const r of matrizRaw) {
      if (matrizMap[r.real]) matrizMap[r.real][r.previsto] = Number(r.total);
    }

    const total_matriz = Object.values(matrizMap)
      .flatMap(r => Object.values(r))
      .reduce((s, v) => s + v, 0);

    const matriz_confusao = CLASSES.map(real => ({
      real,
      baixo:     matrizMap[real].baixo,
      medio:     matrizMap[real].medio,
      alto:      matrizMap[real].alto,
      total_real: matrizMap[real].baixo + matrizMap[real].medio + matrizMap[real].alto,
      acerto:    matrizMap[real][real],
      pct_acerto: total_matriz > 0
        ? Math.round(matrizMap[real][real] / (matrizMap[real].baixo + matrizMap[real].medio + matrizMap[real].alto) * 1000) / 10
        : 0,
    }));

    return NextResponse.json({
      evolucao_por_curso,
      evolucao_linhas,
      renda_vs_faixa,
      acesso_internet,
      histograma,
      matriz_confusao,
      total_matriz,
    });
  } catch (e) {
    console.error("[/api/analise]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}