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

  function info() {
    const r = S.data.rules;
    setTimeout(() => { const lo = $("#logoutBtn"); if (lo) lo.onclick = logout; }, 0);
    setTimeout(() => { const b = $("#enableAdmin"); if (b) b.onclick = () => { showAdmin(); $("#modal").classList.add("hidden"); S.view = "admin"; $$("#nav button").forEach((x) => x.classList.toggle("on", x.dataset.v === "admin")); render(); }; }, 0);
    modal(`<h2>ℹ️ O aplikaciji</h2>
      <div class="box"><b>✏️ Unos rezultata (admin)</b><p class="small muted">${store.get("mm_admin")?.token ? "✅ Ovaj uređaj je prijavljen kao admin (GitHub token je sačuvan)." : "Uključuje tab Unos na ovom uređaju. Za objavu je potreban GitHub token koji ima samo admin, pa igrači ne mogu ništa da promene."}</p><button id="enableAdmin">${store.get("mm_admin_on") ? "Otvori Unos" : "Uključi tab Unos"}</button></div>
      <div class="box"><b>🚪 Odjava</b><p class="small muted">Briše sa ovog uređaja zapamćenu lozinku ekipe i, ako postoji, admin token i nesačuvan unos.</p><button id="logoutBtn" class="ghost">Odjavi se</button></div>
      <p>Statistika naše Mau Mau bleje od 2017. Svi podaci su iz sveski i Excela, a od sada se unose ovde. Gore biraš godinu ili svesku, i svi prikazi se računaju samo za to.</p>
      <ul class="list">
        <li><b>🏆 Tabela</b> – efikasnost (pobede / odigrane partije), finala, pobede u prvoj i poslednjoj partiji, ⚡ clutch, 👑 bleje, završnica (W/L ukupno) i grafikon pobeda kroz vreme. Dodirni igrača za profil.</li>
        <li><b>⚔️ H2H</b> – 🔥 nizovi u finalima (ko kome vezuje i koliko), matrica finala 1 na 1, H2H po igraču sa VS 2 i VS svi, rang lista duela i poređenje dva igrača.</li>
        <li><b>📊 Pregledi</b> – svi pivoti iz Excela: po godinama, sveskama, mesecima, danima, blejama (i kumulativno), prva/poslednja partija bleje, broj igrača i partija, highlight.</li>
        <li><b>⭐ Rekordi</b> – istaknute partije (⚡ clutch 190–200, 💥 −101, ⛳ Hole in one), trenutni nizovi i najduži nizovi pobeda i bez pobede.</li>
        <li><b>📖 Istorija</b> – svaka bleja i svaka partija, pretraga po datumu, svesci i igraču.</li>
      </ul>
      <p class="muted small">Pojmovi: <b>finale</b> = poslednja dva igrača u partiji; <b>vs 2</b> = pobeda kad su na kraju ostala još dvojica; <b>vs svi</b> = pobeda pre nego što je iko ispao; <b>niz</b> se računa samo kroz partije u kojima je igrač igrao.</p>
      ${r ? `<h2>${esc(r.title)}</h2><p class="muted">${esc(r.sub)}</p>${r.sections.map((sc) => `<details class="box"><summary>${esc(sc.h)}</summary><table class="grid rules"><tbody>${sc.items.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table></details>`).join("")}` : ""}`);
  }
  $("#infoBtn").onclick = info;
  function logout() {
    if (store.get("mm_draft") && !confirm("Imaš nesačuvan unos. Odjavom se briše. Nastavi?")) return;
    ["mm_pw", "mm_admin", "mm_admin_on", "mm_draft"].forEach(store.del);
    location.hash = ""; location.reload();
  }
  function showAdmin() { store.set("mm_admin_on", true); $("#navAdmin").classList.remove("hidden"); }
  window.addEventListener("hashchange", () => { if (location.hash === "#admin" && S.data) showAdmin(); });

  function start() {
    ["#top", "#view", "#nav"].forEach((s) => $(s).classList.remove("hidden"));
    if (store.get("mm_admin") || store.get("mm_admin_on") || location.hash === "#admin") showAdmin();
    fillFilters();
    const last = S.data.days[S.data.days.length - 1];
    $("#lastUpd").textContent = last ? "· poslednja bleja " + fmtDate(last.date) : "";
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
  function modal(html) { $("#modalBody").innerHTML = html; $("#modal").classList.remove("hidden"); makeSortable($("#modalBody")); }

  // Sortiranje: dodir na naslov kolone (ponovni dodir obrće redosled)
  function cellVal(td) {
    const t = (td?.textContent || "").trim().replace(/\s+/g, " ");
    const m = t.replace(",", ".").match(/-?\d+(\.\d+)?/);
    const d = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (d) return +d[3] * 1e4 + +d[2] * 100 + +d[1];
    return m && /^[\s🔥⚡💥⛳-]*-?\d/.test(t) ? parseFloat(m[0]) : t.toLowerCase();
  }
  function makeSortable(root) {
    $$("table.grid", root).forEach((tbl) => {
      if (!tbl.tHead || tbl.querySelector("tr.head")) return;
      const ths = [...tbl.tHead.rows[0].cells];
      ths.forEach((th, ci) => {
        th.classList.add("sortable");
        th.onclick = () => {
          const body = tbl.tBodies[0], rows = [...body.rows], fixed = rows.filter((r) => r.classList.contains("tot")), data = rows.filter((r) => !r.classList.contains("tot"));
          const prev = th.dataset.dir;
          const isNum = typeof cellVal(data[0]?.cells[ci]) === "number";
          const dir = prev ? (prev === "desc" ? "asc" : "desc") : (isNum ? "desc" : "asc");
          ths.forEach((x) => { delete x.dataset.dir; });
          th.dataset.dir = dir;
          data.sort((a, b) => {
            const x = cellVal(a.cells[ci]), y = cellVal(b.cells[ci]);
            const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "sr");
            return dir === "asc" ? c : -c;
          });
          [...data, ...fixed].forEach((r) => body.appendChild(r));
        };
      });
    });
  }

  const G = () => Stats.filter(S.games, S.f);
  const filterLabel = () => [S.f.year, S.f.book].filter(Boolean).join(" · ") || "Sve od 2017.";

  function render() {
    $("#top .filters").style.display = S.view === "admin" ? "none" : "";
    const v = { tabela: vTabela, h2h: vH2H, pivot: vPivot, nizovi: vNizovi, istorija: vIstorija, admin: vAdmin }[S.view];
    $("#view").innerHTML = v();
    bind[S.view] && bind[S.view]();
    makeSortable($("#view"));
  }
  const bind = {};

  // ---------- Tabela ----------
  function vTabela() {
    const g = G(), t = Stats.table(g, S.players), nights = new Set(g.map((x) => x.day)).size;
    const first = g[0], last = g[g.length - 1];
    if (!g.length) return `<p class="empty">Nema partija za izabrani filter.</p>`;
    const leader = t[0];
    const books = [...new Set(S.data.days.map((d) => d.book))], curBook = books[books.length - 1], curYear = String(new Date().getFullYear());
    const quick = [["Sve", "", ""], ["Aktuelna sveska (" + curBook + ")", "", curBook], ["Ova godina", curYear, ""]];
    const tEnd = [...t].sort((a, b) => b.pctWT - a.pctWT);
    return `<div class="chips">${quick.map(([l, y, b]) => `<button class="chip ${S.f.year === y && S.f.book === b ? "on" : ""}" data-qy="${y}" data-qb="${esc(b)}">${esc(l)}</button>`).join("")}</div>
    <div class="cards">
      <div class="card"><b>${g.length}</b><span>partija</span></div>
      <div class="card"><b>${nights}</b><span>bleja</span></div>
      <div class="card"><b>${dot(leader.id)}${esc(leader.name)}</b><span>najbolja efikasnost ${pct(leader.eff)}</span></div>
    </div>
    <p class="muted small">${filterLabel()} · ${fmtDate(first.date)} – ${fmtDate(last.date)}</p>
    <h2>Tabela</h2>
    <div class="tw"><table class="grid sticky">
      <thead><tr><th>#</th><th>Igrač</th><th title="Odigrane partije">Odigr.</th><th>Pob.</th><th>Efik.</th><th title="Učešće u finalu 1 na 1">Finala</th><th title="% partija u kojima je bio u finalu">U fin.%</th><th title="Dobijena – izgubljena finala">F W-L</th><th title="% dobijenih finala 1 na 1">% 1:1</th><th title="Pobeda protiv 2 igrača">vs 2</th><th title="Pobeda protiv svih">vs svi</th><th title="Pobede u prvoj partiji bleje">Prva</th><th title="Pobede u poslednjoj partiji bleje">Posl.</th><th title="Pobede posle 190–200 poena u toku partije">⚡ Clutch</th><th title="Pobeda prekidom na −101 / Hole in one">💥/⛳</th><th title="Bleje na kojima je imao najviše pobeda (ili delio prvo mesto)">👑 Bleje</th><th title="Na koliko bleja je bio">Bio na bleji</th></tr></thead>
      <tbody>${t.map((s, i) => `<tr data-p="${s.id}" class="click">
        <td>${i + 1}</td><td class="nm">${dot(s.id)}${esc(s.name)}</td><td>${s.played}</td><td><b>${s.wins}</b></td>
        <td><span class="bar" style="--w:${s.eff * 100 / Math.max(...t.map((x) => x.eff))}%;--c:${color(s.id)}">${pct(s.eff, 1)}</span></td>
        <td>${s.finals}</td><td>${pct(s.finRate)}</td><td>${s.finW}-${s.finL}</td><td>${pct(s.fin1v1)}</td><td>${s.w2}</td><td>${s.wA}</td><td>${s.firstW}</td><td>${s.lastW}</td><td><b>${s.clutch}</b></td><td>${s.m101}/${s.hio}</td><td>${s.nightBest}</td><td>${s.days}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="muted small">Efikasnost = pobede / odigrane partije. Dodirni igrača za profil.</p>
    <h2>Završnica (finala, vs 2, vs svi)</h2>
    <div class="tw"><table class="grid sticky"><thead><tr><th>#</th><th>Igrač</th><th>Dobio fin.</th><th>Izgubio fin.</th><th>Finala</th><th>% 1:1</th><th>Win vs 2</th><th>Win vs svi</th><th>Σ W vs 2+svi</th><th>W ukupno</th><th>L ukupno</th><th>W+L</th><th>% W ukupno</th></tr></thead><tbody>
    ${tEnd.map((s, i) => `<tr data-p="${s.id}" class="click"><td>${i + 1}</td><td class="nm">${dot(s.id)}${esc(s.name)}</td><td>${s.finW}</td><td>${s.finL}</td><td>${s.finals}</td><td>${pct(s.fin1v1, 1)}</td><td>${s.w2}</td><td>${s.wA}</td><td>${s.wEnd}</td><td><b>${s.WT}</b></td><td>${s.LT}</td><td>${s.WT + s.LT}</td><td><b>${pct(s.pctWT, 1)}</b></td></tr>`).join("")}
    <tr class="tot"><td></td><td class="nm">Ukupno</td>${["finW", "finL", "finals"].map((k) => `<td>${t.reduce((a, s) => a + s[k], 0)}</td>`).join("")}<td></td>${["w2", "wA", "wEnd", "WT", "LT"].map((k) => `<td>${t.reduce((a, s) => a + s[k], 0)}</td>`).join("")}<td>${t.reduce((a, s) => a + s.WT + s.LT, 0)}</td><td></td></tr>
    </tbody></table></div>
    <p class="muted small">L ukupno = izgubljena finala + porazi kad je neko pobedio protiv 2 ili protiv svih. Kao tabela „Finala“ na listu Pregledi.</p>
    <h2>Pobede kroz vreme</h2>
    ${chart(g)}`;
  }
  bind.tabela = () => {
    $$("tr[data-p]").forEach((r) => r.onclick = () => profile(r.dataset.p));
    $$("[data-qy]").forEach((b) => b.onclick = () => { S.f.year = b.dataset.qy; S.f.book = b.dataset.qb; fillFilters(); render(); });
  };

  function chart(g) {
    const { days, series } = Stats.cumulative(g, S.players);
    if (days.length < 2) return "";
    const MES = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
    const W = 680, H = 290, L = 34, Rm = 112, T = 12, B = 44, max = Math.max(1, ...Object.values(series).flat());
    const PW = W - L - Rm, x = (i) => L + (i * PW) / (days.length - 1), y = (v) => T + (H - T - B) * (1 - v / max);
    // Ose: crtica za svaki mesec, natpis meseca (ili samo godine kad je period dug)
    const months = []; let pm = "";
    days.forEach((d, i) => { const k = d.slice(0, 7); if (k !== pm) { months.push([i, +d.slice(5, 7), d.slice(0, 4)]); pm = k; } });
    const span = months.length, every = span <= 14 ? 1 : span <= 30 ? 2 : span <= 48 ? 3 : 0;
    let lastLab = -99, lastYr = -99;
    const xt = months.map(([i, m, yr]) => {
      const xx = x(i).toFixed(1), isJan = m === 1 || i === 0;
      const showLab = every && (m - 1) % every === 0 && x(i) - lastLab >= 26; if (showLab) lastLab = x(i);
      const showYr = isJan && x(i) - lastYr >= 34; if (showYr) lastYr = x(i);
      const lab = showLab ? `<text x="${xx}" y="${H - B + 16}" class="ax" text-anchor="middle">${MES[m - 1]}</text>` : "";
      const yl = showYr ? `<text x="${xx}" y="${H - B + 32}" class="ax yr" text-anchor="${i === 0 ? "start" : "middle"}">${yr}</text>` : "";
      return `<line x1="${xx}" x2="${xx}" y1="${H - B}" y2="${H - B + (isJan ? 8 : 4)}" class="tick"/>${isJan && i ? `<line x1="${xx}" x2="${xx}" y1="${T}" y2="${H - B}" class="gl yl"/>` : ""}${lab}${yl}`;
    }).join("");
    const step = Math.max(1, Math.ceil(max / 5 / 5) * 5 > max / 2 ? Math.ceil(max / 4) : Math.ceil(max / 5 / 5) * 5);
    let grid = ""; for (let v = 0; v <= max; v += step) grid += `<line x1="${L}" x2="${L + PW}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L - 5}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`;
    const act = S.players.filter((p) => series[p.id][series[p.id].length - 1] > 0);
    const lines = act.map((p) => `<polyline fill="none" stroke="${color(p.id)}" stroke-width="2.2" stroke-linejoin="round" points="${series[p.id].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>`).join("");
    // Imena desno, razmaknuta da se ne preklapaju
    const labs = act.map((p) => ({ p, v: series[p.id][series[p.id].length - 1] })).map((o) => ({ ...o, yy: y(o.v) })).sort((a, b) => a.yy - b.yy);
    const GAP = 17; labs.forEach((o, i) => { if (i && o.yy - labs[i - 1].yy < GAP) o.yy = labs[i - 1].yy + GAP; });
    const over = labs.length ? labs[labs.length - 1].yy - (H - B) : 0; if (over > 0) labs.forEach((o) => o.yy -= over);
    const lt = labs.map((o) => `<line x1="${L + PW}" y1="${y(o.v)}" x2="${L + PW + 8}" y2="${o.yy}" stroke="${color(o.p.id)}" stroke-width="1"/><text x="${L + PW + 11}" y="${o.yy + 4}" fill="${color(o.p.id)}" class="lbl">${esc(o.p.name)} ${o.v}</text>`).join("");
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kumulativne pobede">${grid}${xt}<line x1="${L}" x2="${L + PW}" y1="${H - B}" y2="${H - B}" class="axl"/>${lines}${lt}</svg></div>`;
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
      <h3>H2H (finala, vs 2, vs svi)</h3>
      ${h2hTable(g, id)}
      <h3>Po godinama</h3>
      <table class="grid"><thead><tr><th>Godina</th><th>Efikasnost</th></tr></thead><tbody>
      ${byYear.rows.filter((r) => r.vals[pi] != null).map((r) => `<tr><td>${r.label}</td><td>${pct(r.vals[pi], 1)}</td></tr>`).join("")}
      </tbody></table>`);
  }

  function h2hTable(g, id) {
    const h = Stats.playerH2H(g, S.players, id);
    const row = (r, cls = "") => `<tr class="${cls}"><td class="nm">${r.id ? dot(r.id) : ""}${esc(r.label)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.w + r.l}</td><td>${r.w + r.l ? pct(r.w / (r.w + r.l), 1) : "–"}</td></tr>`;
    return `<table class="grid"><thead><tr><th>${esc(pname(id))} H2H</th><th>Dobio</th><th>Izgubio</th><th>Ukupno</th><th>% pobeda</th></tr></thead><tbody>
      ${h.rows.map((r) => row(r)).join("")}${row(h.v2)}${row(h.vA)}${row(h.tot, "tot")}</tbody></table>`;
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
    const ds = Stats.duelStreaks(g, act).sort((x, y) => y.cur - x.cur || y.max - x.max);
    if (!S.h2hP || !act.find((p) => p.id === S.h2hP)) S.h2hP = act[0]?.id;
    const pl = Stats.pairList(g, act);
    return `<h2>🔥 Nizovi u finalima</h2>
      <p class="muted small">Računa se samo kroz direktna finala ta dva igrača; partije u kojima nisu igrali finale ne prekidaju niz. ${filterLabel()}</p>
      <div class="tw"><table class="grid"><thead><tr><th>Duel</th><th>Trenutno vodi</th><th>Niz</th><th>Od</th><th>Rekordni niz</th><th>Rekorder</th><th>Rekord (prvi / drugi)</th><th>Finala</th><th>Poslednje</th></tr></thead><tbody>
      ${ds.map((x) => `<tr><td class="nm">${dot(x.a)}${esc(pname(x.a))} – ${dot(x.b)}${esc(pname(x.b))}</td>
        <td class="nm"><b style="color:${color(x.leader)}">${esc(pname(x.leader))}</b></td><td><b>${x.cur >= 3 ? "🔥 " : ""}${x.cur}</b></td><td class="muted">${fmtDate(x.start)}</td>
        <td>${x.max}</td><td class="nm">${x.holders.map((h) => esc(pname(h))).join(" / ")}</td><td>${x.recA} / ${x.recB}</td><td>${x.n}</td><td class="muted">${fmtDate(x.last)}</td></tr>`).join("")}
      </tbody></table></div>
      <h2>Finala 1 na 1</h2>
      <p class="muted small">Red = pobednik, kolona = poraženi u finalu. ${filterLabel()}</p>
      <div class="tw"><table class="grid h2h"><thead><tr><th></th>${act.map((p) => `<th>${dot(p.id)}${esc(p.name)}</th>`).join("")}<th>Σ</th></tr></thead>
      <tbody>${act.map((a) => `<tr><th class="nm">${dot(a.id)}${esc(a.name)}</th>${act.map((b) => cell(a.id, b.id)).join("")}<td><b>${act.reduce((s, b) => s + m[a.id][b.id], 0)}</b></td></tr>`).join("")}</tbody></table></div>
      <h2>H2H po igraču</h2>
      <div class="chips">${act.map((p) => `<button class="pchip ${S.h2hP === p.id ? "on" : ""}" style="--c:${color(p.id)}" data-hp="${p.id}">${esc(p.name)}</button>`).join("")}</div>
      ${S.h2hP ? h2hTable(g, S.h2hP) : ""}
      <h2>Rang lista duela</h2>
      <details class="box"><summary>Svi parovi po % pobeda (${pl.length})</summary>
      <table class="grid"><thead><tr><th>H2H</th><th>Dobio</th><th>Izgubio</th><th>Ukupno</th><th>%</th></tr></thead><tbody>
      ${pl.map((r) => `<tr><td class="nm">${dot(r.a)}${esc(r.label)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.n}</td><td>${pct(r.pct, 1)}</td></tr>`).join("")}</tbody></table></details>
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
  bind.h2h = () => {
    $$("[data-hp]").forEach((b) => b.onclick = () => { S.h2hP = b.dataset.hp; render(); }); $("#pa").onchange = (e) => { S.pair.a = e.target.value; render(); }; $("#pb").onchange = (e) => { S.pair.b = e.target.value; render(); }; };

  // ---------- Pregledi (pivoti) ----------
  const PRESETS = [
    { l: "⚡ Highlight", dim: "hl", metric: "wins" }, { l: "Pobede po godinama", dim: "year", metric: "wins" }, { l: "Efikasnost po godinama", dim: "year", metric: "eff" },
    { l: "Pobede po sveskama", dim: "book", metric: "wins" }, { l: "Efikasnost po sveskama", dim: "book", metric: "eff" },
    { l: "Prva partija po sveskama", dim: "book", metric: "winsShare", pos: "first" }, { l: "Poslednja partija po sveskama", dim: "book", metric: "winsShare", pos: "last" },
    { l: "Bleje – kumulativno", dim: "night", metric: "cum" }, { l: "Bleje – efikasnost", dim: "night", metric: "eff" },
    { l: "Po mesecima", dim: "month", metric: "wins" }, { l: "Efikasnost po mesecima", dim: "month", metric: "eff" },
    { l: "Po danu u nedelji", dim: "wd", metric: "wins" }, { l: "Efikasnost po danu", dim: "wd", metric: "eff" },
    { l: "Sveska × broj igrača", dim: "book", dim2: "np", metric: "wins" }, { l: "Sveska × broj partija", dim: "book", dim2: "cnt", metric: "wins" },
    { l: "Redni broj partije", dim: "idx", metric: "eff" }, { l: "Način pobede", dim: "tip", metric: "wins" },
  ];
  const presetOn = (p) => ["dim", "metric", "dim2", "pos", "np"].every((k) => (p[k] || "") === (S.pivot[k] || ""));
  function vPivot() {
    const { dim, metric, dim2 = "", pos = "", np = "" } = S.pivot, M = Stats.METRICS[metric];
    const g = Stats.filter(G(), { pos, np });
    const pv = Stats.pivot(g, S.players, dim, metric, dim2);
    const nps = [...new Set(S.games.map((x) => x.np))].sort();
    const act = S.players.filter((p, i) => pv.total.vals[i] != null);
    const idx = act.map((p) => S.players.indexOf(p));
    const num = (v) => Array.isArray(v) ? v[0] : v;
    const fmt = (v) => v == null ? "<span class='muted'>–</span>" : Array.isArray(v) ? `${v[0]} <small class="muted">${pct(v[1])}</small>` : M.pct ? pct(v, 1) : v;
    const best = (r) => Math.max(...idx.map((i) => num(r.vals[i]) ?? -1));
    const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${l}</option>`).join("")}</select>`;
    const dims = Object.entries(Stats.DIMS).map(([k, v]) => [k, v.label]);
    return `<div class="chips scroll">${PRESETS.map((p, i) => `<button class="chip ${presetOn(p) ? "on" : ""}" data-pi="${i}">${p.l}</button>`).join("")}</div>
      <div class="row"><label>Redovi ${sel("pDim", dims, dim)}</label><label>Podgrupa ${sel("pDim2", [["", "—"], ...dims.filter(([k]) => k !== dim)], dim2)}</label>
      <label>Vrednost ${sel("pMet", Object.entries(Stats.METRICS).map(([k, v]) => [k, v.label]), metric)}</label></div>
      <div class="row"><label>Partije ${sel("pPos", [["", "Sve partije"], ["first", "Samo prva partija bleje"], ["last", "Samo poslednja partija bleje"]], pos)}</label>
      <label>Broj igrača ${sel("pNp", [["", "Svi"], ...nps.map((n) => [n, n + " igrača"])], np)}</label></div>
      <p class="muted small">${filterLabel()}${pos ? " · " + (pos === "first" ? "prve partije" : "poslednje partije") : ""}${np ? " · " + np + " igrača" : ""}. Zeleno = najbolji u redu.</p>
      ${g.length ? `<div class="tw"><table class="grid sticky pv"><thead><tr><th>${Stats.DIMS[dim].label}${dim2 ? " / " + Stats.DIMS[dim2].label : ""}</th>${act.map((p) => `<th>${dot(p.id)}${esc(p.name)}</th>`).join("")}<th>Partija</th></tr></thead>
      <tbody>${[...pv.rows, pv.total].map((r) => { const b = best(r); return `<tr class="${r.key === "Σ" ? "tot" : r.head ? "head" : r.sub ? "sub" : ""}"><th class="nm">${esc(r.label)}</th>${idx.map((i) => `<td class="${r.vals[i] != null && num(r.vals[i]) === b && b > 0 && !r.head ? "best" : ""}">${fmt(r.vals[i])}</td>`).join("")}<td class="muted">${r.total}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="empty">Nema partija za izabrani filter.</p>`}`;
  }
  bind.pivot = () => {
    const save = () => { store.set("mm_pivot", S.pivot); render(); };
    $$(".chip[data-pi]").forEach((b) => b.onclick = () => { const p = PRESETS[+b.dataset.pi]; S.pivot = { dim: p.dim, metric: p.metric, dim2: p.dim2 || "", pos: p.pos || "", np: p.np || "" }; save(); });
    $("#pDim").onchange = (e) => { S.pivot.dim = e.target.value; if (S.pivot.dim2 === S.pivot.dim) S.pivot.dim2 = ""; save(); };
    $("#pDim2").onchange = (e) => { S.pivot.dim2 = e.target.value; save(); };
    $("#pPos").onchange = (e) => { S.pivot.pos = e.target.value; save(); };
    $("#pNp").onchange = (e) => { S.pivot.np = e.target.value; save(); };
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
    const hl = Stats.highlights(g), t = Stats.table(g, S.players).sort((a, b) => b.clutch - a.clutch);
    return `<h2>⭐ Istaknute partije</h2>
      <p class="muted small">⚡ Clutch: pobeda posle 190–200 poena u toku partije (201 = ispadanje) · 💥 −101: partija prekinuta, pobednik · ⛳ Hole in one: pobedio jedno deljenje i to mu je donelo pobedu.</p>
      <div class="tw"><table class="grid"><thead><tr><th>Igrač</th><th>⚡ Clutch</th><th>💥 −101</th><th>⛳ HIO</th><th>% clutch u pobedama</th></tr></thead><tbody>
      ${t.map((s) => `<tr><td class="nm">${dot(s.id)}${esc(s.name)}</td><td><b>${s.clutch}</b></td><td>${s.m101}</td><td>${s.hio}</td><td>${pct(s.wins ? s.clutch / s.wins : 0)}</td></tr>`).join("")}
      </tbody></table></div>
      <details class="box"><summary>Sve istaknute partije (${hl.length})</summary><ol class="list">${hl.map((x) => `<li>${fmtDate(x.date)} — ${dot(x.w)}<b>${esc(pname(x.w))}</b> <span class="hl">${Stats.hlText(x.h)}</span></li>`).join("")}</ol></details>
      <h2>Trenutno</h2>
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
      <p class="muted small">${days.length} bleja${days.length > 60 ? " (prikazano 60)" : ""}</p>
      ${shown.map(([n, gs]) => {
        const cnt = {}; gs.forEach((x) => cnt[x.w] = (cnt[x.w] || 0) + 1);
        const nh = gs.filter((x) => Stats.hlKind(x.h)).length;
        return `<details class="night"><summary><span><b>${fmtDate(gs[0].date)}</b>${nh ? ` <span class="hl">${gs.filter((x) => Stats.hlKind(x.h)).map((x) => Stats.HL[Stats.hlKind(x.h)].icon).join("")}</span>` : ""} <span class="muted small">${Stats.DANI[gs[0].wd]} · ${esc(gs[0].book)} · bleja ${n}</span></span>
        <span class="score">${gs[0].p.map((id) => `<span class="pill" style="--c:${color(id)}">${esc(pname(id))} ${cnt[id] || 0}</span>`).join("")}</span></summary>
        <ol class="list">${gs.map((x) => `<li>${dot(x.w)}<b>${esc(pname(x.w))}</b> ${desc(x)}${x.h != null && Stats.hlKind(x.h) ? ` <span class="hl">${Stats.hlText(x.h)}</span>` : ""}</li>`).join("")}</ol></details>`;
      }).join("")}`;
  }
  bind.istorija = () => {
    $("#hq").oninput = (e) => { S.histQ = e.target.value; clearTimeout(S._hq); S._hq = setTimeout(() => { render(); const i = $("#hq"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); };
    $("#hp").onchange = (e) => { S.histPlayer = e.target.value; render(); };
  };

  // ---------- Unos (admin) ----------
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
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
    const curBook = day?.book || E.book;
    const blejaNo = day ? day.n : Math.max(0, ...D.days.map((d) => d.n)) + 1;
    const bookNo = day ? day.bookDay : D.days.filter((d) => d.book === curBook).length + 1;
    const partNo = dayGames.length + 1, totalNo = D.games.length + 1;
    const adm = cfg.token ? `<p class="small ok">✅ Prijavljen kao admin (${esc(cfg.owner)}/${esc(cfg.repo)})</p>` : `<p class="small warn">⚠️ Nisi prijavljen kao admin: unos možeš da pripremiš, ali za objavu upiši GitHub token u ⚙️ Podešavanja dole.</p>`;
    return `<h2>Unos partija</h2>${adm}
    <div class="cards">
      <div class="card"><b>Bleja ${blejaNo}</b><span>${day ? "u toku" : "nova"} · ${esc(curBook)} #${bookNo}</span></div>
      <div class="card"><b>Partija ${partNo}.</b><span>na ovoj bleji · ukupno #${totalNo}</span></div>
    </div>
    <div class="box">
      <div class="row"><label>Datum <input type="date" id="eDate" value="${E.date}"></label>
      <label>Sveska <select id="eBook">${[...new Set([...books, E.book].filter(Boolean))].map((b) => `<option ${b === (day?.book || E.book) ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></label></div>
      ${E.newBook ? `<div class="row"><label>Naziv nove sveske <input id="nbName" value="${esc(E.newBook)}"></label><button id="nbOk">Otvori svesku</button><button id="nbX" class="ghost">Otkaži</button></div>
        <p class="small muted">Nova sveska počinje od ove bleje (bleja #1 u svesci). Sve statistike se mogu filtrirati po svesci.</p>`
        : `<button id="nbBtn" class="ghost small">📓 Nova sveska</button>`}
      <p class="small muted">Ko je na bleji:</p>
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
      ${E.w ? `<p class="small muted">Istaknuta partija?</p><div class="chips">
        <button class="chip ${E.h == null ? "on" : ""}" data-h="">Ne</button>
        <button class="chip ${typeof E.h === "number" && E.h >= 190 ? "on" : ""}" data-h="clutch">⚡ Clutch</button>
        <button class="chip ${E.h === -101 ? "on" : ""}" data-h="-101">💥 −101</button>
        <button class="chip ${E.h === "HIO" ? "on" : ""}" data-h="HIO">⛳ Hole in one</button></div>
        ${typeof E.h === "number" && E.h >= 190 ? `<label class="small muted">Najviše poena u toku partije (190–200) <input id="eClutch" type="number" min="190" max="200" value="${E.h}" inputmode="numeric"></label>` : ""}` : ""}
      <button id="addGame" class="primary" ${canAdd() ? "" : "disabled"}>+ Dodaj ${partNo}. partiju</button>
    </div>
    ${dayGames.length ? `<h3>Bleja ${blejaNo} · ${fmtDate(E.date)} · ${dayGames.length} ${dayGames.length === 1 ? "partija" : dayGames.length < 5 ? "partije" : "partija"}</h3><ol class="list">${dayGames.map((x) => `<li>${dot(x.w)}<b>${esc(pname(x.w))}</b> ${desc(x)} ${x.h != null ? Stats.hlText(x.h) : ""} <button class="ghost small" data-del="${x.id}">✕</button></li>`).join("")}</ol>` : ""}
    <div class="row sticky-save"><button id="saveGh" class="primary" ${S.dirty || store.get("mm_draft") ? "" : "disabled"}>☁️ Sačuvaj i objavi</button><button id="discard" class="ghost">Odbaci izmene</button></div>
    <details class="box"><summary>⚙️ Podešavanja (GitHub, lozinka, izvoz)</summary>
      <div class="form">
        <label>GitHub vlasnik <input id="cOwner" value="${esc(cfg.owner || "misacrni")}" placeholder="misacrni"></label>
        <label>Repozitorijum <input id="cRepo" value="${esc(cfg.repo || "maumau")}" placeholder="maumau"></label>
        <label>Grana <input id="cBranch" value="${esc(cfg.branch || "main")}"></label>
        <label>Token (fine-grained, samo Contents: write za ovaj repo) <input id="cToken" type="password" value="${esc(cfg.token)}"></label>
        <button id="saveCfg">Sačuvaj podešavanja (prijava kao admin)</button>
        <button id="adminOut" class="ghost">Odjavi admina (obriši token sa ovog uređaja)</button>
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
    const books = [...new Set(D.days.map((d) => d.book))];
    $("#eDate").onchange = (e) => { E.date = e.target.value; E.w = null; E.l = []; render(); };
    const nb = $("#nbBtn"); if (nb) nb.onclick = () => { E.newBook = (books.length + 1) + " "; render(); const i = $("#nbName"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    const nx = $("#nbX"); if (nx) nx.onclick = () => { E.newBook = null; render(); };
    const nok = $("#nbOk"); if (nok) nok.onclick = () => {
      const name = $("#nbName").value.trim();
      if (!name || /^\d+$/.test(name)) return toast("Upiši naziv, npr. „7 Black“.");
      if (books.includes(name)) return toast("Ta sveska već postoji.");
      E.newBook = null; E.book = name; const day = D.days.find((d) => d.date === E.date); if (day) { day.book = name; day.bookDay = 1; saveDraft(); }
      toast("Nova sveska: " + name); render();
    };
    $("#eBook").onchange = (e) => {
      let b = e.target.value;
      E.book = b; const day = D.days.find((d) => d.date === E.date); if (day) { day.book = b; saveDraft(); } render();
    };
    $$("[data-pp]").forEach((b) => b.onclick = () => {
      const id = b.dataset.pp, day = D.days.find((d) => d.date === E.date), arr = day ? day.p : E.p;
      const i = arr.indexOf(id); i >= 0 ? arr.splice(i, 1) : arr.push(id);
      arr.sort((a, c) => S.players.findIndex((p) => p.id === a) - S.players.findIndex((p) => p.id === c));
      if (day) saveDraft(); E.w = null; E.l = []; render();
    });
    $$("[data-gp]").forEach((b) => b.onclick = () => { const i = E.gp.indexOf(b.dataset.gp); i >= 0 ? E.gp.splice(i, 1) : E.gp.push(b.dataset.gp); E.w = null; E.l = []; render(); });
    $$("[data-w]").forEach((b) => b.onclick = () => { E.w = b.dataset.w; E.l = []; E.h = null; render(); });
    $$("[data-h]").forEach((b) => b.onclick = () => { const v = b.dataset.h; E.h = v === "" ? null : v === "clutch" ? 195 : v === "-101" ? -101 : "HIO"; render(); });
    const ec = $("#eClutch"); if (ec) ec.onchange = () => { const v = Math.round(+ec.value); E.h = v >= 190 && v <= 200 ? v : 195; render(); };
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
      if (E.h != null) g.h = E.h;
      D.games.push(g);
      E.w = null; E.l = []; E.t = "F"; E.gp = null; E.h = null; saveDraft(); toast("Partija dodata"); render();
    };
    $$("[data-del]").forEach((b) => b.onclick = () => { if (!confirm("Obriši ovu partiju?")) return; D.games = D.games.filter((g) => g.id !== +b.dataset.del); saveDraft(); render(); });
    $("#discard").onclick = () => { if (!confirm("Odbaciti sve nesačuvane izmene?")) return; store.del("mm_draft"); S.draft = null; S.dirty = false; S.edit = null; S.players = S.data.players; render(); };
    $("#saveCfg").onclick = async () => {
      const c = { owner: $("#cOwner").value.trim() || "misacrni", repo: $("#cRepo").value.trim() || "maumau", branch: $("#cBranch").value.trim() || "main", token: $("#cToken").value.trim() };
      if (!c.token) return toast("Upiši token.");
      try {
        const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, { headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json" } });
        const j = await r.json();
        if (!r.ok) throw new Error(j.message || r.status);
        if (!j.permissions?.push) throw new Error("token nema pravo upisa u repo");
        store.set("mm_admin", c); toast("✅ Prijavljen kao admin"); render();
      } catch (e) { toast("Token ne radi: " + e.message, 5000); }
    };
    $("#saveGh").onclick = publish;
    $("#adminOut").onclick = () => { if (!confirm("Obrisati GitHub token sa ovog uređaja?")) return; store.del("mm_admin"); store.del("mm_admin_on"); $("#navAdmin").classList.add("hidden"); S.view = "tabela"; $$("#nav button").forEach((x) => x.classList.toggle("on", x.dataset.v === "tabela")); toast("Admin odjavljen"); render(); };
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
      const rows = [["id", "bleja", "datum", "sveska", "igraci", "pobednik", "tip", "porazeni", "istaknuto"]].concat(D.games.map((g) => { const d = dm.get(g.day); return [g.id, g.day, d.date, d.book, d.p.map(pname).join("|"), pname(g.w), Stats.TIP[g.t], g.l.map(pname).join("|"), g.h ?? ""]; }));
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
