// Sve statistike se računaju iz liste partija — isto što rade pivoti u Excelu.
const Stats = (() => {
  const DANI = ["ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota", "nedelja"];
  const MESECI = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
  const TIP = { F: "Finale 1 na 1", 2: "Pobeda protiv 2", A: "Pobeda protiv svih" };

  // Obogati partije podacima o kolu (datum, sveska, redni broj u večeri...)
  function enrich(data) {
    const dayMap = new Map(data.days.map((d) => [d.n, d]));
    const perDay = new Map();
    data.games.forEach((g) => { if (!perDay.has(g.day)) perDay.set(g.day, []); perDay.get(g.day).push(g); });
    const out = [];
    for (const [n, list] of [...perDay.entries()].sort((a, b) => a[0] - b[0])) {
      const d = dayMap.get(n);
      if (!d) continue;
      const dt = new Date(d.date + "T12:00:00");
      list.forEach((g, i) => out.push({
        ...g, date: d.date, year: dt.getFullYear(), month: dt.getMonth() + 1, wd: (dt.getDay() + 6) % 7,
        book: d.book, dp: d.p, p: g.p || d.p, np: (g.p || d.p).length, idx: i + 1, cnt: list.length,
        first: i === 0, last: i === list.length - 1,
      }));
    }
    return out;
  }

  function filter(games, f) {
    return games.filter((g) => (!f.year || g.year === +f.year) && (!f.book || g.book === f.book) &&
      (!f.from || g.date >= f.from) && (!f.to || g.date <= f.to));
  }

  function table(games, players) {
    const S = {};
    players.forEach((p) => S[p.id] = { id: p.id, name: p.name, days: new Set(), played: 0, wins: 0, finals: 0, finW: 0, finL: 0, w2: 0, wA: 0, firstW: 0, lastW: 0, nightBest: 0 });
    const nights = new Map();
    for (const g of games) {
      for (const id of g.p) { if (!S[id]) continue; S[id].played++; S[id].days.add(g.day); }
      const w = S[g.w]; if (!w) continue;
      w.wins++;
      if (g.t === "F") { w.finals++; w.finW++; const l = S[g.l[0]]; if (l) { l.finals++; l.finL++; } }
      else if (g.t === "2") w.w2++; else if (g.t === "A") w.wA++;
      if (g.first) w.firstW++;
      if (g.last) w.lastW++;
      if (!nights.has(g.day)) nights.set(g.day, {});
      const nm = nights.get(g.day); nm[g.w] = (nm[g.w] || 0) + 1;
    }
    for (const nm of nights.values()) {
      const max = Math.max(...Object.values(nm));
      Object.entries(nm).forEach(([id, v]) => { if (v === max && S[id]) S[id].nightBest++; });
    }
    return Object.values(S).map((s) => ({
      ...s, days: s.days.size,
      eff: s.played ? s.wins / s.played : 0,
      finRate: s.played ? s.finals / s.played : 0,
      fin1v1: s.finals ? s.finW / s.finals : 0,
    })).filter((s) => s.played > 0).sort((a, b) => b.eff - a.eff);
  }

  // Matrica finala: m[a][b] = koliko puta je a pobedio b u finalu 1 na 1
  function h2hMatrix(games, players) {
    const m = {}; players.forEach((a) => { m[a.id] = {}; players.forEach((b) => m[a.id][b.id] = 0); });
    games.forEach((g) => { if (g.t === "F" && m[g.w] && m[g.w][g.l[0]] !== undefined) m[g.w][g.l[0]]++; });
    return m;
  }

  function pair(games, a, b) {
    const both = games.filter((g) => g.p.includes(a) && g.p.includes(b));
    const fin = games.filter((g) => g.t === "F" && ((g.w === a && g.l[0] === b) || (g.w === b && g.l[0] === a)));
    return {
      both: both.length, winsA: both.filter((g) => g.w === a).length, winsB: both.filter((g) => g.w === b).length,
      finals: fin.length, finA: fin.filter((g) => g.w === a).length, finB: fin.filter((g) => g.w === b).length,
      lastFinals: fin.slice(-10).reverse(),
      beatA: games.filter((g) => g.w === a && g.l.includes(b)).length,
      beatB: games.filter((g) => g.w === b && g.l.includes(a)).length,
    };
  }

  const DIMS = {
    year: { label: "Godina", key: (g) => g.year },
    book: { label: "Sveska", key: (g) => g.book },
    month: { label: "Mesec", key: (g) => g.month, fmt: (k) => MESECI[k - 1] },
    wd: { label: "Dan u nedelji", key: (g) => g.wd, fmt: (k) => DANI[k] },
    idx: { label: "Redni broj partije u večeri", key: (g) => g.idx, fmt: (k) => k + ". partija" },
    np: { label: "Broj igrača", key: (g) => g.np, fmt: (k) => k + " igrača" },
    fl: { label: "Prva / poslednja partija", key: (g) => g.cnt === 1 ? 0 : g.first ? 1 : g.last ? 3 : 2, fmt: (k) => ["Jedina u večeri", "Prva", "Između", "Poslednja"][k] },
    hl: { label: "Highlight W", key: (g) => g.h ?? "", fmt: (k) => k === "" ? "bez oznake" : String(k) },
    tip: { label: "Način pobede", key: (g) => g.t, fmt: (k) => TIP[k] || k },
  };
  const METRICS = {
    wins: { label: "Pobede", pct: false }, eff: { label: "Efikasnost %", pct: true }, share: { label: "Udeo u pobedama %", pct: true },
    played: { label: "Odigrane partije", pct: false }, finals: { label: "Učešće u finalu", pct: false }, finW: { label: "Dobijena finala", pct: false },
    fin1v1: { label: "% dobijenih finala", pct: true },
  };

  function pivot(games, players, dim, metric) {
    const D = DIMS[dim]; const groups = new Map();
    games.forEach((g) => { const k = D.key(g); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); });
    const keys = [...groups.keys()].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    const val = (t, total) => {
      if (!t) return null;
      switch (metric) {
        case "share": return total ? t.wins / total : 0;
        default: return t[metric];
      }
    };
    const rows = keys.map((k) => {
      const gs = groups.get(k); const t = Object.fromEntries(table(gs, players).map((s) => [s.id, s]));
      return { key: k, label: D.fmt ? D.fmt(k) : String(k), total: gs.length, vals: players.map((p) => val(t[p.id], gs.length)) };
    });
    const tAll = Object.fromEntries(table(games, players).map((s) => [s.id, s]));
    const total = { key: "Σ", label: "Ukupno", total: games.length, vals: players.map((p) => val(tAll[p.id], games.length)) };
    return { rows, total };
  }

  function streaks(games, id) {
    const mine = games.filter((g) => g.p.includes(id));
    const win = [], dry = [];
    let cur = null;
    mine.forEach((g) => {
      const w = g.w === id; const kind = w ? "W" : "D";
      if (!cur || cur.kind !== kind) { if (cur) (cur.kind === "W" ? win : dry).push(cur); cur = { kind, len: 0, from: g.date, to: g.date }; }
      cur.len++; cur.to = g.date;
    });
    if (cur) (cur.kind === "W" ? win : dry).push(cur);
    const top = (a) => [...a].sort((x, y) => y.len - x.len || (x.from < y.from ? 1 : -1)).slice(0, 5);
    return { win: top(win), dry: top(dry), current: cur };
  }

  // Kumulativne pobede po kolima (za grafikon)
  function cumulative(games, players) {
    const days = [...new Set(games.map((g) => g.date))];
    const acc = Object.fromEntries(players.map((p) => [p.id, 0]));
    const byDate = new Map(); games.forEach((g) => { if (!byDate.has(g.date)) byDate.set(g.date, []); byDate.get(g.date).push(g); });
    const series = Object.fromEntries(players.map((p) => [p.id, []]));
    days.forEach((d) => { byDate.get(d).forEach((g) => acc[g.w] !== undefined && acc[g.w]++); players.forEach((p) => series[p.id].push(acc[p.id])); });
    return { days, series };
  }

  return { enrich, filter, table, h2hMatrix, pair, pivot, streaks, cumulative, DIMS, METRICS, TIP, DANI };
})();
