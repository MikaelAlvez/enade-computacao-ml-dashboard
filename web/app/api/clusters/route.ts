import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


function buildWhere(sp: URLSearchParams): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const ano=sp.get("ano"), curso=sp.get("curso"), tipo=sp.get("tipo");
  const regiao=sp.get("regiao"), uf=sp.get("uf"), municipio=sp.get("municipio");
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
    const [pontos, estatsPorCluster, composicao] = await Promise.all([
      prisma.egressos.findMany({
        where:{ ...where, pca_x:{not:null}, pca_y:{not:null} },
        select:{ pca_x:true, pca_y:true, cluster_id:true, faixa_nota:true, curso_nome:true, nt_ger:true, regiao_nome:true },
        take:2000, orderBy:{ id:"asc" },
      }),
      prisma.egressos.groupBy({ by:["cluster_id"], where, _count:{ cluster_id:true }, _avg:{ nt_ger:true, nt_fg:true, nt_ce:true }, orderBy:{ cluster_id:"asc" } }),
      prisma.egressos.groupBy({ by:["cluster_id","faixa_nota"], where, _count:{ faixa_nota:true }, orderBy:{ cluster_id:"asc" } }),
    ]);
    return NextResponse.json({ pontos, stats_por_cluster:estatsPorCluster, composicao });
  } catch(error) {
    console.error("[/api/clusters]",error);
    return NextResponse.json({ error:"Erro ao buscar clusters" },{ status:500 });
  }
}
