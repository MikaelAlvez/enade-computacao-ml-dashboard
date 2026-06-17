import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── tipos ────────────────────────────────────────────────
type HabitoRow = {
  categoria: string | null;
  total: bigint;
  media_nota: number | null;
};

type HabitoItem = {
  categoria: string;
  total: number;
  pct: number;
  media_nota: number;
};

type HabitoResult = {
  variavel: string;
  label: string;
  dados: HabitoItem[];
};

// ── mapeamentos de rótulos ───────────────────────────────
const MAPAS: Record<string, Record<string, string>> = {
  qe_horas_estudo: {
    "0": "Nenhuma hora",
    "1": "De 1 a 3 h/sem",
    "2": "De 4 a 7 h/sem",
    "3": "Mais de 7 h/sem",
  },
  qe_trabalha: {
    "0": "Não trabalha",
    "1": "Até 20 h/sem",
    "2": "Entre 20 e 40 h/sem",
    "3": "Mais de 40 h/sem",
  },
  qe_horas_trabalho: {
    "0": "Não trabalha",
    "1": "Até 20 h/sem",
    "2": "Entre 20 e 40 h/sem",
    "3": "Mais de 40 h/sem",
  },
  qe_uso_biblioteca: {
    A: "Nunca/quase nunca",
    B: "Sempre/quase sempre",
  },
  qe_acesso_internet: {
    A: "Nunca",
    B: "Raramente",
    C: "Ocasionalmente",
    D: "Frequentemente",
    E: "Sempre",
  },
};

const LABELS: Record<string, string> = {
  qe_horas_estudo:   "Horas de estudo extraclasse (QE_I17)",
  qe_trabalha:       "Vínculo empregatício (QE_I18)",
  qe_horas_trabalho: "Horas de trabalho semanal (QE_I19)",
  qe_uso_biblioteca: "Frequência de uso da biblioteca (QE_I21)",
  qe_acesso_internet:"Acesso à internet para estudo (QE_I23)",
};

// ── helpers ──────────────────────────────────────────────
function buildWhere(params: URLSearchParams) {
  const where: Record<string, unknown> = {};
  const ano      = params.get("ano");
  const curso    = params.get("curso");
  const tipo     = params.get("tipo");
  const regiao   = params.get("regiao");
  const uf       = params.get("uf");
  const municipio= params.get("municipio");

  if (ano)       where.nu_ano      = BigInt(ano);
  if (curso)     where.co_grupo    = BigInt(curso);
  if (tipo)      where.tipo_ensino = tipo;
  if (regiao)    where.co_regiao   = Number(regiao);
  if (uf)        where.co_uf       = BigInt(uf);
  if (municipio) where.co_municipio= BigInt(municipio);

  return where;
}

// ── handler ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const where  = buildWhere(params);

    // Monta cláusula WHERE para SQL raw
    const conditions: string[] = ["nt_ger IS NOT NULL"];
    const sqlValues: unknown[]  = [];
    let   pIdx = 1;

    for (const [col, val] of Object.entries(where)) {
      conditions.push(`${col} = $${pIdx++}`);
      sqlValues.push(val);
    }
    const whereClause = conditions.join(" AND ");

    // Total filtrado (para calcular %)
    const totalResult = await prisma.$queryRawUnsafe<[{ total: bigint }]>(
      `SELECT COUNT(*) AS total FROM egressos WHERE ${whereClause}`,
      ...sqlValues
    );
    const total = Number(totalResult[0].total);

    // Uma query por variável de hábito
    const habitos = Object.keys(MAPAS);
    const results: HabitoResult[] = [];

    for (const hab of habitos) {
      const rows = await prisma.$queryRawUnsafe<HabitoRow[]>(
        `SELECT
           ${hab}::text AS categoria,
           COUNT(*)     AS total,
           ROUND(AVG(nt_ger)::numeric, 2)::float AS media_nota
         FROM egressos
         WHERE ${whereClause}
           AND ${hab} IS NOT NULL
         GROUP BY ${hab}
         ORDER BY ${hab}`,
        ...sqlValues
      );

      const mapa  = MAPAS[hab];
      const dados: HabitoItem[] = rows
        .filter(r => r.categoria !== null && mapa[r.categoria] !== undefined)
        .map(r => ({
          categoria: mapa[r.categoria!] ?? r.categoria!,
          total:     Number(r.total),
          pct:       total > 0 ? Math.round((Number(r.total) / total) * 1000) / 10 : 0,
          media_nota:r.media_nota ?? 0,
        }));

      results.push({ variavel: hab, label: LABELS[hab], dados });
    }

    return NextResponse.json({ total, habitos: results });
  } catch (err) {
    console.error("[/api/habitos]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}