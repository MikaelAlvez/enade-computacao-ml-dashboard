import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function buildWhere(sp: URLSearchParams) {
  const w: Record<string, unknown> = {};
  const ano       = sp.get("ano");
  const curso     = sp.get("curso");
  const tipo      = sp.get("tipo");
  const regiao    = sp.get("regiao");
  const uf        = sp.get("uf");
  const municipio = sp.get("municipio");
  if (ano)       w.nu_ano       = BigInt(ano);
  if (curso)     w.co_grupo     = BigInt(curso);
  if (tipo)      w.tipo_ensino  = tipo;
  if (regiao)    w.co_regiao    = parseInt(regiao);
  if (uf)        w.co_uf        = BigInt(uf);
  if (municipio) w.co_municipio = BigInt(municipio);
  return w;
}

function toSql(where: Record<string, unknown>) {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const map: Record<string, string> = {
    nu_ano:"nu_ano", co_grupo:"co_grupo", tipo_ensino:"tipo_ensino",
    co_regiao:"co_regiao", co_uf:"co_uf", co_municipio:"co_municipio",
  };
  for (const [k, v] of Object.entries(where)) {
    if (map[k]) { conds.push(`${map[k]} = $${i++}`); vals.push(v); }
  }
  return { clause: conds.length ? "AND " + conds.join(" AND ") : "", vals };
}

const FIN_LABEL: Record<string, string> = {
  "0":"Sem financiamento","1":"ProUni","2":"FIES",
  "3":"ProUni + FIES","4":"Outro público","5":"Outro privado",
};
const EC_LABEL: Record<string, string> = {
  "A":"Solteiro(a)","B":"Casado(a)","C":"Separado(a)/Divorciado(a)","D":"Viúvo(a)",
};

export async function GET(req: NextRequest) {
  try {
    const where = buildWhere(req.nextUrl.searchParams);
    const { clause, vals } = toSql(where);

    // helpers 
    type Row = Record<string, unknown>;

    const q = async (sql: string) =>
      prisma.$queryRawUnsafe<Row[]>(sql, ...vals);

    // 1. Renda
    const rendaRaw = await q(`
      SELECT renda_nome AS nome, COUNT(*) AS total,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM egressos WHERE nt_ger IS NOT NULL ${clause}
      GROUP BY qe_renda, renda_nome ORDER BY qe_renda`);

    // 2. Escola EM
    const escolaRaw = await q(`
      SELECT escola_em_nome AS nome, COUNT(*) AS total,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM egressos WHERE nt_ger IS NOT NULL AND qe_escola_em IS NOT NULL ${clause}
      GROUP BY qe_escola_em, escola_em_nome ORDER BY qe_escola_em`);

    // 3. Trabalha
    const trabalhaRaw = await q(`
      SELECT qe_trabalha::text AS nome, COUNT(*) AS total,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM egressos WHERE nt_ger IS NOT NULL AND qe_trabalha IS NOT NULL ${clause}
      GROUP BY qe_trabalha ORDER BY qe_trabalha`);

    // 4. Horas estudo
    const estudoRaw = await q(`
      SELECT qe_horas_estudo::text AS nome, COUNT(*) AS total,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM egressos WHERE nt_ger IS NOT NULL AND qe_horas_estudo IS NOT NULL ${clause}
      GROUP BY qe_horas_estudo ORDER BY qe_horas_estudo`);

    // 5. Tipo IES
    const tipoIesRaw = await q(`
      SELECT tipo_ies AS nome, COUNT(*) AS total,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM egressos WHERE nt_ger IS NOT NULL AND tipo_ies IS NOT NULL ${clause}
      GROUP BY tipo_ies ORDER BY media DESC`);

    //  6. Evolução renda × ano
    const evolRaw = await q(`
      SELECT nu_ano::int AS ano, renda_nome AS renda,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM egressos WHERE nt_ger IS NOT NULL AND renda_nome IS NOT NULL ${clause}
      GROUP BY nu_ano, qe_renda, renda_nome ORDER BY nu_ano, qe_renda`);

    //  7. Financiamento
    const finRaw = await q(`
      SELECT qe_financiamento::text AS codigo, COUNT(*) AS total,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM egressos WHERE nt_ger IS NOT NULL AND qe_financiamento IS NOT NULL ${clause}
      GROUP BY qe_financiamento ORDER BY qe_financiamento`);

    const financiamento = finRaw.map(r => ({
      nome:       FIN_LABEL[String(r.codigo)] ?? String(r.codigo),
      codigo:     String(r.codigo),
      total:      Number(r.total),
      media:      Number(r.media),
    }));

    // 8. Estado civil
    const ecRaw = await q(`
      SELECT qe_estado_civil::text AS codigo, COUNT(*) AS total,
             ROUND(AVG(nt_ger)::numeric,2)::float AS media
      FROM egressos WHERE nt_ger IS NOT NULL AND qe_estado_civil IS NOT NULL ${clause}
      GROUP BY qe_estado_civil ORDER BY qe_estado_civil`);

    const estado_civil = ecRaw.map(r => ({
      nome:   EC_LABEL[String(r.codigo)] ?? String(r.codigo),
      codigo: String(r.codigo),
      total:  Number(r.total),
      media:  Number(r.media),
    }));

    // 9. NT_FG vs NT_CE por tipo_ensino
    const ntRaw = await q(`
      SELECT tipo_ensino,
             COUNT(*)                              AS total,
             ROUND(AVG(nt_ger)::numeric,2)::float  AS media_ger,
             ROUND(AVG(nt_fg)::numeric,2)::float   AS media_fg,
             ROUND(AVG(nt_ce)::numeric,2)::float   AS media_ce
      FROM egressos
      WHERE nt_ger IS NOT NULL AND tipo_ensino IS NOT NULL ${clause}
      GROUP BY tipo_ensino ORDER BY tipo_ensino`);

    const nt_por_tipo = ntRaw.map(r => ({
      tipo:      String(r.tipo_ensino),
      total:     Number(r.total),
      media_ger: Number(r.media_ger),
      media_fg:  Number(r.media_fg),
      media_ce:  Number(r.media_ce),
    }));

    const fmt = (rows: Row[]) =>
      rows.map(r => ({ nome: String(r.nome), total: Number(r.total), media: Number(r.media) }));

    return NextResponse.json({
      renda:          fmt(rendaRaw),
      escola:         fmt(escolaRaw),
      trabalha:       fmt(trabalhaRaw),
      estudo:         fmt(estudoRaw),
      tipo_ies:       fmt(tipoIesRaw),
      evolucao_renda: evolRaw.map(r => ({ ano: Number(r.ano), renda: String(r.renda), media: Number(r.media) })),
      financiamento,
      estado_civil,
      nt_por_tipo,
    });
  } catch (e) {
    console.error("[/api/socioeconomico]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}