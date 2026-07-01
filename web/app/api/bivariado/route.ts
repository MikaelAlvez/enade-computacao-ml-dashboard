import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RENDA_LABEL: Record<string, string> = {
  "0":"Não decl.", "1":"≤1,5SM", "2":"1,5–3SM",
  "3":"3–4,5SM",  "4":"4,5–6SM", "5":"6–10SM",
};
const RACA_LABEL: Record<string, string> = {
  "0":"Não decl.", "1":"Branca", "2":"Preta",
  "3":"Parda",    "4":"Amarela","5":"Indígena",
};
const FIN_LABEL: Record<string, string> = {
  "0":"Sem bolsa", "1":"ProUni", "2":"FIES",
  "3":"ProUni+FIES","4":"Outro público","5":"Outro privado",
};
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

function isPublica(tipo: string): boolean {
  return tipo.includes("blica") || tipo.includes("Federal") || tipo.includes("Estadual") || tipo.includes("Municipal");
}

export async function GET() {
  try {
    // 1. Renda × Rede
    const rendaRedeRaw = await prisma.$queryRaw<
      { renda: string; tipo_ies: string; total: bigint; media: number }[]
    >`
      SELECT qe_renda::text                        AS renda,
             tipo_ies,
             COUNT(*)                              AS total,
             ROUND(AVG(nt_ger)::numeric, 2)::float AS media
      FROM   egressos
      WHERE  nt_ger IS NOT NULL
        AND  qe_renda IS NOT NULL
        AND  tipo_ies IS NOT NULL
      GROUP  BY qe_renda, tipo_ies
      ORDER  BY qe_renda
    `;

    const rendaRedeMap: Record<string, { publica: number; privada: number; n_pub: number; n_priv: number }> = {};
    for (const r of rendaRedeRaw) {
      if (!rendaRedeMap[r.renda]) rendaRedeMap[r.renda] = { publica:0, privada:0, n_pub:0, n_priv:0 };
      if (isPublica(r.tipo_ies)) {
        rendaRedeMap[r.renda].publica = Number(r.media);
        rendaRedeMap[r.renda].n_pub   = Number(r.total);
      } else {
        rendaRedeMap[r.renda].privada = Number(r.media);
        rendaRedeMap[r.renda].n_priv  = Number(r.total);
      }
    }
    const renda_vs_rede = Object.entries(rendaRedeMap)
      .filter(([, d]) => d.publica > 0 && d.privada > 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([cod, d]) => ({
        nome:    RENDA_LABEL[cod] ?? cod,
        codigo:  cod,
        publica: d.publica,
        privada: d.privada,
        n_pub:   d.n_pub,
        n_priv:  d.n_priv,
        delta:   Math.round((d.publica - d.privada) * 100) / 100,
      }));

    // 2. Curso × Rede
    const cursoRedeRaw = await prisma.$queryRaw<
      { curso: string; tipo_ies: string; total: bigint; media: number }[]
    >`
      SELECT curso_nome                            AS curso,
             tipo_ies,
             COUNT(*)                              AS total,
             ROUND(AVG(nt_ger)::numeric, 2)::float AS media
      FROM   egressos
      WHERE  nt_ger IS NOT NULL
        AND  curso_nome IS NOT NULL
        AND  tipo_ies IS NOT NULL
      GROUP  BY curso_nome, tipo_ies
      ORDER  BY curso_nome
    `;

    const cursoRedeMap: Record<string, { publica: number; privada: number }> = {};
    for (const r of cursoRedeRaw) {
      const short = CURSO_SHORT[r.curso] ?? r.curso;
      if (!cursoRedeMap[short]) cursoRedeMap[short] = { publica: 0, privada: 0 };
      if (isPublica(r.tipo_ies)) cursoRedeMap[short].publica = Number(r.media);
      else cursoRedeMap[short].privada = Number(r.media);
    }
    const curso_vs_rede = Object.entries(cursoRedeMap)
      .filter(([, d]) => d.publica > 0 && d.privada > 0)
      .map(([curso, d]) => ({
        curso,
        publica: d.publica,
        privada: d.privada,
        delta:   Math.round((d.publica - d.privada) * 100) / 100,
      }))
      .sort((a, b) => b.delta - a.delta);

    // 3. Raça × Renda (heatmap)
    const racaRendaRaw = await prisma.$queryRaw<
      { raca: string; renda: string; total: bigint; media: number }[]
    >`
      SELECT qe_raca_cor::text                     AS raca,
             qe_renda::text                        AS renda,
             COUNT(*)                              AS total,
             ROUND(AVG(nt_ger)::numeric, 2)::float AS media
      FROM   egressos
      WHERE  nt_ger IS NOT NULL
        AND  qe_raca_cor IS NOT NULL
        AND  qe_renda IS NOT NULL
      GROUP  BY qe_raca_cor, qe_renda
      ORDER  BY qe_raca_cor, qe_renda
    `;

    // Pivot para heatmap: { raca, r0, r1, r2, r3, r4, r5 }
    const racaHeatMap: Record<string, Record<string, { media: number; total: number }>> = {};
    for (const r of racaRendaRaw) {
      const nome = RACA_LABEL[r.raca] ?? r.raca;
      if (!racaHeatMap[nome]) racaHeatMap[nome] = {};
      racaHeatMap[nome][r.renda] = { media: Number(r.media), total: Number(r.total) };
    }
    const raca_vs_renda = Object.entries(racaHeatMap).map(([raca, rendas]) => ({
      raca,
      rendas: Object.entries(rendas).map(([cod, d]) => ({
        codigo: cod,
        nome:   RENDA_LABEL[cod] ?? cod,
        media:  d.media,
        total:  d.total,
      })).sort((a, b) => Number(a.codigo) - Number(b.codigo)),
    }));

    // 4. Financiamento × Rede
    const finRedeRaw = await prisma.$queryRaw<
      { fin: string; tipo_ies: string; total: bigint; media: number }[]
    >`
      SELECT qe_financiamento::text                AS fin,
             tipo_ies,
             COUNT(*)                              AS total,
             ROUND(AVG(nt_ger)::numeric, 2)::float AS media
      FROM   egressos
      WHERE  nt_ger IS NOT NULL
        AND  qe_financiamento IS NOT NULL
        AND  tipo_ies IS NOT NULL
      GROUP  BY qe_financiamento, tipo_ies
      ORDER  BY qe_financiamento
    `;

    const finMap: Record<string, { publica: number | null; privada: number | null }> = {};
    for (const r of finRedeRaw) {
      if (!finMap[r.fin]) finMap[r.fin] = { publica: null, privada: null };
      if (isPublica(r.tipo_ies)) finMap[r.fin].publica = Number(r.media);
      else finMap[r.fin].privada = Number(r.media);
    }
    const fin_vs_rede = Object.entries(finMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([cod, d]) => ({
        nome:    FIN_LABEL[cod] ?? cod,
        codigo:  cod,
        publica: d.publica,
        privada: d.privada,
      }));

    // 5. Composição racial por faixa de renda (stacked 100%) ─
    const racaPorRendaRaw = await prisma.$queryRaw<
      { renda: string; raca: string; total: bigint }[]
    >`
      SELECT qe_renda::text    AS renda,
             qe_raca_cor::text AS raca,
             COUNT(*)          AS total
      FROM   egressos
      WHERE  qe_renda IS NOT NULL
        AND  qe_raca_cor IS NOT NULL
        AND  qe_raca_cor != '0'
      GROUP  BY qe_renda, qe_raca_cor
      ORDER  BY qe_renda, qe_raca_cor
    `;

    const rendaRacaMap: Record<string, Record<string, number>> = {};
    for (const r of racaPorRendaRaw) {
      if (!rendaRacaMap[r.renda]) rendaRacaMap[r.renda] = {};
      rendaRacaMap[r.renda][RACA_LABEL[r.raca] ?? r.raca] = Number(r.total);
    }
    const composicao_racial_renda = Object.entries(rendaRacaMap)
      .filter(([cod]) => cod !== "0")
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([cod, racas]) => {
        const total = Object.values(racas).reduce((s, v) => s + v, 0);
        const entry: Record<string, number | string> = {
          nome: RENDA_LABEL[cod] ?? cod,
          codigo: cod,
        };
        for (const [raca, n] of Object.entries(racas)) {
          entry[raca] = Math.round(n / total * 1000) / 10;
        }
        return entry;
      });

    return NextResponse.json({
      renda_vs_rede,
      curso_vs_rede,
      raca_vs_renda,
      fin_vs_rede,
      composicao_racial_renda,
    });
  } catch (e) {
    console.error("[/api/bivariado]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}