/* Mau Mau — statistika ekipe. Statički sajt (GitHub Pages); podaci su šifrovani lozinkom ekipe,
   a unos ide preko GitHub API-ja sa tokenom koji ima samo admin. */
(() => {
  const DATA_ENC = "data/data.enc.json", DATA_PLAIN = "data/data.json";
  const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (v, d = 0) => v == null ? "–" : (v * 100).toFixed(d) + "%";
  const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${+d}.${+m}.${y}.`; };
  const store = {
    get: (k, def = null) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
    del: (k) => { try { localStorage.removeItem(k); } catch { } },
  };

  const S = {
    data: null, games: [], players: [], password: null, encrypted: true,
    f: { year: "", book: "" }, view: "tabela",
    pivot: store.get("mm_pivot", { dim: "year", metric: "eff" }),
    pair: { a: null, b: null }, histPlayer: "", histQ: "",
    draft: null, dirty: false,
  };
  const color = (id) => COLORS[S.players.findIndex((p) => p.id === id) % COLORS.length];
  const pname = (id) => (S.players.find((p) => p.id === id) || { name: id }).name;
  const dot = (id) => `<i class="dot" style="background:${color(id)}"></i>`;

  function toast(msg, ms = 2500) { const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), ms); }

  // ---------- Učitavanje ----------
  async function fetchJson(url) { const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) throw new Error(r.status); return r.json(); }

  async function boot() {
    let box = null;
    try { box = await fetchJson(DATA_ENC); } catch { }
    if (!box) {
      try { setData(await fetchJson(DATA_PLAIN)); S.encrypted = false; return start(); }
      catch { $("#login").classList.remove("hidden"); $("#loginErr").textContent = "Podaci nisu pronađeni."; return; }
    }
    S.box = box;
    const pw = store.get("mm_pw");
    if (pw && await tryPw(pw)) return start();
    $("#login").classList.remove("hidden");
  }
  async function tryPw(pw) {
    try { setData(await MMCrypto.decrypt(S.box, pw)); S.password = pw; return true; } catch { return false; }
  }
  function setData(d) {
    S.data = d; S.players = d.players; S.games = Stats.enrich(d);
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#pw").value;
    $("#loginErr").textContent = "Proveravam…";
    if (await tryPw(pw)) { if ($("#remember").checked) store.set("mm_pw", pw); $("#login").classList.add("hidden"); start(); }
    else $("#loginErr").textContent = "Pogrešna lozinka.";
  });

  function start() {
    ["#top", "#view", "#nav"].forEach((s) => $(s).classList.remove("hidden"));
    if (store.get("mm_admin") || location.hash === "#admin") $("#navAdmin").classList.remove("hidden");
    fillFilters();
    const last = S.data.days[S.data.days.length - 1];
    $("#lastUpd").textContent = last ? "· poslednje kolo " + fmtDate(last.date) : "";
    render();
  }

  function fillFilters() {
    const years = [...new Set(S.games.map((g) => g.year))].sort((a, b) => b - a);
    const books = [...new Set(S.data.days.map((d) => d.book))];
    $("#fYear").innerHTML = `<option value="">Sve godine</option>` + years.map((y) => `<option ${S.f.year == y ? "selected" : ""}>${y}</option>`).join("");
    $("#fBook").innerHTML = `<option value="">Sve sveske</option>` + books.map((b) => `<option ${S.f.book === b ? "selected" : ""}>${esc(b)}</option>`).join("");
  }
  $("#fYear").onchange = (e) => { S.f.year = e.target.value; render(); };
  $("#fBook").onchange = (e) => { S.f.book = e.target.value; render(); };
  $("#fReset").onclick = () => { S.f = { year: "", book: "" }; fillFilters(); render(); };
  $$("#nav button").forEach((b) => b.onclick = () => { S.view = b.dataset.v; if (S.view !== "admin") S.players = S.data.players; $$("#nav button").forEach((x) => x.classList.toggle("on", x === b)); render(); window.scrollTo(0, 0); });
  $("#modalClose").onclick = () => $("#modal").classList.add("hidden");
  $("#modal").onclick = (e) => { if (e.target.id === "modal") $("#modal").classList.add("hidden"); };
  function modal(html) { $("#modalBody").innerHTML = html; $("#modal").classList.remove("hidden"); }

  const G = () => Stats.filter(S.games, S.f);
  const filterLabel = () => [S.f.year, S.f.book].filter(Boolean).join(" · ") || "Sve od 2017.";

  function render() {
    $("#top .filters").style.display = S.view === "admin" ? "none" : "";
    const v = { tabela: vTabela, h2h: vH2H, pivot: vPivot, nizovi: vNizovi, istorija: vIstorija, admin: vAdmin }[S.view];
    $("#view").innerHTML = v();
    bind[S.view] && bind[S.view]();
  }
  const bind = {};

  // ---------- Tabela ----------
  function vTabela() {
    const g = G(), t = Stats.table(g, S.players), nights = new Set(g.map((x) => x.day)).size;
    const first = g[0], last = g[g.length - 1];
    if (!g.length) return `<p class="empty">Nema partija za izabrani filter.</p>`;
    const leader = t[0];
    return `
    <div class="cards">
      <div class="card"><b>${g.length}</b><span>partija</span></div>
      <div class="card"><b>${nights}</b><span>večeri</span></div>
      <div class="card"><b>${dot(leader.id)}${esc(leader.name)}</b><span>najbolja efikasnost ${pct(leader.eff)}</span></div>
    </div>
    <p class="muted small">${filterLabel()} · ${fmtDate(first.date)} – ${fmtDate(last.date)}</p>
    <h2>Tabela</h2>
    <div class="tw"><table class="grid sticky">
      <thead><tr><th>#</th><th>Igrač</th><th title="Odigrane partije">Odigr.</th><th>Pob.</th><th>Efik.</th><th title="Učešće u finalu 1 na 1">Finala</th><th title="% partija u kojima je bio u finalu">U fin.%</th><th title="Dobijena – izgubljena finala">F W-L</th><th title="% dobijenih finala 1 na 1">% 1:1</th><th title="Pobeda protiv 2 igrača">vs 2</th><th title="Pobeda protiv svih">vs svi</th><th title="Pobede u prvoj partiji večeri">Prva</th><th title="Pobede u poslednjoj partiji večeri">Posl.</th><th title="Večeri u kojima je imao najviše pobeda (ili delio prvo mesto)">👑 Večeri</th><th>Večeri</th></tr></thead>
      <tbody>${t.map((s, i) => `<tr data-p="${s.id}" class="click">
        <td>${i + 1}</td><td class="nm">${dot(s.id)}${esc(s.name)}</td><td>${s.played}</td><td><b>${s.wins}</b></td>
        <td><span class="bar" style="--w:${s.eff * 100 / Math.max(...t.map((x) => x.eff))}%;--c:${color(s.id)}">${pct(s.eff, 1)}</span></td>
        <td>${s.finals}</td><td>${pct(s.finRate)}</td><td>${s.finW}-${s.finL}</td><td>${pct(s.fin1v1)}</td><td>${s.w2}</td><td>${s.wA}</td><td>${s.firstW}</td><td>${s.lastW}</td><td>${s.nightBest}</td><td>${s.days}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="muted small">Efikasnost = pobede / odigrane partije. Dodirni igrača za profil.</p>
    <h2>Pobede kroz vreme</h2>
    ${chart(g)}`;
  }
  bind.tabela = () => $$("tr[data-p]").forEach((r) => r.onclick = () => profile(r.dataset.p));

  function chart(g) {
    const { days, series } = Stats.cumulative(g, S.players);
    if (days.length < 2) return "";
    const W = 640, H = 260, P = 32, max = Math.max(1, ...Object.values(series).flat());
    const x = (i) => P + (i * (W - P - 8)) / (days.length - 1), y = (v) => H - 22 - (v * (H - 40)) / max;
    const yearsTicks = []; let prev = "";
    days.forEach((d, i) => { const yr = d.slice(0, 4); if (yr !== prev) { yearsTicks.push([i, yr]); prev = yr; } });
    const lines = S.players.filter((p) => series[p.id][series[p.id].length - 1] > 0).map((p) => {
      const pts = series[p.id].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      const lv = series[p.id][series[p.id].length - 1];
      return `<polyline fill="none" stroke="${color(p.id)}" stroke-width="2" points="${pts}"/><text x="${W - 4}" y="${y(lv) + 4}" text-anchor="end" fill="${color(p.id)}" class="lbl">${esc(p.name)} ${lv}</text>`;
    }).join("");
    const grid = [0, .25, .5, .75, 1].map((f) => `<line x1="${P}" x2="${W - 8}" y1="${y(max * f)}" y2="${y(max * f)}" class="gl"/><text x="${P - 4}" y="${y(max * f) + 4}" text-anchor="end" class="ax">${Math.round(max * f)}</text>`).join("");
    const xt = yearsTicks.map(([i, yr]) => `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${yearsTicks.length > 6 ? "’" + yr.slice(2) : yr}</text>`).join("");
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kumulativne pobede">${grid}${xt}${lines}</svg></div>`;
  }

  function profile(id) {
    const g = G(), me = Stats.table(g, S.players).find((s) => s.id === id);
    if (!me) return;
    const m = Stats.h2hMatrix(g, S.players), st = Stats.streaks(g, id);
    const byYear = Stats.pivot(g, S.players, "year", "eff"), pi = S.players.findIndex((p) => p.id === id);
    const others = S.players.filter((p) => p.id !== id && (m[id][p.id] + m[p.id][id]) > 0);
    modal(`<h2>${dot(id)}${esc(me.name)}</h2><p class="muted small">${filterLabel()}</p>
      <div class="cards">
        <div class="card"><b>${me.wins}</b><span>pobeda od ${me.played}</span></div>
        <div class="card"><b>${pct(me.eff, 1)}</b><span>efikasnost</span></div>
        <div class="card"><b>${me.finW}-${me.finL}</b><span>finala (${pct(me.fin1v1)})</span></div>
      </div>
      <p>Trenutno: ${st.current ? (st.current.kind === "W" ? `🔥 niz od <b>${st.current.len}</b> pobeda` : `${st.current.len} partija bez pobede`) : "–"}</p>
      <h3>Finala protiv</h3>
      <table class="grid"><thead><tr><th>Protivnik</th><th>Dobio</th><th>Izgubio</th><th>%</th></tr></thead><tbody>
      ${others.map((p) => { const w = m[id][p.id], l = m[p.id][id]; return `<tr><td class="nm">${dot(p.id)}${esc(p.name)}</td><td>${w}</td><td>${l}</td><td>${pct(w / (w + l))}</td></tr>`; }).join("")}
      </tbody></table>
      <h3>Po godinama</h3>
      <table class="grid"><thead><tr><th>Godina</th><th>Efikasnost</th></tr></thead><tbody>
      ${byYear.rows.filter((r) => r.vals[pi] != null).map((r) => `<tr><td>${r.label}</td><td>${pct(r.vals[pi], 1)}</td></tr>`).join("")}
      </tbody></table>`);
  }

  // ---------- H2H ----------
  function vH2H() {
    const g = G(), m = Stats.h2hMatrix(g, S.players);
    const act = S.players.filter((p) => g.some((x) => x.p.includes(p.id)));
    if (!S.pair.a || !act.find((p) => p.id === S.pair.a)) S.pair.a = act[0]?.id;
    if (!S.pair.b || S.pair.b === S.pair.a || !act.find((p) => p.id === S.pair.b)) S.pair.b = act.find((p) => p.id !== S.pair.a)?.id;
    const cell = (a, b) => {
      if (a === b) return `<td class="diag">—</td>`;
      const w = m[a][b], l = m[b][a], n = w + l;
      const r = n ? w / n : .5;
      return `<td style="background:${n ? `color-mix(in srgb, ${r >= .5 ? "#16a34a" : "#dc2626"} ${Math.round(Math.abs(r - .5) * 120)}%, transparent)` : ""}"><b>${w}</b>${n ? `<small>${pct(r)}</small>` : ""}</td>`;
    };
    const P = S.pair.a && S.pair.b ? Stats.pair(g, S.pair.a, S.pair.b) : null;
    const opt = (sel) => act.map((p) => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${esc(p.name)}</option>`).join("");
    return `<h2>Finala 1 na 1</h2>
      <p class="muted small">Red = pobednik, kolona = poraženi u finalu. ${filterLabel()}</p>
      <div class="tw"><table class="grid h2h"><thead><tr><th></th>${act.map((p) => `<th>${dot(p.id)}${esc(p.name)}</th>`).join("")}<th>Σ</th></tr></thead>
      <tbody>${act.map((a) => `<tr><th class="nm">${dot(a.id)}${esc(a.name)}</th>${act.map((b) => cell(a.id, b.id)).join("")}<td><b>${act.reduce((s, b) => s + m[a.id][b.id], 0)}</b></td></tr>`).join("")}</tbody></table></div>
      <h2>Duel</h2>
      <div class="row"><select id="pa">${opt(S.pair.a)}</select><span>vs</span><select id="pb">${opt(S.pair.b)}</select></div>
      ${P ? `<div class="duel">
        <div class="side" style="--c:${color(S.pair.a)}"><b>${P.finA}</b><span>${esc(pname(S.pair.a))}</span></div>
        <div class="mid">finala<br><small>${P.finals} ukupno</small></div>
        <div class="side" style="--c:${color(S.pair.b)}"><b>${P.finB}</b><span>${esc(pname(S.pair.b))}</span></div>
      </div>
      <table class="grid"><tbody>
        <tr><td>Partije u kojima su igrali zajedno</td><td colspan="2"><b>${P.both}</b></td></tr>
        <tr><td>Pobede u tim partijama</td><td>${dot(S.pair.a)}${P.winsA}</td><td>${dot(S.pair.b)}${P.winsB}</td></tr>
        <tr><td>Pobedio drugog na kraju (finale, vs 2, vs svi)</td><td>${dot(S.pair.a)}${P.beatA}</td><td>${dot(S.pair.b)}${P.beatB}</td></tr>
      </tbody></table>
      <h3>Poslednja finala</h3>
      <ul class="list">${P.lastFinals.map((x) => `<li>${fmtDate(x.date)} — ${dot(x.w)}<b>${esc(pname(x.w))}</b> pobedio</li>`).join("") || "<li class='muted'>Nema finala.</li>"}</ul>` : ""}`;
  }
  bind.h2h = () => { $("#pa").onchange = (e) => { S.pair.a = e.target.value; render(); }; $("#pb").onchange = (e) => { S.pair.b = e.target.value; render(); }; };

  // ---------- Pregledi (pivoti) ----------
  const PRESETS = [["year", "eff", "Po godinama"], ["book", "wins", "Po sveskama"], ["fl", "wins", "Prva / poslednja"], ["idx", "wins", "Redni broj partije"], ["np", "eff", "Broj igrača"], ["wd", "eff", "Dan u nedelji"], ["tip", "wins", "Način pobede"], ["month", "wins", "Po mesecima"]];
  function vPivot() {
    const g = G(), { dim, metric } = S.pivot, M = Stats.METRICS[metric];
    const pv = Stats.pivot(g, S.players, dim, metric);
    const act = S.players.filter((p, i) => pv.total.vals[i] != null);
    const idx = act.map((p) => S.players.indexOf(p));
    const fmt = (v) => v == null ? "<span class='muted'>–</span>" : M.pct ? pct(v, 1) : v;
    const best = (r) => { const vs = idx.map((i) => r.vals[i] ?? -1); return Math.max(...vs); };
    return `<div class="chips">${PRESETS.map(([d, m, l]) => `<button class="chip ${d === dim && m === metric ? "on" : ""}" data-d="${d}" data-m="${m}">${l}</button>`).join("")}</div>
      <div class="row"><label>Redovi <select id="pDim">${Object.entries(Stats.DIMS).map(([k, v]) => `<option value="${k}" ${k === dim ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
      <label>Vrednost <select id="pMet">${Object.entries(Stats.METRICS).map(([k, v]) => `<option value="${k}" ${k === metric ? "selected" : ""}>${v.label}</option>`).join("")}</select></label></div>
      <p class="muted small">${filterLabel()}. Zeleno = najbolji u redu.</p>
      <div class="tw"><table class="grid sticky pv"><thead><tr><th>${Stats.DIMS[dim].label}</th>${act.map((p) => `<th>${dot(p.id)}${esc(p.name)}</th>`).join("")}<th>Partija</th></tr></thead>
      <tbody>${[...pv.rows, pv.total].map((r) => { const b = best(r); return `<tr class="${r.key === "Σ" ? "tot" : ""}"><th class="nm">${esc(r.label)}</th>${idx.map((i) => `<td class="${r.vals[i] != null && r.vals[i] === b && b > 0 ? "best" : ""}">${fmt(r.vals[i])}</td>`).join("")}<td class="muted">${r.total}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  bind.pivot = () => {
    const save = () => { store.set("mm_pivot", S.pivot); render(); };
    $$(".chip[data-d]").forEach((b) => b.onclick = () => { S.pivot = { dim: b.dataset.d, metric: b.dataset.m }; save(); });
    $("#pDim").onchange = (e) => { S.pivot.dim = e.target.value; save(); };
    $("#pMet").onchange = (e) => { S.pivot.metric = e.target.value; save(); };
  };

  // ---------- Nizovi ----------
  function vNizovi() {
    const g = G();
    const act = S.players.filter((p) => g.some((x) => x.p.includes(p.id)));
    const all = act.map((p) => ({ p, s: Stats.streaks(g, p.id) }));
    const recW = all.flatMap(({ p, s }) => s.win.map((x) => ({ ...x, id: p.id }))).sort((a, b) => b.len - a.len).slice(0, 5);
    const recD = all.flatMap(({ p, s }) => s.dry.map((x) => ({ ...x, id: p.id }))).sort((a, b) => b.len - a.len).slice(0, 5);
    const li = (x) => `<li>${dot(x.id)}<b>${esc(pname(x.id))}</b> — ${x.len} <span class="muted small">(${fmtDate(x.from)} – ${fmtDate(x.to)})</span></li>`;
    return `<h2>Trenutno</h2>
      <div class="cards">${all.map(({ p, s }) => `<div class="card"><b>${dot(p.id)}${esc(p.name)}</b><span>${s.current ? (s.current.kind === "W" ? `🔥 ${s.current.len} pob. zaredom` : `${s.current.len} bez pobede`) : "–"}</span></div>`).join("")}</div>
      <div class="two"><div><h2>🔥 Najduži nizovi pobeda</h2><ol class="list">${recW.map(li).join("")}</ol></div>
      <div><h2>🥶 Najduže bez pobede</h2><ol class="list">${recD.map(li).join("")}</ol></div></div>
      <h2>Po igraču</h2>
      <div class="tw"><table class="grid"><thead><tr><th>Igrač</th><th>Top 5 nizova pobeda</th><th>Top 5 bez pobede</th></tr></thead><tbody>
      ${all.map(({ p, s }) => `<tr><td class="nm">${dot(p.id)}${esc(p.name)}</td><td>${s.win.map((x) => `<span title="${fmtDate(x.from)} – ${fmtDate(x.to)}">${x.len}</span>`).join(", ")}</td><td>${s.dry.map((x) => `<span title="${fmtDate(x.from)} – ${fmtDate(x.to)}">${x.len}</span>`).join(", ")}</td></tr>`).join("")}
      </tbody></table></div><p class="muted small">Niz se računa kroz partije u kojima je igrač igrao. ${filterLabel()}</p>`;
  }

  // ---------- Istorija ----------
  function vIstorija() {
    const g = G(); const byDay = new Map();
    g.forEach((x) => { if (!byDay.has(x.day)) byDay.set(x.day, []); byDay.get(x.day).push(x); });
    let days = [...byDay.entries()].sort((a, b) => b[0] - a[0]);
    if (S.histPlayer) days = days.filter(([, gs]) => gs[0].p.includes(S.histPlayer));
    if (S.histQ) days = days.filter(([, gs]) => fmtDate(gs[0].date).includes(S.histQ) || gs[0].book.toLowerCase().includes(S.histQ.toLowerCase()));
    const shown = days.slice(0, 60);
    const desc = (x) => x.t === "F" ? `pobedio ${dot(x.l[0])}${esc(pname(x.l[0]))} u finalu` : x.t === "2" ? `pobedio ${x.l.map((i) => esc(pname(i))).join(" i ")}` : "pobedio sve";
    return `<div class="row"><input id="hq" type="search" placeholder="Datum (npr. 3.2025) ili sveska" value="${esc(S.histQ)}">
      <select id="hp"><option value="">Svi igrači</option>${S.players.map((p) => `<option value="${p.id}" ${S.histPlayer === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
      <p class="muted small">${days.length} večeri${days.length > 60 ? " (prikazano 60)" : ""}</p>
      ${shown.map(([n, gs]) => {
        const cnt = {}; gs.forEach((x) => cnt[x.w] = (cnt[x.w] || 0) + 1);
        return `<details class="night"><summary><span><b>${fmtDate(gs[0].date)}</b> <span class="muted small">${Stats.DANI[gs[0].wd]} · ${esc(gs[0].book)} · kolo ${n}</span></span>
        <span class="score">${gs[0].p.map((id) => `<span class="pill" style="--c:${color(id)}">${esc(pname(id))} ${cnt[id] || 0}</span>`).join("")}</span></summary>
        <ol class="list">${gs.map((x) => `<li>${dot(x.w)}<b>${esc(pname(x.w))}</b> ${desc(x)}</li>`).join("")}</ol></details>`;
      }).join("")}`;
  }
  bind.istorija = () => {
    $("#hq").oninput = (e) => { S.histQ = e.target.value; clearTimeout(S._hq); S._hq = setTimeout(() => { render(); const i = $("#hq"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); };
    $("#hp").onchange = (e) => { S.histPlayer = e.target.value; render(); };
  };

  // ---------- Unos (admin) ----------
  const today = () => new Date().toISOString().slice(0, 10);
  function ensureDraft() { if (!S.draft) S.draft = store.get("mm_draft") || JSON.parse(JSON.stringify(S.data)); S.players = S.draft.players; }
  function saveDraft() { S.dirty = true; store.set("mm_draft", S.draft); }
  function vAdmin() {
    ensureDraft();
    const cfg = store.get("mm_admin", { owner: "", repo: "", branch: "main", token: "" });
    const D = S.draft, books = [...new Set(D.days.map((d) => d.book))];
    if (!S.edit) { const last = D.days[D.days.length - 1]; S.edit = { date: today(), book: last?.book || "", p: last ? [...last.p] : S.players.map((p) => p.id), w: null, t: "F", l: [] }; }
    const E = S.edit, day = D.days.find((d) => d.date === E.date);
    const dayGames = day ? D.games.filter((g) => g.day === day.n) : [];
    const present = day ? day.p : E.p;
    if (!E.gp || E.gp.some((id) => !present.includes(id))) E.gp = [...present];
    const gp = E.gp.filter((id) => present.includes(id));
    const chip = (id, on, attr) => `<button class="pchip ${on ? "on" : ""}" style="--c:${color(id)}" ${attr}="${id}">${esc(pname(id))}</button>`;
    const others = gp.filter((id) => id !== E.w);
    const desc = (x) => x.t === "F" ? `finale vs ${esc(pname(x.l[0]))}` : x.t === "2" ? `vs ${x.l.map((i) => esc(pname(i))).join(" i ")}` : "vs svi";
    return `<h2>Unos partija</h2>
    <div class="box">
      <div class="row"><label>Datum <input type="date" id="eDate" value="${E.date}"></label>
      <label>Sveska <select id="eBook">${books.map((b) => `<option ${b === (day?.book || E.book) ? "selected" : ""}>${esc(b)}</option>`).join("")}<option value="__new">+ Nova sveska…</option></select></label></div>
      <p class="small muted">Igrači večeras${day ? " (kolo " + day.n + ")" : ""}:</p>
      <div class="chips">${S.players.map((p) => chip(p.id, present.includes(p.id), "data-pp")).join("")}</div>
    </div>
    <div class="box">
      <details ${gp.length !== present.length ? "open" : ""}><summary class="small muted">Igrali ovu partiju: ${gp.length === present.length ? "svi" : gp.map(pname).join(", ")}</summary>
      <div class="chips">${present.map((id) => chip(id, gp.includes(id), "data-gp")).join("")}</div></details>
      <p class="small muted">Pobednik partije:</p>
      <div class="chips">${gp.map((id) => chip(id, E.w === id, "data-w")).join("")}</div>
      ${E.w ? `<p class="small muted">Kraj partije:</p>
      <div class="chips">
        <button class="chip ${E.t === "F" ? "on" : ""}" data-t="F">Finale 1 na 1</button>
        ${others.length >= 2 ? `<button class="chip ${E.t === "2" ? "on" : ""}" data-t="2">Protiv 2</button>` : ""}
        ${others.length >= 3 ? `<button class="chip ${E.t === "A" ? "on" : ""}" data-t="A">Protiv svih (${others.length})</button>` : ""}
      </div>
      ${E.t !== "A" ? `<p class="small muted">${E.t === "F" ? "Protivnik u finalu:" : "Izaberi 2 protivnika:"}</p><div class="chips">${others.map((id) => chip(id, E.l.includes(id), "data-l")).join("")}</div>` : ""}` : ""}
      <button id="addGame" class="primary" ${canAdd() ? "" : "disabled"}>+ Dodaj partiju</button>
    </div>
    ${dayGames.length ? `<h3>Partije ${fmtDate(E.date)}</h3><ol class="list">${dayGames.map((x) => `<li>${dot(x.w)}<b>${esc(pname(x.w))}</b> ${desc(x)} <button class="ghost small" data-del="${x.id}">✕</button></li>`).join("")}</ol>` : ""}
    <div class="row sticky-save"><button id="saveGh" class="primary" ${S.dirty || store.get("mm_draft") ? "" : "disabled"}>☁️ Sačuvaj i objavi</button><button id="discard" class="ghost">Odbaci izmene</button></div>
    <details class="box"><summary>⚙️ Podešavanja (GitHub, lozinka, izvoz)</summary>
      <div class="form">
        <label>GitHub vlasnik <input id="cOwner" value="${esc(cfg.owner)}" placeholder="misacrni"></label>
        <label>Repozitorijum <input id="cRepo" value="${esc(cfg.repo)}" placeholder="maumau"></label>
        <label>Grana <input id="cBranch" value="${esc(cfg.branch || "main")}"></label>
        <label>Token (fine-grained, samo Contents: write za ovaj repo) <input id="cToken" type="password" value="${esc(cfg.token)}"></label>
        <button id="saveCfg">Sačuvaj podešavanja</button>
        <hr><b>Igrači</b>
        ${D.players.map((p) => `<label>${dot(p.id)}Ime <input data-ren="${p.id}" value="${esc(p.name)}"></label>`).join("")}
        <div class="row"><input id="newPlayer" placeholder="Ime novog igrača"><button id="addPlayer" class="ghost">+ Dodaj igrača</button></div>
        <p class="small muted">Novi igrač dobija lozinku ekipe i odmah vidi sve izveštaje. Izmene važe posle „Sačuvaj i objavi“.</p>
        <hr><label>Nova lozinka ekipe <input id="newPw" type="password" placeholder="ostavi prazno ako ne menjaš"></label>
        <button id="exportJson" class="ghost">⬇ Izvoz JSON</button> <button id="exportCsv" class="ghost">⬇ Izvoz CSV</button>
      </div>
    </details>`;
  }
  function canAdd() { const E = S.edit; return E && E.w && (E.t === "A" || (E.t === "F" && E.l.length === 1) || (E.t === "2" && E.l.length === 2)); }
  bind.admin = () => {
    const E = S.edit, D = S.draft;
    $("#eDate").onchange = (e) => { E.date = e.target.value; E.w = null; E.l = []; render(); };
    $("#eBook").onchange = (e) => {
      let b = e.target.value;
      if (b === "__new") { b = prompt("Naziv nove sveske (npr. 7 Black):"); if (!b) return render(); }
      E.book = b; const day = D.days.find((d) => d.date === E.date); if (day) { day.book = b; saveDraft(); } render();
    };
    $$("[data-pp]").forEach((b) => b.onclick = () => {
      const id = b.dataset.pp, day = D.days.find((d) => d.date === E.date), arr = day ? day.p : E.p;
      const i = arr.indexOf(id); i >= 0 ? arr.splice(i, 1) : arr.push(id);
      arr.sort((a, c) => S.players.findIndex((p) => p.id === a) - S.players.findIndex((p) => p.id === c));
      if (day) saveDraft(); E.w = null; E.l = []; render();
    });
    $$("[data-gp]").forEach((b) => b.onclick = () => { const i = E.gp.indexOf(b.dataset.gp); i >= 0 ? E.gp.splice(i, 1) : E.gp.push(b.dataset.gp); E.w = null; E.l = []; render(); });
    $$("[data-w]").forEach((b) => b.onclick = () => { E.w = b.dataset.w; E.l = []; render(); });
    $$("[data-t]").forEach((b) => b.onclick = () => { E.t = b.dataset.t; E.l = []; render(); });
    $$("[data-l]").forEach((b) => b.onclick = () => {
      const id = b.dataset.l; if (E.t === "F") E.l = [id]; else { const i = E.l.indexOf(id); i >= 0 ? E.l.splice(i, 1) : E.l.length < 2 && E.l.push(id); }
      render();
    });
    const add = $("#addGame"); if (add) add.onclick = () => {
      let day = D.days.find((d) => d.date === E.date);
      if (!day) {
        if (E.p.length < 3) return toast("Potrebna su najmanje 3 igrača (kvorum).");
        const book = E.book || D.days[D.days.length - 1]?.book || "1";
        day = { n: Math.max(0, ...D.days.map((d) => d.n)) + 1, date: E.date, book, bookDay: D.days.filter((d) => d.book === book).length + 1, p: [...E.p] };
        D.days.push(day); D.days.sort((a, b) => a.date < b.date ? -1 : 1);
      }
      const gp = E.gp.filter((id) => day.p.includes(id));
      if (gp.length < 2) return toast("U partiji moraju biti bar 2 igrača.");
      const l = E.t === "A" ? gp.filter((x) => x !== E.w) : [...E.l];
      const g = { id: Math.max(0, ...D.games.map((g) => g.id)) + 1, day: day.n, w: E.w, l, t: E.t };
      if (gp.length !== day.p.length) g.p = gp;
      D.games.push(g);
      E.w = null; E.l = []; E.t = "F"; E.gp = null; saveDraft(); toast("Partija dodata"); render();
    };
    $$("[data-del]").forEach((b) => b.onclick = () => { if (!confirm("Obriši ovu partiju?")) return; D.games = D.games.filter((g) => g.id !== +b.dataset.del); saveDraft(); render(); });
    $("#discard").onclick = () => { if (!confirm("Odbaciti sve nesačuvane izmene?")) return; store.del("mm_draft"); S.draft = null; S.dirty = false; S.edit = null; S.players = S.data.players; render(); };
    $("#saveCfg").onclick = () => { store.set("mm_admin", { owner: $("#cOwner").value.trim(), repo: $("#cRepo").value.trim(), branch: $("#cBranch").value.trim() || "main", token: $("#cToken").value.trim() }); toast("Podešavanja sačuvana na ovom uređaju"); };
    $("#saveGh").onclick = publish;
    $$("[data-ren]").forEach((i) => i.onchange = () => { const p = D.players.find((x) => x.id === i.dataset.ren); if (i.value.trim()) { p.name = i.value.trim(); S.players = D.players; saveDraft(); render(); } });
    $("#addPlayer").onclick = () => {
      const name = $("#newPlayer").value.trim(); if (!name) return;
      if (D.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast("Taj igrač već postoji.");
      let id = "P" + (D.players.length + 1); while (D.players.some((p) => p.id === id)) id += "x";
      D.players.push({ id, name }); S.players = D.players; saveDraft(); toast(`Dodat: ${name}`); render();
    };
    $("#exportJson").onclick = () => download("maumau.json", JSON.stringify(D, null, 1), "application/json");
    $("#exportCsv").onclick = () => {
      const dm = new Map(D.days.map((d) => [d.n, d]));
      const rows = [["id", "kolo", "datum", "sveska", "igraci", "pobednik", "tip", "porazeni"]].concat(D.games.map((g) => { const d = dm.get(g.day); return [g.id, g.day, d.date, d.book, d.p.map(pname).join("|"), pname(g.w), Stats.TIP[g.t], g.l.map(pname).join("|")]; }));
      download("maumau.csv", "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
    };
  };
  function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }

  async function publish() {
    const cfg = store.get("mm_admin");
    if (!cfg?.token || !cfg.owner || !cfg.repo) return toast("Prvo unesi GitHub podešavanja.");
    const newPw = $("#newPw")?.value;
    const pw = newPw || S.password;
    if (!pw) return toast("Nema lozinke ekipe — uloguj se ponovo.");
    const btn = $("#saveGh"); btn.disabled = true; btn.textContent = "Objavljujem…";
    try {
      S.draft.updated = new Date().toISOString();
      const box = await MMCrypto.encrypt(S.draft, pw);
      const api = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_ENC}`;
      const H = { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" };
      const cur = await fetch(`${api}?ref=${cfg.branch}`, { headers: H });
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const body = { message: `Unos: ${S.edit?.date || ""}`, branch: cfg.branch, content: MMCrypto.b64(new TextEncoder().encode(JSON.stringify(box))), sha };
      const r = await fetch(api, { method: "PUT", headers: H, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).message || r.status);
      setData(S.draft); S.box = box; S.password = pw; if (newPw && store.get("mm_pw")) store.set("mm_pw", newPw);
      store.del("mm_draft"); S.draft = null; S.dirty = false; fillFilters();
      toast("✅ Objavljeno. Igrači vide izmene za ~1 min.", 4000); render();
    } catch (e) { toast("Greška: " + e.message, 5000); btn.disabled = false; btn.textContent = "☁️ Sačuvaj i objavi"; }
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
  boot();
})();
