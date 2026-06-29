import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mapeamento correto UF → Região (IBGE)
const UF_REGIAO: Record<string, string> = {
  AC:"Norte",  AL:"Nordeste", AM:"Norte",   AP:"Norte",   BA:"Nordeste",
  CE:"Nordeste",DF:"Centro-Oeste",ES:"Sudeste",GO:"Centro-Oeste",
  MA:"Nordeste",MG:"Sudeste",  MS:"Centro-Oeste",MT:"Centro-Oeste",
  PA:"Norte",  PB:"Nordeste", PE:"Nordeste", PI:"Nordeste", PR:"Sul",
  RJ:"Sudeste", RN:"Nordeste", RO:"Norte",   RR:"Norte",   RS:"Sul",
  SC:"Sul",    SE:"Nordeste", SP:"Sudeste",  TO:"Norte",
};

// Totais extraídos originalmente (antes do filtro de nota válida)
const TOTAL_EXTRAIDO: Record<string, number> = {
  "2014": 51774,
  "2017": 51009,
  "2021": 62031,
};

export async function GET() {
  try {
    // 1. Modalidade por ano
    const modalRaw = await prisma.$queryRaw<
      { ano: bigint; modalidade: string; total: bigint }[]
    >`
      SELECT nu_ano AS ano,
             COALESCE(modalidade, 'Não informado') AS modalidade,
             COUNT(*) AS total
      FROM   egressos
      GROUP  BY nu_ano, modalidade
      ORDER  BY nu_ano, modalidade
    `;

    const modalPivot: Record<string, { presencial: number; ead_nd: number }> = {};
    for (const r of modalRaw) {
      const ano = String(r.ano);
      if (!modalPivot[ano]) modalPivot[ano] = { presencial: 0, ead_nd: 0 };
      if (r.modalidade === "Presencial") modalPivot[ano].presencial += Number(r.total);
      else modalPivot[ano].ead_nd += Number(r.total);
    }

    const modalidade = Object.entries(modalPivot)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ano, d]) => ({ ano, ...d, total: d.presencial + d.ead_nd }));

    // 2. Rede pública vs privada por ano
    const redeRaw = await prisma.$queryRaw<
      { ano: bigint; tipo_ies: string; total: bigint }[]
    >`
      SELECT nu_ano AS ano,
             tipo_ies,
             COUNT(*) AS total
      FROM   egressos
      WHERE  tipo_ies IS NOT NULL
      GROUP  BY nu_ano, tipo_ies
      ORDER  BY nu_ano
    `;

    const redePivot: Record<string, { publica: number; privada: number }> = {};
    for (const r of redeRaw) {
      const ano = String(r.ano);
      if (!redePivot[ano]) redePivot[ano] = { publica: 0, privada: 0 };
      if (r.tipo_ies.includes("blica")) redePivot[ano].publica += Number(r.total);
      else redePivot[ano].privada += Number(r.total);
    }

    const rede = Object.entries(redePivot)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ano, d]) => ({
        ano,
        publica:  d.publica,
        privada:  d.privada,
        total:    d.publica + d.privada,
        pct_pub:  Math.round(d.publica / (d.publica + d.privada) * 1000) / 10,
        pct_priv: Math.round(d.privada / (d.publica + d.privada) * 1000) / 10,
      }));

    // 3. Por UF
    const ufRaw = await prisma.$queryRaw<
      { uf: string; nome: string; total: bigint; media: number }[]
    >`
      SELECT uf_sigla                              AS uf,
             uf_nome                               AS nome,
             COUNT(*)                              AS total,
             ROUND(AVG(nt_ger)::numeric, 2)::float AS media
      FROM   egressos
      WHERE  uf_sigla IS NOT NULL
        AND  nt_ger   IS NOT NULL
      GROUP  BY uf_sigla, uf_nome
      ORDER  BY uf_sigla
    `;

    const por_uf = ufRaw.map(r => ({
      uf:     r.uf,
      nome:   r.nome,
      total:  Number(r.total),
      media:  Number(r.media),
      regiao: UF_REGIAO[r.uf] ?? "Desconhecido",
    }));

    // 4. Por região (com UF correto)
    const regiaoMap: Record<string, { n: number; soma: number }> = {};
    for (const u of por_uf) {
      if (!regiaoMap[u.regiao]) regiaoMap[u.regiao] = { n: 0, soma: 0 };
      regiaoMap[u.regiao].n    += u.total;
      regiaoMap[u.regiao].soma += u.media * u.total;
    }
    const por_regiao = Object.entries(regiaoMap).map(([regiao, d]) => ({
      regiao,
      total: d.n,
      media: Math.round(d.soma / d.n * 100) / 100,
    })).sort((a, b) => b.total - a.total);

    // 5. Cobertura de nota válida por ano
    const validosRaw = await prisma.$queryRaw<
      { ano: bigint; validos: bigint }[]
    >`
      SELECT nu_ano AS ano, COUNT(*) AS validos
      FROM   egressos
      WHERE  nt_ger IS NOT NULL
      GROUP  BY nu_ano
      ORDER  BY nu_ano
    `;

    const cobertura = validosRaw.map(r => ({
      ano:           String(r.ano),
      validos:       Number(r.validos),
      total:         TOTAL_EXTRAIDO[String(r.ano)] ?? Number(r.validos),
      sem_nota:      (TOTAL_EXTRAIDO[String(r.ano)] ?? Number(r.validos)) - Number(r.validos),
      pct_validos:   Math.round(Number(r.validos) / (TOTAL_EXTRAIDO[String(r.ano)] ?? Number(r.validos)) * 1000) / 10,
    }));

    const total_validos  = cobertura.reduce((s, r) => s + r.validos, 0);
    const total_extraido = cobertura.reduce((s, r) => s + r.total,   0);

    return NextResponse.json({
      modalidade,
      rede,
      por_uf,
      por_regiao,
      cobertura,
      resumo: {
        total_extraido,
        total_validos,
        total_sem_nota: total_extraido - total_validos,
        pct_validos: Math.round(total_validos / total_extraido * 1000) / 10,
      },
    });
  } catch (e) {
    console.error("[/api/visao-geral]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}