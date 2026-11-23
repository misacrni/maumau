// Sve statistike se računaju iz liste partija — isto što rade pivoti u Excelu.
const Stats = (() => {
  const DANI = ["ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota", "nedelja"];
  const MESECI = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
  const TIP = { F: "Finale 1 na 1", 2: "Pobeda protiv 2", A: "Pobeda protiv svih" };
  // Istaknute partije: clutch = pobeda posle 190–200 poena u toku partije; -101 = prekid i pobeda; HIO = Hole in one
  const hlKind = (h) => h === "HIO" ? "hio" : h === -101 ? "m101" : (typeof h === "number" && h >= 190 && h <= 200) ? "clutch" : null;
  const HL = { clutch: { icon: "⚡", label: "Clutch" }, m101: { icon: "💥", label: "−101" }, hio: { icon: "⛳", label: "Hole in one" } };
  const hlText = (h) => { const k = hlKind(h); return !k ? "" : k === "clutch" ? `${HL.clutch.icon} Clutch (${h})` : `${HL[k].icon} ${HL[k].label}`; };

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
      (!f.from || g.date >= f.from) && (!f.to || g.date <= f.to) &&
      (!f.np || g.np === +f.np) && (!f.pos || (f.pos === "first" ? g.first : g.last)));
  }

  function table(games, players) {
    const S = {};
    players.forEach((p) => S[p.id] = { id: p.id, name: p.name, days: new Set(), played: 0, wins: 0, finals: 0, finW: 0, finL: 0, w2: 0, wA: 0, firstW: 0, lastW: 0, nightBest: 0, clutch: 0, m101: 0, hio: 0, l2: 0, lA: 0 });
    const nights = new Map();
    for (const g of games) {
      for (const id of g.p) { if (!S[id]) continue; S[id].played++; S[id].days.add(g.day); }
      const w = S[g.w]; if (!w) continue;
      w.wins++;
      if (g.t === "F") { w.finals++; w.finW++; const l = S[g.l[0]]; if (l) { l.finals++; l.finL++; } }
      else if (g.t === "2") { w.w2++; g.l.forEach((x) => S[x] && S[x].l2++); }
      else if (g.t === "A") { w.wA++; g.l.forEach((x) => S[x] && S[x].lA++); }
      const hk = hlKind(g.h); if (hk) w[hk]++;
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
      wEnd: s.w2 + s.wA, WT: s.finW + s.w2 + s.wA, LT: s.finL + s.l2 + s.lA,
      pctWT: (s.finW + s.w2 + s.wA + s.finL + s.l2 + s.lA) ? (s.finW + s.w2 + s.wA) / (s.finW + s.w2 + s.wA + s.finL + s.l2 + s.lA) : 0,
      share: games.length ? s.wins / games.length : 0,
    })).filter((s) => s.played > 0).sort((a, b) => b.eff - a.eff).map((s, i, arr) => s);
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
    idx: { label: "Redni broj partije na bleji", key: (g) => g.idx, fmt: (k) => k + ". partija" },
    cnt: { label: "Broj partija na bleji", key: (g) => g.cnt, fmt: (k) => k + (k === 1 ? " partija" : k < 5 ? " partije" : " partija") },
    night: { label: "Bleja (datum)", key: (g) => g.date, fmt: (k) => { const [y, m, d] = k.split("-"); return `${+d}.${+m}.${y}.`; } },
    np: { label: "Broj igrača", key: (g) => g.np, fmt: (k) => k + " igrača" },
    fl: { label: "Prva / poslednja partija", key: (g) => g.cnt === 1 ? 0 : g.first ? 1 : g.last ? 3 : 2, fmt: (k) => ["Jedina na bleji", "Prva", "Između", "Poslednja"][k] },
    hl: { label: "Istaknute (clutch poeni)", key: (g) => hlKind(g.h) ? (g.h === "HIO" ? 999 : g.h) : -999, fmt: (k) => k === -999 ? "Obične partije" : k === 999 ? "⛳ Hole in one" : k === -101 ? "💥 −101" : "⚡ " + k + " poena" },
    tip: { label: "Način pobede", key: (g) => g.t, fmt: (k) => TIP[k] || k },
  };
  const METRICS = {
    wins: { label: "Pobede", pct: false }, winsShare: { label: "Pobede + % od ukupno", pct: false, combo: true },
    cum: { label: "Kumulativne pobede", pct: false }, eff: { label: "Efikasnost %", pct: true }, share: { label: "Udeo u pobedama %", pct: true },
    played: { label: "Odigrane partije", pct: false }, finals: { label: "Učešće u finalu", pct: false }, finW: { label: "Dobijena finala", pct: false },
    fin1v1: { label: "% dobijenih finala", pct: true },
  };

  // Pivot: redovi po dim (i opciono podgrupa dim2), vrednost po igraču
  function pivot(games, players, dim, metric, dim2) {
    const group = (gs, D) => { const m = new Map(); gs.forEach((g) => { const k = D.key(g); if (!m.has(k)) m.set(k, []); m.get(k).push(g); }); return [...m.entries()].sort((a, b) => (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0)); };
    const run = Object.fromEntries(players.map((p) => [p.id, 0]));
    const val = (t, gs, id) => {
      if (!t) return metric === "cum" ? (run[id] || null) : null;
      switch (metric) {
        case "share": return gs.length ? t.wins / gs.length : 0;
        case "winsShare": return [t.wins, gs.length ? t.wins / gs.length : 0];
        case "cum": run[id] += t.wins; return run[id];
        default: return t[metric];
      }
    };
    const mk = (k, gs, D, sub) => {
      const t = Object.fromEntries(table(gs, players).map((s) => [s.id, s]));
      return { key: k, sub, label: D.fmt ? D.fmt(k) : String(k), total: gs.length, vals: players.map((p) => val(t[p.id], gs, p.id)) };
    };
    const rows = [];
    for (const [k, gs] of group(games, DIMS[dim])) {
      if (dim2 && DIMS[dim2]) {
        const head = metric === "cum" ? null : mk(k, gs, DIMS[dim], false);
        if (head) { head.head = true; rows.push(head); }
        for (const [k2, gs2] of group(gs, DIMS[dim2])) rows.push(mk(k2, gs2, DIMS[dim2], true));
      } else rows.push(mk(k, gs, DIMS[dim], false));
    }
    const tAll = Object.fromEntries(table(games, players).map((s) => [s.id, s]));
    const total = { key: "Σ", label: "Ukupno", total: games.length, vals: players.map((p) => metric === "cum" ? (tAll[p.id]?.wins ?? null) : val(tAll[p.id], games, p.id)) };
    return { rows, total };
  }

  // H2H jednog igrača: finala protiv svakog + VS 2 + VS ALL (kao list Pregledi)
  function playerH2H(games, players, id) {
    const rows = players.filter((p) => p.id !== id).map((p) => {
      const w = games.filter((g) => g.t === "F" && g.w === id && g.l[0] === p.id).length;
      const l = games.filter((g) => g.t === "F" && g.w === p.id && g.l[0] === id).length;
      return { id: p.id, label: p.name, w, l };
    }).filter((r) => r.w + r.l > 0);
    const v2 = { label: "VS 2", w: games.filter((g) => g.t === "2" && g.w === id).length, l: games.filter((g) => g.t === "2" && g.l.includes(id)).length };
    const vA = { label: "VS ALL", w: games.filter((g) => g.t === "A" && g.w === id).length, l: games.filter((g) => g.t === "A" && g.l.includes(id)).length };
    const all = [...rows, v2, vA];
    const tot = { label: "Ukupno", w: all.reduce((s, r) => s + r.w, 0), l: all.reduce((s, r) => s + r.l, 0) };
    return { rows, v2, vA, tot };
  }

  // Rang lista svih duela (A vs B), sortirano po % pobeda
  function pairList(games, players) {
    const out = [];
    players.forEach((a) => {
      const h = playerH2H(games, players, a.id);
      h.rows.forEach((r) => out.push({ a: a.id, b: r.id, label: `${a.name} vs ${r.label}`, w: r.w, l: r.l }));
      [h.v2, h.vA].forEach((r) => r.w + r.l > 0 && out.push({ a: a.id, b: null, label: `${a.name} ${r.label}`, w: r.w, l: r.l }));
    });
    return out.map((r) => ({ ...r, n: r.w + r.l, pct: r.w / (r.w + r.l) })).sort((x, y) => y.pct - x.pct || y.n - x.n);
  }

  // Nizovi u direktnim duelima (finala 1 na 1)
  function duelStreaks(games, players) {
    const out = [];
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      const a = players[i].id, b = players[j].id;
      const fin = games.filter((g) => g.t === "F" && ((g.w === a && g.l[0] === b) || (g.w === b && g.l[0] === a)));
      if (!fin.length) continue;
      const best = { [a]: 0, [b]: 0 }; let cur = null, len = 0, start = null;
      fin.forEach((g) => { if (g.w === cur) len++; else { cur = g.w; len = 1; start = g.date; } best[cur] = Math.max(best[cur], len); });
      const max = Math.max(best[a], best[b]);
      out.push({ a, b, recA: best[a], recB: best[b], max, holders: [a, b].filter((x) => best[x] === max), leader: cur, cur: len, start, last: fin[fin.length - 1].date, n: fin.length });
    }
    return out;
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

  function highlights(games) { return games.filter((g) => hlKind(g.h)).reverse(); }
  return { playerH2H, pairList, duelStreaks, hlKind, HL, hlText, highlights, enrich, filter, table, h2hMatrix, pair, pivot, streaks, cumulative, DIMS, METRICS, TIP, DANI };
})();
