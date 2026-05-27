import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


const MAPA_RACA: Record<number,string> = { 0:"Não declarado",1:"Branca",2:"Preta",3:"Parda",4:"Amarela",5:"Indígena" };
const MAPA_TRABALHA: Record<number,string> = { 0:"Não trabalha",1:"Até 20h/sem",2:"20 a 40h/sem",3:"Mais de 40h/sem" };
const MAPA_ESTUDO: Record<number,string>   = { 0:"Nenhuma",1:"1 a 3h/sem",2:"4 a 7h/sem",3:"Mais de 7h/sem" };

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

const serialize = (obj: unknown): unknown => {
  if (typeof obj === "bigint") return Number(obj);
  if (Array.isArray(obj)) return obj.map(serialize);
  if (obj !== null && typeof obj === "object")
    return Object.fromEntries(Object.entries(obj as Record<string,unknown>).map(([k,v])=>[k,serialize(v)]));
  return obj;
};

export async function GET(req: NextRequest) {
  try {
    const where = buildWhere(req.nextUrl.searchParams);

    const [renda,escola,raca,trabalha,estudo,tipoIes,evolucaoRenda] = await Promise.all([
      prisma.egressos.groupBy({ by:["qe_renda","renda_nome"], where:{ ...where, renda_nome:{not:null} }, _count:{ qe_renda:true }, _avg:{ nt_ger:true }, orderBy:{ qe_renda:"asc" } }),
      prisma.egressos.groupBy({ by:["escola_em_nome"], where:{ ...where, escola_em_nome:{not:null} }, _count:{ escola_em_nome:true }, _avg:{ nt_ger:true }, orderBy:{ _avg:{ nt_ger:"desc" } } }),
      prisma.egressos.groupBy({ by:["qe_raca_cor"], where:{ ...where, qe_raca_cor:{not:null} }, _count:{ qe_raca_cor:true }, _avg:{ nt_ger:true }, orderBy:{ qe_raca_cor:"asc" } }),
      prisma.egressos.groupBy({ by:["qe_trabalha"], where:{ ...where, qe_trabalha:{not:null} }, _count:{ qe_trabalha:true }, _avg:{ nt_ger:true }, orderBy:{ qe_trabalha:"asc" } }),
      prisma.egressos.groupBy({ by:["qe_horas_estudo"], where:{ ...where, qe_horas_estudo:{not:null} }, _count:{ qe_horas_estudo:true }, _avg:{ nt_ger:true }, orderBy:{ qe_horas_estudo:"asc" } }),
      prisma.egressos.groupBy({ by:["tipo_ies"], where:{ ...where, tipo_ies:{not:null} }, _count:{ tipo_ies:true }, _avg:{ nt_ger:true }, orderBy:{ _avg:{ nt_ger:"desc" } } }),
      prisma.egressos.groupBy({ by:["nu_ano","qe_renda","renda_nome"], where:{ ...where, renda_nome:{not:null} }, _avg:{ nt_ger:true }, orderBy:[{ nu_ano:"asc" },{ qe_renda:"asc" }] }),
    ]);

    return NextResponse.json(serialize({
      renda:   renda.map(r=>({ nome:r.renda_nome, total:r._count.qe_renda, media:Math.round((r._avg.nt_ger??0)*10)/10 })),
      escola:  escola.map(e=>({ nome:e.escola_em_nome, total:e._count.escola_em_nome, media:Math.round((e._avg.nt_ger??0)*10)/10 })),
      raca:    raca.map(r=>({ nome:MAPA_RACA[r.qe_raca_cor??0]??"N/A", total:r._count.qe_raca_cor, media:Math.round((r._avg.nt_ger??0)*10)/10 })),
      trabalha:trabalha.map(t=>({ nome:MAPA_TRABALHA[t.qe_trabalha??0]??"N/A", total:t._count.qe_trabalha, media:Math.round((t._avg.nt_ger??0)*10)/10 })),
      estudo:  estudo.map(e=>({ nome:MAPA_ESTUDO[e.qe_horas_estudo??0]??"N/A", total:e._count.qe_horas_estudo, media:Math.round((e._avg.nt_ger??0)*10)/10 })),
      tipo_ies:tipoIes.map(t=>({ nome:t.tipo_ies, total:t._count.tipo_ies, media:Math.round((t._avg.nt_ger??0)*10)/10 })),
      evolucao_renda: evolucaoRenda.map(e=>({ ano:Number(e.nu_ano), renda:e.renda_nome, media:Math.round((e._avg.nt_ger??0)*10)/10 })),
    }));
  } catch(error) {
    console.error("[/api/socioeconomico]",error);
    return NextResponse.json({ error:"Erro interno" },{ status:500 });
  }
}
