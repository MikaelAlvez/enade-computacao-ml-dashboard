"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── tipos ────────────────────────────────────────────────
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

type ApiResponse = {
  total: number;
  habitos: HabitoResult[];
};

type Filters = {
  ano?: string;
  curso?: string;
  tipo?: string;
  regiao?: string;
  uf?: string;
  municipio?: string;
};

// ── cores ────────────────────────────────────────────────
const BAR_COLORS = ["#534AB7", "#7F77DD", "#0F6E56", "#1D9E75", "#185FA5"];
const LINE_COLOR = "#888780";

// ── tooltip customizado ──────────────────────────────────
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--color-background-primary, #fff)",
        border: "0.5px solid #ccc",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
      }}
    >
      <p style={{ margin: "0 0 6px", fontWeight: 500 }}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ margin: "2px 0", color: entry.color }}>
          {entry.name === "media_nota"
            ? `Média NT_GER: ${entry.value.toFixed(1)} pts`
            : `Estudantes: ${entry.value.toLocaleString("pt-BR")} (${
                payload[0]?.payload?.pct ?? ""
              }%)`}
        </p>
      ))}
    </div>
  );
};

// ── card de gráfico ──────────────────────────────────────
function HabitoCard({ habito }: { habito: HabitoResult }) {
  return (
    <div
      style={{
        background: "var(--color-background-primary, #fff)",
        border: "0.5px solid #e0e0e0",
        borderRadius: 12,
        padding: "1rem 1.25rem",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 2px" }}>
        {habito.label}
      </p>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px" }}>
        Barras = média NT_GER · Linha = nº de estudantes
      </p>

      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart
          data={habito.dados}
          margin={{ top: 8, right: 16, left: 0, bottom: 32 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f0f0f0"
            vertical={false}
          />
          <XAxis
            dataKey="categoria"
            tick={{ fontSize: 11 }}
            angle={-18}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            yAxisId="nota"
            domain={[0, 90]}
            tick={{ fontSize: 11 }}
            label={{
              value: "Média NT_GER",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fontSize: 11, fill: "#888" },
            }}
          />
          <YAxis
            yAxisId="total"
            orientation="right"
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            tick={{ fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            formatter={(value: string) =>
              value === "media_nota" ? "Média NT_GER" : "Nº estudantes"
            }
            wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
          />
          <Bar
            yAxisId="nota"
            dataKey="media_nota"
            name="media_nota"
            radius={[4, 4, 0, 0]}
          >
            {habito.dados.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
          <Line
            yAxisId="total"
            dataKey="total"
            name="total"
            type="monotone"
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 4, fill: LINE_COLOR }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── componente principal ─────────────────────────────────
export default function HabitosTab({ filters }: { filters: Filters }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });

    fetch(`/api/habitos?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error("Erro na API");
        return r.json();
      })
      .then((d: ApiResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [filters]);

  if (loading)
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
        Carregando dados de hábitos...
      </div>
    );

  if (error)
    return (
      <div style={{ padding: "2rem", color: "#c0392b" }}>
        Erro ao carregar: {error}
      </div>
    );

  if (!data) return null;

  const grupo1 = data.habitos.filter((h) =>
    ["qe_horas_estudo", "qe_trabalha", "qe_horas_trabalho"].includes(h.variavel)
  );
  const grupo2 = data.habitos.filter((h) =>
    ["qe_uso_biblioteca", "qe_acesso_internet"].includes(h.variavel)
  );

  const findPct = (variavel: string, categoria: string) =>
    (
      data.habitos
        .find((h) => h.variavel === variavel)
        ?.dados.find((d) => d.categoria === categoria)?.pct ?? 0
    ).toFixed(1) + "%";

  return (
    <div style={{ padding: "1rem 0" }}>
      {/* Cards de resumo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: "1.5rem",
        }}
      >
        {[
          {
            label: "Não estuda extraclasse",
            value: findPct("qe_horas_estudo", "Nenhuma hora"),
          },
          {
            label: "Não tem vínculo empreg.",
            value: findPct("qe_trabalha", "Não trabalha"),
          },
          {
            label: "Usa sempre a biblioteca",
            value: findPct("qe_uso_biblioteca", "Sempre/quase sempre"),
          },
          {
            label: "Total de registros",
            value: data.total.toLocaleString("pt-BR"),
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "var(--color-background-secondary, #f5f5f5)",
              borderRadius: 8,
              padding: "0.75rem 1rem",
            }}
          >
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}>
              {label}
            </p>
            <p style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Grupo 1 — estudo e trabalho */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.25rem",
        }}
      >
        {grupo1.map((h) => (
          <HabitoCard key={h.variavel} habito={h} />
        ))}
      </div>

      {/* Grupo 2 — biblioteca e internet */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {grupo2.map((h) => (
          <HabitoCard key={h.variavel} habito={h} />
        ))}
      </div>
    </div>
  );
}