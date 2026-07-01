import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RACA_LABEL: Record<string, string> = {
  "0": "Não decl.",
  "1": "Branca",
  "2": "Preta",
  "3": "Parda",
  "4": "Amarela",
  "5": "Indígena",
};

function toSql(sp: URLSearchParams) {
  const conds: string[] = [];
  const vals: unknown[]  = [];
  let   i = 1;

  const map: Record<string, { col: string; cast: string }> = {
    ano:       { col: "nu_ano",       cast: "bigint"  },
    curso:     { col: "co_grupo",     cast: "bigint"  },
    tipo:      { col: "tipo_ensino",  cast: "string"  },
    regiao:    { col: "co_regiao",    cast: "int"     },
    uf:        { col: "co_uf",        cast: "bigint"  },
    municipio: { col: "co_municipio", cast: "bigint"  },
  };

  for (const [param, { col, cast }] of Object.entries(map)) {
    const v = sp.get(param);
    if (!v) continue;
    conds.push(`${col} = $${i++}`);
    vals.push(
      cast === "bigint" ? BigInt(v) :
      cast === "int"    ? parseInt(v) :
      v
    );
  }

  return {
    clause: conds.length ? "AND " + conds.join(" AND ") : "",
    vals,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { clause, vals } = toSql(req.nextUrl.searchParams);

    const [totResult, racaRaw] = await Promise.all([
      prisma.$queryRawUnsafe<[{ total: bigint }]>(
        `SELECT COUNT(*) AS total
         FROM   egressos
         WHERE  nt_ger IS NOT NULL ${clause}`,
        ...vals
      ),
      prisma.$queryRawUnsafe<
        { codigo: string; total: bigint; media_nota: number }[]
      >(
        `SELECT qe_raca_cor::text                     AS codigo,
                COUNT(*)                              AS total,
                ROUND(AVG(nt_ger)::numeric, 2)::float AS media_nota
         FROM   egressos
         WHERE  nt_ger       IS NOT NULL
           AND  qe_raca_cor  IS NOT NULL
           ${clause}
         GROUP  BY qe_raca_cor
         ORDER  BY qe_raca_cor`,
        ...vals
      ),
    ]);

    const totalRaca = racaRaw.reduce((s, r) => s + Number(r.total), 0);

    const raca = racaRaw.map(r => ({
      nome:       RACA_LABEL[r.codigo] ?? r.codigo,
      codigo:     r.codigo,
      total:      Number(r.total),
      pct:        totalRaca > 0
                    ? Math.round(Number(r.total) / totalRaca * 1000) / 10
                    : 0,
      media_nota: Number(r.media_nota),
    }));

    return NextResponse.json({
      total: Number(totResult[0].total),
      raca,
    });
  } catch (e) {
    console.error("[/api/raca]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}