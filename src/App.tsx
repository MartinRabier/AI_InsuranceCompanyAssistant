import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Send, Database, FileText, Package, Plus, Shield, ShieldAlert, ShieldX, ChevronDown } from "lucide-react";
import { store, Contract, BelongingWithCoverage } from "./lib/store";
import { processGeminiTurn } from "./lib/gemini";
import { Content } from "@google/genai";

type AppStateStatus = "idle" | "listening" | "thinking" | "speaking";

export default function App() {
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState<AppStateStatus>("idle");
  const [history, setHistory] = useState<Content[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [belongings, setBelongings] = useState<BelongingWithCoverage[]>([]);
  const [showData, setShowData] = useState(true);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync with store
  useEffect(() => {
    const updateLocalState = () => {
      const storeState = store.getState();
      setContracts([...storeState.contracts]);
      setBelongings([...storeState.belongingsWithCoverage]);
    };
    updateLocalState();
    return store.subscribe(updateLocalState);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [history]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const newContents = [...history, { role: "user", parts: [{ text }] }];
    setHistory(newContents);
    setInputText("");
    setStatus("thinking");

    try {
      const finalContents = await processGeminiTurn(newContents, (toolName) => {
        // We could briefly show tool usage here
        console.log("Calling tool: ", toolName);
      });
      setHistory(finalContents);
      setStatus("speaking");
      setTimeout(() => setStatus("idle"), 2000); // simulate speaking delay
    } catch (err: any) {
      console.error(err);
      setStatus("idle");
      // Add error message to chat
      setHistory((prev) => [
        ...prev,
        { role: "model", parts: [{ text: `Error: ${err.message}` }] },
      ]);
    }
  };

  const visibleHistory = history.filter(
    (item) => item.role === "user" || (item.role === "model" && item.parts?.some((p) => p.text))
  );

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          
          <img
            src="https://www.groupama.com/app/uploads/2015/05/GRP_CR_GRAA_VER_VERT_RVB.png"
            alt="CerIAse Logo"
            className="w-10 h-10 rounded-lg object-cover"
          />
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            CerIAse <span className="text-xs font-medium text-slate-400 ml-2 uppercase tracking-widest hidden sm:inline">v0.4 - RAG Engine</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Système Actif
          </div>
          <button
            onClick={() => setShowData(!showData)}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate-200 transition-colors"
            title="Toggle Data Panel"
          >
            <Database size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden p-4 sm:p-6 gap-6">
        
        {/* Chat Section */}
        <section className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden relative">
          
          {/* Section Header */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${status === "idle" ? "bg-slate-300" : status === "thinking" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse"}`}></div>
              <span className="font-mono text-xs font-bold tracking-widest text-slate-500 uppercase">
                {status === "idle" ? "SYSTÈME PRÊT" : status === "thinking" ? "TRAITEMENT..." : "FLUX AUDIO ACTIF"}
              </span>
            </div>
          </div>
          
          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto flex flex-col hide-scrollbar" ref={scrollRef}>
            <div className="flex-1 w-full max-w-3xl mx-auto p-6 flex flex-col gap-6">
              {/* Visual Orb */}
              <div className="flex items-center justify-center w-full my-6 shrink-0">
                <motion.div
                  animate={{
                    scale: status === "listening" ? [1, 1.2, 1] : status === "thinking" ? [1, 0.95, 1.05, 1] : 1,
                    opacity: status === "idle" ? 0.7 : 1,
                  }}
                  transition={{
                    duration: status === "thinking" ? 1.5 : 2,
                    repeat: Infinity,
                  }}
                  className="relative flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-[40px] opacity-20"></div>
                  <div
                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-green-50 via-emerald-100 to-white shadow-[0_0_30px_rgba(16,185,129,0.20)] border border-emerald-200 flex items-center justify-center ${
                      status === "thinking" ? "animate-pulse-slow" : ""
                    }`}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-green-600 via-emerald-500 to-green-400 shadow-inner flex items-center justify-center">
                      <Mic className="text-white opacity-90" size={24} />
                    </div>
                  </div>
                </motion.div>
              </div>

              <AnimatePresence>
                {visibleHistory.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-slate-400 text-sm mt-4">
                    Il est recommandé de générer des données de test avant de commencer... <br/> Essayez de dire "Quels sont mes contrats actuels ?"
                  </motion.div>
                )}
                {visibleHistory.map((item, idx) => {
                  const textContent = item.parts?.find((p) => p.text)?.text;
                  if (!textContent) return null;
                  const isUser = item.role === "user" && !item.parts?.some((p) => p.functionResponse);

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] px-5 py-3.5 rounded-2xl shadow-sm ${
                          isUser
                            ? "bg-indigo-600 text-white rounded-br-none"
                            : "bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-none"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{textContent}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
            <div className="max-w-3xl mx-auto flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend(inputText);
                  }}
                  placeholder="Tapez votre message à l'IA..."
                  disabled={status === "thinking"}
                  className="w-full bg-white border border-slate-300 text-slate-800 shadow-sm rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm placeholder:text-slate-400 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend(inputText)}
                  disabled={!inputText.trim() || status === "thinking"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#07c31a] text-white rounded shadow hover:bg-[#06a617] disabled:opacity-50 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
              <button
                onClick={() => {/* Voice simulation hook */}}
                className="px-4 py-2 bg-white text-[#07c31a] font-bold border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center shrink-0 uppercase tracking-wider text-xs hidden sm:flex"
                title="Voice input (mocked by text for demo)"
              >
                <Mic className="mr-2" size={16} /> Appuyer pour parler
              </button>
            </div>
          </div>
        </section>

        {/* Data Panel */}
        <AnimatePresence>
          {showData && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "20rem", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex flex-col gap-6 shrink-0 h-full overflow-hidden hidden lg:block"
            >
              <div className="flex flex-col gap-6 overflow-y-auto h-full pb-4 hide-scrollbar w-[20rem] p-1">
                
                
                {/* RAG Engine */}
                <div className="bg-emerald-900 rounded-xl p-5 text-white shadow-xl flex flex-col shrink-0">
                  <h3 className="text-xs font-bold text-emerald-300 uppercase mb-4 tracking-wider">
                  Raisonnement du moteur RAG
                  </h3>

                  <div className="bg-emerald-800/50 p-3 rounded-lg border border-emerald-700/50">
                    <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">
                      Contexte des connaissances
                    </p>

                    <p className="text-xs leading-relaxed italic opacity-80">
                      - Limites Habitation: 300k €, 2k € par équipement.<br/>
                      - Contrat Objets de valeur &gt; 5k €.<br/>
                      Le système applique les politiques à la conversation naturelle.
                    </p>
                  </div>
                </div>
                {/* Testing Suite */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm shrink-0">
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-2">
                    Suite de tests
                  </h3>
                  <button
                    onClick={() => store.generateMockData()}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors rounded-lg mb-3 flex items-center justify-center gap-2 uppercase shadow-sm"
                  >
                    <span>⚡</span> Générer des données
                  </button>
                  <p className="text-[10px] text-slate-400 text-center leading-tight">
                    Ajoute des biens aléatoires et crée un historique fictif.
                  </p>
                </div>

                {/* Sub-panels */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col shrink-0">
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider flex items-center gap-2">
                    Portefeuille
                  </h3>
                  <div className="space-y-4">
                    {contracts.length === 0 ? (
                      <p className="text-slate-500 text-sm italic">Aucun contrat trouvé.</p>
                    ) : (
                      contracts.map((c) => (
                        <div key={c.id} className={`border-l-4 ${c.active ? 'border-indigo-500' : 'border-slate-300'} pl-3`}>
                          <div
                            className="flex justify-between items-start cursor-pointer hover:bg-slate-50 p-1 -ml-1 rounded transition-colors"
                            onClick={() => setExpandedContract(expandedContract === c.id ? null : c.id)}
                          >
                            <p className="text-sm font-bold text-slate-800 max-w-[150px] truncate" title={c.type}>
                              {c.type}
                            </p>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">{c.premium} €/an</span>
                              <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedContract === c.id ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          {expandedContract === c.id ? (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="text-xs text-slate-600 mt-2 space-y-1 overflow-hidden bg-slate-50 p-2 rounded border border-slate-100">
                              <div className="flex justify-between"><span className="font-semibold text-slate-400">ID</span><span className="font-mono text-[10px]">{c.id}</span></div>
                              <div className="flex justify-between"><span className="font-semibold text-slate-400">Limite</span><span>{c.coverageLimit.toLocaleString()} €</span></div>
                              <div className="flex justify-between"><span className="font-semibold text-slate-400">Franchise</span><span>{c.deductible.toLocaleString()} €</span></div>
                              <div className="flex justify-between"><span className="font-semibold text-slate-400">Statut</span><span className={c.active ? 'text-emerald-500 font-medium' : 'text-slate-400'}>{c.active ? 'Actif' : 'Inactif'}</span></div>
                            </motion.div>
                          ) : (
                            <div className="flex justify-between text-xs text-slate-500 mt-1 pl-1">
                              <span className="font-mono truncate max-w-[80px]">{c.id}</span>
                              <span>Limite: {c.coverageLimit.toLocaleString()} €</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center justify-between">
                      Biens Déclarés
                      {belongings.length > 0 && <span className="p-1 px-2 bg-slate-100 rounded text-[10px] text-slate-500">{belongings.length} biens</span>}
                    </p>
                    <ul className="text-sm space-y-3">
                      {belongings.length === 0 ? (
                        <li className="text-slate-500 text-sm italic">Aucun bien déclaré.</li>
                      ) : (
                        belongings.map((b) => (
                          <li key={b.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2 truncate pr-2">
                              {b.coverageStatus === 'covered' && <Shield size={14} className="text-emerald-500 shrink-0" title="Couvert" />}
                              {b.coverageStatus === 'partial' && <ShieldAlert size={14} className="text-amber-500 shrink-0" title="Partiellement Couvert" />}
                              {b.coverageStatus === 'not_covered' && <ShieldX size={14} className="text-red-400 shrink-0" title="Non Couvert" />}
                              <span className="text-slate-700 font-medium truncate group-hover:text-indigo-600 transition-colors cursor-default" title={`${b.name} (${b.category})`}>{b.name}</span>
                            </div>
                            <span className="text-slate-500 font-mono text-xs shrink-0">{b.value.toLocaleString()} €</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

              </div>
            </motion.aside>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
