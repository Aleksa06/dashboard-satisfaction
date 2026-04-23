"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID || "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";
const RANGE = "A:Z";

const BRAND = {
  red: "#cf2e2e",
  redDark: "#a61f1f",
  redSoft: "#fff1f1",
  green: "#16a34a",
  greenDark: "#166534",
  greenSoft: "#eefbf3",
  orange: "#f59e0b",
  text: "#1f2937",
  subtext: "#64748b",
  bg: "#f5f6f8",
  card: "#ffffff",
  border: "#e5e7eb",
  dark: "#111827",
  gray: "#6b7280",
};

type Stats = {
  total: number;
  aEnvoyer: number;
  envoye: number;
  envoye2: number;
  noResponse: number;
  termine: number;
  totalNotes: number;
  nbNotes: number;
  commentaires: number;
};

type FeedbackRow = {
  note: number | null;
  commentaire: string;
  motif: string;
  statut: string;
  dateFin: string;
};

type ChartRow = {
  label: string;
  moyenne: number;
  sortDate: Date;
};

const initialStats: Stats = {
  total: 0,
  aEnvoyer: 0,
  envoye: 0,
  envoye2: 0,
  noResponse: 0,
  termine: 0,
  totalNotes: 0,
  nbNotes: 0,
  commentaires: 0,
};

function normalizeText(value: string) {
  return (value || "").trim();
}

function normalizeStatus(value: string) {
  return normalizeText(value).toUpperCase();
}

function isTermine(value: string) {
  const status = normalizeStatus(value);
  return (
    status === "✅TERMINE" ||
    status === "✅ TERMINE" ||
    status === "TERMINE" ||
    status === "TERMINÉ"
  );
}

function parseNote(value: string): number | null {
  const cleaned = normalizeText(value).replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseFrenchDateTime(raw: string): Date | null {
  const value = normalizeText(raw);
  if (!value) return null;

  const [datePart, timePart = "00:00:00"] = value.split(" ");
  const parts = datePart.split("/");

  if (parts.length !== 3) return null;

  const [day, month, year] = parts.map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = timePart.split(":").map(Number);

  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function formatDayKey(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function formatFullDayKey(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatMonthKey(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${yyyy}`;
}

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function isRowEmpty(row: string[]) {
  return !row.some((cell) => normalizeText(cell) !== "");
}

function buildData(data: string[][]) {
  if (!data.length) {
    return {
      stats: initialStats,
      feedbackRows: [] as FeedbackRow[],
      motifs: [] as string[],
    };
  }

  const headers = data[0].map((h) => normalizeText(h).toLowerCase());

  const noteIndex = headers.indexOf("note");
  const commentaireIndex = headers.indexOf("commentaire");
  const statutIndex = headers.indexOf("statut");
  const motifIndex = headers.indexOf("motif_insatisfaction");

  const dateStatutIndex = headers.findIndex((h) => h.includes("date statut"));
  const dateIndex = headers.indexOf("date");

  if (noteIndex === -1 || commentaireIndex === -1 || statutIndex === -1) {
    throw new Error("Colonnes 'note', 'commentaire' ou 'statut' introuvables.");
  }

  const stats = { ...initialStats };
  const feedbackRows: FeedbackRow[] = [];
  const motifsSet = new Set<string>();

  for (const row of data.slice(1)) {
    if (isRowEmpty(row)) continue;

    const statut = normalizeText(row[statutIndex] || "");
    const normalizedStatus = normalizeStatus(statut);
    const note = parseNote(row[noteIndex] || "");
    const commentaire = normalizeText(row[commentaireIndex] || "");
    const motif = motifIndex !== -1 ? normalizeText(row[motifIndex] || "") : "";
    const dateFinRaw =
      (dateStatutIndex !== -1 ? row[dateStatutIndex] : "") ||
      (dateIndex !== -1 ? row[dateIndex] : "") ||
      "";

    stats.total++;

    if (normalizedStatus === "A_ENVOYER") stats.aEnvoyer++;
    if (normalizedStatus === "ENVOYÉ") stats.envoye++;
    if (normalizedStatus === "ENVOYÉ 2") stats.envoye2++;
    if (normalizedStatus === "PAS DE RÉPONSE ❌") stats.noResponse++;

    if (isTermine(statut)) {
      stats.termine++;

      if (note !== null) {
        stats.totalNotes += note;
        stats.nbNotes++;
      }

      if (commentaire !== "") {
        stats.commentaires++;
      }

      feedbackRows.push({
        note,
        commentaire,
        motif,
        statut,
        dateFin: dateFinRaw,
      });

      if (motif) motifsSet.add(motif);
    }
  }

  const motifs = Array.from(motifsSet).sort((a, b) => a.localeCompare(b));

  return { stats, feedbackRows, motifs };
}

function buildChartData(
  rows: FeedbackRow[],
  periodFilter: string,
  customStart: string,
  customEnd: string
) {
  const now = new Date();

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let granularity: "day" | "month" = "day";

  if (periodFilter === "month") {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
    granularity = "day";
  } else if (periodFilter === "year") {
    startDate = startOfYear(now);
    endDate = endOfYear(now);
    granularity = "month";
  } else {
    startDate = customStart ? startOfDay(parseInputDate(customStart) || new Date(0)) : null;
    endDate = customEnd ? endOfDay(parseInputDate(customEnd) || now) : null;
    granularity = "day";
  }

  const filtered = rows.filter((row) => {
    if (row.note === null) return false;
    const parsedDate = parseFrenchDateTime(row.dateFin);
    if (!parsedDate) return false;

    const afterStart = startDate ? parsedDate >= startDate : true;
    const beforeEnd = endDate ? parsedDate <= endDate : true;

    return afterStart && beforeEnd;
  });

  if (!filtered.length) {
    return {
      data: [] as ChartRow[],
      granularityLabel:
        periodFilter === "year"
          ? "Mois par mois"
          : periodFilter === "month"
          ? "Jour par jour"
          : "Période personnalisée",
    };
  }

  const grouped = new Map<string, { sum: number; count: number; sortDate: Date }>();

  for (const row of filtered) {
    const parsedDate = parseFrenchDateTime(row.dateFin);
    if (!parsedDate || row.note === null) continue;

    let key = "";
    let sortDate = startOfDay(parsedDate);

    if (granularity === "day") {
      key = periodFilter === "custom" ? formatFullDayKey(parsedDate) : formatDayKey(parsedDate);
      sortDate = startOfDay(parsedDate);
    } else {
      key = formatMonthKey(parsedDate);
      sortDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
    }

    const current = grouped.get(key);
    if (current) {
      current.sum += row.note;
      current.count += 1;
    } else {
      grouped.set(key, {
        sum: row.note,
        count: 1,
        sortDate,
      });
    }
  }

  const data = Array.from(grouped.entries())
    .map(([label, value]) => ({
      label,
      moyenne: Number((value.sum / value.count).toFixed(2)),
      sortDate: value.sortDate,
    }))
    .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

  const granularityLabel =
    periodFilter === "year"
      ? "Mois par mois"
      : periodFilter === "month"
      ? "Jour par jour"
      : "Période personnalisée";

  return { data, granularityLabel };
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats>(initialStats);
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [motifs, setMotifs] = useState<string[]>([]);

  const [periodFilter, setPeriodFilter] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [lowNoteFilter, setLowNoteFilter] = useState("all");
  const [lowMotifFilter, setLowMotifFilter] = useState("all");
  const [highNoteFilter, setHighNoteFilter] = useState("all");

  useEffect(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const today = endOfDay(now);

    setCustomStart(
      `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(
        monthStart.getDate()
      ).padStart(2, "0")}`
    );
    setCustomEnd(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
        today.getDate()
      ).padStart(2, "0")}`
    );
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    async function loadData() {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
          RANGE
        )}?key=${API_KEY}`;

        const res = await fetch(url);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error?.message || "Impossible de récupérer les données Google Sheets");
        }

        const values = json.values || [];
        const built = buildData(values);

        setStats(built.stats);
        setFeedbackRows(built.feedbackRows);
        setMotifs(built.motifs);
        setError("");
      } catch (err: any) {
        setError(err.message || "Erreur de connexion à Google Sheets");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 60000);
    intervalId = interval;

    return () => clearInterval(intervalId);
  }, []);

  const tauxReponseReel = useMemo(() => {
    const envoyes = stats.total - stats.aEnvoyer;
    return envoyes > 0 ? stats.termine / envoyes : 0;
  }, [stats]);

  const moyenneNote = useMemo(() => {
    return stats.nbNotes > 0 ? stats.totalNotes / stats.nbNotes : 0;
  }, [stats]);

  const tauxCommentaire = useMemo(() => {
    return stats.termine > 0 ? stats.commentaires / stats.termine : 0;
  }, [stats]);

  const pieData = useMemo(() => {
    return [
      { name: "Envoyé", value: stats.envoye },
      { name: "Envoyé 2", value: stats.envoye2 },
      { name: "Pas de réponse", value: stats.noResponse },
      { name: "Terminé", value: stats.termine },
    ].filter((item) => item.value > 0);
  }, [stats]);

  const lowScoreRows = useMemo(() => {
    return feedbackRows.filter((row) => {
      if (row.note === null || row.note < 1 || row.note > 3) return false;
      const noteOk = lowNoteFilter === "all" ? true : String(row.note) === lowNoteFilter;
      const motifOk = lowMotifFilter === "all" ? true : row.motif === lowMotifFilter;
      return noteOk && motifOk;
    });
  }, [feedbackRows, lowNoteFilter, lowMotifFilter]);

  const highScoreRows = useMemo(() => {
    return feedbackRows.filter((row) => {
      if (row.note === null || row.note < 4 || row.note > 5) return false;
      const noteOk = highNoteFilter === "all" ? true : String(row.note) === highNoteFilter;
      return noteOk;
    });
  }, [feedbackRows, highNoteFilter]);

  const chartResult = useMemo(() => {
    return buildChartData(feedbackRows, periodFilter, customStart, customEnd);
  }, [feedbackRows, periodFilter, customStart, customEnd]);

  const COLORS = ["#6b7280", "#f59e0b", "#dc2626", "#16a34a"];
  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;
  const formatNote = (val: number) => val.toFixed(2);

  if (loading) {
    return (
      <main style={{ padding: "40px", fontFamily: "Arial, sans-serif", background: BRAND.bg, minHeight: "100vh" }}>
        <h1 style={{ color: BRAND.text }}>Chargement du dashboard...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: "40px", fontFamily: "Arial, sans-serif", background: BRAND.bg, minHeight: "100vh" }}>
        <div style={errorBoxStyle}>
          <h1 style={{ margin: 0, color: BRAND.redDark }}>{error}</h1>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "28px",
        fontFamily: "Arial, sans-serif",
        background: BRAND.bg,
        minHeight: "100vh",
        color: BRAND.text,
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={brandBadgeStyle}>DISTRItec · Satisfaction client</div>
          <h1 style={{ margin: "10px 0 6px 0", fontSize: "34px", lineHeight: 1.1 }}>
            Dashboard Satisfaction
          </h1>
          <p style={{ margin: 0, color: BRAND.subtext, fontSize: "15px" }}>
            Suivi des enquêtes post-appel manqué
          </p>
        </div>

        <div style={headerMetaStyle}>
          <div style={liveDotStyle} />
          <span>Mise à jour automatique</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
          gap: "18px",
          marginBottom: "22px",
        }}
      >
        <KpiCard title="Total enquêtes" value={String(stats.total)} />
        <KpiCard title="Taux de réponse réel" value={formatPercent(tauxReponseReel)} />
        <KpiCard title="Note moyenne" value={`${formatNote(moyenneNote)} / 5`} />
        <KpiCard title="Taux de commentaire" value={formatPercent(tauxCommentaire)} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.95fr 1.35fr",
          gap: "22px",
          marginBottom: "22px",
          alignItems: "stretch",
        }}
      >
        <section style={panelStyle}>
          <div style={panelTitleRowStyle}>
            <h2 style={panelTitleStyle}>Suivi des enquêtes envoyées</h2>
          </div>

          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  outerRadius={124}
                  label={({ value, percent }) =>
                    `${value} (${((percent || 0) * 100).toFixed(0)}%)`
                  }
                  labelLine={true}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
  formatter={(value, name) => {
    const numericValue = typeof value === "number" ? value : Number(value ?? 0);
    const total = pieData.reduce((sum, item) => sum + item.value, 0);
    const pct = total > 0 ? ((numericValue / total) * 100).toFixed(1) : "0.0";
    return [`${numericValue} soit ${pct}%`, String(name)];
  }}
/>
                <Legend
                  formatter={(value) => {
                    const item = pieData.find((d) => d.name === value);
                    const total = pieData.reduce((sum, d) => sum + d.value, 0);
                    const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
                    return `${value} (${pct}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelTitleRowStyle}>
            <h2 style={panelTitleStyle}>Évolution de la satisfaction</h2>
            <span style={miniInfoStyle}>{chartResult.granularityLabel}</span>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px", marginBottom: "14px" }}>
            {[
              { key: "month", label: "Mois" },
              { key: "year", label: "Année" },
              { key: "custom", label: "Personnalisé" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setPeriodFilter(item.key)}
                style={{
                  ...periodButtonStyle,
                  background: periodFilter === item.key ? BRAND.red : "#fff",
                  color: periodFilter === item.key ? "#fff" : BRAND.text,
                  borderColor: periodFilter === item.key ? BRAND.red : BRAND.border,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {periodFilter === "custom" && (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
              <div>
                <label style={labelStyle}>Date début</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={selectStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Date fin</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={selectStyle}
                />
              </div>
            </div>
          )}

          <div style={{ width: "100%", height: 360 }}>
            {chartResult.data.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: BRAND.subtext,
                  border: `1px dashed ${BRAND.border}`,
                  borderRadius: "16px",
                  background: "#fafafa",
                }}
              >
                Aucune note terminée sur cette période
              </div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={chartResult.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eceff3" />
                  <XAxis dataKey="label" tick={{ fill: BRAND.subtext, fontSize: 12 }} />
                  <YAxis domain={[0, 5]} tick={{ fill: BRAND.subtext, fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="moyenne"
                    stroke={BRAND.red}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "22px",
          alignItems: "start",
        }}
      >
        <section
          style={{
            ...panelStyle,
            borderTop: `6px solid ${BRAND.red}`,
            background: BRAND.card,
          }}
        >
          <div style={panelTitleRowStyle}>
            <h2 style={{ ...panelTitleStyle, color: BRAND.redDark }}>Notes 1 à 3</h2>
            <span style={{ ...miniInfoStyle, background: BRAND.redSoft, color: BRAND.redDark }}>
              Priorité de traitement
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px", marginBottom: "14px" }}>
            <div>
              <label style={labelStyle}>Filtre note</label>
              <select
                value={lowNoteFilter}
                onChange={(e) => setLowNoteFilter(e.target.value)}
                style={compactSelectStyle}
              >
                <option value="all">Toutes</option>
                <option value="1">Note 1</option>
                <option value="2">Note 2</option>
                <option value="3">Note 3</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Motif d&apos;insatisfaction</label>
              <select
                value={lowMotifFilter}
                onChange={(e) => setLowMotifFilter(e.target.value)}
                style={compactSelectStyle}
              >
                <option value="all">Tous les motifs</option>
                {motifs.map((motif) => (
                  <option key={motif} value={motif}>
                    {motif}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ScrollableFeedbackTable rows={lowScoreRows} showMotif variant="danger" />
        </section>

        <section
          style={{
            ...panelStyle,
            borderTop: `6px solid ${BRAND.green}`,
            background: BRAND.card,
          }}
        >
          <div style={panelTitleRowStyle}>
            <h2 style={{ ...panelTitleStyle, color: BRAND.greenDark }}>Notes 4 à 5</h2>
            <span style={{ ...miniInfoStyle, background: BRAND.greenSoft, color: BRAND.greenDark }}>
              Feedback positif
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px", marginBottom: "14px" }}>
            <div>
              <label style={labelStyle}>Filtre note</label>
              <select
                value={highNoteFilter}
                onChange={(e) => setHighNoteFilter(e.target.value)}
                style={compactSelectStyle}
              >
                <option value="all">Toutes</option>
                <option value="4">Note 4</option>
                <option value="5">Note 5</option>
              </select>
            </div>
          </div>

          <ScrollableFeedbackTable rows={highScoreRows} showMotif={false} variant="success" />
        </section>
      </div>
    </main>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={kpiCardStyle}>
      <div style={kpiTopBorderStyle} />
      <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", color: BRAND.subtext, fontWeight: 600 }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: BRAND.dark }}>{value}</p>
    </div>
  );
}

function ScrollableFeedbackTable({
  rows,
  showMotif,
  variant,
}: {
  rows: FeedbackRow[];
  showMotif: boolean;
  variant: "danger" | "success";
}) {
  const rowBg = variant === "danger" ? "#fff8f8" : "#f8fff9";

  return (
    <div
      style={{
        marginTop: "8px",
        maxHeight: "610px",
        overflowY: "auto",
        borderRadius: "14px",
        border: `1px solid ${BRAND.border}`,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "14px" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
          <tr>
            <th style={{ ...thStyle, background: "#fff" }}>Date</th>
            <th style={{ ...thStyle, background: "#fff" }}>Note</th>
            <th style={{ ...thStyle, background: "#fff" }}>Commentaire</th>
            {showMotif && <th style={{ ...thStyle, background: "#fff" }}>Motif</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={showMotif ? 4 : 3}
                style={{ padding: "18px 10px", color: BRAND.subtext, background: "#fff" }}
              >
                Aucun résultat
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${row.dateFin}-${row.note}-${index}`}>
                <td style={{ ...tdStyle, background: rowBg }}>{row.dateFin || "-"}</td>
                <td style={{ ...tdStyle, background: rowBg, fontWeight: 700 }}>{row.note ?? "-"}</td>
                <td style={{ ...tdStyle, background: rowBg }}>{row.commentaire || "-"}</td>
                {showMotif && <td style={{ ...tdStyle, background: rowBg }}>{row.motif || "-"}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  background: BRAND.card,
  borderRadius: "24px",
  padding: "24px 26px",
  marginBottom: "22px",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  borderTop: `6px solid ${BRAND.red}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
};

const brandBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "999px",
  background: BRAND.redSoft,
  color: BRAND.redDark,
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const headerMetaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: BRAND.subtext,
  fontSize: "14px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const liveDotStyle: React.CSSProperties = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  background: BRAND.green,
  boxShadow: "0 0 0 6px rgba(22,163,74,0.12)",
};

const kpiCardStyle: React.CSSProperties = {
  background: BRAND.card,
  borderRadius: "20px",
  padding: "20px",
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const kpiTopBorderStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "5px",
  background: BRAND.red,
};

const panelStyle: React.CSSProperties = {
  background: BRAND.card,
  padding: "22px",
  borderRadius: "22px",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const panelTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  color: BRAND.text,
};

const miniInfoStyle: React.CSSProperties = {
  padding: "7px 11px",
  borderRadius: "999px",
  background: "#f1f5f9",
  color: BRAND.subtext,
  fontSize: "12px",
  fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "14px",
  color: BRAND.subtext,
  fontWeight: 600,
};

const selectStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: "12px",
  border: `1px solid ${BRAND.border}`,
  minWidth: "230px",
  background: "white",
  color: BRAND.text,
  outline: "none",
};

const compactSelectStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "12px",
  border: `1px solid ${BRAND.border}`,
  minWidth: "180px",
  background: "white",
  color: BRAND.text,
  outline: "none",
};

const periodButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "999px",
  border: "1px solid",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "13px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  fontWeight: 700,
  color: BRAND.subtext,
  borderBottom: `1px solid ${BRAND.border}`,
  fontSize: "13px",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 10px",
  color: BRAND.text,
  verticalAlign: "top",
  borderBottom: "1px solid #f1f5f9",
};

const errorBoxStyle: React.CSSProperties = {
  background: "#fff1f1",
  border: `1px solid #fecaca`,
  borderRadius: "18px",
  padding: "20px",
};