import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const regiao = searchParams.get("regiao");
    const uf = searchParams.get("uf");

    if (uf) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT e.co_municipio::text AS co_municipio,
               COALESCE(m.nome, e.co_municipio::text) AS nome
        FROM egressos e
        LEFT JOIN municipios m ON m.co_municipio = e.co_municipio
        WHERE e.co_uf = ${parseInt(uf)} AND e.co_municipio IS NOT NULL
        ORDER BY nome ASC
      `);
      return NextResponse.json(
        rows.map((r) => ({ co_municipio: Number(r.co_municipio), nome: r.nome }))
      );
    }

    if (regiao) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ufs: any[] = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT co_uf::text AS co_uf, uf_sigla, uf_nome
        FROM egressos
        WHERE co_regiao = ${parseInt(regiao)} AND uf_sigla IS NOT NULL
        ORDER BY uf_sigla ASC
      `);
      return NextResponse.json(
        ufs.map((u) => ({ co_uf: Number(u.co_uf), sigla: u.uf_sigla, nome: u.uf_nome }))
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [ufs, cursos, tipos]: any[] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT DISTINCT co_regiao, co_uf::text AS co_uf, uf_sigla, uf_nome
        FROM egressos WHERE uf_sigla IS NOT NULL ORDER BY uf_sigla ASC
      `),
      prisma.$queryRawUnsafe(`
        SELECT DISTINCT co_grupo::text AS co_grupo, curso_nome
        FROM egressos WHERE curso_nome IS NOT NULL ORDER BY co_grupo ASC
      `),
      prisma.$queryRawUnsafe(`
        SELECT DISTINCT tipo_ensino FROM egressos
        WHERE tipo_ensino IS NOT NULL ORDER BY tipo_ensino ASC
      `),
    ]);

    return NextResponse.json({
      ufs: ufs.map((u: any) => ({ co_regiao: u.co_regiao, co_uf: Number(u.co_uf), sigla: u.uf_sigla, nome: u.uf_nome })),
      cursos: cursos.map((c: any) => ({ co_grupo: Number(c.co_grupo), nome: c.curso_nome })),
      tipos: tipos.map((t: any) => t.tipo_ensino),
    });

  } catch (error) {
    console.error("[/api/filtros]", error);
    return NextResponse.json({ error: "Erro ao buscar filtros" }, { status: 500 });
  }
}
