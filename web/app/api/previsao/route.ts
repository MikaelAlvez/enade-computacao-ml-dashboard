import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ANOS_REAIS = [2014, 2017, 2021];
const ANOS_PROJ  = [2024, 2027];

const CURSO_SHORT: Record<string, string> = {
  "Ciência da Computação (Bacharelado)":                 "CC Bach.",
  "Ciência da Computação (Licenciatura)":                "CC Lic.",
  "Engenharia da Computação":                            "Eng. da Comp.",
  "Engenharia de Computação":                            "Eng. de Comp.",
  "Sistemas de Informação":                              "Sist. Informação",
  "Tecnologia em Análise e Desenvolvimento de Sistemas": "Tec. ADS",
  "Tecnologia em Gestão da Tecnologia da Informação":    "Tec. GTI",
  "Tecnologia em Redes de Computadores":                 "Tec. Redes",
};

// Regressão linear simples (OLS)
function regressao(xs: number[], ys: number[]) {
  const n  = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  const b1 = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
             xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const b0  = my - b1 * mx;
  const ss_res = ys.reduce((s, y, i) => s + (y - (b0 + b1 * xs[i])) ** 2, 0);
  const ss_tot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const r2 = ss_tot > 0 ? 1 - ss_res / ss_tot : 1;
  return {
    b0: Math.round(b0 * 10000) / 10000,
    b1: Math.round(b1 * 10000) / 10000,
    r2: Math.round(r2 * 10000) / 10000,
    prever: (x: number) => Math.round((b0 + b1 * x) * 100) / 100,
  };
}

function isPublica(tipo: string) {
  return tipo.includes("blica");
}

export async function GET() {
  try {
    // 1. Média geral por ano
    const geralRaw = await prisma.$queryRaw<
      { ano: bigint; media: number; total: bigint }[]
    >`
      SELECT nu_ano                              AS ano,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media,
             COUNT(*)                            AS total
      FROM   egressos
      WHERE  nt_ger IS NOT NULL
      GROUP  BY nu_ano ORDER BY nu_ano
    `;

    const geralMap: Record<number, number> = {};
    for (const r of geralRaw) geralMap[Number(r.ano)] = Number(r.media);

    const ys_geral = ANOS_REAIS.map(a => geralMap[a]).filter(Boolean);
    const reg_geral = regressao(ANOS_REAIS, ys_geral);

    const tendencia_geral = [
      ...ANOS_REAIS.map(a => ({
        ano: a, media: geralMap[a] ?? null, projecao: null as number | null, tipo: "real",
      })),
      ...ANOS_PROJ.map(a => ({
        ano: a, media: null as number | null, projecao: reg_geral.prever(a), tipo: "projecao",
      })),
    ];

    // 2. Por curso
    const cursoRaw = await prisma.$queryRaw<
      { curso: string; ano: bigint; media: number }[]
    >`
      SELECT curso_nome                          AS curso,
             nu_ano                              AS ano,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM   egressos
      WHERE  nt_ger IS NOT NULL AND curso_nome IS NOT NULL
      GROUP  BY curso_nome, nu_ano ORDER BY curso_nome, nu_ano
    `;

    const cursoMap: Record<string, Record<number, number>> = {};
    for (const r of cursoRaw) {
      const short = CURSO_SHORT[r.curso] ?? r.curso;
      if (!cursoMap[short]) cursoMap[short] = {};
      cursoMap[short][Number(r.ano)] = Number(r.media);
    }

    const tendencia_cursos: {
      curso: string; r2: number; b1: number; confiavel: boolean;
      dados: { ano: number; media: number | null; projecao: number | null; tipo: string }[];
    }[] = [];

    for (const [curso, anos] of Object.entries(cursoMap)) {
      const ys = ANOS_REAIS.map(a => anos[a]).filter(Boolean);
      if (ys.length < 3) continue;
      const reg = regressao(ANOS_REAIS, ys);

      // Excluir previsões implausíveis (abaixo de 20 pts)
      const confiavel = reg.r2 >= 0.75 &&
        ANOS_PROJ.every(a => reg.prever(a) >= 20 && reg.prever(a) <= 100);

      tendencia_cursos.push({
        curso,
        r2:        reg.r2,
        b1:        reg.b1,
        confiavel,
        dados: [
          ...ANOS_REAIS.map(a => ({
            ano: a, media: anos[a] ?? null, projecao: null as number | null, tipo: "real",
          })),
          ...ANOS_PROJ.map(a => ({
            ano: a, media: null as number | null,
            projecao: confiavel ? reg.prever(a) : null,
            tipo: "projecao",
          })),
        ],
      });
    }

    // 3. Pública vs Privada
    const redeRaw = await prisma.$queryRaw<
      { tipo_ies: string; ano: bigint; media: number }[]
    >`
      SELECT tipo_ies,
             nu_ano                              AS ano,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM   egressos
      WHERE  nt_ger IS NOT NULL AND tipo_ies IS NOT NULL
      GROUP  BY tipo_ies, nu_ano ORDER BY nu_ano
    `;

    const redeMap: Record<string, Record<number, number>> = { Pública: {}, Privada: {} };
    for (const r of redeRaw) {
      const rede = isPublica(r.tipo_ies) ? "Pública" : "Privada";
      const ano  = Number(r.ano);
      if (!redeMap[rede][ano]) redeMap[rede][ano] = 0;
      // Média ponderada simples (agrupa todos os tipos públicos/privados)
      redeMap[rede][ano] = Number(r.media);
    }

    // Recalcular média ponderada real por rede e ano
    const redePonderadaRaw = await prisma.$queryRaw<
      { rede: string; ano: bigint; media: number }[]
    >`
      SELECT CASE WHEN tipo_ies LIKE '%blica%' THEN 'Pública' ELSE 'Privada' END AS rede,
             nu_ano AS ano,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM   egressos
      WHERE  nt_ger IS NOT NULL AND tipo_ies IS NOT NULL
      GROUP  BY rede, nu_ano ORDER BY nu_ano
    `;

    const redeReal: Record<string, Record<number, number>> = {};
    for (const r of redePonderadaRaw) {
      if (!redeReal[r.rede]) redeReal[r.rede] = {};
      redeReal[r.rede][Number(r.ano)] = Number(r.media);
    }

    const tendencia_rede: Record<string, {
      b1: number; r2: number;
      dados: { ano: number; media: number | null; projecao: number | null; tipo: string }[];
    }> = {};

    for (const rede of ["Pública", "Privada"]) {
      const ys = ANOS_REAIS.map(a => redeReal[rede]?.[a]).filter(Boolean) as number[];
      if (ys.length < 3) continue;
      const reg = regressao(ANOS_REAIS, ys);
      tendencia_rede[rede] = {
        b1: reg.b1, r2: reg.r2,
        dados: [
          ...ANOS_REAIS.map(a => ({
            ano: a, media: redeReal[rede]?.[a] ?? null, projecao: null as number | null, tipo: "real",
          })),
          ...ANOS_PROJ.map(a => ({
            ano: a, media: null as number | null, projecao: reg.prever(a), tipo: "projecao",
          })),
        ],
      };
    }

    // 4. Resumo das tendências
    const resumo = {
      tendencia_geral_b1:    reg_geral.b1,
      tendencia_geral_r2:    reg_geral.r2,
      previsao_2024:         reg_geral.prever(2024),
      previsao_2027:         reg_geral.prever(2027),
      cursos_confiaveis:     tendencia_cursos.filter(c => c.confiavel).length,
      cursos_nao_confiaveis: tendencia_cursos.filter(c => !c.confiavel).length,
    };

    return NextResponse.json({
      tendencia_geral,
      tendencia_cursos,
      tendencia_rede,
      resumo,
      anos_reais: ANOS_REAIS,
      anos_proj:  ANOS_PROJ,
    });
  } catch (e) {
    console.error("[/api/previsao]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}