import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function buildWhere(sp: URLSearchParams): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const ano       = sp.get("ano");
  const curso     = sp.get("curso");
  const tipo      = sp.get("tipo");
  const regiao    = sp.get("regiao");
  const uf        = sp.get("uf");
  const municipio = sp.get("municipio");

  if (ano)       where.nu_ano       = BigInt(ano);
  if (curso)     where.co_grupo     = BigInt(curso);
  if (tipo)      where.tipo_ensino  = tipo;
  if (regiao)    where.co_regiao    = parseInt(regiao);
  if (uf)        where.co_uf        = BigInt(uf);
  if (municipio) where.co_municipio = BigInt(municipio);

  return where;
}

function whereToSql(where: Record<string, unknown>): {
  clause: string;
  values: unknown[];
} {
  const conditions: string[] = [];
  const values: unknown[]    = [];
  let   idx = 1;

  const colMap: Record<string, string> = {
    nu_ano:       "nu_ano",
    co_grupo:     "co_grupo",
    tipo_ensino:  "tipo_ensino",
    co_regiao:    "co_regiao",
    co_uf:        "co_uf",
    co_municipio: "co_municipio",
  };

  for (const [key, val] of Object.entries(where)) {
    const col = colMap[key];
    if (col) {
      conditions.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }

  const clause = conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";
  return { clause, values };
}

const RACA_LABEL: Record<string, string> = {
  "0": "Não decl.",
  "1": "Branca",
  "2": "Preta",
  "3": "Parda",
  "4": "Amarela",
  "5": "Indígena",
};

export async function GET(req: NextRequest) {
  try {
    const where               = buildWhere(req.nextUrl.searchParams);
    const { clause, values }  = whereToSql(where);

    // ── 1. Total filtrado ───────────────────────────────────
    const [{ total }] = await prisma.$queryRawUnsafe<[{ total: bigint }]>(
      `SELECT COUNT(*) AS total FROM egressos WHERE nt_ger IS NOT NULL ${clause}`,
      ...values
    );

    // ── 2. Gênero × NT_GER ─────────────────────────────────
    const generoRaw = await prisma.$queryRawUnsafe<
      { tp_sexo: string; total: bigint; media_nota: number }[]
    >(
      `SELECT tp_sexo,
              COUNT(*)                              AS total,
              ROUND(AVG(nt_ger)::numeric, 2)::float AS media_nota
       FROM   egressos
       WHERE  nt_ger   IS NOT NULL
         AND  tp_sexo  IS NOT NULL
         ${clause}
       GROUP  BY tp_sexo
       ORDER  BY tp_sexo`,
      ...values
    );

    const totalGenero = generoRaw.reduce((s, r) => s + Number(r.total), 0);
    const genero = generoRaw.map((r) => ({
      sexo:       r.tp_sexo === "F" ? "Feminino" : "Masculino",
      codigo:     r.tp_sexo,
      total:      Number(r.total),
      pct:        totalGenero > 0 ? Math.round((Number(r.total) / totalGenero) * 1000) / 10 : 0,
      media_nota: Number(r.media_nota),
    }));

    // ── 3. Raça × NT_GER ───────────────────────────────────
    const racaRaw = await prisma.$queryRawUnsafe<
      { qe_raca_cor: string; total: bigint; media_nota: number }[]
    >(
      `SELECT qe_raca_cor::text,
              COUNT(*)                              AS total,
              ROUND(AVG(nt_ger)::numeric, 2)::float AS media_nota
       FROM   egressos
       WHERE  nt_ger       IS NOT NULL
         AND  qe_raca_cor  IS NOT NULL
         ${clause}
       GROUP  BY qe_raca_cor
       ORDER  BY qe_raca_cor`,
      ...values
    );

    const totalRaca = racaRaw.reduce((s, r) => s + Number(r.total), 0);
    const raca = racaRaw.map((r) => ({
      nome:       RACA_LABEL[r.qe_raca_cor] ?? r.qe_raca_cor,
      codigo:     r.qe_raca_cor,
      total:      Number(r.total),
      pct:        totalRaca > 0 ? Math.round((Number(r.total) / totalRaca) * 1000) / 10 : 0,
      media_nota: Number(r.media_nota),
    }));

    // ── 4. Gênero × Raça (cruzamento) ─────────────────────
    const cruzamentoRaw = await prisma.$queryRawUnsafe<
      { tp_sexo: string; qe_raca_cor: string; total: bigint; media_nota: number }[]
    >(
      `SELECT tp_sexo,
              qe_raca_cor::text,
              COUNT(*)                              AS total,
              ROUND(AVG(nt_ger)::numeric, 2)::float AS media_nota
       FROM   egressos
       WHERE  nt_ger      IS NOT NULL
         AND  tp_sexo     IS NOT NULL
         AND  qe_raca_cor IS NOT NULL
         ${clause}
       GROUP  BY tp_sexo, qe_raca_cor
       ORDER  BY tp_sexo, qe_raca_cor`,
      ...values
    );

    // Pivot: para cada raça, média de F e M
    const racasUnicas = [...new Set(cruzamentoRaw.map((r) => r.qe_raca_cor))].sort();
    const cruzamento = racasUnicas.map((cod) => {
      const f = cruzamentoRaw.find((r) => r.qe_raca_cor === cod && r.tp_sexo === "F");
      const m = cruzamentoRaw.find((r) => r.qe_raca_cor === cod && r.tp_sexo === "M");
      return {
        raca:      RACA_LABEL[cod] ?? cod,
        codigo:    cod,
        feminino:  f ? Number(f.media_nota) : null,
        masculino: m ? Number(m.media_nota) : null,
        total_f:   f ? Number(f.total) : 0,
        total_m:   m ? Number(m.total) : 0,
      };
    });

    return NextResponse.json({
      total: Number(total),
      genero,
      raca,
      cruzamento,
    });
  } catch (error) {
    console.error("[/api/genero]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}