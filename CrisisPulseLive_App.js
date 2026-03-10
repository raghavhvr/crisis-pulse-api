import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ── CONFIG — swap this URL after you deploy the backend on Render ─────────────
const API_BASE = "https://crisis-pulse-api.onrender.com";
// While testing locally: const API_BASE = "http://localhost:5000";

const MARKETS_ALL = ["AE", "SA", "KW", "QA"];
const MARKET_LABELS = { AE: "UAE", SA: "KSA", KW: "Kuwait", QA: "Qatar" };
const MARKET_COLORS = { UAE: "#22d3ee", KSA: "#f59e0b", Kuwait: "#34d399", Qatar: "#a78bfa" };

const SIGNALS = {
  gaming:   { label: "Gaming",        icon: "🎮", desc: "Escapism / entertainment shift" },
  wellness: { label: "Wellness",      icon: "🧘", desc: "Anxiety / self-care signal" },
  news:     { label: "News",          icon: "📰", desc: "Crisis awareness monitoring" },
  cheap:    { label: '"Cheap"',       icon: "💰", desc: "Price sensitivity indicator" },
  delivery: { label: "Delivery",      icon: "📦", desc: "Retail avoidance signal" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function trendInfo(vals = []) {
  if (vals.length < 4) return { dir: "→", color: "#94a3b8", pct: 0 };
  const mid = Math.floor(vals.length / 2);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const pct = Math.round(((avg(vals.slice(mid)) - avg(vals.slice(0, mid))) / (avg(vals.slice(0, mid)) || 1)) * 100);
  if (pct > 4)  return { dir: "↑", color: "#34d399", pct };
  if (pct < -4) return { dir: "↓", color: "#f87171", pct };
  return { dir: "→", color: "#94a3b8", pct };
}

function buildChartData(dates = [], trendData = {}, signal, activeMarkets) {
  return dates.map((date, i) => {
    const row = { date };
    activeMarkets.forEach(m => {
      const vals = trendData[m]?.[signal];
      if (vals) row[m] = vals[i] ?? null;
    });
    return row;
  });
}

function deriveAlerts(trendData) {
  const alerts = [];
  Object.entries(trendData).forEach(([market, signals]) => {
    Object.entries(signals).forEach(([signal, vals]) => {
      if (!Array.isArray(vals) || vals.length < 4) return;
      const { pct, dir } = trendInfo(vals);
      if (Math.abs(pct) >= 20) {
        alerts.push({ market, signal, pct, dir, severity: Math.abs(pct) >= 30 ? "high" : "medium" });
      }
    });
  });
  return alerts.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ signal, vals = [] }) {
  const meta = SIGNALS[signal];
  const latest = vals[vals.length - 1] ?? 0;
  const { dir, color, pct } = trendInfo(vals);
  return (
    <div style={{
      background: "rgba(15,23,42,0.75)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "16px 18px", backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{meta.icon}</span>
        <span style={{ fontSize: 11, color, background: `${color}22`, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", fontWeight: 700 }}>
          {dir} {Math.abs(pct)}%
        </span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#f1f5f9", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>
        {latest}
      </div>
      <div style={{ fontSize: 10, color: "#475569", marginTop: 2, fontFamily: "monospace" }}>/ 100 index · UAE</div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8, fontWeight: 600 }}>{meta.label}</div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 3, lineHeight: 1.4 }}>{meta.desc}</div>
    </div>
  );
}

function SignalChart({ signal, dates, trendData, activeMarkets }) {
  const meta = SIGNALS[signal];
  const data = buildChartData(dates, trendData, signal, activeMarkets);
  return (
    <div style={{
      background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: "18px 14px 12px", backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{meta.label}</span>
        <span style={{ fontSize: 10, color: "#334155", marginLeft: "auto" }}>Google Trends (0–100)</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#94a3b8" }}
          />
          {activeMarkets.map(m => (
            <Line key={m} type="monotone" dataKey={m} stroke={MARKET_COLORS[m]}
              strokeWidth={2} dot={{ r: 3, fill: MARKET_COLORS[m], strokeWidth: 0 }}
              activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        {activeMarkets.map(m => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: MARKET_COLORS[m] }} />
            <span style={{ fontSize: 10, color: "#64748b" }}>{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertBanner({ alerts }) {
  if (!alerts.length) return (
    <div style={{ fontSize: 12, color: "#475569", padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
      No significant signal movements detected this week.
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          background: a.severity === "high" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
          border: `1px solid ${a.severity === "high" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
          borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 14 }}>{a.severity === "high" ? "🔴" : "🟡"}</span>
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>
            <strong style={{ color: "#f1f5f9" }}>{a.market}</strong>
            {" — "}<strong style={{ color: "#94a3b8" }}>{SIGNALS[a.signal]?.label ?? a.signal}</strong>
            {" searches "}{a.dir === "↑" ? "up" : "down"}
            {" "}<strong style={{ color: a.dir === "↑" ? "#f87171" : "#34d399" }}>{Math.abs(a.pct)}%</strong> WoW
          </span>
        </div>
      ))}
    </div>
  );
}

function LoadingSpinner({ message }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, minHeight: 400 }}>
      <div style={{
        width: 40, height: 40, border: "3px solid rgba(34,211,238,0.15)",
        borderTop: "3px solid #22d3ee", borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }} />
      <div style={{ color: "#64748b", fontSize: 13, fontFamily: "monospace" }}>{message}</div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function CrisisPulseLive() {
  const [trendData, setTrendData]   = useState({});  // { "UAE": { gaming: [...], ... }, ... }
  const [dates, setDates]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadMsg, setLoadMsg]       = useState("Connecting to Google Trends...");
  const [error, setError]           = useState(null);
  const [lastPulled, setLastPulled] = useState(null);
  const [cached, setCached]         = useState(false);
  const [activeMarkets, setActiveMarkets] = useState(["UAE", "KSA", "Qatar"]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setLoadMsg("Pulling Google Trends data for MENA markets…");

    try {
      const params = new URLSearchParams({
        markets: MARKETS_ALL.join(","),
        days: 7,
        ...(forceRefresh ? { refresh: "true" } : {}),
      });

      const res = await fetch(`${API_BASE}/api/trends?${params}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();

      if (json.error) throw new Error(json.error);

      setTrendData(json.markets || {});
      setDates(json.dates || []);
      setLastPulled(json.fetched_at);
      setCached(json.cached ?? false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleMarket = (m) => {
    setActiveMarkets(prev =>
      prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m]
    );
  };

  const alerts = deriveAlerts(trendData);
  const uaeData = trendData["UAE"] || {};

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#020617 0%,#0f172a 50%,#020617 100%)",
      fontFamily: "'IBM Plex Sans',system-ui,sans-serif",
      color: "#f1f5f9",
    }}>
      {/* Header */}
      <div style={{
        background: "rgba(2,6,23,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(16px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: loading ? "#f59e0b" : error ? "#f87171" : "#22d3ee",
            boxShadow: `0 0 12px ${loading ? "#f59e0b" : error ? "#f87171" : "#22d3ee"}`,
            animation: loading ? "none" : "pulse 2s infinite",
          }} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.05em" }}>CRISIS PULSE</span>
          <span style={{ fontSize: 12, color: "#475569" }}>— Media & Search Intelligence · MENA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastPulled && (
            <span style={{ fontSize: 11, color: "#334155", fontFamily: "monospace" }}>
              {cached ? "⚡ cached · " : "🔄 live · "}
              <span style={{ color: "#22d3ee" }}>
                {new Date(lastPulled).toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })} UTC
              </span>
            </span>
          )}
          <button onClick={() => fetchData(true)} disabled={loading} style={{
            background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.25)",
            color: "#22d3ee", borderRadius: 20, padding: "5px 14px", fontSize: 11,
            fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
          }}>
            {loading ? "Pulling…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1300, margin: "0 auto" }}>

        {loading ? (
          <LoadingSpinner message={loadMsg} />
        ) : error ? (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 12, padding: "24px", textAlign: "center", marginTop: 40,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, color: "#f87171", marginBottom: 8 }}>Could not reach the API backend</div>
            <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace", marginBottom: 16 }}>{error}</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>
              Make sure the backend is deployed on Render and the <code style={{ color: "#22d3ee" }}>API_BASE</code> URL at the top of this file is correct.
            </div>
            <button onClick={() => fetchData()} style={{
              background: "rgba(34,211,238,0.1)", border: "1px solid #22d3ee",
              color: "#22d3ee", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13,
            }}>Retry</button>
          </div>
        ) : (
          <>
            {/* Market filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 22, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#475569" }}>Markets:</span>
              {Object.values(MARKET_LABELS).map(m => (
                <button key={m} onClick={() => toggleMarket(m)} style={{
                  background: activeMarkets.includes(m) ? `${MARKET_COLORS[m]}22` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${activeMarkets.includes(m) ? MARKET_COLORS[m] : "rgba(255,255,255,0.08)"}`,
                  color: activeMarkets.includes(m) ? MARKET_COLORS[m] : "#475569",
                  borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{m}</button>
              ))}
              <span style={{ fontSize: 11, color: "#1e3a5f", marginLeft: "auto" }}>
                Source: Google Trends via pytrends · 7-day rolling · Index 0–100
              </span>
            </div>

            {/* Alerts */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                🚨 Automated Signal Alerts
              </div>
              <AlertBanner alerts={alerts} />
            </div>

            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 22 }}>
              {Object.keys(SIGNALS).map(sig => (
                <KpiCard key={sig} signal={sig} vals={uaeData[sig] || []} />
              ))}
            </div>

            {/* Charts */}
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              📊 7-Day Search Trends by Market
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
              {Object.keys(SIGNALS).map(sig => (
                <SignalChart key={sig} signal={sig} dates={dates} trendData={trendData} activeMarkets={activeMarkets} />
              ))}
            </div>

            {/* Footer */}
            <div style={{
              background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 10, padding: "14px 20px",
              display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16,
            }}>
              {[
                { icon: "✅", label: "Google Trends", note: "Live — auto-refreshes hourly via pytrends backend", cost: "Free" },
                { icon: "🔜", label: "YouTube Data API", note: "Next sprint — trending category share by region", cost: "Free (API key)" },
                { icon: "🔜", label: "Reddit / Twitch",  note: "Next sprint — narrative + gaming volume signals",  cost: "Free (OAuth)" },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 }}>{s.icon} {s.label}</div>
                  <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{s.note}</div>
                  <div style={{ fontSize: 10, color: "#22d3ee", marginTop: 4 }}>{s.cost}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Mono:wght@700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        button { transition: all 0.15s; }
        button:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}
