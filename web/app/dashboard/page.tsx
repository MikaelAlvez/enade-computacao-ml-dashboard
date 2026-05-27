"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

// ── Constantes ────────────────────────────────────────────────
const CORES_CLUSTER  = ["#6366f1","#10b981","#f59e0b","#ef4444"];
const CORES_FAIXA    = { alto:"#10b981", medio:"#f59e0b", baixo:"#ef4444" };
const CORES_GRADIENTE= ["#4f46e5","#6366f1","#818cf8","#a5b4fc","#c7d2fe","#e0e7ff"];
const CORES_RENDA    = ["#ef4444","#f97316","#eab308","#84cc16","#22c55e","#10b981"];
const CORES_RACA     = ["#94a3b8","#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe"];

const ANOS   = ["Todos","2014","2017","2021"];
const ABAS   = ["Visão Geral","Socioeconômico","Raça & Gênero","Hábitos","Clusters & ML"];
const FAIXAS_RENDA = ["Até 1,5 SM","1,5 a 3 SM","3 a 4,5 SM","4,5 a 6 SM","6 a 10 SM","10 a 30 SM"];
const PERFIS_CLUSTER = [
  { rotulo:"Desempenho médio",         detalhe:"Renda média · IES privada" },
  { rotulo:"Baixo desempenho público", detalhe:"Renda baixa · IES federal" },
  { rotulo:"Baixo desempenho privado", detalhe:"Renda baixa · IES privada" },
  { rotulo:"Alto desempenho",          detalhe:"Renda alta · Mais estudo"  },
];

// Regiões com código real do banco (0=Norte,1=Nordeste,2=Sudeste,3=Sul,4=Centro-Oeste)
const REGIOES = [
  { value:"", label:"Todas as regiões" },
  { value:"0", label:"Norte" },
  { value:"1", label:"Nordeste" },
  { value:"2", label:"Sudeste" },
  { value:"3", label:"Sul" },
  { value:"4", label:"Centro-Oeste" },
];

function r(v: number|null|undefined) { return Math.round((v??0)*10)/10; }

// ── Componentes base ──────────────────────────────────────────
function Card({ title, value, sub, color="indigo", delta }: {
  title:string; value:string|number; sub?:string; color?:string; delta?:string;
}) {
  const bg: Record<string,string> = {
    indigo:"from-indigo-500 to-indigo-700", green:"from-emerald-500 to-emerald-700",
    amber:"from-amber-500 to-amber-700",   rose:"from-rose-500 to-rose-700",
    purple:"from-purple-500 to-purple-700",sky:"from-sky-500 to-sky-700",
  };
  return (
    <div className={`bg-gradient-to-br ${bg[color]} rounded-2xl p-5 text-white shadow-lg`}>
      <p className="text-xs font-medium opacity-75 uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub   && <p className="text-xs opacity-65 mt-1">{sub}</p>}
      {delta && <p className="text-xs mt-2 font-semibold opacity-90">{delta}</p>}
    </div>
  );
}

function Section({ title, sub, children }: { title:string; sub?:string; children:React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      {sub && <p className="text-xs text-gray-500 mt-0.5 mb-4">{sub}</p>}
      {!sub && <div className="mb-4"/>}
      {children}
    </div>
  );
}

function LegendaRenda() {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-2">
      {FAIXAS_RENDA.map((nome, i) => (
        <div key={nome} className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-0.5 rounded" style={{background: CORES_RENDA[i]}}/>
          <span className="text-xs text-gray-300">{nome}</span>
        </div>
      ))}
    </div>
  );
}

// Componente de select reutilizável
function Select({ value, onChange, children, disabled = false }: {
  value:string; onChange:(v:string)=>void; children:React.ReactNode; disabled?:boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      suppressHydrationWarning
      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white
                 focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </select>
  );
}

const TT = { contentStyle:{ backgroundColor:"#1f2937", border:"none", borderRadius:8, fontSize:12 } };

// ── Tipos ─────────────────────────────────────────────────────
type CursoOpt  = { co_grupo: number; nome: string };
type UFOpt     = { co_uf: number; sigla: string; nome: string; co_regiao: number };
type MunicOpt = { co_municipio: number; nome: string };

export default function Dashboard() {
  const [aba,           setAba]           = useState(0);
  // Filtros
  const [filtroAno,     setFiltroAno]     = useState("");
  const [filtroCurso,   setFiltroCurso]   = useState("");
  const [filtroTipo,    setFiltroTipo]    = useState("");
  const [filtroRegiao,  setFiltroRegiao]  = useState("");
  const [filtroUF,      setFiltroUF]      = useState("");
  const [filtroMunicio, setFiltroMunicio] = useState("");
  // Opções dinâmicas
  const [cursos,        setCursos]        = useState<CursoOpt[]>([]);
  const [tipos,         setTipos]         = useState<string[]>([]);
  const [todasUFs,      setTodasUFs]      = useState<UFOpt[]>([]);
  const [ufsRegiao,     setUfsRegiao]     = useState<UFOpt[]>([]);
  const [municipios,    setMunicipios]    = useState<MunicOpt[]>([]);
  // Dados
  const [stats,         setStats]         = useState<Record<string,unknown>|null>(null);
  const [socio,         setSocio]         = useState<Record<string,unknown>|null>(null);
  const [clusters,      setClusters]      = useState<Record<string,unknown>|null>(null);
  const [ml,            setMl]            = useState<Record<string,unknown>|null>(null);
  const [loading,       setLoading]       = useState(true);

  // Carrega opções de filtro na montagem
  useEffect(() => {
    axios.get("/api/filtros").then(res => {
      setCursos(res.data.cursos ?? []);
      setTipos(res.data.tipos ?? []);
      setTodasUFs(res.data.ufs ?? []);
    }).catch(console.error);
  }, []);

  // Quando região muda, filtra UFs
  useEffect(() => {
    setFiltroUF("");
    setFiltroMunicio("");
    setMunicipios([]);
    if (filtroRegiao) {
      setUfsRegiao(todasUFs.filter(u => String(u.co_regiao) === filtroRegiao));
    } else {
      setUfsRegiao([]);
    }
  }, [filtroRegiao, todasUFs]);

  // Quando UF muda, carrega municípios
  useEffect(() => {
    setFiltroMunicio("");
    setMunicipios([]);
    if (filtroUF) {
      axios.get(`/api/filtros?uf=${filtroUF}`).then(res => {
        setMunicipios(res.data ?? []);
      }).catch(console.error);
    }
  }, [filtroUF]);

  // Filtra cursos pelo tipo selecionado
  const cursosVisiveis = filtroTipo
    ? cursos.filter(c => {
        const tipoMap: Record<number,string> = {
          72:"Tecnologia", 79:"Tecnologia",
          4003:"Bacharelado", 4004:"Bacharelado",
          4005:"Licenciatura", 4006:"Bacharelado",
          5809:"Bacharelado", 6409:"Tecnologia",
        };
        return tipoMap[c.co_grupo] === filtroTipo;
      })
    : cursos;

  const buildParams = useCallback(() => {
    const p: Record<string,string> = {};
    if (filtroAno)     p.ano      = filtroAno;
    if (filtroCurso)   p.curso    = filtroCurso;
    if (filtroTipo)    p.tipo     = filtroTipo;
    if (filtroRegiao)  p.regiao   = filtroRegiao;
    if (filtroUF)      p.uf       = filtroUF;
    if (filtroMunicio) p.municipio = filtroMunicio;
    const s = new URLSearchParams(p).toString();
    return s ? "?" + s : "";
  }, [filtroAno, filtroCurso, filtroTipo, filtroRegiao, filtroUF, filtroMunicio]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = buildParams();
    Promise.all([
      axios.get(`/api/estatisticas${qs}`),
      axios.get(`/api/socioeconomico${qs}`),
      axios.get(`/api/clusters${qs}`),
      axios.get("/api/ml-metricas"),
    ]).then(([s,so,c,m]) => {
      if (cancelled) return;
      setStats(s.data); setSocio(so.data);
      setClusters(c.data); setMl(m.data);
    }).catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buildParams]);

  const limparFiltros = () => {
    setFiltroAno(""); setFiltroCurso(""); setFiltroTipo("");
    setFiltroRegiao(""); setFiltroUF(""); setFiltroMunicio("");
  };
  const temFiltro = filtroAno||filtroCurso||filtroTipo||filtroRegiao||filtroUF||filtroMunicio;

  // ── Dados derivados ─────────────────────────────────────────
  type Item = Record<string,unknown>;
  const faixaData  = ((stats?.distribuicao_faixa  as Item[])?? []).map((f:Item) => ({
    name: f.faixa_nota as string ?? "N/A",
    value: (f._count as Item).faixa_nota as number,
    fill: CORES_FAIXA[(f.faixa_nota as keyof typeof CORES_FAIXA)] ?? "#94a3b8",
  }));
  const anoData    = ((stats?.distribuicao_ano    as Item[])?? []).map((a:Item) => ({
    ano: String(a.nu_ano),
    estudantes: (a._count as Item).nu_ano as number,
    media: r((a._avg as Item).nt_ger as number),
  }));
  const cursoData  = ((stats?.distribuicao_curso  as Item[])?? []).map((c:Item) => ({
    nome: (c.curso_nome as string) ?? "N/A",
    total: (c._count as Item).co_grupo as number,
    media: r((c._avg as Item).nt_ger as number),
  }));
  const regiaoData = ((stats?.distribuicao_regiao as Item[])?? []).map((ri:Item) => ({
    nome: ri.regiao_nome as string ?? "N/A",
    total: (ri._count as Item).co_regiao as number,
    media: r((ri._avg as Item).nt_ger as number),
  }));

  type SocioItem = { nome:string; total:number; media:number };
  const rendaData    = (socio?.renda    as SocioItem[]) ?? [];
  const escolaData   = (socio?.escola   as SocioItem[]) ?? [];
  const racaData     = (socio?.raca     as SocioItem[]) ?? [];
  const trabalhaData = (socio?.trabalha as SocioItem[]) ?? [];
  const estudoData   = (socio?.estudo   as SocioItem[]) ?? [];
  const tipoIesData  = (socio?.tipo_ies as SocioItem[]) ?? [];

  type EvolItem = { ano:number; renda:string; media:number };
  const evolRenda = (socio?.evolucao_renda as EvolItem[]) ?? [];
  const evolPivot = [2014,2017,2021].map(ano => {
    const entries: [string, unknown][] = [["ano", String(ano)]];
    FAIXAS_RENDA.forEach(rn => {
      const found = evolRenda.find(e => e.ano === ano && e.renda === rn);
      entries.push([rn, found ? found.media : undefined]);
    });
    return Object.fromEntries(entries);
  });

  type PontoCluster = { pca_x:number; pca_y:number; cluster_id:number; nt_ger:number };
  const pontos     = (clusters?.pontos as PontoCluster[]) ?? [];
  const clusterGrp = [0,1,2,3].map(id => ({
    id, data: pontos.filter(p=>p.cluster_id===id).map(p=>({ x:p.pca_x, y:p.pca_y, nota:r(p.nt_ger) }))
  }));
  type StatCluster = { cluster_id:number; _count:{cluster_id:number}; _avg:{nt_ger:number;nt_fg:number;nt_ce:number} };
  const statsCluster = (clusters?.stats_por_cluster as StatCluster[]) ?? [];
  const radarData  = statsCluster.map(c => ({
    cluster: `Cluster ${c.cluster_id}`,
    "Nota Geral": r(c._avg.nt_ger),
    "Formação Geral": r(c._avg.nt_fg),
    "Componente Específico": r(c._avg.nt_ce),
  }));
  type ImportItem = { nome:string; percentual:number };
  const importancias  = (ml?.importancias as ImportItem[]) ?? [];
  const acuracia      = Math.round(((ml?.acuracia as number)??0)*10000)/100;
  const total         = (stats?.total_estudantes as number) ?? 0;
  const mediaGeral    = r(((stats?.media_notas as Item)?._avg as Item)?.nt_ger as number);
  const rendaMin      = rendaData[0]?.media ?? 0;
  const rendaMax      = rendaData[rendaData.length-1]?.media ?? 0;
  const multRenda     = rendaMax > 0 ? (rendaMax/rendaMin).toFixed(1) : "—";

  const comparativoHabitos = [
    { grupo:"Nenhuma / Não trabalha", trabalho: trabalhaData[0]?.media, estudo: estudoData[0]?.media },
    { grupo:"Baixa intensidade",      trabalho: trabalhaData[1]?.media, estudo: estudoData[1]?.media },
    { grupo:"Média intensidade",      trabalho: trabalhaData[2]?.media, estudo: estudoData[2]?.media },
    { grupo:"Alta intensidade",       trabalho: trabalhaData[3]?.media, estudo: estudoData[3]?.media },
  ];

  // Label do filtro de localização ativo
  const labelLocalizacao = filtroMunicio
    ? `Município ${filtroMunicio}`
    : filtroUF
    ? ufsRegiao.find(u=>String(u.co_uf)===filtroUF)?.nome ?? filtroUF
    : filtroRegiao
    ? REGIOES.find(r=>r.value===filtroRegiao)?.label ?? ""
    : "";

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h1 className="text-lg font-bold text-white">Análise de Egressos ENADE — Computação</h1>
              <p className="text-xs text-gray-400">2014 · 2017 · 2021 · Machine Learning · UFERSA TCC 2026.1</p>
            </div>
            {loading && <span className="text-xs text-gray-500 animate-pulse">Carregando...</span>}
          </div>

          {/* Filtros — linha 1: Ano, Tipo de ensino, Curso */}
          <div className="flex flex-wrap gap-2 mb-2">
            <Select value={filtroAno} onChange={v => setFiltroAno(v === "Todos" ? "" : v)}>
              {ANOS.map(a => <option key={a} value={a === "Todos" ? "" : a}>{a}</option>)}
            </Select>

            <Select value={filtroTipo} onChange={v => { setFiltroTipo(v); setFiltroCurso(""); }}>
              <option value="">Todos os tipos de ensino</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>

            <Select value={filtroCurso} onChange={setFiltroCurso}>
              <option value="">Todos os cursos</option>
              {cursosVisiveis.map(c => (
                <option key={c.co_grupo} value={String(c.co_grupo)}>{c.nome}</option>
              ))}
            </Select>
          </div>

          {/* Filtros — linha 2: Região → UF → Município (cascata) */}
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filtroRegiao} onChange={v => { setFiltroRegiao(v); setFiltroUF(""); setFiltroMunicio(""); }}>
              {REGIOES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>

            <Select
              value={filtroUF}
              onChange={v => { setFiltroUF(v); setFiltroMunicio(""); }}
              disabled={!filtroRegiao}
            >
              <option value="">
                {filtroRegiao ? "Todos os estados" : "← Selecione região"}
              </option>
              {ufsRegiao.map(u => (
                <option key={u.co_uf} value={String(u.co_uf)}>{u.sigla} — {u.nome}</option>
              ))}
            </Select>

            <Select
              value={filtroMunicio}
              onChange={setFiltroMunicio}
              disabled={!filtroUF}
            >
              <option value="">
                {filtroUF ? `Todos os municípios${municipios.length ? ` (${municipios.length})` : ""}` : "← Selecione estado"}
              </option>
              {municipios.map(m => (
                <option key={m.co_municipio} value={String(m.co_municipio)}>
                  {m.nome}
                </option>
              ))}
            </Select>

            {temFiltro && (
              <button onClick={limparFiltros}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 border border-indigo-500/30 rounded-lg py-1.5">
                ✕ Limpar filtros
              </button>
            )}

            {labelLocalizacao && (
              <span className="text-xs bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg">
                📍 {labelLocalizacao}
              </span>
            )}
          </div>

          {/* Abas */}
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {ABAS.map((a,i) => (
              <button key={i} onClick={() => setAba(i)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  aba===i ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">

        {/* ── ABA 0: Visão Geral ── */}
        {aba===0 && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Estudantes analisados" value={total.toLocaleString("pt-BR")} sub="com nota válida no ENADE" color="indigo"/>
            <Card title="Média geral ENADE" value={mediaGeral.toFixed(1)} sub="escala 0–100, todos os anos" color="green"/>
            <Card title="Diferença por renda" value={`${multRenda}×`} sub="nota máx vs mínima por faixa" color="amber" delta="⚠ Desigualdade crítica"/>
            <Card title="Acurácia Random Forest" value={`${acuracia}%`} sub="classificação de desempenho" color="rose"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Estudantes e média por ano">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={anoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:12}} padding={{left:70,right:70}}/>
                  <YAxis yAxisId="l" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <YAxis yAxisId="r" orientation="right" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar yAxisId="l" dataKey="estudantes" fill="#6366f1" name="Estudantes" radius={[4,4,0,0]} barSize={60}/>
                  <Line yAxisId="r" type="monotone" dataKey="media" stroke="#10b981" strokeWidth={2} dot={{fill:"#10b981"}} name="Média nota"/>
                </LineChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Distribuição por faixa de desempenho" sub="Baseado na nota geral (NT_GER) — escala 0 a 100">
              <div className="flex justify-center gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/>
                  <span className="text-xs text-gray-200">Baixo <span className="text-red-400 font-semibold">0 – 33,3 pts</span></span>
                </div>
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/>
                  <span className="text-xs text-gray-200">Médio <span className="text-amber-400 font-semibold">33,3 – 48,5 pts</span></span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/>
                  <span className="text-xs text-gray-200">Alto <span className="text-emerald-400 font-semibold">acima de 48,5 pts</span></span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={faixaData} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name"
                    label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(2)}%`} labelLine={false}>
                    {faixaData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                  </Pie>
                  <Tooltip {...TT}/>
                </PieChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Média de nota por curso">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cursoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[0,70]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:9}} width={200}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[0,4,4,0]}>
                    {cursoData.map((_,i)=><Cell key={i} fill={CORES_GRADIENTE[i%CORES_GRADIENTE.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Estudantes e média por região">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={regiaoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:11}}/>
                  <YAxis yAxisId="l" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <YAxis yAxisId="r" orientation="right" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar yAxisId="l" dataKey="total" fill="#8b5cf6" name="Estudantes" radius={[4,4,0,0]}/>
                  <Line yAxisId="r" type="monotone" dataKey="media" stroke="#f59e0b" strokeWidth={2} name="Média"/>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>
        </>}

        {/* ── ABA 1: Socioeconômico ── */}
        {aba===1 && <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card title="Menor média (menor renda)" value={rendaData[0]?.media.toFixed(1)??"-"} sub={rendaData[0]?.nome??"—"} color="rose"/>
            <Card title="Maior média (maior renda)" value={rendaData[rendaData.length-1]?.media.toFixed(1)??"-"} sub={rendaData[rendaData.length-1]?.nome??"—"} color="green"/>
            <Card title="Fator de desigualdade" value={`${multRenda}×`} sub="nota máx ÷ mínima por renda" color="amber" delta="Correlação fortíssima"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Renda familiar × Média no ENADE" sub="Correlação quase linear — principal preditor de desempenho">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rendaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} angle={-20} textAnchor="end" height={50}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}} domain={[0,90]}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[4,4,0,0]}>
                    {rendaData.map((_,i)=><Cell key={i} fill={CORES_RENDA[i%CORES_RENDA.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Evolução da nota por faixa de renda (2014–2021)" sub="Faixa '10 a 30 SM' ausente em 2021 nos microdados INEP">
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={evolPivot}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}}/>
                  <Tooltip {...TT}/>
                  <Line type="monotone" dataKey="Até 1,5 SM" stroke={CORES_RENDA[0]} strokeWidth={2} dot={{r:3}} name="Até 1,5 SM"/>
                  <Line type="monotone" dataKey="1,5 a 3 SM" stroke={CORES_RENDA[1]} strokeWidth={2} dot={{r:3}} name="1,5 a 3 SM"/>
                  <Line type="monotone" dataKey="3 a 4,5 SM" stroke={CORES_RENDA[2]} strokeWidth={2} dot={{r:3}} name="3 a 4,5 SM"/>
                  <Line type="monotone" dataKey="4,5 a 6 SM" stroke={CORES_RENDA[3]} strokeWidth={2} dot={{r:3}} name="4,5 a 6 SM"/>
                  <Line type="monotone" dataKey="6 a 10 SM"  stroke={CORES_RENDA[4]} strokeWidth={2} dot={{r:3}} name="6 a 10 SM"/>
                  <Line type="monotone" dataKey="10 a 30 SM" stroke={CORES_RENDA[5]} strokeWidth={2} dot={{r:3}} name="10 a 30 SM"/>
                </LineChart>
              </ResponsiveContainer>
              <LegendaRenda/>
            </Section>

            <Section title="Tipo de escola no Ensino Médio × Nota" sub="Quem estudou em escola pública integral tem menor nota média">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={escolaData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[0,70]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} width={160}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[0,4,4,0]}>
                    {escolaData.map((_,i)=><Cell key={i} fill={CORES_GRADIENTE[i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Tipo de IES × Nota média" sub="Diferença entre categorias administrativas das instituições">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tipoIesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[35,55]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} width={160}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[0,4,4,0]}>
                    {tipoIesData.map((_,i)=><Cell key={i} fill={CORES_GRADIENTE[i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>
        </>}

        {/* ── ABA 2: Raça & Gênero ── */}
        {aba===2 && <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Raça/Cor autodeclarada × Média no ENADE" sub="Desigualdade racial significativa nos resultados">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={racaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:11}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}} domain={[0,90]}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[4,4,0,0]}>
                    {racaData.map((_,i)=><Cell key={i} fill={CORES_RACA[i%CORES_RACA.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Distribuição de estudantes por raça/cor" sub="Composição racial do corpo discente nos cursos de Computação">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={racaData} cx="50%" cy="50%" outerRadius={95} dataKey="total" nameKey="nome"
                    label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(2)}%`} labelLine={false}>
                    {racaData.map((_,i)=><Cell key={i} fill={CORES_RACA[i%CORES_RACA.length]}/>)}
                  </Pie>
                  <Tooltip {...TT}/>
                </PieChart>
              </ResponsiveContainer>
            </Section>
          </div>
          <Section title="Índice de desigualdade por grupo racial" sub="Comparativo entre grupos raciais autodeclarados">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 text-gray-400">Raça/Cor</th>
                    <th className="text-right py-2 text-gray-400">Estudantes</th>
                    <th className="text-right py-2 text-gray-400">Média nota</th>
                    <th className="text-right py-2 text-gray-400">% do total</th>
                    <th className="py-2 text-gray-400 text-left pl-4">Desempenho relativo</th>
                  </tr>
                </thead>
                <tbody>
                  {racaData.map((raca,i)=>{
                    const pct = total > 0 ? (raca.total/total*100).toFixed(2) : "0";
                    const pctNota = Math.min(raca.media/90*100,100);
                    return (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="py-2 text-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full inline-block" style={{background:CORES_RACA[i%CORES_RACA.length]}}/>
                            {raca.nome}
                          </div>
                        </td>
                        <td className="py-2 text-right text-gray-300">{raca.total.toLocaleString("pt-BR")}</td>
                        <td className="py-2 text-right font-semibold" style={{color:CORES_RACA[i%CORES_RACA.length]}}>{raca.media.toFixed(2)}</td>
                        <td className="py-2 text-right text-gray-400">{pct}%</td>
                        <td className="py-2 pl-4">
                          <div className="h-1.5 bg-gray-700 rounded-full w-32">
                            <div className="h-full rounded-full" style={{width:`${pctNota}%`,background:CORES_RACA[i%CORES_RACA.length]}}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>}

        {/* ── ABA 3: Hábitos ── */}
        {aba===3 && <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Horas de trabalho × Nota média" sub="Estudantes que trabalham mais têm notas maiores — efeito de seleção">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={trabalhaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:11}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}} domain={[0,90]}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[4,4,0,0]}>
                    {trabalhaData.map((_,i)=><Cell key={i} fill={CORES_GRADIENTE[i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-amber-400 mt-2">⚠ Contra-intuitivo: pode indicar maior maturidade ou renda familiar associada ao trabalho</p>
            </Section>
            <Section title="Horas de estudo × Nota média" sub="Correlação direta: mais estudo = melhor desempenho">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={estudoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:11}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}} domain={[0,90]}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[4,4,0,0]}>
                    {estudoData.map((_,i)=><Cell key={i} fill={CORES_RENDA[i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Comparativo: trabalho vs estudo" sub="Distribuição de estudantes por perfil de hábito">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-2 font-medium">Horas de trabalho</p>
                  {trabalhaData.map((t,i)=>(
                    <div key={i} className="mb-2">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-300">{t.nome}</span>
                        <span className="text-gray-400">{t.total.toLocaleString("pt-BR")} ({(t.total/total*100).toFixed(2)}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full">
                        <div className="h-full rounded-full" style={{width:`${t.total/total*100}%`,background:CORES_GRADIENTE[i]}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2 font-medium">Horas de estudo</p>
                  {estudoData.map((e,i)=>(
                    <div key={i} className="mb-2">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-300">{e.nome}</span>
                        <span className="text-gray-400">{e.total.toLocaleString("pt-BR")} ({(e.total/total*100).toFixed(2)}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full">
                        <div className="h-full rounded-full" style={{width:`${e.total/total*100}%`,background:CORES_RENDA[i]}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
            <Section title="Nota média: trabalho vs estudo por intensidade" sub="Comparação direta entre perfis de dedicação">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={comparativoHabitos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="grupo" tick={{fill:"#9ca3af",fontSize:10}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}} domain={[0,90]}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar dataKey="trabalho" name="Horas de trabalho" fill="#6366f1" radius={[4,4,0,0]} barSize={28}/>
                  <Bar dataKey="estudo"   name="Horas de estudo"   fill="#10b981" radius={[4,4,0,0]} barSize={28}/>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>
        </>}

        {/* ── ABA 4: Clusters & ML ── */}
        {aba===4 && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statsCluster.map((c,i)=>(
              <Card key={i}
                title={`Cluster ${c.cluster_id} — ${PERFIS_CLUSTER[i]?.rotulo}`}
                value={c._count.cluster_id.toLocaleString("pt-BR")}
                sub={PERFIS_CLUSTER[i]?.detalhe}
                color={["indigo","green","amber","rose"][i] as "indigo"|"green"|"amber"|"rose"}/>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PERFIS_CLUSTER.map((p,i)=>(
              <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 flex gap-3 items-start">
                <span className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{background:CORES_CLUSTER[i]}}/>
                <div>
                  <p className="text-xs font-semibold text-gray-200">Cluster {i} — {p.rotulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.detalhe}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Clusters K-Means — Visualização PCA" sub="Cada ponto é um estudante. Cores = 4 perfis identificados pelo algoritmo">
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" dataKey="x" name="PC1" tick={{fill:"#9ca3af",fontSize:11}}/>
                  <YAxis type="number" dataKey="y" name="PC2" tick={{fill:"#9ca3af",fontSize:11}}/>
                  <Tooltip cursor={{strokeDasharray:"3 3"}} {...TT}/>
                  <Legend/>
                  {clusterGrp.map(g=>(
                    <Scatter key={g.id} name={`Cluster ${g.id}`} data={g.data}
                      fill={CORES_CLUSTER[g.id]} opacity={0.55}/>
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Perfil médio por cluster — Radar" sub="Comparação das 3 dimensões de nota entre os perfis">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#374151"/>
                  <PolarAngleAxis dataKey="cluster" tick={{fill:"#9ca3af",fontSize:11}}/>
                  {["Nota Geral","Formação Geral","Componente Específico"].map((k,i)=>(
                    <Radar key={k} name={k} dataKey={k} stroke={CORES_CLUSTER[i]} fill={CORES_CLUSTER[i]} fillOpacity={0.15}/>
                  ))}
                  <Legend/><Tooltip {...TT}/>
                </RadarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Importância das variáveis — Random Forest" sub="Fatores que mais predizem o desempenho no ENADE">
              <div className="space-y-3">
                {importancias.map((f,i)=>(
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{f.nome}</span>
                      <span className="text-indigo-400 font-semibold">{f.percentual}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                        style={{width:`${Math.min(f.percentual*3,100)}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-800 text-xs text-gray-500">
                Acurácia: <span className="text-emerald-400 font-semibold">{acuracia}%</span>
                {" · "}100 árvores · validação hold-out 20%
              </div>
            </Section>
            <Section title="Métricas por classe" sub="Precisão do classificador por faixa de desempenho">
              {((ml?.metricas_classe as Array<{classe:string;f1_score:number;detalhe:{precision:number;recall:number;support:number}}>) ?? [])
                .filter(m=>["baixo","medio","alto"].includes(m.classe ?? ""))
                .map((m,i)=>(
                  <div key={i} className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize" style={{color:["#ef4444","#f59e0b","#10b981"][i]}}>{m.classe}</span>
                      <span className="text-xs text-gray-400">F1-score: <span className="text-white font-semibold">{(m.f1_score*100).toFixed(2)}%</span></span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {([["Precisão",m.detalhe?.precision],["Recall",m.detalhe?.recall],["Support",m.detalhe?.support]] as [string,number][]).map(([k,v],j)=>(
                        <div key={j} className="bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-gray-500">{k}</p>
                          <p className="text-white font-semibold">{typeof v==="number"&&v<2?(v*100).toFixed(2)+"%":Number(v).toLocaleString("pt-BR")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </Section>
          </div>
        </>}
      </main>
    </div>
  );
}
