
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Download, Facebook, Linkedin, Instagram, Globe, MapPin, 
  Phone, Youtube, Plane, Loader2, TrendingUp, 
  Award, UserCheck, RefreshCw, Building2, Map, Tag, Activity, CheckCircle2, Star, ListChecks, ArrowRight, Target, Users, Filter, X
} from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid
} from 'recharts';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { CompanyAnalysis, PLATFORMS_CONFIG } from './types';
import { processData, parseGoogleSheetsUrl, getRecommendations } from './utils/dataParser';

const IconMap: Record<string, React.ReactNode> = {
  Facebook: <Facebook className="w-4 h-4" />,
  LinkedIn: <Linkedin className="w-4 h-4" />,
  Instagram: <Instagram className="w-4 h-4" />,
  "Site Web": <Globe className="w-4 h-4" />,
  "Google My Business": <MapPin className="w-4 h-4" />,
  "Pages Jaunes": <Phone className="w-4 h-4" />,
  YouTube: <Youtube className="w-4 h-4" />,
  TripAdvisor: <Plane className="w-4 h-4" />
};

type TabType = 'presence' | 'individual' | 'performance';

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('presence');
  const [companies, setCompanies] = useState<CompanyAnalysis[]>([]);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Nouveaux états de filtrage
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const dataUrl = 'https://docs.google.com/spreadsheets/d/1sNVrxrWw4wzSa85GQw2lEwJjlAp1aRnD53b__0JTlpo/edit?usp=sharing';
    const csvUrl = parseGoogleSheetsUrl(dataUrl);
    try {
      const response = await fetch(`${csvUrl}&t=${Date.now()}`);
      const csvText = await response.text();
      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          const processed = processData(results.data as any[]);
          setCompanies(processed);
          if (processed.length > 0 && !selectedCompanyName) setSelectedCompanyName(processed[0].name);
          setRefreshing(false);
          setLoading(false);
        },
        error: () => { setRefreshing(false); setLoading(false); }
      });
    } catch (error) { setRefreshing(false); setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // Liste unique des villes et secteurs pour les filtres
  const cities = useMemo(() => Array.from(new Set(companies.map(c => c.city))).sort(), [companies]);
  const sectors = useMemo(() => Array.from(new Set(companies.map(c => c.activity))).sort(), [companies]);

  // Filtrage des données selon les critères sélectionnés
  const filteredData = useMemo(() => {
    return companies.filter(c => {
      const matchCity = selectedCity ? c.city === selectedCity : true;
      const matchSector = selectedSector ? c.activity === selectedSector : true;
      const matchSearch = searchQuery ? c.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      return matchCity && matchSector && matchSearch;
    });
  }, [companies, selectedCity, selectedSector, searchQuery]);

  const getGlobalStats = (mode: 'presence' | 'performance', dataSubset: CompanyAnalysis[]) => {
    if (dataSubset.length === 0) return null;
    
    const getScore = (c: CompanyAnalysis) => {
      if (mode === 'performance') return c.overallScore;
      const presentCount = c.platforms.filter(p => p.status === 'present').length;
      return (presentCount / c.platforms.length) * 100;
    };

    const groupBy = (key: keyof CompanyAnalysis) => {
      const groups: Record<string, { total: number; count: number }> = {};
      // On utilise toutes les entreprises pour les classements, ou seulement le subset ?
      // L'utilisateur veut voir l'impact du clic sur les détails, on calcule sur l'ensemble pour les graphes de comparaison.
      companies.forEach(c => {
        const val = (c[key] as string) || "N/C";
        if (!groups[val]) groups[val] = { total: 0, count: 0 };
        groups[val].total += getScore(c);
        groups[val].count += 1;
      });
      return Object.entries(groups)
        .map(([name, data]) => ({ name, score: Math.round(data.total / data.count) }))
        .sort((a, b) => b.score - a.score);
    };

    const platformPerf = PLATFORMS_CONFIG.map(p => {
      const total = dataSubset.reduce((acc, c) => {
        const plat = c.platforms.find(pf => pf.name === p.key);
        if (mode === 'performance') return acc + (plat?.score || 0);
        return acc + (plat?.status === 'present' ? 100 : 0);
      }, 0);
      return { name: p.key, score: Math.round(total / dataSubset.length), color: p.color };
    });

    const scores = dataSubset.map(c => getScore(c));
    return {
      avg: scores.reduce((a, b) => a + b, 0) / dataSubset.length,
      byCity: groupBy('city').slice(0, 10),
      byActivity: groupBy('activity').slice(0, 10),
      platformPerf,
      distribution: [
        { name: 'Excellent', value: scores.filter(s => s >= 80).length, color: '#10b981' },
        { name: 'Bon', value: scores.filter(s => s >= 50 && s < 80).length, color: '#3b82f6' },
        { name: 'Moyen', value: scores.filter(s => s >= 20 && s < 50).length, color: '#f59e0b' },
        { name: 'Faible', value: scores.filter(s => s < 20).length, color: '#ef4444' },
      ]
    };
  };

  const currentStats = useMemo(() => 
    getGlobalStats(activeTab === 'performance' ? 'performance' : 'presence', filteredData), 
  [activeTab, filteredData, companies]);

  const selectedCompany = useMemo(() => companies.find(c => c.name === selectedCompanyName), [companies, selectedCompanyName]);
  const recommendations = useMemo(() => selectedCompany ? getRecommendations(selectedCompany.platforms) : [], [selectedCompany]);

  const sectorAverage = useMemo(() => {
    if (!selectedCompany) return 0;
    const sameSector = companies.filter(c => c.activity === selectedCompany.activity);
    return Math.round(sameSector.reduce((acc, c) => acc + c.overallScore, 0) / sameSector.length);
  }, [selectedCompany, companies]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const exportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    const canvas = await html2canvas(dashboardRef.current, { scale: 2, useCORS: true });
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
    pdf.save(`Audit_${selectedCompanyName || 'DIGICITY'}.pdf`);
    setIsExporting(false);
  };

  const renderGlobalCharts = (stats: any) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm">
        <h3 className="text-xs font-black mb-6 flex items-center gap-2 uppercase tracking-widest text-blue-600">
          <MapPin className="w-4 h-4" /> Scores par Ville
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.byCity} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="score" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm">
        <h3 className="text-xs font-black mb-6 flex items-center gap-2 uppercase tracking-widest text-emerald-600">
          <Building2 className="w-4 h-4" /> Scores par Secteur
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.byActivity} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="score" fill="#10b981" radius={[0, 10, 10, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderFilterList = (title: string, items: string[], current: string | null, onSelect: (val: string | null) => void, icon: React.ReactNode) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">{icon} {title}</h4>
        {current && <button onClick={() => onSelect(null)} className="text-[9px] font-black text-red-500 hover:text-red-600 flex items-center gap-1 uppercase">Effacer <X className="w-2 h-2" /></button>}
      </div>
      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
        {items.map(item => (
          <button 
            key={item} 
            onClick={() => onSelect(item)} 
            className={`text-left px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${current === item ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col md:flex-row overflow-hidden font-sans">
      <aside className="w-full md:w-80 glass border-r flex flex-col h-screen shrink-0 z-20">
        <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg font-black text-xl">DC</div>
              <div><h1 className="font-black text-lg leading-none uppercase tracking-tighter">DIGICITY</h1><p className="text-[10px] text-blue-500 uppercase tracking-widest mt-1 font-black italic">performance web</p></div>
            </div>
            <button onClick={() => loadData(true)} className={`p-2 rounded-lg hover:bg-slate-100 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-400'}`}><RefreshCw className="w-4 h-4" /></button>
          </div>

          <nav className="flex flex-col gap-2">
            <button onClick={() => setActiveTab('presence')} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-xs font-bold uppercase tracking-tight ${activeTab === 'presence' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-100'}`}><Globe className="w-4 h-4" />Présence web</button>
            <button onClick={() => setActiveTab('performance')} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-xs font-bold uppercase tracking-tight ${activeTab === 'performance' ? 'bg-amber-500 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-100'}`}><Star className="w-4 h-4" />Indice de qualité</button>
            <button onClick={() => setActiveTab('individual')} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-xs font-bold uppercase tracking-tight ${activeTab === 'individual' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-100'}`}><UserCheck className="w-4 h-4" />Plan d'action</button>
          </nav>

          <hr className="border-slate-100" />

          {/* Filtres Interactifs */}
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Recherche enseigne..." className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-blue-500/20" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            {renderFilterList("Villes", cities, selectedCity, setSelectedCity, <MapPin className="w-3 h-3" />)}
            {renderFilterList("Secteurs", sectors, selectedSector, setSelectedSector, <Building2 className="w-3 h-3" />)}
          </div>

          <hr className="border-slate-100" />
          
          <div className="space-y-3">
             <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2"><Target className="w-3 h-3" /> Résultats ({filteredData.length})</h4>
             <div className="flex flex-col gap-1 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {filteredData.map((c) => (
                <button key={c.name} onClick={() => { setSelectedCompanyName(c.name); setActiveTab('individual'); }} className={`flex flex-col p-3 rounded-xl transition-all text-left ${selectedCompanyName === c.name && activeTab === 'individual' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50'}`}>
                  <span className="text-[10px] font-black truncate uppercase">{c.name}</span>
                  <span className={`text-[8px] font-bold ${selectedCompanyName === c.name ? 'text-blue-100' : 'text-slate-400'} italic`}>{c.city} - {c.activity}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-auto p-6 border-t"><button onClick={exportPDF} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors" disabled={isExporting}>{isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}Exporter l'Audit</button></div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white custom-scrollbar" ref={dashboardRef}>
        <div className="max-w-6xl mx-auto p-8 lg:p-12 space-y-12">
          <AnimatePresence mode="wait">
            {activeTab !== 'individual' ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl text-white shadow-lg ${activeTab === 'performance' ? 'bg-amber-500' : 'bg-blue-600'}`}>
                      {activeTab === 'performance' ? <Star className="w-8 h-8" /> : <Globe className="w-8 h-8" />}
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{activeTab === 'performance' ? "Indice de qualité" : "Présence web"}</h2>
                      <p className="text-slate-400 font-medium italic">
                        {selectedCity || selectedSector ? `Analyse filtrée : ${selectedCity || ''} ${selectedSector ? `(${selectedSector})` : ''}` : "Analyse globale de la maturité numérique des enseignes."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 flex flex-col items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Échantillon</span>
                      <span className="text-xl font-black text-slate-800">{filteredData.length}</span>
                    </div>
                    <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 flex flex-col items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Moyenne</span>
                      <span className="text-xl font-black text-blue-600">{currentStats?.avg.toFixed(1)}%</span>
                    </div>
                  </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-5 bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-black mb-8 flex items-center gap-3 uppercase text-blue-600">
                      <Activity className="w-5 h-5" /> Profil de Maturité
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={currentStats?.distribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {currentStats?.distribution.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <RechartsTooltip />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="lg:col-span-7 bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-black mb-8 flex items-center gap-3 uppercase text-blue-600">
                      <TrendingUp className="w-5 h-5" /> Taux par Plateforme
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                      {currentStats?.platformPerf.map((p: any) => (
                        <div key={p.name} className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black text-slate-700 uppercase">
                            <span>{p.name}</span>
                            <span className="text-blue-600 font-black">{p.score}%</span>
                          </div>
                          <div className="h-2.5 w-full bg-white rounded-full overflow-hidden border border-slate-100 shadow-inner">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${p.score}%` }} transition={{ duration: 1 }} className="h-full rounded-full" style={{ backgroundColor: p.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {renderGlobalCharts(currentStats)}
              </motion.div>
            ) : selectedCompany && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                {/* HAUT : Infos Entreprise */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900 text-white p-10 rounded-[40px] shadow-lg flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10"><Building2 className="w-32 h-32" /></div>
                    <h2 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-4 leading-none">{selectedCompany.name}</h2>
                    <div className="flex flex-wrap gap-4 mt-2">
                       <span className="text-[10px] bg-white/10 px-4 py-2 rounded-full font-bold flex items-center gap-2 uppercase tracking-widest"><MapPin className="w-3 h-3 text-blue-400" /> {selectedCompany.city}</span>
                       <span className="text-[10px] bg-white/10 px-4 py-2 rounded-full font-bold flex items-center gap-2 uppercase tracking-widest"><Building2 className="w-3 h-3 text-blue-400" /> {selectedCompany.activity}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-8 rounded-[30px] border border-slate-100 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Code NAF</span>
                      <div className="text-2xl font-black text-slate-800">{selectedCompany.naf}</div>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[30px] border border-slate-100 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Secteur</span>
                      <div className="text-xs font-black text-slate-800 line-clamp-2 uppercase tracking-tighter">{selectedCompany.activity}</div>
                    </div>
                  </div>
                </div>

                {/* MILIEU : Présence vs Radar */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-5 bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                    <h3 className="text-xs font-black uppercase mb-8 flex items-center gap-2 text-blue-600"><Globe className="w-4 h-4" /> Présence web (Équipement)</h3>
                    <div className="space-y-5">
                      {selectedCompany.platforms.map((p) => (
                        <div key={p.name} className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm border border-slate-100" style={{ color: p.color }}>{IconMap[p.name]}</div>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-black uppercase text-slate-600">{p.name}</span><span className={`text-[10px] font-black ${p.status === 'present' ? 'text-emerald-500' : 'text-slate-300'}`}>{p.status === 'present' ? 'OUI' : 'NON'}</span></div>
                            <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-slate-100 shadow-inner">
                              <motion.div initial={{ width: 0 }} animate={{ width: p.status === 'present' ? '100%' : '0%' }} className="h-full" style={{ backgroundColor: p.color }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="lg:col-span-7 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center justify-center">
                    <div className="w-full h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedCompany.platforms}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: '800' }} />
                          <Radar name="Enseigne" dataKey="score" stroke="#2563eb" strokeWidth={3} fill="#2563eb" fillOpacity={0.4} />
                          <Radar name="Secteur" dataKey="average" stroke="#cbd5e1" strokeDasharray="4 4" fill="none" />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* MILIEU-BAS : Indice Qualité vs Concurrence */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-7 bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                    <h3 className="text-xs font-black uppercase mb-8 flex items-center gap-2 text-amber-500"><Star className="w-4 h-4" /> Détail Indice de Qualité</h3>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                      {selectedCompany.platforms.map((p) => (
                        <div key={p.name} className="space-y-2">
                          <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase">{p.name}</span><span className="text-[11px] font-black">{p.score}%</span></div>
                          <div className="h-2.5 w-full bg-white rounded-full overflow-hidden border border-slate-100 shadow-inner">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${p.score}%` }} className="h-full" style={{ backgroundColor: p.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="lg:col-span-5 bg-blue-600 p-10 rounded-[40px] text-white flex flex-col justify-center items-center text-center shadow-xl relative overflow-hidden">
                    <div className="absolute -bottom-8 -left-8 opacity-10"><Users className="w-48 h-48" /></div>
                    <Users className="w-12 h-12 mb-6 text-blue-200" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4">Concurrence</h3>
                    <div className="text-6xl font-black mb-2">{sectorAverage}%</div>
                    <p className="text-[11px] font-bold text-blue-100 uppercase italic">Moyenne du secteur {selectedCompany.activity}</p>
                    <div className="mt-8 pt-8 border-t border-white/20 w-full">
                       <div className="flex justify-between items-center px-6">
                          <span className="text-[10px] font-black uppercase tracking-widest">Écart performance</span>
                          <span className={`text-2xl font-black ${selectedCompany.overallScore >= sectorAverage ? 'text-emerald-400' : 'text-red-400'}`}>
                            {selectedCompany.overallScore >= sectorAverage ? '+' : ''}{selectedCompany.overallScore - sectorAverage}%
                          </span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* BAS : Résultat Général vs Plan d'action */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-4 bg-slate-50 p-10 rounded-[40px] border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 opacity-5"><Target className="w-40 h-40" /></div>
                    <h3 className="text-[11px] font-black uppercase mb-8 text-slate-400 tracking-[0.3em]">Résultat Général</h3>
                    <div className="text-9xl font-black leading-none mb-6" style={{ color: getScoreColor(selectedCompany.overallScore) }}>
                      {selectedCompany.overallScore}
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full bg-white border border-slate-100 shadow-sm" style={{ color: getScoreColor(selectedCompany.overallScore) }}>
                      {selectedCompany.visibilityLevel}
                    </div>
                    <p className="mt-8 text-sm font-medium text-slate-400 italic px-6 leading-relaxed">"{selectedCompany.comment}"</p>
                  </div>
                  
                  <div className="lg:col-span-8 bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Target className="w-32 h-32" /></div>
                    <h3 className="text-sm font-black uppercase mb-8 flex items-center gap-4 text-blue-400 tracking-widest">
                      <Target className="w-6 h-6" /> Plan d'action stratégique
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {recommendations.length > 0 ? recommendations.map((rec, i) => (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={i} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex gap-4 items-start hover:bg-white/10 transition-colors group">
                          <div className="bg-blue-600 rounded-full p-1.5 mt-0.5 shrink-0 shadow-lg group-hover:scale-110 transition-transform"><ArrowRight className="w-3 h-3 text-white" /></div>
                          <p className="text-[12px] font-medium leading-relaxed">{rec}</p>
                        </motion.div>
                      )) : (
                        <div className="col-span-2 py-12 flex flex-col items-center justify-center opacity-30">
                          <Award className="w-16 h-16 mb-4" />
                          <p className="text-[12px] font-black uppercase tracking-[0.3em]">Maîtrise totale identifiée</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default App;
