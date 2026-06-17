"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ── Tipos ──────────────────────────────────────────────────────
interface MatrizConfusaoData {
  classes: string[];
  matrix: number[][];
  total_teste: number;
}

interface Props {
  dados: MatrizConfusaoData | null;
}

// ── Helpers ────────────────────────────────────────────────────

// Retorna a intensidade (0–1) de uma célula para o fundo colorido
function intensidade(valor: number, maxValor: number): number {
  return maxValor > 0 ? valor / maxValor : 0;
}

// Interpola entre branco (#fff) e a cor de destaque baseado na intensidade
function corCelula(
  i: number,
  j: number,
  valor: number,
  maxDiag: number,
  maxFora: number
): string {
  if (i === j) {
    // Diagonal (acerto): verde teal
    const alpha = Math.round(intensidade(valor, maxDiag) * 200);
    return `rgba(29, 158, 117, ${(alpha / 255).toFixed(2)})`;
  }
  if (valor === 0) return "transparent";
  // Fora da diagonal (erro): âmbar
  const alpha = Math.round(intensidade(valor, maxFora) * 180);
  return `rgba(186, 117, 23, ${(alpha / 255).toFixed(2)})`;
}

// Label legível das classes
const LABEL: Record<string, string> = {
  alto:  "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

// Descrição dos limites de cada faixa
const DESCRICAO: Record<string, string> = {
  alto:  "NT_GER_NORM > 48,5 pts",
  medio: "33,3 a 48,5 pts",
  baixo: "NT_GER_NORM < 33,3 pts",
};

// ── Componente ─────────────────────────────────────────────────
export default function MatrizConfusao({ dados }: Props) {
  if (!dados) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Matriz de confusão não disponível.
      </div>
    );
  }

  const { classes, matrix, total_teste } = dados;

  // Total de acertos (diagonal)
  const totalAcertos = matrix.reduce((sum, row, i) => sum + row[i], 0);
  const acuracia = totalAcertos / total_teste;

  // Valores máximos para a escala de cores
  const maxDiag = Math.max(...matrix.map((row, i) => row[i]));
  const maxFora = Math.max(
    ...matrix.flatMap((row, i) => row.filter((_, j) => j !== i))
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Matriz de Confusão — Random Forest</p>
            <p className="text-xs text-muted-foreground">
              Linhas = valor real · Colunas = valor predito · {total_teste.toLocaleString("pt-BR")} registros de teste
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {(acuracia * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">acurácia geral</p>
          </div>
        </div>

        {/* Matriz */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {/* célula vazia canto superior esquerdo */}
                <th className="p-2 text-xs text-muted-foreground font-normal text-right w-28">
                  real \ predito
                </th>
                {classes.map((cls) => (
                  <th
                    key={cls}
                    className="p-2 text-center font-medium text-xs"
                  >
                    <span className="block">{LABEL[cls] ?? cls}</span>
                    <span className="block text-muted-foreground font-normal">
                      {DESCRICAO[cls]}
                    </span>
                  </th>
                ))}
                <th className="p-2 text-center text-xs text-muted-foreground font-normal">
                  Total real
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.map((classeReal, i) => {
                const totalLinha = matrix[i].reduce((a, b) => a + b, 0);
                return (
                  <tr key={classeReal}>
                    {/* Label linha */}
                    <td className="p-2 text-right">
                      <span className="font-medium text-xs">
                        {LABEL[classeReal] ?? classeReal}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {DESCRICAO[classeReal]}
                      </span>
                    </td>

                    {/* Células da matriz */}
                    {classes.map((classePredita, j) => {
                      const valor = matrix[i][j];
                      const pct = totalLinha > 0
                        ? ((valor / totalLinha) * 100).toFixed(1)
                        : "0.0";
                      const isDiag = i === j;
                      const bg = corCelula(i, j, valor, maxDiag, maxFora);

                      return (
                        <Tooltip key={classePredita}>
                          <TooltipTrigger asChild>
                            <td
                              className="p-3 text-center border border-border/30 cursor-default transition-opacity hover:opacity-80"
                              style={{ backgroundColor: bg }}
                            >
                              <span
                                className={`block text-lg font-bold ${
                                  isDiag
                                    ? "text-emerald-800 dark:text-emerald-200"
                                    : valor === 0
                                    ? "text-muted-foreground/40"
                                    : "text-amber-800 dark:text-amber-200"
                                }`}
                              >
                                {valor.toLocaleString("pt-BR")}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {pct}%
                              </span>
                            </td>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="font-medium">
                              Real: {LABEL[classeReal]} → Predito: {LABEL[classePredita]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {valor.toLocaleString("pt-BR")} casos ({pct}% da faixa {LABEL[classeReal]})
                            </p>
                            {isDiag && (
                              <p className="text-xs text-emerald-500 mt-1">✓ Acerto (TP)</p>
                            )}
                            {!isDiag && valor > 0 && (
                              <p className="text-xs text-amber-500 mt-1">
                                ✗ Erro — confusão entre faixas adjacentes
                              </p>
                            )}
                            {valor === 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                0 casos — faixas não adjacentes
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {/* Total da linha */}
                    <td className="p-2 text-center text-xs text-muted-foreground">
                      {totalLinha.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                );
              })}

              {/* Linha de totais por coluna */}
              <tr className="border-t border-border">
                <td className="p-2 text-right text-xs text-muted-foreground">
                  Total predito
                </td>
                {classes.map((_, j) => {
                  const totalCol = matrix.reduce((sum, row) => sum + row[j], 0);
                  return (
                    <td key={j} className="p-2 text-center text-xs text-muted-foreground">
                      {totalCol.toLocaleString("pt-BR")}
                    </td>
                  );
                })}
                <td className="p-2 text-center text-xs font-medium">
                  {total_teste.toLocaleString("pt-BR")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Interpretação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Card acertos diagonal */}
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Diagonal principal
            </p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {totalAcertos.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              acertos dos {total_teste.toLocaleString("pt-BR")} casos
            </p>
          </div>

          {/* Card erros "médio" */}
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Erros concentrados em Médio
            </p>
            {(() => {
              const iMedio = classes.indexOf("medio");
              const errosMedio = iMedio >= 0
                ? matrix[iMedio].reduce((s, v, j) => (j !== iMedio ? s + v : s), 0)
                : 0;
              const totalMedio = iMedio >= 0
                ? matrix[iMedio].reduce((a, b) => a + b, 0)
                : 1;
              return (
                <>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">
                    {errosMedio.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    {((errosMedio / totalMedio) * 100).toFixed(1)}% da faixa médio — adjacência com alto e baixo
                  </p>
                </>
              );
            })()}
          </div>

          {/* Card confusão entre extremos */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium">
              Alto ↔ Baixo
            </p>
            <p className="text-xl font-bold mt-1">0</p>
            <p className="text-xs text-muted-foreground">
              casos — faixas não adjacentes nunca se confundem
            </p>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}