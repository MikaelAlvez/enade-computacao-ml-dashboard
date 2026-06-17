import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function buildWhere(sp: URLSearchParams): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const ano      = sp.get("ano");
  const curso    = sp.get("curso");
  const tipo     = sp.get("tipo");
  const regiao   = sp.get("regiao");
  const uf       = sp.get("uf");
  const municipio= sp.get("municipio");

  if (ano)        where.nu_ano       = BigInt(ano);
  if (curso)      where.co_grupo     = BigInt(curso);
  if (tipo)       where.tipo_ensino  = tipo;
  if (regiao)     where.co_regiao    = parseInt(regiao);
  if (uf)         where.co_uf        = BigInt(uf);
  if (municipio)  where.co_municipio = BigInt(municipio);

  return where;
}

// Converte o where do Prisma em cláusula SQL + valores para $queryRawUnsafe
function whereToSql(where: Record<string, unknown>): {
  clause: string;
  values: unknown[];
} {
  const conditions: string[] = [];
  const values: unknown[]    = [];
  let idx = 1;

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

export async function GET(req: NextRequest) {
  try {
    const where = buildWhere(req.nextUrl.searchParams);
    const { clause, values } = whereToSql(where);

    // ── Pontos PCA agrupados por coordenada única ───────────────────────────
    // O PCA sobre features categóricas produz pouquíssimas coordenadas únicas
    // (~50 combinações para 127k registros). Agrupar evita enviar milhares de
    // pontos duplicados e garante que todos os clusters apareçam no gráfico.
    const pontosRaw = await prisma.$queryRawUnsafe<
      {
        pca_x:      number;
        pca_y:      number;
        cluster_id: number;
        total:      bigint;
        media_nota: number;
      }[]
    >(
      `SELECT
         ROUND(pca_x::numeric, 4)       AS pca_x,
         ROUND(pca_y::numeric, 4)       AS pca_y,
         cluster_id,
         COUNT(*)                       AS total,
         ROUND(AVG(nt_ger)::numeric, 2) AS media_nota
       FROM egressos
       WHERE pca_x      IS NOT NULL
         AND pca_y      IS NOT NULL
         AND cluster_id IS NOT NULL
         ${clause}
       GROUP BY ROUND(pca_x::numeric, 4),
                ROUND(pca_y::numeric, 4),
                cluster_id
       ORDER BY cluster_id ASC, total DESC`,
      ...values
    );

    // Serializa bigint e calcula raio proporcional (√total × 0.8, entre 4 e 30)
    const pontos = pontosRaw.map((p) => ({
      x:          Number(p.pca_x),
      y:          Number(p.pca_y),
      cluster_id: Number(p.cluster_id),
      total:      Number(p.total),
      media_nota: Number(p.media_nota),
      r:          Math.max(4, Math.min(30, Math.sqrt(Number(p.total)) * 0.8)),
    }));

    // ── Estatísticas e composição (inalteradas) ─────────────────────────────
    const [estatsPorCluster, composicao] = await Promise.all([
      prisma.egressos.groupBy({
        by:       ["cluster_id"],
        where,
        _count:   { cluster_id: true },
        _avg:     { nt_ger: true, nt_fg: true, nt_ce: true },
        orderBy:  { cluster_id: "asc" },
      }),
      prisma.egressos.groupBy({
        by:       ["cluster_id", "faixa_nota"],
        where,
        _count:   { faixa_nota: true },
        orderBy:  { cluster_id: "asc" },
      }),
    ]);

    return NextResponse.json({
      pontos,
      stats_por_cluster: estatsPorCluster,
      composicao,
    });
  } catch (error) {
    console.error("[/api/clusters]", error);
    return NextResponse.json(
      { error: "Erro ao buscar clusters" },
      { status: 500 }
    );
  }
}