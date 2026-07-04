"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ComposedChart,
} from "recharts";

// ── Constantes ────────────────────────────────────────────────
const CORES_CLUSTER   = ["#6366f1","#10b981","#f59e0b","#ef4444"];
const CORES_FAIXA     = { alto:"#10b981", medio:"#f59e0b", baixo:"#ef4444" };
const CORES_GRADIENTE = ["#4f46e5","#6366f1","#818cf8","#a5b4fc","#c7d2fe","#e0e7ff"];
const CORES_RENDA     = ["#ef4444","#f97316","#eab308","#84cc16","#22c55e","#10b981"];
const CORES_RACA      = ["#94a3b8","#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe"];
const CORES_HABITO    = ["#534AB7","#7F77DD","#0F6E56","#1D9E75","#185FA5"];
const CORES_RACA_G    = ["#94a3b8","#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe"];
const CORES_REGIAO    = ["#2a78d6","#1baf7a","#eda100","#4a3aa7","#e34948"];
const LINE_HABITO     = "#888780";

const CORES_PCA  = ["#6366f1","#10b981","#f59e0b","#ef4444"];
const NOMES_PCA  = ["Desempenho médio","Baixo desempenho público","Baixo desempenho privado","Alto desempenho"];
const MEDIAS_PCA = [31.7, 62.6, 50.8, 74.9];
const TOTAL_PCA  = [65451, 27646, 29014, 5132];

const ANOS  = ["Todos","2014","2017","2021"];
const ABAS  = ["Visão Geral","Socioeconômico","Raça/Cor","Hábitos","Clusters & ML","Previsão"];
const FAIXAS_RENDA = ["Até 1,5 SM","1,5 a 3 SM","3 a 4,5 SM","4,5 a 6 SM","6 a 10 SM","10 a 30 SM"];
const PERFIS_CLUSTER = [
  { rotulo:"Desempenho médio",         detalhe:"Renda média · IES privada" },
  { rotulo:"Baixo desempenho público", detalhe:"Renda baixa · IES federal" },
  { rotulo:"Baixo desempenho privado", detalhe:"Renda baixa · IES privada" },
  { rotulo:"Alto desempenho",          detalhe:"Renda alta · Mais estudo"  },
];
const REGIOES = [
  { value:"",  label:"Todas as regiões" },
  { value:"0", label:"Norte"            },
  { value:"1", label:"Nordeste"         },
  { value:"2", label:"Sudeste"          },
  { value:"3", label:"Sul"              },
  { value:"4", label:"Centro-Oeste"     },
];
const NOMES_FEATURE: Record<string,string> = {
  QE_I05:"Renda familiar", QE_I19:"Horas de trabalho",
  QE_I18:"Trabalha atualmente", QE_I08:"Financiamento estudantil",
  QE_I02:"Tipo de escola no EM", QE_I04:"Raça/Cor",
  QE_I17:"Horas de estudo", CO_CATEGAD:"Categoria IES",
  CO_REGIAO_CURSO:"Região",
};

function r(v: number|null|undefined) { return Math.round((v??0)*10)/10; }

// ── Tipos ─────────────────────────────────────────────────────
type CursoOpt     = { co_grupo:number; nome:string };
type UFOpt        = { co_uf:number; sigla:string; nome:string; co_regiao:number };
type MunicOpt     = { co_municipio:number; nome:string };
type Item         = Record<string,unknown>;
type SocioItem    = { nome:string; total:number; media:number };
type HabitoItem   = { categoria:string; total:number; pct:number; media_nota:number };
type HabitoResult = { variavel:string; label:string; dados:HabitoItem[] };
type HabitosData  = { total:number; habitos:HabitoResult[] };
type PontoCluster = { x:number; y:number; cluster_id:number; total:number; media_nota:number; r:number };
type ImportItemApi = { feature:string; valor:number };
type MetricaClasse = { classe:string; f1:number; precision:number; recall:number; support:number };
type RacaItem     = { nome:string; codigo:string; total:number; pct:number; media_nota:number };
type RacaData     = { total:number; raca:RacaItem[] };
type RendaRedeItem= { nome:string; codigo:string; publica:number; privada:number; n_pub:number; n_priv:number; delta:number };
type CursoRedeItem= { curso:string; publica:number; privada:number; delta:number };
type RacaRendaCell= { codigo:string; nome:string; media:number; total:number };
type RacaRendaItem= { raca:string; rendas:RacaRendaCell[] };
type FinRedeItem  = { nome:string; codigo:string; publica:number|null; privada:number|null };
type TendItem     = { ano:number; media:number|null; projecao:number|null; tipo:string };
type TendCurso    = { curso:string; r2:number; b1:number; confiavel:boolean; dados:TendItem[] };
type TendRedeItem = { b1:number; r2:number; dados:TendItem[] };
type PrevisaoData = {
  tendencia_geral: TendItem[];
  tendencia_cursos: TendCurso[];
  tendencia_rede: Record<string,TendRedeItem>;
  resumo: { tendencia_geral_b1:number; tendencia_geral_r2:number; previsao_2024:number; previsao_2027:number; cursos_confiaveis:number; cursos_nao_confiaveis:number };
  anos_reais: number[]; anos_proj: number[];
};
type BivData      = { renda_vs_rede:RendaRedeItem[]; curso_vs_rede:CursoRedeItem[]; raca_vs_renda:RacaRendaItem[]; fin_vs_rede:FinRedeItem[]; composicao_racial_renda:Record<string,number|string>[] };
type FinItem      = { nome:string; codigo:string; total:number; media:number };
type EcItem       = { nome:string; codigo:string; total:number; media:number };
type NtTipo       = { tipo:string; total:number; media_ger:number; media_fg:number; media_ce:number };
type ModalItem    = { ano:string; presencial:number; ead_nd:number; total:number };
type RedeItem     = { ano:string; publica:number; privada:number; total:number; pct_pub:number; pct_priv:number };
type UFItem       = { uf:string; nome:string; total:number; media:number; regiao:string };
type RegiaoItem   = { regiao:string; total:number; media:number };
type CoberturaItem= { ano:string; validos:number; total:number; sem_nota:number; pct_validos:number };
type VGData       = { modalidade:ModalItem[]; rede:RedeItem[]; por_uf:UFItem[]; por_regiao:RegiaoItem[]; cobertura:CoberturaItem[]; resumo:{total_extraido:number;total_validos:number;total_sem_nota:number;pct_validos:number} };
type EvolCurso    = { curso:string; "2014":number|null; "2017":number|null; "2021":number|null };
type RendaFaixa   = { nome:string; codigo:string; baixo:number; medio:number; alto:number; total:number; pct_baixo:number; pct_medio:number; pct_alto:number };
type InetItem     = { nome:string; codigo:string; total:number; media:number };
type HistItem     = { faixa:string; "2014":number; "2017":number; "2021":number };
type MatrizItem   = { real:string; baixo:number; medio:number; alto:number; total_real:number; acerto:number; pct_acerto:number };
type AnaliseData  = { evolucao_por_curso:EvolCurso[]; renda_vs_faixa:RendaFaixa[]; acesso_internet:InetItem[]; histograma:HistItem[]; matriz_confusao:MatrizItem[]; total_matriz:number };

const TT = { contentStyle:{ backgroundColor:"#1f2937", border:"none", borderRadius:8, fontSize:12 } };

// ── Componentes base ──────────────────────────────────────────
function Card({ title, value, sub, color="indigo", delta }: {
  title:string; value:string|number; sub?:string; color?:string; delta?:string;
}) {
  const bg: Record<string,string> = {
    indigo:"from-indigo-500 to-indigo-700", green:"from-emerald-500 to-emerald-700",
    amber:"from-amber-500 to-amber-700",    rose:"from-rose-500 to-rose-700",
    purple:"from-purple-500 to-purple-700", sky:"from-sky-500 to-sky-700",
    gray:"from-gray-500 to-gray-700",
  };
  return (
    <div className={`bg-gradient-to-br ${bg[color]??bg.indigo} rounded-2xl p-5 text-white shadow-lg`}>
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
      {FAIXAS_RENDA.map((nome,i) => (
        <div key={nome} className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-0.5 rounded" style={{background:CORES_RENDA[i]}}/>
          <span className="text-xs text-gray-300">{nome}</span>
        </div>
      ))}
    </div>
  );
}

function Select({ value, onChange, children, disabled=false }: {
  value:string; onChange:(v:string)=>void; children:React.ReactNode; disabled?:boolean;
}) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}
      suppressHydrationWarning
      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white
                 focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed">
      {children}
    </select>
  );
}

const TooltipHabito = ({ active, payload, label }: { active?:boolean; payload?:any[]; label?:string }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#1f2937",borderRadius:8,padding:"10px 14px",fontSize:12}}>
      <p style={{margin:"0 0 6px",fontWeight:500,color:"#e5e7eb"}}>{label}</p>
      {payload.map((e:any) => (
        <p key={e.name} style={{margin:"2px 0",color:e.color}}>
          {e.name==="media_nota"
            ? `Média NT_GER: ${e.value.toFixed(1)} pts`
            : `Estudantes: ${e.value.toLocaleString("pt-BR")} (${payload[0]?.payload?.pct??""}%)`}
        </p>
      ))}
    </div>
  );
};

function HabitoCard({ habito }: { habito:HabitoResult }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <p className="text-sm font-semibold text-gray-200 mb-0.5">{habito.label}</p>
      <p className="text-xs text-gray-500 mb-4">Barras = média NT_GER · Linha = nº de estudantes</p>
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={habito.dados} margin={{top:8,right:16,left:0,bottom:32}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false}/>
          <XAxis dataKey="categoria" tick={{fill:"#9ca3af",fontSize:11}} angle={-18} textAnchor="end" interval={0}/>
          <YAxis yAxisId="nota" domain={[0,90]} tick={{fill:"#9ca3af",fontSize:11}}
            label={{value:"Média NT_GER",angle:-90,position:"insideLeft",offset:10,style:{fontSize:11,fill:"#6b7280"}}}/>
          <YAxis yAxisId="total" orientation="right"
            tickFormatter={(v:number)=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)}
            tick={{fill:"#9ca3af",fontSize:11}}/>
          <Tooltip content={<TooltipHabito/>}/>
          <Legend verticalAlign="top"
            formatter={(v:string)=>v==="media_nota"?"Média NT_GER":"Nº estudantes"}
            wrapperStyle={{fontSize:12,paddingBottom:4,color:"#9ca3af"}}/>
          <Bar yAxisId="nota" dataKey="media_nota" name="media_nota" radius={[4,4,0,0]}>
            {habito.dados.map((_,i)=><Cell key={i} fill={CORES_HABITO[i%CORES_HABITO.length]}/>)}
          </Bar>
          <Line yAxisId="total" dataKey="total" name="total" type="monotone"
            stroke={LINE_HABITO} strokeWidth={2} strokeDasharray="5 3"
            dot={{r:4,fill:LINE_HABITO}} activeDot={{r:6}}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScatterPCA({ clusterGrp }: { clusterGrp:{ id:number; data:PontoCluster[] }[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hidden,  setHidden]  = useState([false,false,false,false]);
  const [opacity, setOpacity] = useState(70);
  const [tip, setTip] = useState<{ visible:boolean; x:number; y:number; p:(PontoCluster&{c:number})|null }>
    ({ visible:false, x:0, y:0, p:null });

  const xMin=-4, xMax=12, yMin=-4.5, yMax=4.5;
  const PAD={l:52,r:16,t:16,b:44}; const VW=640, VH=340;
  const PW=VW-PAD.l-PAD.r, PH=VH-PAD.t-PAD.b;
  const px=(x:number)=>PAD.l+((x-xMin)/(xMax-xMin))*PW;
  const py=(y:number)=>PAD.t+(1-(y-yMin)/(yMax-yMin))*PH;
  const pr=(n:number)=>Math.max(4,Math.min(36,Math.sqrt(n)*0.8));

  function handleEnter(e:React.MouseEvent<SVGCircleElement>,p:PontoCluster,c:number) {
    const svg=svgRef.current; if (!svg) return;
    const sr=svg.getBoundingClientRect();
    const scX=sr.width/VW, scY=sr.height/VH;
    const cx=px(p.x)*scX+sr.left, cy=py(p.y)*scY+sr.top;
    const pr2=svg.parentElement!.getBoundingClientRect();
    let lft=cx-pr2.left+14, top=cy-pr2.top-10;
    if (lft+210>pr2.width) lft=cx-pr2.left-220;
    if (top<0) top=4;
    setTip({ visible:true, x:lft, y:top, p:{...p,c} });
  }

  const xTicks=[-4,-2,0,4,8,12]; const yTicks=[-4,-2,0,2,4];

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <p className="text-sm font-semibold text-gray-200 mb-0.5">Clusters K-Means — Visualização PCA</p>
      <p className="text-xs text-gray-500 mb-3">Tamanho do círculo ∝ nº de estudantes</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {NOMES_PCA.map((nome,c)=>(
          <button key={c} onClick={()=>setHidden(h=>h.map((v,i)=>i===c?!v:v))}
            className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-gray-800"
            style={{opacity:hidden[c]?0.35:1}}>
            <span className="rounded-full flex-shrink-0" style={{width:10,height:10,display:"inline-block",background:CORES_PCA[c],opacity:0.85}}/>
            <span className="text-gray-300">{`C${c} — ${nome}`}</span>
            <span className="text-gray-600 ml-1">{TOTAL_PCA[c].toLocaleString("pt-BR")}</span>
          </button>
        ))}
      </div>
      <div style={{position:"relative"}}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{display:"block",overflow:"visible"}}>
          {yTicks.map(v=>(
            <line key={`y${v}`} x1={PAD.l} y1={py(v)} x2={VW-PAD.r} y2={py(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray={v===0?"none":"4 4"}/>
          ))}
          {xTicks.map(v=>(
            <line key={`x${v}`} x1={px(v)} y1={PAD.t} x2={px(v)} y2={VH-PAD.b} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray={v===0?"none":"4 4"}/>
          ))}
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={VH-PAD.b} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5}/>
          <line x1={PAD.l} y1={VH-PAD.b} x2={VW-PAD.r} y2={VH-PAD.b} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5}/>
          {xTicks.map(v=><text key={`tx${v}`} x={px(v)} y={VH-PAD.b+14} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.3)">{v}</text>)}
          {yTicks.map(v=><text key={`ty${v}`} x={PAD.l-6} y={py(v)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="rgba(255,255,255,0.3)">{v}</text>)}
          <text x={PAD.l+PW/2} y={VH-4} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.35)">PC1 — perfil socioeconômico (63,4% da variância)</text>
          <text x={12} y={PAD.t+PH/2} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.35)" transform={`rotate(-90,12,${PAD.t+PH/2})`}>PC2 — hábitos (12,8%)</text>
          {clusterGrp.map(g=>hidden[g.id]?null:g.data.map((p,i)=>(
            <circle key={i} cx={px(p.x)} cy={py(p.y)} r={pr(p.total)}
              fill={CORES_PCA[g.id]} fillOpacity={opacity/100}
              stroke={CORES_PCA[g.id]} strokeWidth={1} strokeOpacity={0.9}
              style={{cursor:"pointer"}}
              onMouseEnter={e=>handleEnter(e,p,g.id)}
              onMouseLeave={()=>setTip(t=>({...t,visible:false}))}/>
          )))}
        </svg>
        {tip.visible && tip.p && (
          <div style={{position:"absolute",left:tip.x,top:tip.y,background:"#111827",border:"0.5px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"10px 14px",fontSize:12,pointerEvents:"none",zIndex:10,minWidth:190}}>
            <p style={{color:CORES_PCA[tip.p.c],fontWeight:500,margin:"0 0 6px"}}>Cluster {tip.p.c} — {NOMES_PCA[tip.p.c]}</p>
            <p style={{color:"#9ca3af",margin:"2px 0"}}>PC1: {tip.p.x.toFixed(3)} · PC2: {tip.p.y.toFixed(3)}</p>
            <p style={{color:"#9ca3af",margin:"2px 0"}}>Estudantes: <strong style={{color:"#e5e7eb"}}>{tip.p.total.toLocaleString("pt-BR")}</strong></p>
            <p style={{color:"#9ca3af",margin:"2px 0"}}>Média NT_GER: <strong style={{color:"#e5e7eb"}}>{MEDIAS_PCA[tip.p.c].toFixed(1)} pts</strong></p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-3" style={{fontSize:12,color:"#6b7280"}}>
        <span>Opacidade</span>
        <input type="range" min={10} max={100} step={5} value={opacity} onChange={e=>setOpacity(Number(e.target.value))} style={{width:100}}/>
        <span style={{minWidth:32}}>{opacity}%</span>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard() {
  const [aba, setAba] = useState(0);
  const [filtroAno,     setFiltroAno]     = useState("");
  const [filtroCurso,   setFiltroCurso]   = useState("");
  const [filtroTipo,    setFiltroTipo]    = useState("");
  const [filtroRegiao,  setFiltroRegiao]  = useState("");
  const [filtroUF,      setFiltroUF]      = useState("");
  const [filtroMunicio, setFiltroMunicio] = useState("");
  const [cursos,     setCursos]     = useState<CursoOpt[]>([]);
  const [tipos,      setTipos]      = useState<string[]>([]);
  const [todasUFs,   setTodasUFs]   = useState<UFOpt[]>([]);
  const [ufsRegiao,  setUfsRegiao]  = useState<UFOpt[]>([]);
  const [municipios, setMunicipios] = useState<MunicOpt[]>([]);
  const [stats,      setStats]      = useState<Record<string,unknown>|null>(null);
  const [socio,      setSocio]      = useState<Record<string,unknown>|null>(null);
  const [clusters,   setClusters]   = useState<Record<string,unknown>|null>(null);
  const [ml,         setMl]         = useState<Record<string,unknown>|null>(null);
  const [habitos,    setHabitos]    = useState<HabitosData|null>(null);
  const [racaData,  setRacaData]  = useState<RacaData|null>(null);
  const [bivData,   setBivData]   = useState<BivData|null>(null);
  const [prevData,  setPrevData]  = useState<PrevisaoData|null>(null);
  const [vgData,     setVgData]     = useState<VGData|null>(null);
  const [analiseData,setAnaliseData]= useState<AnaliseData|null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(()=>{
    axios.get("/api/filtros").then(res=>{
      setCursos(res.data.cursos??[]); setTipos(res.data.tipos??[]); setTodasUFs(res.data.ufs??[]);
    }).catch(console.error);
    axios.get("/api/visao-geral").then(res=>setVgData(res.data)).catch(console.error);
    axios.get("/api/analise").then(res=>setAnaliseData(res.data)).catch(console.error);
    axios.get("/api/bivariado").then(res=>setBivData(res.data)).catch(console.error);
    axios.get("/api/previsao").then(res=>setPrevData(res.data)).catch(console.error);
  },[]);

  useEffect(()=>{
    setFiltroUF(""); setFiltroMunicio(""); setMunicipios([]);
    if (filtroRegiao) setUfsRegiao(todasUFs.filter(u=>String(u.co_regiao)===filtroRegiao));
    else setUfsRegiao([]);
  },[filtroRegiao,todasUFs]);

  useEffect(()=>{
    setFiltroMunicio(""); setMunicipios([]);
    if (filtroUF) axios.get(`/api/filtros?uf=${filtroUF}`).then(res=>setMunicipios(res.data??[])).catch(console.error);
  },[filtroUF]);

  const cursosVisiveis = filtroTipo
    ? cursos.filter(c=>{
        const m:Record<number,string>={72:"Tecnologia",79:"Tecnologia",4003:"Bacharelado",4004:"Bacharelado",4005:"Licenciatura",4006:"Bacharelado",5809:"Bacharelado",6409:"Tecnologia"};
        return m[c.co_grupo]===filtroTipo;
      })
    : cursos;

  const buildParams = useCallback(()=>{
    const p:Record<string,string>={};
    if (filtroAno)     p.ano=filtroAno;
    if (filtroCurso)   p.curso=filtroCurso;
    if (filtroTipo)    p.tipo=filtroTipo;
    if (filtroRegiao)  p.regiao=filtroRegiao;
    if (filtroUF)      p.uf=filtroUF;
    if (filtroMunicio) p.municipio=filtroMunicio;
    const s=new URLSearchParams(p).toString();
    return s?"?"+s:"";
  },[filtroAno,filtroCurso,filtroTipo,filtroRegiao,filtroUF,filtroMunicio]);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    const qs=buildParams();
    Promise.all([
      axios.get(`/api/estatisticas${qs}`),
      axios.get(`/api/socioeconomico${qs}`),
      axios.get(`/api/clusters${qs}`),
      axios.get("/api/ml-metricas"),
      axios.get(`/api/habitos${qs}`),
      axios.get(`/api/raca${qs}`),
    ]).then(([s,so,c,m,h,g])=>{
      if (cancelled) return;
      setStats(s.data); setSocio(so.data); setClusters(c.data);
      setMl(m.data); setHabitos(h.data); setRacaData(g.data);
    }).catch(console.error)
      .finally(()=>{ if (!cancelled) setLoading(false); });
    return ()=>{ cancelled=true; };
  },[buildParams]);

  const limparFiltros=()=>{ setFiltroAno(""); setFiltroCurso(""); setFiltroTipo(""); setFiltroRegiao(""); setFiltroUF(""); setFiltroMunicio(""); };
  const temFiltro=filtroAno||filtroCurso||filtroTipo||filtroRegiao||filtroUF||filtroMunicio;

  // ── Dados derivados ───────────────────────────────────────
  const faixaData  = ((stats?.distribuicao_faixa  as Item[])??[]).map((f:Item)=>({ name:f.faixa_nota as string??"N/A", value:(f._count as Item).faixa_nota as number, fill:CORES_FAIXA[(f.faixa_nota as keyof typeof CORES_FAIXA)]??"#94a3b8" }));
  const anoData    = ((stats?.distribuicao_ano    as Item[])??[]).map((a:Item)=>({ ano:String(a.nu_ano), estudantes:(a._count as Item).nu_ano as number, media:r((a._avg as Item).nt_ger as number) }));
  const cursoData  = ((stats?.distribuicao_curso  as Item[])??[]).map((c:Item)=>({ nome:(c.curso_nome as string)??"N/A", total:(c._count as Item).co_grupo as number, media:r((c._avg as Item).nt_ger as number) }));

  const rendaData          = (socio?.renda          as SocioItem[])??[];
  const escolaData         = (socio?.escola         as SocioItem[])??[];
  const trabalhaData       = (socio?.trabalha       as SocioItem[])??[];
  const estudoData         = (socio?.estudo         as SocioItem[])??[];
  const tipoIesData        = (socio?.tipo_ies       as SocioItem[])??[];
  const financiamentoData  = (socio?.financiamento  as FinItem[])??[];
  const estadoCivilData    = (socio?.estado_civil   as EcItem[])??[];
  const ntPorTipo          = (socio?.nt_por_tipo    as NtTipo[])??[];

  type EvolItem = { ano:number; renda:string; media:number };
  const evolRenda = (socio?.evolucao_renda as EvolItem[])??[];
  const evolPivot = [2014,2017,2021].map(ano=>{ const entries:[string,unknown][]=[["ano",String(ano)]]; FAIXAS_RENDA.forEach(rn=>{ const found=evolRenda.find(e=>e.ano===ano&&e.renda===rn); entries.push([rn,found?found.media:undefined]); }); return Object.fromEntries(entries); });

  const pontos     = (clusters?.pontos as PontoCluster[])??[];
  const clusterGrp = [0,1,2,3].map(id=>({ id, data:pontos.filter(p=>p.cluster_id===id) }));
  type StatCluster = { cluster_id:number; _count:{cluster_id:number}; _avg:{nt_ger:number;nt_fg:number;nt_ce:number} };
  const statsCluster = (clusters?.stats_por_cluster as StatCluster[])??[];
  const radarData    = statsCluster.map(c=>({ cluster:`Cluster ${c.cluster_id}`, "Nota Geral":r(c._avg.nt_ger), "Formação Geral":r(c._avg.nt_fg), "Componente Específico":r(c._avg.nt_ce) }));

  const importancias   = ((ml?.importancias as ImportItemApi[])??[]).map(f=>({ nome:NOMES_FEATURE[f.feature]??f.feature, percentual:Math.round(f.valor*1000)/10 }));
  const acuracia       = Math.round(((ml?.acuracia as number)??0)*10000)/100;
  const metricasClasse = ((ml?.metricas_classe as MetricaClasse[])??[]).filter(m=>["baixo","medio","alto"].includes(m.classe??""));

  const total      = (stats?.total_estudantes as number)??0;
  const mediaGeral = r(((stats?.media_notas as Item)?._avg as Item)?.nt_ger as number);
  const rendaMin   = rendaData[0]?.media??0;
  const rendaMax   = rendaData[rendaData.length-1]?.media??0;
  const multRenda  = rendaMax>0?(rendaMax/rendaMin).toFixed(1):"—";

  const comparativoHabitos = [
    {grupo:"Nenhuma / Não trabalha",trabalho:trabalhaData[0]?.media,estudo:estudoData[0]?.media},
    {grupo:"Baixa intensidade",     trabalho:trabalhaData[1]?.media,estudo:estudoData[1]?.media},
    {grupo:"Média intensidade",     trabalho:trabalhaData[2]?.media,estudo:estudoData[2]?.media},
    {grupo:"Alta intensidade",      trabalho:trabalhaData[3]?.media,estudo:estudoData[3]?.media},
  ];
  const habitosGrupo1 = (habitos?.habitos??[]).filter(h=>["qe_horas_estudo","qe_trabalha","qe_horas_trabalho"].includes(h.variavel));
  const habitosGrupo2 = (habitos?.habitos??[]).filter(h=>["qe_uso_biblioteca","qe_acesso_internet"].includes(h.variavel));
  const findHabitoPct = (variavel:string,categoria:string) => (habitos?.habitos.find(h=>h.variavel===variavel)?.dados.find(d=>d.categoria===categoria)?.pct??0).toFixed(1)+"%";


  const labelLocalizacao = filtroMunicio?`Município ${filtroMunicio}`:filtroUF?ufsRegiao.find(u=>String(u.co_uf)===filtroUF)?.nome??filtroUF:filtroRegiao?REGIOES.find(rg=>rg.value===filtroRegiao)?.label??"":"";

  // dados previsão
  const tendGeral   = prevData?.tendencia_geral??[];
  const tendCursos  = prevData?.tendencia_cursos??[];
  const tendRede    = prevData?.tendencia_rede??{};
  const resumoPrev  = prevData?.resumo;
  const cursosConf  = tendCursos.filter(c=>c.confiavel);
  const cursosNConf = tendCursos.filter(c=>!c.confiavel);

  // pivot tendência geral para recharts
  const tendGeralPivot = [2014,2017,2021,2024,2027].map(ano=>{
    const real = tendGeral.find(d=>d.ano===ano&&d.tipo==="real");
    const proj = tendGeral.find(d=>d.ano===ano&&d.tipo==="projecao");
    return { ano:String(ano), real:real?.media??undefined, projecao:proj?.projecao??undefined };
  });

  // pivot rede
  const tendRedePivot = [2014,2017,2021,2024,2027].map(ano=>{
    const pub = tendRede["Pública"]?.dados.find(d=>d.ano===ano);
    const prv = tendRede["Privada"]?.dados.find(d=>d.ano===ano);
    return {
      ano: String(ano),
      pub_real:  pub?.media??undefined,
      prv_real:  prv?.media??undefined,
      pub_proj:  pub?.projecao??undefined,
      prv_proj:  prv?.projecao??undefined,
    };
  });

  // dados bivariados
  const rendaVsRede  = bivData?.renda_vs_rede??[];
  const cursoVsRede  = bivData?.curso_vs_rede??[];
  const racaVsRenda  = bivData?.raca_vs_renda??[];
  const finVsRede    = bivData?.fin_vs_rede??[];
  const compRacial   = bivData?.composicao_racial_renda??[];
  const RACAS_COMP   = ["Branca","Preta","Parda","Amarela","Indígena"];
  const CORES_RACA_BIV = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe"];

  // dados VG
  const modalData   = vgData?.modalidade??[];
  const redeData    = vgData?.rede??[];
  const ufData      = vgData?.por_uf??[];
  const regiaoData  = vgData?.por_regiao??[];
  const cobertData  = vgData?.cobertura??[];
  const resumoVG    = vgData?.resumo;

  // dados Analise
  const evolCursos  = analiseData?.evolucao_por_curso??[];
  const rendaFaixa  = analiseData?.renda_vs_faixa??[];
  const inetData    = analiseData?.acesso_internet??[];
  const histData    = analiseData?.histograma??[];
  const matrizData  = analiseData?.matriz_confusao??[];
  const totalMatriz = analiseData?.total_matriz??0;

  // Cores para matriz de confusão
  const matrizCor = (real:string, prev:string, val:number, total:number) => {
    if (real === prev) return `rgba(16,185,129,${Math.min(0.15 + val/total*0.7, 0.85)})`;
    return `rgba(239,68,68,${Math.min(0.05 + val/total*3, 0.6)})`;
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h1 className="text-lg font-bold text-white">Análise de Egressos ENADE — Computação</h1>
              <p className="text-xs text-gray-400">2014 · 2017 · 2021 · Machine Learning · UFERSA TCC 2026.1</p>
            </div>
            {loading && <span className="text-xs text-gray-500 animate-pulse">Carregando...</span>}
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <Select value={filtroAno} onChange={v=>setFiltroAno(v==="Todos"?"":v)}>
              {ANOS.map(a=><option key={a} value={a==="Todos"?"":a}>{a}</option>)}
            </Select>
            <Select value={filtroTipo} onChange={v=>{setFiltroTipo(v);setFiltroCurso("");}}>
              <option value="">Todos os tipos de ensino</option>
              {tipos.map(t=><option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={filtroCurso} onChange={setFiltroCurso}>
              <option value="">Todos os cursos</option>
              {cursosVisiveis.map(c=><option key={c.co_grupo} value={String(c.co_grupo)}>{c.nome}</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filtroRegiao} onChange={v=>{setFiltroRegiao(v);setFiltroUF("");setFiltroMunicio("");}}>
              {REGIOES.map(rg=><option key={rg.value} value={rg.value}>{rg.label}</option>)}
            </Select>
            <Select value={filtroUF} onChange={v=>{setFiltroUF(v);setFiltroMunicio("");}} disabled={!filtroRegiao}>
              <option value="">{filtroRegiao?"Todos os estados":"← Selecione região"}</option>
              {ufsRegiao.map(u=><option key={u.co_uf} value={String(u.co_uf)}>{u.sigla} — {u.nome}</option>)}
            </Select>
            <Select value={filtroMunicio} onChange={setFiltroMunicio} disabled={!filtroUF}>
              <option value="">{filtroUF?`Todos os municípios${municipios.length?` (${municipios.length})`:""}`:"← Selecione estado"}</option>
              {municipios.map(m=><option key={m.co_municipio} value={String(m.co_municipio)}>{m.nome}</option>)}
            </Select>
            {temFiltro && <button onClick={limparFiltros} className="text-xs text-indigo-400 hover:text-indigo-300 px-2 border border-indigo-500/30 rounded-lg py-1.5">✕ Limpar filtros</button>}
            {labelLocalizacao && <span className="text-xs bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg">📍 {labelLocalizacao}</span>}
          </div>
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {ABAS.map((a,i)=>(
              <button key={i} onClick={()=>setAba(i)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${aba===i?"bg-indigo-600 text-white":"text-gray-400 hover:text-white hover:bg-gray-800"}`}>
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
            <Card title="Total extraído" value={(resumoVG?.total_extraido??164814).toLocaleString("pt-BR")} sub={`${resumoVG?.pct_validos??77.2}% com nota válida`} color="amber"/>
            <Card title="Acurácia Random Forest" value={`${acuracia}%`} sub="classificação de desempenho" color="rose"/>
          </div>

          {/* Nota por ano + Faixas */}
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
            <Section title="Distribuição por faixa de desempenho" sub="Baseado na nota geral (NT_GER) normalizada por tercis">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={faixaData} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name" label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(1)}%`} labelLine={false}>
                    {faixaData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                  </Pie>
                  <Tooltip {...TT}/>
                </PieChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Modalidade + Rede */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Modalidade de ensino por ano" sub="Presencial confirmado vs EAD/não informado nos microdados LGPD">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar dataKey="presencial"  name="Presencial"        fill="#6366f1" radius={[4,4,0,0]} stackId="s"/>
                  <Bar dataKey="ead_nd"      name="EAD/Não informado" fill="#64748b" radius={[4,4,0,0]} stackId="s"/>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-amber-400 mt-2">⚠ EAD não foi capturado nestas edições — "Não informado" inclui registros sem modalidade declarada.</p>
            </Section>
            <Section title="Rede pública vs privada por ano" sub="Distribuição do corpo discente por tipo de instituição">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={redeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <Tooltip {...TT} formatter={(v)=>[Number(v??0).toLocaleString("pt-BR"),""]}/>
                  <Legend/>
                  <Bar dataKey="publica"  name="Pública"  fill="#10b981" radius={[4,4,0,0]} stackId="s"/>
                  <Bar dataKey="privada"  name="Privada"  fill="#6366f1" radius={[4,4,0,0]} stackId="s"/>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Por curso + NT_FG vs NT_CE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Média de nota por curso">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cursoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[0,70]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:9}} width={200}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[0,4,4,0]}><LabelList dataKey="media" position="right" style={{fontSize:10,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/>  {cursoData.map((_,i)=><Cell key={i} fill={CORES_GRADIENTE[i%CORES_GRADIENTE.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Curso × Pública vs Privada" sub="CC Licenciatura pública supera privada em 8,5 pts — único curso com inversão clara">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cursoVsRede} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[30,65]}/>
                  <YAxis type="category" dataKey="curso" tick={{fill:"#9ca3af",fontSize:9}} width={90}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar dataKey="publica" name="Pública"  fill="#10b981" radius={[0,4,4,0]} barSize={14}><LabelList dataKey="publica" position="right" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                  <Bar dataKey="privada" name="Privada"  fill="#6366f1" radius={[0,4,4,0]} barSize={14}><LabelList dataKey="privada" position="right" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="NT_FG vs NT_CE por tipo de ensino" sub="Formação Geral vs Componente Específico — diagnóstico pedagógico">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ntPorTipo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="tipo" tick={{fill:"#9ca3af",fontSize:11}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}} domain={[35,55]}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar dataKey="media_fg"  name="NT_FG (Form. Geral)"      fill="#6366f1" radius={[4,4,0,0]} barSize={28}><LabelList dataKey="media_fg"  position="top" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                  <Bar dataKey="media_ce"  name="NT_CE (Comp. Específico)" fill="#10b981" radius={[4,4,0,0]} barSize={28}><LabelList dataKey="media_ce"  position="top" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                  <Bar dataKey="media_ger" name="NT_GER (Nota Geral)"      fill="#f59e0b" radius={[4,4,0,0]} barSize={28}><LabelList dataKey="media_ger" position="top" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-2">Tecnologia tem maior lacuna NT_FG/NT_CE — déficit no componente específico.</p>
            </Section>
          </div>

          {/* Evolução por curso + Histograma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Evolução da média por curso (2014–2021)" sub="Cada linha = um curso · CC Bacharelado teve a maior queda (−42%)">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart margin={{top:8,right:8,left:0,bottom:8}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="ano" type="number" domain={[2014,2021]} ticks={[2014,2017,2021]} tick={{fill:"#9ca3af",fontSize:11}}/>
                  <YAxis domain={[20,65]} tick={{fill:"#9ca3af",fontSize:11}}/>
                  <Tooltip {...TT}/><Legend wrapperStyle={{fontSize:11}}/>
                  {evolCursos.map((curso,i)=>(
                    <Line key={curso.curso} type="monotone"
                      data={[
                        {ano:2014,media:curso["2014"]},
                        {ano:2017,media:curso["2017"]},
                        {ano:2021,media:curso["2021"]},
                      ].filter(d=>d.media!==null)}
                      dataKey="media" name={curso.curso}
                      stroke={CORES_GRADIENTE[i%CORES_GRADIENTE.length]}
                      strokeWidth={2} dot={{r:4}} connectNulls={false}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Distribuição de notas por ano" sub="Histograma em faixas de 10 pontos — 2021 concentrou-se em 20-30 pts">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={histData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="faixa" tick={{fill:"#9ca3af",fontSize:10}} angle={-30} textAnchor="end" height={40}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar dataKey="2014" name="2014" fill="#6366f1" radius={[3,3,0,0]} barSize={14}><LabelList dataKey="2014" position="top" style={{fontSize:8,fill:"#9ca3af"}} formatter={(v)=>Number(v??0)>2000?`${(Number(v??0)/1000).toFixed(0)}k`:""}/></Bar>
                  <Bar dataKey="2017" name="2017" fill="#10b981" radius={[3,3,0,0]} barSize={14}><LabelList dataKey="2017" position="top" style={{fontSize:8,fill:"#9ca3af"}} formatter={(v)=>Number(v??0)>2000?`${(Number(v??0)/1000).toFixed(0)}k`:""}/></Bar>
                  <Bar dataKey="2021" name="2021" fill="#f59e0b" radius={[3,3,0,0]} barSize={14}><LabelList dataKey="2021" position="top" style={{fontSize:8,fill:"#9ca3af"}} formatter={(v)=>Number(v??0)>2000?`${(Number(v??0)/1000).toFixed(0)}k`:""}/></Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Por estado */}
          <Section title="Estudantes e média NT_GER por estado" sub="Todos os estados brasileiros com dados de Computação no ENADE">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={ufData} margin={{top:8,right:40,left:0,bottom:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false}/>
                <XAxis dataKey="uf" tick={{fill:"#9ca3af",fontSize:10}} angle={-40} textAnchor="end" interval={0}/>
                <YAxis yAxisId="l" tick={{fill:"#9ca3af",fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}
                  label={{value:"Estudantes",angle:-90,position:"insideLeft",style:{fontSize:11,fill:"#6b7280"}}}/>
                <YAxis yAxisId="r" orientation="right" domain={[30,55]} tick={{fill:"#f59e0b",fontSize:11}}
                  label={{value:"Média",angle:90,position:"insideRight",style:{fontSize:11,fill:"#f59e0b"}}}/>
                <Tooltip {...TT} formatter={(v,n)=>[n==="Média NT_GER"?Number(v??0).toFixed(2):Number(v??0).toLocaleString("pt-BR"),String(n)]}/>
                <Legend/>
                <Bar yAxisId="l" dataKey="total" name="Estudantes" fill="#6366f1" radius={[3,3,0,0]} order={2}/>
                <Line yAxisId="r" dataKey="media" name="Média NT_GER" type="monotone"
                  stroke="#f59e0b" strokeWidth={2} dot={{r:3,fill:"#f59e0b"}} activeDot={{r:5}} order={1}/>
              </ComposedChart>
            </ResponsiveContainer>
          </Section>

          {/* Concentração por região + Cobertura */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Concentração por região" sub="Total acumulado 2014–2021 com média NT_GER">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={regiaoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <YAxis type="category" dataKey="regiao" tick={{fill:"#9ca3af",fontSize:12}} width={110}/>
                  <Tooltip {...TT} formatter={(v,n)=>[n==="Média NT_GER"?Number(v??0).toFixed(2):Number(v??0).toLocaleString("pt-BR"),String(n)]}/>
                  <Legend/>
                  <Bar dataKey="total" name="Estudantes" radius={[0,4,4,0]}>
                    {regiaoData.map((_,i)=><Cell key={i} fill={CORES_REGIAO[i%CORES_REGIAO.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Nota válida vs total extraído por ano" sub="Cobertura do banco — registros sem nota foram excluídos da análise">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cobertData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <Tooltip {...TT} formatter={(v)=>[Number(v??0).toLocaleString("pt-BR"),""]}/>
                  <Legend/>
                  <Bar dataKey="total"   name="Total extraído"  fill="#64748b" radius={[4,4,0,0]}/>
                  <Bar dataKey="validos" name="Com nota válida" fill="#6366f1" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-around mt-3">
                {cobertData.map(d=>(
                  <div key={d.ano} className="text-center">
                    <p className="text-xs text-gray-500">{d.ano}</p>
                    <p className="text-sm font-semibold text-indigo-400">{d.pct_validos}%</p>
                    <p className="text-xs text-gray-500">válidos</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </>}

        {/* ── ABA 1: Socioeconômico ── */}
        {aba===1 && <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card title="Menor média (menor renda)" value={rendaData[0]?.media.toFixed(1)??"-"} sub={rendaData[0]?.nome??"—"} color="rose"/>
            <Card title="Maior média (maior renda)" value={rendaData[rendaData.length-1]?.media.toFixed(1)??"-"} sub={rendaData[rendaData.length-1]?.nome??"—"} color="green"/>
            <Card title="Fator de desigualdade" value={`${multRenda}×`} sub="nota máx ÷ mínima por renda" color="amber" delta="Correlação r=0,951"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Renda familiar × Média no ENADE" sub="Correlação quase linear — principal preditor de desempenho">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rendaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} angle={-20} textAnchor="end" height={50}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}} domain={[0,90]}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[4,4,0,0]}>{rendaData.map((_,i)=><Cell key={i} fill={CORES_RENDA[i%CORES_RENDA.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Evolução da nota por faixa de renda (2014–2021)">
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={evolPivot}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:12}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}}/>
                  <Tooltip {...TT}/>
                  {FAIXAS_RENDA.map((fr,i)=><Line key={fr} type="monotone" dataKey={fr} stroke={CORES_RENDA[i]} strokeWidth={2} dot={{r:3}} name={fr}/>)}
                </LineChart>
              </ResponsiveContainer>
              <LegendaRenda/>
            </Section>
            <Section title="Tipo de escola no Ensino Médio × Nota">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={escolaData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[0,70]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} width={160}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[0,4,4,0]}>{escolaData.map((_,i)=><Cell key={i} fill={CORES_GRADIENTE[i]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Tipo de IES × Nota média">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tipoIesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[35,55]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} width={160}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média nota" radius={[0,4,4,0]}>{tipoIesData.map((_,i)=><Cell key={i} fill={CORES_GRADIENTE[i]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Financiamento estudantil × Nota" sub="Quem não tem financiamento tem a menor média">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={financiamentoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[0,85]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} width={130}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média NT_GER" radius={[0,4,4,0]}><LabelList dataKey="media" position="right" style={{fontSize:10,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/> 
                    {financiamentoData.map((_,i)=><Cell key={i} fill={CORES_RENDA[i%CORES_RENDA.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Estado civil × Nota média" sub="Mediado pela idade — estudantes mais velhos têm maior maturidade acadêmica">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={estadoCivilData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[0,90]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} width={170}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média NT_GER" radius={[0,4,4,0]}><LabelList dataKey="media" position="right" style={{fontSize:10,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/> 
                    {estadoCivilData.map((_,i)=><Cell key={i} fill={CORES_GRADIENTE[i%CORES_GRADIENTE.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-amber-400 mt-2">⚠ Viúvos (n=196) e separados (n=4.195) têm amostras pequenas — interpretar com cautela.</p>
            </Section>
          </div>

          {/* Renda × Pública vs Privada */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Renda × Pública vs Privada" sub="Dentro da mesma renda, pública e privada têm notas quase iguais — a renda é o fator determinante">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rendaVsRede} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} angle={-15} textAnchor="end" height={40}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:11}} domain={[0,90]}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar dataKey="publica" name="Pública"  fill="#10b981" radius={[4,4,0,0]} barSize={22}><LabelList dataKey="publica" position="top" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                  <Bar dataKey="privada" name="Privada"  fill="#6366f1" radius={[4,4,0,0]} barSize={22}><LabelList dataKey="privada" position="top" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-2">Δ máximo entre pública e privada: {rendaVsRede.length>0?Math.max(...rendaVsRede.map(r=>Math.abs(r.delta))).toFixed(1):"—"} pts — diferença pequena em todas as faixas.</p>
            </Section>
            <Section title="Financiamento × Pública vs Privada" sub="ProUni é exclusivo de IES privadas — FIES em ambas tem notas similares">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={finVsRede} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} angle={-15} textAnchor="end" height={40}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:11}} domain={[0,90]}/>
                  <Tooltip {...TT}/><Legend/>
                  <Bar dataKey="publica" name="Pública"  fill="#10b981" radius={[4,4,0,0]} barSize={22}><LabelList dataKey="publica" position="top" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                  <Bar dataKey="privada" name="Privada"  fill="#6366f1" radius={[4,4,0,0]} barSize={22}><LabelList dataKey="privada" position="top" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/></Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Renda × proporção por faixa — 100% stacked */}
          <Section title="Renda familiar × proporção por faixa de desempenho" sub="Renda determina quase que completamente a faixa de nota — segregação quase perfeita">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rendaFaixa} layout="vertical" barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis type="number" domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fill:"#9ca3af",fontSize:11}}/>
                <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:11}} width={80}/>
                <Tooltip {...TT} formatter={(v)=>[`${Number(v??0).toFixed(1)}%`,""]}/>
                <Legend/>
                <Bar dataKey="pct_baixo" name="Faixa baixo" fill="#ef4444" stackId="s" radius={[0,0,0,0]}/>
                <Bar dataKey="pct_medio" name="Faixa médio" fill="#f59e0b" stackId="s" radius={[0,0,0,0]}/>
                <Bar dataKey="pct_alto"  name="Faixa alto"  fill="#10b981" stackId="s" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-2">Renda 0–1: concentração quase total na faixa baixa. Renda 4–5: concentração total na faixa alto. Confirma correlação r=0,951.</p>
          </Section>
        </>}

                {/* ── ABA 2: Raça/Cor ── */}
        {aba===2 && <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card title="Total de estudantes" value={(racaData?.total??0).toLocaleString("pt-BR")} sub="com raça/cor declarada" color="indigo"/>
            <Card title="Grupo maior" value={racaData?.raca[1]?.nome??"—"} sub={`${racaData?.raca[1]?.pct.toFixed(1)??"—"}% do total`} color="purple"/>
            <Card title="Maior média" value={racaData?.raca.slice().sort((a,b)=>b.media_nota-a.media_nota)[0]?.nome??"—"} sub={`${racaData?.raca.slice().sort((a,b)=>b.media_nota-a.media_nota)[0]?.media_nota.toFixed(1)??"—"} pts`} color="green"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Raça/Cor autodeclarada × Média NT_GER" sub="Desigualdade racial nos resultados do ENADE">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={racaData?.raca??[]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="nome" tick={{fill:"#9ca3af",fontSize:11}}/>
                  <YAxis tick={{fill:"#9ca3af",fontSize:12}} domain={[0,90]}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media_nota" name="Média NT_GER" radius={[4,4,0,0]}><LabelList dataKey="media_nota" position="top" style={{fontSize:9,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/>
                    {(racaData?.raca??[]).map((_,i)=><Cell key={i} fill={CORES_RACA_G[i%CORES_RACA_G.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Distribuição de estudantes por raça/cor" sub="Composição racial do corpo discente">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={racaData?.raca??[]} cx="50%" cy="50%" outerRadius={100} dataKey="total" nameKey="nome"
                    label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(1)}%`} labelLine={false}>
                    {(racaData?.raca??[]).map((_,i)=><Cell key={i} fill={CORES_RACA_G[i%CORES_RACA_G.length]}/>)}
                  </Pie>
                  <Tooltip {...TT}/>
                </PieChart>
              </ResponsiveContainer>
            </Section>
          </div>
          {/* Composição racial por faixa de renda */}
          <Section title="Composição racial por faixa de renda" sub="% de cada grupo racial dentro de cada faixa — segregação socioeconômica por raça">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={compRacial} layout="vertical" barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis type="number" domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fill:"#9ca3af",fontSize:11}}/>
                <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:11}} width={70}/>
                <Tooltip {...TT} formatter={(v)=>[`${Number(v??0).toFixed(1)}%`,""]}/>
                <Legend/>
                {RACAS_COMP.map((r,i)=>(
                  <Bar key={r} dataKey={r} name={r} fill={CORES_RACA_BIV[i]} stackId="s" barSize={20}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-amber-400 mt-2">⚠ Cada grupo racial ocupa nichos de renda distintos — Brancos concentrados em R1-R2, Pardos em R3-R4, Amarelos em R4-R5. Desigualdade racial e desigualdade de renda são quase a mesma variável no Brasil.</p>
          </Section>

          {/* Raça × Renda heatmap */}
          <Section title="Nota média por raça e faixa de renda" sub="Heatmap — células vazias = combinação inexistente no banco (segregação socioeconômica)">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-2 text-left text-gray-400 w-24">Raça/Cor</th>
                    {["Não decl.","≤1,5SM","1,5–3SM","3–4,5SM","4,5–6SM","6–10SM"].map(r=>(
                      <th key={r} className="py-2 text-center text-gray-400">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {racaVsRenda.map((row,i)=>(
                    <tr key={i} className="border-b border-gray-800">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{background:CORES_RACA_G[i%CORES_RACA_G.length]}}/>
                          <span className="text-gray-200">{row.raca}</span>
                        </div>
                      </td>
                      {["0","1","2","3","4","5"].map(cod=>{
                        const cell = row.rendas.find(r=>r.codigo===cod);
                        const pct  = cell ? Math.min(cell.media/90, 1) : 0;
                        return (
                          <td key={cod} className="py-2 text-center">
                            {cell ? (
                              <div className="inline-block px-2 py-1 rounded text-xs font-semibold"
                                style={{background:`rgba(${i===0?'99,102,241':i===1?'139,92,246':i===2?'167,139,250':i===3?'196,181,253':'221,214,254'},${0.15+pct*0.5})`,color:CORES_RACA_G[i%CORES_RACA_G.length]}}>
                                {cell.media.toFixed(1)}
                              </div>
                            ) : (
                              <span className="text-gray-700">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Índice de desigualdade por grupo racial" sub="Comparativo entre grupos raciais autodeclarados — nota geral">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    {["Raça/Cor","Estudantes","% total","Média NT_GER","Desempenho relativo"].map(h=>(
                      <th key={h} className={`py-2 text-gray-400 ${h==="Raça/Cor"||h==="Desempenho relativo"?"text-left":"text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(racaData?.raca??[]).map((raca,i)=>{
                    const pctNota=Math.min(raca.media_nota/90*100,100);
                    return (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="py-2 text-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{background:CORES_RACA_G[i%CORES_RACA_G.length]}}/>
                            {raca.nome}
                          </div>
                        </td>
                        <td className="py-2 text-right text-gray-300">{raca.total.toLocaleString("pt-BR")}</td>
                        <td className="py-2 text-right text-gray-400">{raca.pct.toFixed(1)}%</td>
                        <td className="py-2 text-right font-semibold" style={{color:CORES_RACA_G[i%CORES_RACA_G.length]}}>{raca.media_nota.toFixed(2)}</td>
                        <td className="py-2 pl-4">
                          <div className="h-1.5 bg-gray-700 rounded-full w-32">
                            <div className="h-full rounded-full" style={{width:`${pctNota}%`,background:CORES_RACA_G[i%CORES_RACA_G.length]}}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-amber-400 mt-3">⚠ Os dados de gênero (TP_SEXO) não puderam ser associados individualmente aos registros — o arquivo LGPD do INEP distribui essa variável em ordem diferente dos demais fragmentos, sem identificador único por estudante. A análise de gênero foi removida por falta de dados confiáveis.</p>
          </Section>
        </>}

{/* ── ABA 3: Hábitos ── */}
        {aba===3 && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Não estuda extraclasse" value={findHabitoPct("qe_horas_estudo","Nenhuma hora")} sub="nenhuma hora fora da aula" color="rose"/>
            <Card title="Não tem vínculo empreg." value={findHabitoPct("qe_trabalha","Não trabalha")} sub="sem trabalho remunerado" color="indigo"/>
            <Card title="Usa sempre a biblioteca" value={findHabitoPct("qe_uso_biblioteca","Sempre/quase sempre")} sub="frequência alta de uso" color="green"/>
            <Card title="Total de registros" value={(habitos?.total??0).toLocaleString("pt-BR")} sub="com dado de hábito" color="purple"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {habitosGrupo1.map(h=><HabitoCard key={h.variavel} habito={h}/>)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {habitosGrupo2.map(h=><HabitoCard key={h.variavel} habito={h}/>)}
          </div>
          {/* Acesso à internet */}
          <Section title="Acesso à internet × Nota" sub="Proxy de condição socioeconômica — progressão de 14,1 pts (sem acesso) a 72,3 pts (sempre acessa)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={inetData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis type="number" tick={{fill:"#9ca3af",fontSize:11}} domain={[0,85]}/>
                  <YAxis type="category" dataKey="nome" tick={{fill:"#9ca3af",fontSize:10}} width={130}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="media" name="Média NT_GER" radius={[0,4,4,0]}><LabelList dataKey="media" position="right" style={{fontSize:10,fill:"#9ca3af"}} formatter={(v)=>Number(v??0).toFixed(1)}/> 
                    {inetData.map((_,i)=><Cell key={i} fill={CORES_RENDA[i+1<CORES_RENDA.length?i+1:i]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-col justify-center gap-3">
                {inetData.map((d,i)=>(
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{d.nome}</span>
                      <span className="font-semibold" style={{color:CORES_RENDA[i+1<CORES_RENDA.length?i+1:i]}}>{d.media.toFixed(1)} pts</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${d.media/85*100}%`,background:CORES_RENDA[i+1<CORES_RENDA.length?i+1:i]}}/>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{d.total.toLocaleString("pt-BR")} estudantes</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Section title="Comparativo: trabalho vs estudo por intensidade">
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
            <Section title="Distribuição por hábito de estudo e trabalho">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-2 font-medium">Horas de trabalho</p>
                  {trabalhaData.map((t,i)=>(
                    <div key={i} className="mb-2">
                      <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-300">{t.nome}</span><span className="text-gray-400">{t.total.toLocaleString("pt-BR")}</span></div>
                      <div className="h-1.5 bg-gray-800 rounded-full"><div className="h-full rounded-full" style={{width:`${t.total/total*100}%`,background:CORES_GRADIENTE[i]}}/></div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2 font-medium">Horas de estudo</p>
                  {estudoData.map((e,i)=>(
                    <div key={i} className="mb-2">
                      <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-300">{e.nome}</span><span className="text-gray-400">{e.total.toLocaleString("pt-BR")}</span></div>
                      <div className="h-1.5 bg-gray-800 rounded-full"><div className="h-full rounded-full" style={{width:`${e.total/total*100}%`,background:CORES_RENDA[i]}}/></div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </>}

        {/* ── ABA 4: Clusters & ML ── */}
        {aba===4 && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statsCluster.map((c,i)=>(
              <Card key={i} title={`Cluster ${c.cluster_id} — ${PERFIS_CLUSTER[i]?.rotulo}`} value={c._count.cluster_id.toLocaleString("pt-BR")} sub={PERFIS_CLUSTER[i]?.detalhe} color={(["indigo","green","amber","rose"] as const)[i]}/>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PERFIS_CLUSTER.map((p,i)=>(
              <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 flex gap-3 items-start">
                <span className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{background:CORES_CLUSTER[i]}}/>
                <div><p className="text-xs font-semibold text-gray-200">Cluster {i} — {p.rotulo}</p><p className="text-xs text-gray-500 mt-0.5">{p.detalhe}</p></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ScatterPCA clusterGrp={clusterGrp}/>
            <Section title="Perfil médio por cluster — Radar">
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
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{width:`${Math.min(f.percentual*3,100)}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-800 text-xs text-gray-500">
                Acurácia: <span className="text-emerald-400 font-semibold">{acuracia}%</span>{" · "}100 árvores · hold-out 20%
              </div>
            </Section>
            <Section title="Métricas por classe" sub="Precisão do classificador por faixa de desempenho">
              {metricasClasse.map((m,i)=>(
                <div key={i} className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize" style={{color:["#10b981","#ef4444","#f59e0b"][i]}}>{m.classe}</span>
                    <span className="text-xs text-gray-400">F1-score: <span className="text-white font-semibold">{(m.f1*100).toFixed(2)}%</span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {([["Precisão",m.precision],["Recall",m.recall],["Support",m.support]] as [string,number][]).map(([label,valor],j)=>(
                      <div key={j} className="bg-gray-800 rounded-lg p-2 text-center">
                        <p className="text-gray-500">{label}</p>
                        <p className="text-white font-semibold">{typeof valor==="number"&&valor<2?(valor*100).toFixed(2)+"%":Number(valor).toLocaleString("pt-BR")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          </div>

          {/* Matriz de confusão */}
          <Section title="Matriz de confusão — Random Forest" sub="Verde = acerto · Vermelho = erro · Erros só ocorrem entre classes adjacentes (nunca baixo↔alto)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              <div>
                {/* Header */}
                <div className="grid grid-cols-4 gap-1 mb-1">
                  <div/>
                  {["Prev. baixo","Prev. médio","Prev. alto"].map(h=>(
                    <div key={h} className="text-xs text-gray-400 text-center py-1">{h}</div>
                  ))}
                </div>
                {matrizData.map((row,i)=>(
                  <div key={i} className="grid grid-cols-4 gap-1 mb-1">
                    <div className="text-xs text-gray-400 flex items-center justify-end pr-2 capitalize">
                      Real {row.real}
                    </div>
                    {(["baixo","medio","alto"] as const).map(prev=>{
                      const val = row[prev as keyof MatrizItem] as number;
                      const pct = totalMatriz>0?val/totalMatriz:0;
                      const isAcerto = row.real===prev;
                      return (
                        <div key={prev} className="rounded-lg p-3 text-center"
                          style={{background: isAcerto ? `rgba(16,185,129,${0.15+pct*5})` : val>0 ? `rgba(239,68,68,${0.1+pct*8})` : "rgba(55,65,81,0.3)"}}>
                          <p className="text-sm font-bold" style={{color: isAcerto ? "#10b981" : val>0 ? "#ef4444" : "#6b7280"}}>
                            {val.toLocaleString("pt-BR")}
                          </p>
                          <p className="text-xs" style={{color: isAcerto ? "#6ee7b7" : "#9ca3af"}}>
                            {totalMatriz>0?(val/totalMatriz*100).toFixed(1):0}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-3">Total: {totalMatriz.toLocaleString("pt-BR")} predições · Diagonal = acertos · Erros entre extremos (baixo↔alto) = 0</p>
              </div>
              <div className="space-y-4">
                <p className="text-sm font-semibold text-gray-200">Acurácia por classe</p>
                {matrizData.map((row,i)=>(
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize text-gray-300">Faixa {row.real}</span>
                      <span className="font-semibold" style={{color:["#10b981","#f59e0b","#6366f1"][i]}}>{row.pct_acerto}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${row.pct_acerto}%`,background:["#10b981","#f59e0b","#6366f1"][i]}}/>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{row.acerto.toLocaleString("pt-BR")} acertos de {row.total_real.toLocaleString("pt-BR")}</p>
                  </div>
                ))}
                <div className="bg-gray-800/60 rounded-xl p-3 mt-2">
                  <p className="text-xs text-gray-400">Acurácia geral</p>
                  <p className="text-2xl font-bold text-emerald-400">{acuracia}%</p>
                  <p className="text-xs text-gray-500">100 árvores · hold-out 20%</p>
                </div>
              </div>
            </div>
          </Section>
        </>}

        {/* ── ABA 5: Previsão ── */}
        {aba===5 && <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Tendência geral" value={`${resumoPrev?.tendencia_geral_b1??0} pts/ano`} sub="queda acumulada desde 2014" color="rose" delta="Regressão linear OLS"/>
            <Card title="Projeção 2024" value={`${resumoPrev?.previsao_2024??0} pts`} sub="se tendência continuar" color="amber"/>
            <Card title="Projeção 2027" value={`${resumoPrev?.previsao_2027??0} pts`} sub="se tendência continuar" color="purple"/>
            <Card title="Cursos confiáveis" value={`${resumoPrev?.cursos_confiaveis??0} de ${(resumoPrev?.cursos_confiaveis??0)+(resumoPrev?.cursos_nao_confiaveis??0)}`} sub="R²≥0,75 e projeção ≥20pts" color="indigo"/>
          </div>

          {/* Aviso */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-400 mb-1">⚠ Projeções exploratórias — leia antes de interpretar</p>
            <p className="text-xs text-amber-300/80">
              As projeções são baseadas em <strong>apenas 3 edições</strong> do ENADE (2014, 2017, 2021) usando regressão linear simples.
              Com n=3, qualquer reta tem R²=1,0 matematicamente — isso <strong>não garante confiabilidade preditiva</strong>.
              Fatores como COVID-19 em 2021, expansão do EAD, mudanças curriculares e políticas educacionais
              não estão modelados. Use como indicativo de tendência, não como previsão estatisticamente robusta.
              A próxima edição real do ENADE de Computação seria <strong>2024</strong>.
            </p>
          </div>

          {/* Tendência geral */}
          <Section title="Tendência da nota geral — dados reais e projeção" sub="Linha sólida = dados reais · Linha pontilhada = projeção (2024 e 2027)">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={tendGeralPivot}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:12}}/>
                <YAxis domain={[30,52]} tick={{fill:"#9ca3af",fontSize:11}}/>
                <Tooltip {...TT}/>
                <Legend/>
                <Line dataKey="real"    name="Dados reais (2014–2021)"
                  type="monotone" stroke="#6366f1" strokeWidth={2.5}
                  dot={{r:5,fill:"#6366f1"}} connectNulls={false}/>
                <Line dataKey="projecao" name="Projeção (2024–2027)"
                  type="monotone" stroke="#f59e0b" strokeWidth={2}
                  strokeDasharray="8 4" dot={{r:5,fill:"#f59e0b"}} connectNulls={false}/>
              </LineChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[["2014","47,2 pts","Referência"],["2017","44,7 pts","−2,5 pts"],["2021","41,3 pts","−3,4 pts"],["2024","38,9 pts","Projeção"],["2027","36,4 pts","Projeção"]].map(([ano,val,label])=>(
                <div key={ano} className={`text-center p-3 rounded-xl ${ano==="2024"||ano==="2027"?"bg-amber-500/10 border border-amber-500/20":"bg-gray-800/60"}`}>
                  <p className="text-xs text-gray-400">{ano}</p>
                  <p className={`text-lg font-bold ${ano==="2024"||ano==="2027"?"text-amber-400":"text-white"}`}>{val}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Por curso */}
          <Section title="Tendência por curso — apenas cursos com R² ≥ 0,75" sub="Cursos com tendência inconsistente foram excluídos por baixa confiabilidade preditiva">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {cursosConf.map((curso,i)=>{
                const pivot = [2014,2017,2021,2024,2027].map(ano=>{
                  const real = curso.dados.find(d=>d.ano===ano&&d.tipo==="real");
                  const proj = curso.dados.find(d=>d.ano===ano&&d.tipo==="projecao");
                  return { ano:String(ano), real:real?.media??undefined, projecao:proj?.projecao??undefined };
                });
                const cor = CORES_GRADIENTE[i%CORES_GRADIENTE.length];
                return (
                  <div key={curso.curso} className="bg-gray-800/40 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-semibold text-gray-200">{curso.curso}</p>
                      <div className="flex gap-2">
                        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">R²={curso.r2}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${curso.b1>0?"bg-emerald-500/20 text-emerald-400":"bg-rose-500/20 text-rose-400"}`}>
                          {curso.b1>0?"↑":"↓"} {Math.abs(curso.b1).toFixed(2)} pts/ano
                        </span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={pivot}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                        <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:10}}/>
                        <YAxis domain={["auto","auto"]} tick={{fill:"#9ca3af",fontSize:10}}/>
                        <Tooltip {...TT}/>
                        <Line dataKey="real"     type="monotone" stroke={cor} strokeWidth={2} dot={{r:4,fill:cor}} connectNulls={false}/>
                        <Line dataKey="projecao" type="monotone" stroke={cor} strokeWidth={1.5} strokeDasharray="6 3" dot={{r:4,fill:cor}} connectNulls={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
            {cursosNConf.length > 0 && (
              <div className="mt-4 bg-gray-800/40 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Cursos excluídos da projeção (R² {"<"} 0,75 ou projeção implausível):</p>
                <div className="flex flex-wrap gap-2">
                  {cursosNConf.map(c=>(
                    <span key={c.curso} className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-400">
                      {c.curso} (R²={c.r2})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Rede */}
          <Section title="Tendência pública vs privada — dados reais e projeção" sub="Privada cai mais rápido — convergência projetada para 2024">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={tendRedePivot}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis dataKey="ano" tick={{fill:"#9ca3af",fontSize:12}}/>
                <YAxis domain={[34,52]} tick={{fill:"#9ca3af",fontSize:11}}/>
                <Tooltip {...TT}/><Legend/>
                <Line dataKey="pub_real"  name="Pública (real)"    type="monotone" stroke="#10b981" strokeWidth={2.5} dot={{r:5,fill:"#10b981"}} connectNulls={false}/>
                <Line dataKey="pub_proj"  name="Pública (projeção)" type="monotone" stroke="#10b981" strokeWidth={2} strokeDasharray="8 4" dot={{r:4,fill:"#10b981"}} connectNulls={false}/>
                <Line dataKey="prv_real"  name="Privada (real)"    type="monotone" stroke="#6366f1" strokeWidth={2.5} dot={{r:5,fill:"#6366f1"}} connectNulls={false}/>
                <Line dataKey="prv_proj"  name="Privada (projeção)" type="monotone" stroke="#6366f1" strokeWidth={2} strokeDasharray="8 4" dot={{r:4,fill:"#6366f1"}} connectNulls={false}/>
              </LineChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Pública — tendência</p>
                <p className="text-xl font-bold text-emerald-400">{tendRede["Pública"]?.b1??0} pts/ano</p>
                <p className="text-xs text-gray-500">Queda mais lenta</p>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Privada — tendência</p>
                <p className="text-xl font-bold text-indigo-400">{tendRede["Privada"]?.b1??0} pts/ano</p>
                <p className="text-xs text-gray-500">Queda mais rápida</p>
              </div>
            </div>
          </Section>

          {/* Nota metodológica */}
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-sm font-semibold text-gray-200 mb-3">Nota metodológica</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
              <div>
                <p className="font-medium text-gray-300 mb-1">Método utilizado</p>
                <p>Regressão linear simples (OLS — Mínimos Quadrados Ordinários) sobre as médias de NT_GER por edição. Equação: NT_GER = b₀ + b₁ × ano.</p>
              </div>
              <div>
                <p className="font-medium text-gray-300 mb-1">Critério de inclusão</p>
                <p>Cursos incluídos apenas se R² ≥ 0,75 e projeção resultar em valor entre 20 e 100 pts. Cursos com tendência não-linear ou inconsistente são excluídos.</p>
              </div>
              <div>
                <p className="font-medium text-gray-300 mb-1">Próxima edição real</p>
                <p>O ENADE de Computação segue ciclo trienal. A próxima edição esperada seria 2024, permitindo validar ou refutar as projeções apresentadas.</p>
              </div>
              <div>
                <p className="font-medium text-gray-300 mb-1">Limitação principal</p>
                <p>n=3 pontos no tempo. Qualquer regressão linear com 3 pontos tem R² elevado por construção — isso não representa poder preditivo real.</p>
              </div>
            </div>
          </div>
        </>}

      </main>
    </div>
  );
}