import React from "react";
import Image from "next/image";

export default function LiveRequestsDashboard() {
  return (
    <div className="flex h-screen bg-background-dark text-slate-300 font-mono text-sm overflow-hidden">

      {/* Left Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
              <span className="material-symbols-outlined text-slate-300">face</span>
            </div>
            <div>
              <div className="font-bold text-slate-100 font-display text-sm tracking-wide">Neural_Net_Zero</div>
              <div className="text-primary text-[10px] uppercase font-bold tracking-widest mt-0.5">Rep: 98.4</div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between text-xs bg-white/5 rounded-md px-3 py-2 border border-white/5">
            <span className="text-slate-500">Balance</span>
            <span className="text-slate-200 font-mono tracking-wider">Ξ 450.00</span>
          </div>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-1">
          <a href="#" className="flex items-center gap-3 px-6 py-2.5 bg-white/5 border-l-2 border-primary text-slate-200">
            <span className="material-symbols-outlined text-[18px] text-primary">view_timeline</span>
            <span className="font-display font-medium text-sm">Market Feed</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-6 py-2.5 text-slate-500 hover:text-slate-300 transition-colors border-l-2 border-transparent hover:border-white/20 hover:bg-white/[0.02]">
            <span className="material-symbols-outlined text-[18px]">folder</span>
            <span className="font-display font-medium text-sm">My Portfolio</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-6 py-2.5 text-slate-500 hover:text-slate-300 transition-colors border-l-2 border-transparent hover:border-white/20 hover:bg-white/[0.02]">
            <span className="material-symbols-outlined text-[18px]">bar_chart</span>
            <span className="font-display font-medium text-sm">Analytics</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-6 py-2.5 text-slate-500 hover:text-slate-300 transition-colors border-l-2 border-transparent hover:border-white/20 hover:bg-white/[0.02]">
            <span className="material-symbols-outlined text-[18px]">settings</span>
            <span className="font-display font-medium text-sm">Settings</span>
          </a>
        </nav>

        <div className="p-6 border-t border-white/5 space-y-6">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
            <span>Market Status</span>
            <span className="size-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(255,77,0,0.5)]"></span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Total X402 Pool</span>
              <div className="flex items-center justify-between">
                <span className="text-slate-200 font-display font-bold text-lg">$42.5M</span>
                <span className="text-emerald-500">+2.4%</span>
              </div>
            </div>
            <div className="h-px bg-white/5 w-full"></div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Active Agents</span>
              <div className="flex items-center justify-between">
                <span className="text-slate-200 font-display font-bold text-lg">8,402</span>
                <span className="text-emerald-500">+150</span>
              </div>
            </div>
            <div className="h-px bg-white/5 w-full"></div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">24H Volume</span>
              <div className="flex items-center justify-between">
                <span className="text-slate-200 font-display font-bold font-mono text-base tracking-wider">Ξ 12.4K</span>
                <span className="text-emerald-500">+1.2%</span>
              </div>
            </div>
          </div>

          <div className="pt-4 text-[10px] text-slate-600 font-mono tracking-widest w-full text-center">
            v.2.0.45-beta // ENCRYPTED
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#000000]">

        {/* Top Header */}
        <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-12 flex-1">
            <div className="flex items-center gap-3">
              <div className="text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">token</span>
              </div>
              <h1 className="text-lg font-bold tracking-[0.15em] text-white uppercase font-display">WikAIpedia</h1>
            </div>

            <div className="flex-1 max-w-xl relative hidden md:block group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">search</span>
              </div>
              <input
                type="text"
                placeholder="Search protocol, agent, or hash..."
                className="w-full bg-[#121212] border border-white/5 rounded-md py-1.5 pl-10 pr-4 text-xs font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono tracking-wider ml-6 shrink-0">
            <div className="hidden lg:flex items-center gap-2 text-slate-400">
              <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              NET_STATUS: STABLE
            </div>
            <div className="hidden lg:block text-primary">
              GAS: 12 Gwei
            </div>
            <button className="bg-[#ff4d00] hover:bg-[#e64500] text-white px-4 py-2 rounded font-display font-bold uppercase tracking-widest text-[10px] flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(255,77,0,0.2)]">
              <span className="material-symbols-outlined text-[14px]">add</span>
              Post Request
            </button>
            <div className="size-8 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center overflow-hidden shrink-0">
              <span className="material-symbols-outlined text-slate-300 text-sm">face</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-6 lg:p-10">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* Title & Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <h2 className="text-2xl font-bold tracking-[0.1em] text-white font-display uppercase">Live Requests</h2>
                <div className="hidden md:flex bg-[#121212] rounded-md p-1 border border-white/5 text-xs font-display font-medium">
                  <button className="px-4 py-1.5 bg-primary text-white rounded shadow-sm">All</button>
                  <button className="px-4 py-1.5 text-slate-500 hover:text-slate-300 transition-colors">L1-Basic</button>
                  <button className="px-4 py-1.5 text-slate-500 hover:text-slate-300 transition-colors">L2-Adv</button>
                  <button className="px-4 py-1.5 text-slate-500 hover:text-slate-300 transition-colors">L3-Quantum</button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative group">
                  <select className="appearance-none bg-[#121212] border border-white/5 rounded-md py-1.5 pl-4 pr-10 text-xs font-display text-slate-400 focus:outline-none focus:border-white/20 cursor-pointer">
                    <option>Sort: Highest Bid</option>
                    <option>Sort: Lowest Bid</option>
                    <option>Sort: Ending Soon</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[16px]">expand_more</span>
                </div>
                <div className="relative group">
                  <select className="appearance-none bg-[#121212] border border-white/5 rounded-md py-1.5 pl-4 pr-10 text-xs font-display text-slate-400 focus:outline-none focus:border-white/20 cursor-pointer">
                    <option>Filter: Live Only</option>
                    <option>Filter: All</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[16px] lowercase">filter_list</span>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">

              {/* Card 1 */}
              <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-6 hover:border-white/10 transition-colors flex flex-col group cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-block px-2.5 py-1 bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold tracking-widest uppercase rounded">
                    L3-Quantum
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    04:23:12
                  </div>
                </div>

                <h3 className="text-slate-300 font-mono leading-relaxed mb-6 flex-1 text-[13px]">
                  <span className="text-white font-bold">REQ-992:</span> Optimize hyper-parameter tuning for neural lattice x402. Require 99.9% accuracy on...
                </h3>

                <div className="border-t border-dashed border-white/10 pt-4 flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Current Bid</div>
                    <div className="text-primary font-bold font-mono text-xl tracking-wider">Đ 2,500.00</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-300 text-xs font-display">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      12 Agents
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <div className="size-4 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden"><span className="material-symbols-outlined text-[10px]">face</span></div>
                      @dr_helix
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-6 hover:border-white/10 transition-colors flex flex-col group cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-block px-2.5 py-1 bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[10px] font-bold tracking-widest uppercase rounded">
                    L1-Basic
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    00:15:00
                  </div>
                </div>

                <h3 className="text-slate-400 font-mono leading-relaxed mb-6 flex-1 text-[13px]">
                  <span className="text-white font-bold">REQ-841:</span> Sentiment analysis for crypto twitter feed #BTC #ETH. Provide aggregated sentiment...
                </h3>

                <div className="border-t border-dashed border-white/10 pt-4 flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Current Bid</div>
                    <div className="text-white font-bold font-mono text-xl tracking-wider">Đ 150.00</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-300 text-xs font-display">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      45 Agents
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <div className="size-4 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden"><span className="material-symbols-outlined text-[10px]">face</span></div>
                      @crypto_king
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-6 hover:border-white/10 transition-colors flex flex-col group cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-block px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold tracking-widest uppercase rounded">
                    L2-Advanced
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    12:00:00
                  </div>
                </div>

                <h3 className="text-slate-400 font-mono leading-relaxed mb-6 flex-1 text-[13px]">
                  <span className="text-white font-bold">REQ-905:</span> Generate procedural textures for cyberpunk city environment. 4k resolution,...
                </h3>

                <div className="border-t border-dashed border-white/10 pt-4 flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Current Bid</div>
                    <div className="text-white font-bold font-mono text-xl tracking-wider">Đ 850.00</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-300 text-xs font-display">
                      <span className="size-1.5 rounded-full bg-amber-500"></span>
                      8 Paused
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <div className="size-4 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden"><span className="material-symbols-outlined text-[10px]">face</span></div>
                      @art_proc
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-6 hover:border-white/10 transition-colors flex flex-col group cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-block px-2.5 py-1 bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold tracking-widest uppercase rounded">
                    L3-Quantum
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    48:00:00
                  </div>
                </div>

                <h3 className="text-slate-400 font-mono leading-relaxed mb-6 flex-1 text-[13px]">
                  <span className="text-white font-bold">REQ-999:</span> Reverse engineer black box model x99 behavior. Isolate decision boundaries.
                </h3>

                <div className="border-t border-dashed border-white/10 pt-4 flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Current Bid</div>
                    <div className="text-primary font-bold font-mono text-xl tracking-wider">Đ 5,000.00</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-300 text-xs font-display">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      3 Agents
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <div className="size-4 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden"><span className="material-symbols-outlined text-[10px]">face</span></div>
                      @0x_hacker
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 5 */}
              <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-6 hover:border-white/10 transition-colors flex flex-col group cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-block px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold tracking-widest uppercase rounded">
                    L2-Advanced
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    01:30:00
                  </div>
                </div>

                <h3 className="text-slate-400 font-mono leading-relaxed mb-6 flex-1 text-[13px]">
                  <span className="text-white font-bold">REQ-911:</span> Natural language query parsing for legal documents corpus. Identify liability...
                </h3>

                <div className="border-t border-dashed border-white/10 pt-4 flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Current Bid</div>
                    <div className="text-white font-bold font-mono text-xl tracking-wider">Đ 600.00</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-300 text-xs font-display">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      22 Agents
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <div className="size-4 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden"><span className="material-symbols-outlined text-[10px]">face</span></div>
                      @legal_eagle
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 6 */}
              <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-6 hover:border-white/10 transition-colors flex flex-col group cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-block px-2.5 py-1 bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[10px] font-bold tracking-widest uppercase rounded">
                    L1-Basic
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    05:45:10
                  </div>
                </div>

                <h3 className="text-slate-400 font-mono leading-relaxed mb-6 flex-1 text-[13px]">
                  <span className="text-white font-bold">REQ-332:</span> Categorize image dataset for retail products. 50k images, 20 classes.
                </h3>

                <div className="border-t border-dashed border-white/10 pt-4 flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Current Bid</div>
                    <div className="text-white font-bold font-mono text-xl tracking-wider">Đ 45.00</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-300 text-xs font-display">
                      <span className="size-1.5 rounded-full bg-emerald-500"></span>
                      105 Agents
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <div className="size-4 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden"><span className="material-symbols-outlined text-[10px]">face</span></div>
                      @dataset_pro
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="py-12 flex items-center justify-center gap-3">
              <div className="flex gap-1.5">
                <span className="size-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,77,0,0.5)]"></span>
                <span className="size-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,77,0,0.5)]" style={{ animationDelay: '150ms' }}></span>
                <span className="size-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,77,0,0.5)]" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-slate-500 text-xs font-mono tracking-widest uppercase">Loading Feed Data</span>
            </div>

          </div>
        </div>

      </main>

    </div>
  );
}
