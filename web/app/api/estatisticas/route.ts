import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


function buildWhere(searchParams: URLSearchParams): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const ano       = searchParams.get("ano");
  const curso     = searchParams.get("curso");
  const tipo      = searchParams.get("tipo");
  const regiao    = searchParams.get("regiao");
  const uf        = searchParams.get("uf");
  const municipio = searchParams.get("municipio");

  if (ano)       where.nu_ano       = BigInt(ano);
  if (curso)     where.co_grupo     = BigInt(curso);
  if (tipo)      where.tipo_ensino  = tipo;
  if (regiao)    where.co_regiao    = parseInt(regiao);
  if (uf)        where.co_uf        = BigInt(uf);
  if (municipio) where.co_municipio = BigInt(municipio);
  return where;
}

export async function GET(req: NextRequest) {
  try {
    const where = buildWhere(req.nextUrl.searchParams);

    const [
      totalEstudantes, mediaNotas, distribuicaoFaixa,
      distribuicaoAno, distribuicaoCurso, distribuicaoRegiao, distribuicaoTipoIes,
    ] = await Promise.all([
      prisma.egressos.count({ where }),
      prisma.egressos.aggregate({ where, _avg:{ nt_ger:true, nt_fg:true, nt_ce:true }, _min:{ nt_ger:true }, _max:{ nt_ger:true } }),
      prisma.egressos.groupBy({ by:["faixa_nota"], where, _count:{ faixa_nota:true }, orderBy:{ faixa_nota:"asc" } }),
      prisma.egressos.groupBy({ by:["nu_ano"], where, _count:{ nu_ano:true }, _avg:{ nt_ger:true }, orderBy:{ nu_ano:"asc" } }),
      prisma.egressos.groupBy({ by:["co_grupo","curso_nome"], where, _count:{ co_grupo:true }, _avg:{ nt_ger:true }, orderBy:{ _count:{ co_grupo:"desc" } } }),
      prisma.egressos.groupBy({ by:["co_regiao","regiao_nome"], where, _count:{ co_regiao:true }, _avg:{ nt_ger:true }, orderBy:{ _count:{ co_regiao:"desc" } } }),
      prisma.egressos.groupBy({ by:["tipo_ies"], where, _count:{ tipo_ies:true }, _avg:{ nt_ger:true }, orderBy:{ _avg:{ nt_ger:"desc" } } }),
    ]);

    const serialize = (obj: unknown): unknown => {
      if (typeof obj === "bigint") return Number(obj);
      if (Array.isArray(obj)) return obj.map(serialize);
      if (obj !== null && typeof obj === "object")
        return Object.fromEntries(Object.entries(obj as Record<string,unknown>).map(([k,v])=>[k,serialize(v)]));
      return obj;
    };

    return NextResponse.json(serialize({
      total_estudantes: totalEstudantes,
      media_notas: mediaNotas,
      distribuicao_faixa: distribuicaoFaixa,
      distribuicao_ano: distribuicaoAno,
      distribuicao_curso: distribuicaoCurso,
      distribuicao_regiao: distribuicaoRegiao,
      distribuicao_tipo_ies: distribuicaoTipoIes,
    }));
  } catch (error) {
    console.error("[/api/estatisticas]", error);
    return NextResponse.json({ error: "Erro ao buscar estatísticas" }, { status: 500 });
  }
}
