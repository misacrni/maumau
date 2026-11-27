/* Mau Mau — statistika ekipe. Statički sajt (GitHub Pages); podaci su šifrovani lozinkom ekipe,
   a unos ide preko GitHub API-ja sa tokenom koji ima samo admin. */
(() => {
  const DATA_ENC = "data/data.enc.json", DATA_PLAIN = "data/data.json";
  // Paleta boja igrača; postojeći igrači imaju svoje boje kao do sada
  const PALETTE = [["#2563eb", "plava"], ["#ca8a04", "oker"], ["#ea580c", "narandžasta"], ["#16a34a", "zelena"], ["#7c3aed", "ljubičasta"],
    ["#dc2626", "crvena"], ["#0891b2", "tirkizna"], ["#db2777", "roze"], ["#92400e", "braon"], ["#475569", "siva"], ["#65a30d", "maslinasta"], ["#0f172a", "crna"]];
  const DEFAULT_COLOR = { S: "#2563eb", N: "#ca8a04", M: "#ea580c", L: "#16a34a", U: "#7c3aed" };
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
  const color = (id) => {
    const p = S.players.find((x) => x.id === id);
    if (p?.color) return p.color;
    if (DEFAULT_COLOR[id]) return DEFAULT_COLOR[id];
    const used = new Set(S.players.map((x) => x.color || DEFAULT_COLOR[x.id]).filter(Boolean));
    const free = PALETTE.map((c) => c[0]).filter((c) => !used.has(c));
    return free[S.players.findIndex((x) => x.id === id) % Math.max(1, free.length)] || "#64748b";
  };
  const pname = (id) => (S.players.find((p) => p.id === id) || { name: id }).name;
  const dot = (id) => { const p = S.players.find((x) => x.id === id); return p?.photo ? `<img class="mini" src="${p.photo}" alt="" style="--c:${color(id)}">` : `<i class="dot" style="background:${color(id)}"></i>`; };

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
    setTimeout(() => { const lo = $("#logoutBtn"); if (lo) lo.onclick = logout; const is = $("#infoShare"); if (is) is.onclick = shareApp; }, 0);
    setTimeout(() => { const b = $("#enableAdmin"); if (b) b.onclick = () => { showAdmin(); $("#modal").classList.add("hidden"); S.view = "admin"; $$("#nav button").forEach((x) => x.classList.toggle("on", x.dataset.v === "admin")); render(); }; }, 0);
    modal(`<h2>ℹ️ O aplikaciji</h2>
      <div class="box"><b>✏️ Unos rezultata (admin)</b><p class="small muted">${store.get("mm_admin")?.token ? "✅ Ovaj uređaj je prijavljen kao admin (GitHub token je sačuvan)." : "Uključuje tab Unos na ovom uređaju. Za objavu je potreban GitHub token koji ima samo admin, pa igrači ne mogu ništa da promene."}</p><button id="enableAdmin">${store.get("mm_admin_on") ? "Otvori Unos" : "Uključi tab Unos"}</button></div>
      ${S.data.settings?.ntfy ? `<div class="box"><b>🔔 Obaveštenja o novim rezultatima</b><p class="small">1. Instaliraj besplatnu aplikaciju <b>ntfy</b> (App Store / Google Play).<br>2. U njoj tapni <b>+</b> i upiši temu: <code>${esc(S.data.settings.ntfy)}</code><br>3. Tapni <b>Subscribe</b> i dozvoli notifikacije kad telefon pita.<br>4. Gotovo — posle svake bleje stiže notifikacija sa rezultatima.</p></div>` : ""}
      <div class="box"><b>📤 Pozovi nekog u aplikaciju</b><p class="small muted">Pošalji pozdravnu poruku sa linkom, uputstvom i (po želji) lozinkom.</p><button id="infoShare">📤 Pošalji poziv</button></div>
      <div class="box"><b>🚪 Odjava</b><p class="small muted">Briše sa ovog uređaja zapamćenu lozinku ekipe i, ako postoji, admin token i nesačuvan unos.</p><button id="logoutBtn" class="ghost">Odjavi se</button></div>
      <p>Statistika naše Mau Mau bleje od 2017. Svi podaci su iz sveski i Excela, a od sada se unose ovde. Gore biraš godinu ili svesku, i svi prikazi se računaju samo za to.</p>
      <ul class="list">
        <li><b>🏆 Tabela</b> – efikasnost (pobede / odigrane partije), finala, pobede u prvoj i poslednjoj partiji, ⚡ clutch, 👑 bleje, završnica (W/L ukupno) i grafikon pobeda kroz vreme. Dodirni igrača za profil.</li>
        <li><b>⚔️ H2H</b> – 🔥 nizovi u finalima (ko kome vezuje i koliko), matrica finala 1 na 1, H2H po igraču sa VS 2, VS 3 i VS svi, rang lista duela i poređenje dva igrača.</li>
        <li><b>📊 Pregledi</b> – svi pivoti iz Excela: po godinama, sveskama, mesecima, danima, blejama (i kumulativno), prva/poslednja partija bleje, broj igrača i partija, highlight.</li>
        <li><b>⭐ Rekordi</b> – istaknute partije (⚡ clutch 190–200, 💥 −101, ⛳ Hole in one), trenutni nizovi i najduži nizovi pobeda i bez pobede.</li>
        <li><b>📖 Istorija</b> – Sveske › bleje › partije. Partija vođena u zapisniku otvara se kao stranica sveske, sa svim deljenjima. Pretraga po broju partije (#90) ili datumu.</li>
        <li><b>🔴 Uživo</b> – kad admin vodi zapisnik, gore se pojavi crvena traka „Uživo“: tapni i prati partiju posle svake ruke.</li>
      </ul>
      <p class="muted small">Pojmovi: <b>finale</b> = poslednja dva igrača u partiji; <b>⚡ clutch</b> = pobednik je u toku partije imao 190–200 poena; <b>⛳ Hole in one</b> = pobednik je dobio samo jedno deljenje — poslednje, kojim je izbacio sve preostale; <b>💥 −101</b> = prekid i pobeda na −101; <b>vs 2 / vs 3</b> = pobeda kad su na kraju ostala još dvojica / trojica; <b>vs svi</b> = pobeda pre nego što je iko ispao; <b>niz</b> se računa samo kroz partije u kojima je igrač igrao.</p>
      ${r ? `<h2>${esc(r.title)}</h2><p class="muted">${esc(r.sub)}</p>${r.sections.map((sc) => `<details class="box"><summary>${esc(sc.h)}</summary><table class="grid rules"><tbody>${sc.items.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table></details>`).join("")}` : ""}`);
  }
  $("#infoBtn").onclick = info;
  // Deljenje aplikacije (link, po želji i lozinka)
  function shareApp() {
    const url = location.origin + location.pathname, topic = S.data.settings?.ntfy;
    const welcome = (pw) => `🂡 *Dobrodošao u Mau Mau aplikaciju!* 🂡

Ovde je sva statistika naše bleje od 2017. — pobede, efikasnost, finala, H2H, nizovi, rekordi i svaka partija.

👉 ${url}${pw && S.password ? `\n🔑 Lozinka: ${S.password}` : ""}

*Šta ima unutra:*
🏆 *Tabela* – pobede, efikasnost, finala, clutch, kralj bleje, grafikon pobeda
⚔️ *H2H* – ko kome „vezuje“ u finalima, nizovi u duelima
📊 *Pregledi* – po godinama, sveskama, mesecima, danima, prva/poslednja partija
⭐ *Rekordi* – clutch, Hole in one, −101, najduži nizovi i postovi
📖 *Istorija* – svaka bleja i svaka partija
ℹ️ *Info* – pravila igre i pojmovi

Savet: otvori link u Safariju/Chrome-u i izaberi „Dodaj na početni ekran“ — radi kao prava aplikacija.${topic ? `

🔔 *Obaveštenja posle bleje:* instaliraj besplatnu aplikaciju *ntfy*, tapni *+*, upiši temu *${topic}*, tapni *Subscribe* i dozvoli notifikacije.` : ""}

Vidimo se na bleji! 🃏`;
    modal(`<h2>📤 Pozovi nekog u aplikaciju</h2><p class="small muted">Pregledaj i po želji izmeni poruku, pa je pošalji (WhatsApp, Viber, SMS…). Lozinku dodaj samo ako šalješ nekom iz ekipe.</p>
      <label class="chk"><input type="checkbox" id="shPw" checked> Dodaj i lozinku ekipe</label>
      <textarea id="shText" rows="16">${esc(welcome(true))}</textarea>
      <button id="shGo" class="primary">📤 Pošalji</button><button id="shCopy" class="primary ghost">📋 Kopiraj tekst</button>`);
    $("#shPw").onchange = (e) => { $("#shText").value = welcome(e.target.checked); };
    const text = () => $("#shText").value;
    $("#shGo").onclick = () => navigator.share ? navigator.share({ title: "Mau Mau", text: text() }).catch(() => {}) : window.open("https://wa.me/?text=" + encodeURIComponent(text()), "_blank");
    $("#shCopy").onclick = async () => { try { await navigator.clipboard.writeText(text()); toast("Kopirano"); } catch { toast("Kopiranje nije uspelo"); } };
  }
  $("#shareBtn").onclick = shareApp;
  async function logout() {
    if (store.get("mm_draft") && !(await ask("Imaš nesačuvan unos. Odjavom se briše. Nastavi?", "Odjavi se"))) return;
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
    $("#liveBar").onclick = () => { if (S.view !== "live") S.prevView = S.view; S.view = "live"; $$("#nav button").forEach((x) => x.classList.remove("on")); render(); window.scrollTo(0, 0); };
    render();
    startLive();
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
  $$("#nav button").forEach((b) => b.onclick = () => { if (b.dataset.v === "istorija" && S.view === "istorija") S.nav = {}; S.view = b.dataset.v; if (S.view !== "admin") S.players = S.data.players; $$("#nav button").forEach((x) => x.classList.toggle("on", x === b)); render(); window.scrollTo(0, 0); });
  $("#modalClose").onclick = () => closeModal();
  $("#modal").onclick = (e) => { if (e.target.id === "modal") $("#modal").classList.add("hidden"); };
  // Potvrda u samoj aplikaciji (sistemski confirm() pregledač ume da blokira)
  function ask(msg, okLabel = "Da", input = null) {
    return new Promise((res) => {
      $("#modalBody").innerHTML = `<h2>❓ Potvrda</h2><p style="white-space:pre-line">${esc(msg)}</p>${input != null ? `<input id="askIn" value="${esc(input)}" style="width:100%">` : ""}
        <div class="row"><button id="askOk" class="primary">${esc(okLabel)}</button><button id="askNo" class="primary ghost">Otkaži</button></div>`;
      $("#modal").classList.remove("hidden");
      const done = (v) => { $("#modal").classList.add("hidden"); $("#modalClose").onclick = closeModal; res(v); };
      $("#askOk").onclick = () => done(input != null ? $("#askIn").value : true);
      $("#askNo").onclick = () => done(input != null ? null : false);
      $("#modalClose").onclick = () => done(input != null ? null : false);
      const i = $("#askIn"); if (i) { i.focus(); i.select(); }
    });
  }
  function closeModal() { $("#modal").classList.add("hidden"); }
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
    $("#top .filters").style.display = ["admin", "istorija", "live"].includes(S.view) ? "none" : "";
    const v = { tabela: vTabela, h2h: vH2H, pivot: vPivot, nizovi: vNizovi, istorija: vIstorija, admin: vAdmin, live: vLive }[S.view] || vTabela;
    $("#view").innerHTML = (document.body.classList.contains("tablemode") ? `<button class="ghost small tmx" id="tmExit">✕ Izađi iz celog ekrana</button>` : "") + v();
    bind[S.view] && bind[S.view]();
    const tx = $("#tmExit"); if (tx) tx.onclick = tableMode;
    makeSortable($("#view"));
    liveBar();
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
      <thead><tr><th>#</th><th>Igrač</th><th title="Odigrane partije">Odigr.</th><th>Pob.</th><th>Efik.</th><th title="Učešće u finalu 1 na 1">Finala</th><th title="% partija u kojima je bio u finalu">U fin.%</th><th title="Dobijena – izgubljena finala">F W-L</th><th title="% dobijenih finala 1 na 1">% 1:1</th><th title="Pobeda protiv 2 igrača">vs 2</th><th title="Pobeda protiv 3 igrača">vs 3</th><th title="Pobeda protiv svih">vs svi</th><th title="Pobede u prvoj partiji bleje">Prva</th><th title="Pobede u poslednjoj partiji bleje">Posl.</th><th title="Pobede posle 190–200 poena u toku partije">⚡ Clutch</th><th title="Pobeda prekidom na −101 / Hole in one">💥/⛳</th><th title="Bleje na kojima je imao najviše pobeda (ili delio prvo mesto)">👑 Bleje</th><th title="Na koliko bleja je bio">Bio na bleji</th></tr></thead>
      <tbody>${t.map((s, i) => `<tr data-p="${s.id}" class="click">
        <td>${i + 1}</td><td class="nm">${dot(s.id)}${esc(s.name)}</td><td>${s.played}</td><td><b>${s.wins}</b></td>
        <td><span class="bar" style="--w:${s.eff * 100 / Math.max(...t.map((x) => x.eff))}%;--c:${color(s.id)}">${pct(s.eff, 1)}</span></td>
        <td>${s.finals}</td><td>${pct(s.finRate)}</td><td>${s.finW}-${s.finL}</td><td>${pct(s.fin1v1)}</td><td>${s.w2}</td><td>${s.w3}</td><td>${s.wA}</td><td>${s.firstW}</td><td>${s.lastW}</td><td><b>${s.clutch}</b></td><td>${s.m101}/${s.hio}</td><td>${s.nightBest}</td><td>${s.days}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="muted small">Efikasnost = pobede / odigrane partije. Dodirni igrača za profil.</p>
    <h2>Završnica (finala, vs 2, vs 3, vs svi)</h2>
    <div class="tw"><table class="grid sticky"><thead><tr><th>#</th><th>Igrač</th><th>Dobio fin.</th><th>Izgubio fin.</th><th>Finala</th><th>% 1:1</th><th>Win vs 2</th><th>Win vs 3</th><th>Win vs svi</th><th>Σ W vs 2/3/svi</th><th>W ukupno</th><th>L ukupno</th><th>W+L</th><th>% W ukupno</th></tr></thead><tbody>
    ${tEnd.map((s, i) => `<tr data-p="${s.id}" class="click"><td>${i + 1}</td><td class="nm">${dot(s.id)}${esc(s.name)}</td><td>${s.finW}</td><td>${s.finL}</td><td>${s.finals}</td><td>${pct(s.fin1v1, 1)}</td><td>${s.w2}</td><td>${s.w3}</td><td>${s.wA}</td><td>${s.wEnd}</td><td><b>${s.WT}</b></td><td>${s.LT}</td><td>${s.WT + s.LT}</td><td><b>${pct(s.pctWT, 1)}</b></td></tr>`).join("")}
    <tr class="tot"><td></td><td class="nm">Ukupno</td>${["finW", "finL", "finals"].map((k) => `<td>${t.reduce((a, s) => a + s[k], 0)}</td>`).join("")}<td></td>${["w2", "w3", "wA", "wEnd", "WT", "LT"].map((k) => `<td>${t.reduce((a, s) => a + s[k], 0)}</td>`).join("")}<td>${t.reduce((a, s) => a + s.WT + s.LT, 0)}</td><td></td></tr>
    </tbody></table></div>
    <p class="muted small">L ukupno = izgubljena finala + porazi kad je neko pobedio protiv 2, protiv 3 ili protiv svih. Kao tabela „Finala“ na listu Pregledi.</p>
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
    const P = S.players.find((p) => p.id === id) || {};
    const tel = (P.phone || "").replace(/[^+\d]/g, "");
    modal(`<div class="phead">${P.photo ? `<img class="avatar big" src="${P.photo}" alt="">` : `<div class="avatar big ph" style="--c:${color(id)}">${esc((me.name || "?")[0])}</div>`}
        <div><h2>${esc(me.name)}</h2>${P.desc ? `<p class="small">${esc(P.desc)}</p>` : ""}
        <p class="small">${tel ? `<a href="tel:${tel}">📞 ${esc(P.phone)}</a> · <a href="https://wa.me/${tel.replace("+", "")}">WhatsApp</a>` : ""}${tel && P.email ? " · " : ""}${P.email ? `<a href="mailto:${esc(P.email)}">✉️ ${esc(P.email)}</a>` : ""}</p></div></div>
      <p class="muted small">${filterLabel()}</p>
      <div class="cards">
        <div class="card"><b>${me.wins}</b><span>pobeda od ${me.played}</span></div>
        <div class="card"><b>${pct(me.eff, 1)}</b><span>efikasnost</span></div>
        <div class="card"><b>${me.finW}-${me.finL}</b><span>finala (${pct(me.fin1v1)})</span></div>
      </div>
      <p>Trenutno: ${st.current ? (st.current.kind === "W" ? `🔥 niz od <b>${st.current.len}</b> pobeda` : `${st.current.len} partija bez pobede`) : "–"}</p>
      <h3>H2H (finala, vs 2, vs 3, vs svi)</h3>
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
      ${h.rows.map((r) => row(r)).join("")}${row(h.v2)}${h.v3.w + h.v3.l ? row(h.v3) : ""}${row(h.vA)}${row(h.tot, "tot")}</tbody></table>`;
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
        <tr><td>Pobedio drugog na kraju (finale, vs 2, vs 3, vs svi)</td><td>${dot(S.pair.a)}${P.beatA}</td><td>${dot(S.pair.b)}${P.beatB}</td></tr>
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

  // ---------- Istorija: Sveske › Bleja › Partija › Deljenja ----------
  const MESECI = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
  const DANI_K = ["pon", "uto", "sre", "čet", "pet", "sub", "ned"];
  const pl = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;
  const BOOK_COLORS = { yellow: "#ca8a04", yelow: "#ca8a04", purple: "#9333ea", blue: "#2563eb", green: "#16a34a", red: "#dc2626", brown: "#92400e", black: "#0f172a", orange: "#ea580c", pink: "#db2777", white: "#94a3b8", gray: "#64748b", grey: "#64748b", siva: "#64748b" };
  const bookColor = (b) => { const w = String(b).toLowerCase().split(/\s+/).find((x) => BOOK_COLORS[x]); return w ? BOOK_COLORS[w] : "#475569"; };
  const bookParts = (b) => { const m = String(b).match(/^(\d+)\s*(.*)$/); return m ? [m[1], m[2] || b] : ["", String(b)]; };
  const monYr = (iso) => { const [y, m] = iso.split("-"); return `${MESECI[+m - 1]} ${y}`; };
  const dm = (iso) => { const [, m, d] = iso.split("-"); return `${+d}.${+m}.`; };
  const tipText = (g) => g.t === "F" ? "Finale 1 na 1" : g.t === "A" ? "Protiv svih" : `Protiv ${g.t}`;
  const names = (ids) => ids.map((i) => esc(pname(i))).join(", ").replace(/, ([^,]*)$/, " i $1");
  const goAttr = (nav) => `data-go="${esc(JSON.stringify(nav))}"`;
  const unpackHand = (r) => Array.isArray(r) ? { w: r[0], j: !!r[1], d: r[2], s: r[3] || {}, n: !!r[4] } : r;
  const packHand = (h) => h.n ? [h.w, h.j ? 1 : 0, h.d, h.s, 1] : [h.w, h.j ? 1 : 0, h.d, h.s];
  const winCount = (gs) => { const c = {}; gs.forEach((g) => c[g.w] = (c[g.w] || 0) + 1); return c; };

  function go(nav, replace) {
    S.nav = nav || {};
    try { (replace ? history.replaceState : history.pushState).call(history, { mmNav: S.nav }, ""); } catch { }
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", (e) => {
    if (!S.data) return;
    const nav = e.state?.mmNav;
    if (S.view !== "istorija" && !nav) return;
    S.nav = nav || {};
    if (S.view !== "istorija") { S.view = "istorija"; S.players = S.data.players; $$("#nav button").forEach((x) => x.classList.toggle("on", x.dataset.v === "istorija")); }
    render();
  });
  const crumbs = (items) => `<nav class="crumbs" aria-label="Putanja">${items.map(([label, nav], i) => i < items.length - 1 ? `<button class="lnk" ${goAttr(nav)}>${esc(label)}</button><span>›</span>` : `<b>${esc(label)}</b>`).join("")}</nav>`;
  const ptitle = (t, sub, back) => `<div class="ptitle">${back ? `<button class="back" ${goAttr(back)} aria-label="Nazad">‹</button>` : ""}<div><h2>${t}</h2>${sub ? `<p class="muted small">${sub}</p>` : ""}</div></div>`;

  function vIstorija() {
    const N = S.nav || {};
    if (N.g != null) { const g = S.games.find((x) => x.id === N.g); if (g) return vPartija(g); }
    if (N.day != null) { const gs = S.games.filter((x) => x.day === N.day); if (gs.length) return vBleja(gs); }
    if (N.book && S.games.some((g) => g.book === N.book)) return vSveska(N.book);
    return vSveske();
  }

  function vSveske() {
    const books = [...new Set(S.games.map((g) => g.book))];
    const lastG = S.games[S.games.length - 1], lastDayGs = S.games.filter((g) => g.day === lastG.day);
    const q = (S.histQ || "").trim();
    let res = "";
    if (q) {
      const num = q.match(/^#?\s*(\d{1,4})$/), qd = q.replace(/\s/g, "");
      if (num) {
        const hits = S.games.filter((g) => g.bookIdx === +num[1]).reverse();
        res = `<p class="muted small">Partija #${+num[1]} u svakoj svesci:</p>${hits.map((g) => partItem(g, `${esc(g.book)} #${g.bookIdx} · ${fmtDate(g.date)}`)).join("") || `<p class="empty">Nema takve partije.</p>`}`;
      } else {
        const days = [...new Map(S.games.filter((g) => fmtDate(g.date).includes(qd) || g.book.toLowerCase().includes(q.toLowerCase())).map((g) => [g.day, g])).values()].reverse();
        res = `<p class="muted small">${days.length} ${pl(days.length, "bleja", "bleje", "bleja")}${days.length > 80 ? " (prikazano 80)" : ""}</p>${days.slice(0, 80).map((g) => dayItem(S.games.filter((x) => x.day === g.day), true)).join("") || `<p class="empty">Ništa nije pronađeno.</p>`}`;
      }
    }
    return `${ptitle("Sveske", `${books.length} ${pl(books.length, "sveska", "sveske", "svezaka")} · ${new Set(S.games.map((g) => g.day)).size} bleja · ${S.games.length} partija`)}
      <input id="hq" type="search" class="full" placeholder="Nađi partiju (#90) ili bleju (12.11.2026)" value="${esc(S.histQ || "")}" aria-label="Pretraga">
      ${q ? res : `
      <button class="item hot" ${goAttr({ day: lastG.day })}><span class="dotlast"></span><span class="grow"><span class="small strong">Poslednja bleja</span><span>Bleja ${lastG.day} · ${fmtDate(lastG.date)} · ${lastDayGs.length} ${pl(lastDayGs.length, "partija", "partije", "partija")}</span></span><span class="chev">›</span></button>
      <h3 class="cap">Sveske</h3>
      ${books.slice().reverse().map((b, i) => {
        const gs = S.games.filter((g) => g.book === b), wc = winCount(gs), top = Math.max(...Object.values(wc)), lead = Object.keys(wc).filter((id) => wc[id] === top);
        const [no, nm] = bookParts(b), c = bookColor(b);
        return `<button class="item" ${goAttr({ book: b })}><span class="spine" style="--c:${c}">${esc(no)}</span>
          <span class="grow"><span class="spread"><b>${esc(nm)}</b><span class="muted small">${monYr(gs[0].date)} – ${i === 0 ? "danas" : monYr(gs[gs.length - 1].date)}</span></span>
          <span class="muted small">${new Set(gs.map((g) => g.day)).size} bleja · ${gs.length} partija</span>
          <span class="small">Najviše pobeda: ${lead.map((id) => `<b style="color:${color(id)}">${esc(pname(id))}</b>`).join(" / ")} ${top}</span></span><span class="chev">›</span></button>`;
      }).join("")}`}`;
  }

  function vSveska(book) {
    const gs = S.games.filter((g) => g.book === book), days = [...new Set(gs.map((g) => g.day))];
    const isLast = S.games[S.games.length - 1].book === book;
    const wc = winCount(gs), ids = [...new Set(gs.flatMap((g) => g.p))].sort((a, b) => (wc[b] || 0) - (wc[a] || 0)), mx = Math.max(1, ...Object.values(wc));
    let lastYear = null;
    return `${ptitle(`Sveska ${esc(book)}`, `${fmtDate(gs[0].date)} – ${isLast ? "danas" : fmtDate(gs[gs.length - 1].date)} · ${days.length} ${pl(days.length, "bleja", "bleje", "bleja")} · ${gs.length} partija`, {})}
      ${crumbs([["Sveske", {}], [book]])}
      <div class="box"><h3 class="cap">Pobede u svesci</h3>
        ${ids.map((id) => `<div class="wbar"><span>${dot(id)}${esc(pname(id))}</span><span class="track"><i style="width:${(wc[id] || 0) / mx * 100}%;background:${color(id)}"></i></span><b>${wc[id] || 0}</b></div>`).join("")}</div>
      <h3 class="cap">Bleje</h3>
      ${days.slice().reverse().map((n) => {
        const dg = gs.filter((g) => g.day === n), y = dg[0].year;
        const sep = y !== lastYear ? `<p class="yr">${y}</p>` : ""; lastYear = y;
        return sep + dayItem(dg);
      }).join("")}`;
  }
  // Jedna bleja u listi
  function dayItem(dg, withBook) {
    const g0 = dg[0], wc = winCount(dg), hl = dg.filter((g) => Stats.hlKind(g.h)), dig = dg.some((g) => g.r);
    return `<button class="item" ${goAttr({ day: g0.day })}><span class="dbox"><b>${dm(g0.date)}</b><span class="muted small">${withBook ? g0.year : DANI_K[g0.wd]}</span></span>
      <span class="grow"><span class="muted small">Bleja ${g0.day}${withBook ? " · " + esc(g0.book) : ""} · #${dg[0].bookIdx}${dg.length > 1 ? "–" + dg[dg.length - 1].bookIdx : ""}${dig ? " · 📝" : ""}</span>
      <span class="tags">${Object.entries(wc).sort((a, b) => b[1] - a[1]).map(([id, k]) => `<span class="wtag" style="--c:${color(id)}">${esc(pname(id))} ${k}</span>`).join("")}${hl.map((g) => `<span class="hl">${Stats.hlText(g.h)}</span>`).join("")}</span></span><span class="chev">›</span></button>`;
  }
  // Jedna partija u listi
  function partItem(g, label) {
    const n = g.r ? g.r.length : 0;
    return `<button class="item" ${goAttr({ g: g.id })}><span class="pno">${g.bookIdx}</span>
      <span class="grow"><span class="muted small">${label || `${g.idx}. partija bleje`}</span>
      <span>${dot(g.w)}<b>${esc(pname(g.w))}</b> ${gdesc(g)}</span>
      <span class="tags">${n ? `<span class="dtag">${g.zs ? "📒" : "📝"} ${n} ${pl(n, "deljenje", "deljenja", "deljenja")}</span>` : `<span class="muted small">deljenja samo u svesci</span>`}${Stats.hlKind(g.h) ? `<span class="hl">${Stats.hlText(g.h)}</span>` : ""}</span></span><span class="chev">›</span></button>`;
  }

  function vBleja(gs) {
    const g0 = gs[0], wc = winCount(gs), ids = [...g0.dp].sort((a, b) => (wc[b] || 0) - (wc[a] || 0));
    const dayNs = [...new Set(S.games.map((g) => g.day))], i = dayNs.indexOf(g0.day), prev = dayNs[i - 1], next = dayNs[i + 1];
    const bookDay = S.data.days.find((d) => d.n === g0.day)?.bookDay;
    return `${ptitle(`Bleja ${g0.day} · ${fmtDate(g0.date)}`, `${Stats.DANI[g0.wd]} · ${esc(g0.book)}${bookDay ? ` · ${bookDay}. bleja u svesci` : ""} · ${gs.length} ${pl(gs.length, "partija", "partije", "partija")}`, { book: g0.book })}
      ${crumbs([["Sveske", {}], [g0.book, { book: g0.book }], [`Bleja ${g0.day}`]])}
      <div class="box"><h3 class="cap">Rezultat bleje</h3><div class="tags">${ids.map((id) => `<span class="wtag ${wc[id] ? "" : "zero"}" style="--c:${color(id)}">${esc(pname(id))} ${wc[id] || 0}</span>`).join("")}</div>
        <button class="ghost small" data-share="${g0.date}">📣 Podeli rezultate</button></div>
      <h3 class="cap">Partije</h3>
      ${gs.map((g) => partItem(g)).join("")}
      <div class="row pn">${prev ? `<button class="ghost" ${goAttr({ day: prev })}>‹ Bleja ${prev}</button>` : "<span></span>"}${next ? `<button class="ghost" ${goAttr({ day: next })}>Bleja ${next} ›</button>` : ""}</div>`;
  }

  function vPartija(g) {
    const i = S.games.indexOf(g), prev = S.games[i - 1], next = S.games[i + 1];
    const hands = (g.r || []).map(unpackHand), dig = hands.length && g.o;
    const st = dig ? zCalc(g.o, hands) : null;
    const tags = `<div class="tags">${dig ? `<span class="dtag">${g.zs ? "📒 Iz sveske" : "📝 Zapisnik"} · ${hands.length} ${pl(hands.length, "deljenje", "deljenja", "deljenja")}</span>` : ""}${Stats.hlKind(g.h) ? `<span class="hl">${Stats.hlText(g.h)}</span>` : ""}<span class="gtag">${tipText(g)}</span></div>`;
    let body;
    if (dig) {
      const outs = g.o.filter((id) => st.out[id] != null && !g.l.includes(id) && id !== g.w).sort((a, b) => st.out[a] - st.out[b]);
      const peak = st.peak[g.w];
      body = sheetHTML(g.o, hands, { num: g.bookIdx, date: g.date }) + `<div class="box sum">
        <p>${dot(g.w)}<b>${esc(pname(g.w))}</b> ${g.t === "F" ? `pobedio u finalu protiv <b>${esc(pname(g.l[0]))}</b>` : g.t === "A" ? "pobedio sve odjednom" : `pobedio protiv ${g.t} – ${st.tot[g.w] <= -101 ? "prekid na −101" : "izbacio odjednom"} <b>${names(g.l)}</b>`}${g.l.length && g.l.every((id) => st.tot[id] >= 201) ? ` (${g.l.map((id) => st.tot[id]).join(" · ")})` : ""}.</p>
        ${outs.length ? `<p class="muted">Ispali ranije: ${outs.map((id) => `${esc(pname(id))} (${st.out[id] + 1}. deljenje)`).join(", ")}.</p>` : ""}
        <p class="muted">Prvi delio ${esc(pname(hands[0].d))}${peak != null ? ` · pobednik je u toku partije imao najviše ${peak}` : ""}. D = ko je delio, * = −10, ** = −20 (žandar)${hands.some((h) => Object.values(h.s || {}).includes("x")) ? ", ✗ = ispao (iznos nije zapisan)" : ""}${hands.some((h) => h.n) ? ", ✓ = dobio poslednje deljenje (nije zapisano u svesci)" : ""}.</p>
        ${g.zs ? `<p class="muted small">Deljenja prepisana iz sveske; ko je delio računato je po pravilu.</p>` : ""}</div>`;
    } else {
      body = `<div class="box sum"><p>${dot(g.w)}<b>${esc(pname(g.w))}</b> ${g.t === "F" ? `pobedio u finalu protiv <b>${esc(pname(g.l[0]))}</b>` : g.t === "A" ? "pobedio sve" : `pobedio protiv ${names(g.l)}`}.</p>
        <p class="muted">Igrali: ${names(g.p)}.</p><p class="muted small">Deljenja ove partije su samo u svesci (${esc(g.book)}, partija #${g.bookIdx}).</p></div>`;
    }
    const admin = store.get("mm_admin_on") || store.get("mm_admin");
    return `${ptitle(`Partija #${g.bookIdx} · ${esc(g.book)}`, `Bleja ${g.day} · ${Stats.DANI[g.wd]} ${fmtDate(g.date)} · ${g.idx}. partija bleje`, { day: g.day })}
      ${crumbs([["Sveske", {}], [g.book, { book: g.book }], [`Bleja ${g.day}`, { day: g.day }], [`#${g.bookIdx}`]])}
      ${tags}${body}
      <div class="row pn">${prev ? `<button class="ghost" ${goAttr({ g: prev.id })}>‹ #${prev.bookIdx}</button>` : "<span></span>"}${next ? `<button class="ghost" ${goAttr({ g: next.id })}>#${next.bookIdx} ›</button>` : ""}</div>
      ${admin ? `<button class="ghost small" data-fix="${g.id}">✏️ Ispravi ovu partiju u Unosu</button>` : ""}`;
  }

  bind.istorija = () => {
    $$("[data-go]").forEach((b) => b.onclick = () => go(JSON.parse(b.dataset.go)));
    $$("[data-share]").forEach((b) => b.onclick = () => shareModal(b.dataset.share));
    const hq = $("#hq"); if (hq) hq.oninput = (e) => { S.histQ = e.target.value; clearTimeout(S._hq); S._hq = setTimeout(() => { render(); const i = $("#hq"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 350); };
    const fx = $("[data-fix]"); if (fx) fx.onclick = () => {
      const g = S.games.find((x) => x.id === +fx.dataset.fix); if (!g) return;
      showAdmin(); S.view = "admin"; S.adminTab = "unos"; ensureDraft();
      const dg = S.draft.games.find((x) => x.id === g.id), day = S.draft.days.find((d) => d.n === dg?.day);
      if (dg && day) S.edit = { date: day.date, book: day.book, editId: dg.id, gp: [...(dg.p || day.p)], w: dg.w, t: dg.t === "F" ? "F" : "M", l: [...dg.l], h: dg.h ?? null };
      $$("#nav button").forEach((x) => x.classList.toggle("on", x.dataset.v === "admin")); render(); window.scrollTo(0, 0);
    };
  };

  // ---------- Računanje partije iz deljenja (zapisnik) ----------
  // o = redosled kolona (sedenja), hands = [{w, j, d, s:{id: zbir karata}}]
  function zCalc(o, hands) {
    const tot = {}, out = {}, peak = {}, rows = [];
    o.forEach((id) => { tot[id] = 0; peak[id] = 0; });
    let stop = false;
    hands.forEach((h, i) => {
      if (stop) return;
      const active = o.filter((id) => out[id] == null), cells = {};
      active.forEach((id) => {
        if (id === h.w) { if (!h.n) tot[id] += h.j ? -20 : -10; cells[id] = { v: tot[id], m: h.n ? "" : h.j ? "**" : "*", n: !!h.n }; }
        else if (h.s?.[id] === "x") cells[id] = { v: tot[id], unk: true }; // ispao, iznos nije zapisan u svesci
        else { tot[id] += (+h.s?.[id] || 0) * (h.j ? 2 : 1); cells[id] = { v: tot[id] }; }
        if (tot[id] < 201) peak[id] = Math.max(peak[id], tot[id]);
      });
      active.forEach((id) => { if (tot[id] >= 201 || cells[id].unk) { out[id] = i; cells[id].x = true; } });
      rows.push({ cells, d: h.d, active });
      if (tot[h.w] <= -101) stop = true;
    });
    const active = o.filter((id) => out[id] == null);
    let end = null;
    if (rows.length) {
      const last = rows[rows.length - 1], low = active.find((id) => tot[id] <= -101);
      const w = low || (active.length === 1 ? active[0] : null);
      if (w) {
        const l = last.active.filter((id) => id !== w), others = o.filter((id) => id !== w);
        const t = l.length === 1 ? "F" : (l.length === others.length && others.length >= 3) ? "A" : String(Math.min(l.length, 3));
        // ⚡ Clutch: pobednik je u toku partije imao 190–200. ⛳ Hole in one: dobio je samo jedno deljenje — poslednje, kojim je izbacio sve preostale.
        const cl = rows.map((r) => r.cells[w]?.v).filter((v) => v >= 190 && v <= 200);
        const clutch = cl.length ? Math.max(...cl) : null;
        const hio = !low && hands.filter((h) => h.w === w).length === 1 && hands[rows.length - 1].w === w;
        end = { w, l, t, clutch, hio, h: low ? -101 : hio ? "HIO" : clutch };
      }
    }
    return { tot, out, peak, rows, active, end };
  }
  // Ko deli sledeću ruku: posle prethodnog delioca, redom kolona, preskače ispale
  function zDealer(o, hands, st) {
    if (!hands.length) return o[0];
    const i0 = o.indexOf(hands[hands.length - 1].d);
    for (let k = 1; k <= o.length; k++) { const id = o[(i0 + k) % o.length]; if (st.out[id] == null) return id; }
    return st.active[0];
  }
  // Tabela partije kao stranica sveske
  function sheetHTML(o, hands, opt = {}) {
    const st = zCalc(o, hands), nd = opt.dealer || null, w = st.end?.w;
    const cols = `grid-template-columns:30px repeat(${o.length}, minmax(0,1fr))`;
    const head = o.map((id) => `<span class="sh">${nd === id ? `<span class="deli">DELI</span>` : ""}<span class="nm" style="color:${color(id)}">${esc(pname(id))}</span></span>`).join("");
    const rows = st.rows.map((r, i) => `<div class="sr" style="${cols}"><span class="rn">${i + 1}<i class="dl" title="delio ${esc(pname(r.d))}" style="background:${color(r.d)}">D</i></span>${o.map((id) => {
      const c = r.cells[id];
      if (!c) return `<span class="sc gone"></span>`;
      if (c.unk) return `<span class="sc outc" title="ispao, iznos nije zapisan">✗</span>`;
      if (c.x) return `<span class="sc outc"><s>${c.v}</s></span>`;
      if (c.n) return `<span class="sc win" title="poslednje deljenje nije zapisano u svesci">✓</span>`;
      return `<span class="sc${id === w && i === st.rows.length - 1 ? " win" : ""}">${c.v}${c.m ? `<sup>${c.m}</sup>` : ""}</span>`;
    }).join("")}</div>`).join("");
    const foot = w ? `<div class="sr foot" style="${cols}"><span></span>${o.map((id) => `<span class="sc">${id === w ? "WINNER" : ""}</span>`).join("")}</div>` : "";
    return `<div class="paper${opt.big ? " big" : ""}">${opt.num || opt.date ? `<div class="ptop">${opt.num ? `<span class="circ">${opt.num}</span>` : "<span></span>"}<span>${opt.date ? fmtDate(opt.date) : ""}</span></div>` : ""}
      <div class="sr shead" style="${cols}"><span></span>${head}</div>${rows || `<div class="sr" style="${cols}"><span></span><span class="sc muted" style="grid-column:2/-1">prvo deljenje…</span></div>`}${foot}</div>`;
  }

  // ---------- Unos (admin) ----------
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  // Nacrt unosa važi samo za verziju podataka na kojoj je nastao (da se ne pregaze novije objave)
  const baseId = () => (S.box?.ct || "").slice(0, 40);
  function ensureDraft() {
    if (!S.draft) {
      const st = store.get("mm_draft");
      if (st && st.__base && st.__base !== baseId()) { store.del("mm_draft"); toast("Podaci su u međuvremenu ažurirani — stari nesačuvan unos je odbačen.", 5000); }
      S.draft = (st && (!st.__base || st.__base === baseId())) ? st : JSON.parse(JSON.stringify(S.data));
    }
    S.players = S.draft.players;
  }
  function saveDraft() { S.dirty = true; S.draft.__base = baseId(); store.set("mm_draft", S.draft); }
  function vUnos() {
    ensureDraft();
    const cfg = store.get("mm_admin", { owner: "", repo: "", branch: "main", token: "" });
    const D = S.draft, books = [...new Set(D.days.map((d) => d.book))];
    if (!S.edit) { const last = D.days[D.days.length - 1]; S.edit = { date: today(), book: last?.book || "", w: null, t: "F", l: [], gp: null }; }
    const E = S.edit, day = D.days.find((d) => d.date === E.date);
    const dayGames = day ? D.games.filter((g) => g.day === day.n) : [];
    if (!E.gp) E.gp = defaultPlayers(D, day);
    const gp = E.gp;
    const chip = (id, on, attr) => `<button class="pchip ${on ? "on" : ""}" style="--c:${color(id)}" ${attr}="${id}">${esc(pname(id))}</button>`;
    const others = gp.filter((id) => id !== E.w);
    const curBook = day?.book || E.book;
    const blejaNo = day ? day.n : Math.max(0, ...D.days.filter((d) => d.date < E.date).map((d) => d.n)) + 1;
    const bookNo = day ? day.bookDay : D.days.filter((d) => d.book === curBook && d.date < E.date).length + 1;
    const editing = E.editId != null ? dayGames.findIndex((g) => g.id === E.editId) + 1 : 0;
    const partNo = editing || dayGames.length + 1;
    // Redni broj partije u svesci i ukupno (da se partija nađe u svesci)
    const bookIdxOf = (gid) => { let n = 0; for (const d of D.days) { if (d.book !== curBook) continue; for (const g of D.games) if (g.day === d.n) { n++; if (g.id === gid) return n; } } return n; };
    const totalIdxOf = (gid) => D.games.findIndex((g) => g.id === gid) + 1;
    const beforeInBook = D.games.filter((g) => { const d = D.days.find((x) => x.n === g.day); return d && d.book === curBook && d.date < E.date; }).length;
    const bookPartNo = editing ? bookIdxOf(E.editId) : beforeInBook + dayGames.length + 1;
    const totalNo = editing ? totalIdxOf(E.editId) : D.games.filter((g) => { const d = D.days.find((x) => x.n === g.day); return d && d.date <= E.date; }).length + 1;
    const adm = cfg.token ? `<p class="small ok">✅ Prijavljen kao admin (${esc(cfg.owner)}/${esc(cfg.repo)})</p>` : `<p class="small warn">⚠️ Nisi prijavljen kao admin: unos možeš da pripremiš, ali za objavu upiši GitHub token u ⚙️ Podešavanja dole.</p>`;
    const recent = [...D.days].reverse().slice(0, 60);
    return `<h2>Unos partija</h2>${adm}
    <div class="cards">
      <div class="card"><b>Bleja ${blejaNo}</b><span>${day ? (E.date >= today() ? "u toku" : "ranija bleja") : "nova"} · ${esc(curBook)} #${bookNo}</span></div>
      <div class="card"><b>Partija ${partNo}.</b><span>${editing ? "✏️ ispravka · " : "na ovoj bleji · "}${esc(curBook)} #${bookPartNo} · ukupno #${totalNo}</span></div>
    </div>
    <div class="box">
      <div class="row"><label>Datum <input type="date" id="eDate" value="${E.date}"></label>
      <label>Sveska <select id="eBook">${[...new Set([...books, E.book].filter(Boolean))].map((b) => `<option ${b === curBook ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></label></div>
      ${E.newBook ? `<div class="row"><label>Naziv nove sveske <input id="nbName" value="${esc(E.newBook)}"></label><button id="nbOk">Otvori svesku</button><button id="nbX" class="ghost">Otkaži</button></div>
        <p class="small muted">Nova sveska počinje od ove bleje (bleja #1 u svesci). Sve statistike se mogu filtrirati po svesci.</p>`
        : `<div class="row"><button id="nbBtn" class="ghost small">📓 Nova sveska</button>
           ${day ? `<button id="chDate" class="ghost small">📅 Promeni datum ove bleje</button>` : ""}
           <label class="grow">Ispravi raniju bleju <select id="ePast"><option value="">— izaberi —</option>${recent.map((d) => `<option value="${d.date}" ${d.date === E.date ? "selected" : ""}>${fmtDate(d.date)} · ${esc(d.book)} · bleja ${d.n} (${D.games.filter((g) => g.day === d.n).length})</option>`).join("")}</select></label></div>`}
    </div>
    <div class="box ${editing ? "editing" : ""}">
      <p class="small muted">Igrali ${partNo}. partiju:</p>
      <div class="chips">${S.players.map((p) => chip(p.id, gp.includes(p.id), "data-gp")).join("")}</div>
      <p class="small muted">Pobednik:</p>
      <div class="chips">${gp.map((id) => chip(id, E.w === id, "data-w")).join("")}</div>
      ${E.w ? `<p class="small muted">Kraj partije:</p>
      <div class="chips">
        <button class="chip ${E.t === "F" ? "on" : ""}" data-t="F">Finale 1 na 1</button>
        ${others.length >= 2 ? `<button class="chip ${E.t === "M" ? "on" : ""}" data-t="M">Protiv više</button>` : ""}
      </div>
      <p class="small muted">${E.t === "F" ? "Protivnik u finalu:" : "Protiv koga (svi koji su ostali do kraja):"}</p>
      <div class="chips">${others.map((id) => chip(id, E.l.includes(id), "data-l")).join("")}
        ${E.t === "M" ? `<button class="chip" id="allOpp">Svi (${others.length})</button>` : ""}</div>
      ${E.t === "M" && E.l.length >= 2 ? `<p class="small muted">= ${E.l.length === others.length && others.length >= 3 ? "pobeda protiv svih" : `pobeda protiv ${E.l.length}`}</p>` : ""}` : ""}
      ${E.w ? `<p class="small muted">Istaknuta partija?</p><div class="chips">
        <button class="chip ${E.h == null ? "on" : ""}" data-h="">Ne</button>
        <button class="chip ${typeof E.h === "number" && E.h >= 190 ? "on" : ""}" data-h="clutch">⚡ Clutch</button>
        <button class="chip ${E.h === -101 ? "on" : ""}" data-h="-101">💥 −101</button>
        <button class="chip ${E.h === "HIO" ? "on" : ""}" data-h="HIO">⛳ Hole in one</button></div>
        ${typeof E.h === "number" && E.h >= 190 ? `<label class="small muted">Najviše poena u toku partije (190–200) <input id="eClutch" type="number" min="190" max="200" value="${E.h}" inputmode="numeric"></label>` : ""}` : ""}
      <button id="addGame" class="primary" ${canAdd() ? "" : "disabled"}>${editing ? `💾 Sačuvaj ispravku ${partNo}. partije` : `+ Dodaj ${partNo}. partiju`}</button>
      ${canAdd() ? "" : `<p class="small warn hint">👆 ${!E.w ? "Tapni pobednika partije." : E.t === "F" ? "Tapni protivnika u finalu." : "Tapni bar 2 protivnika."}</p>`}
      ${editing && D.games.find((g) => g.id === E.editId)?.r ? `<p class="small warn">📝 Ova partija je vođena u zapisniku — ispravka menja samo rezultat, ne i deljenja.</p>` : ""}
      ${editing ? `<button id="cancelEdit" class="ghost primary">Otkaži ispravku</button>` : ""}
    </div>
    ${dayGames.length ? `<h3>Bleja ${blejaNo} · ${fmtDate(E.date)} · ${dayGames.length} ${dayGames.length === 1 ? "partija" : dayGames.length < 5 ? "partije" : "partija"}</h3>
      <p class="small muted">Dodirni ✏️ da ispraviš partiju, ✕ da je obrišeš.</p>
      ${dayGames.some((x) => x.r) ? `<p class="small warn">📝 Ova bleja ima partije iz zapisnika — ne unosi ih ponovo iz sveske.</p>` : ""}
      <ol class="list glist">${dayGames.map((x) => `<li class="${x.id === E.editId ? "on" : ""}">${dot(x.w)}<b>${esc(pname(x.w))}</b> ${gdesc(x)} ${x.h != null ? Stats.hlText(x.h) : ""}${x.r ? ` <span class="small muted">📝 ${x.r.length} del.</span>` : ""}
        <span class="muted small">(${(x.p || day.p).map(pname).join(", ")}) · ${esc(day.book)} #${bookIdxOf(x.id)}</span>
        <span class="acts"><button class="ghost small" data-ed="${x.id}">✏️</button><button class="ghost small" data-del="${x.id}">✕</button></span></li>`).join("")}</ol>` : ""}
    <details class="box" id="impBox" ${S.impOpen ? "open" : ""}><summary>📋 Unos iz teksta / sa slike sveske</summary>
      <p class="small muted">Nalepi partije u ovom obliku (jedna partija u redu). Ovaj tekst može da napravi AI agent iz slike stranice sveske.</p>
      <pre class="fmt">BLEJA 26.11.2026 | 6 Brown
IGRAČI: Šomi, Mićko, Nikod, Lešma, Ugar
Šomi > Mićko
Nikod > Lešma, Ugar
Šomi > Mićko, Nikod, Ugar
Lešma > svi
Ugar > Šomi | bez: Mićko
Šomi > Nikod | clutch 197
Mićko > Ugar | HIO</pre>
      <p class="small muted">Deljenja iz sveske za već upisanu partiju: zaglavlje sa brojem partije i kolonama, pa redovi zbirova tačno kao u svesci (* = −10, ** = žandar, x = ispao bez zapisanog iznosa, - = prazno). Aplikacija proverava da li se slaže sa upisanim rezultatom.</p>
      <pre class="fmt">ZAPIS 26.11.2026 #96: Ugar, Nikod, Maleš, Šomi
21 17 -10* 23
11* 46 15 74
…
x - x 119**</pre>
      <textarea id="impText" rows="8" placeholder="Nalepi tekst ovde…">${esc(S.impText || "")}</textarea>
      <button id="impParse" class="ghost">Proveri</button>
      ${S.imp ? `<div class="imp">${S.imp.errors.map((e) => `<p class="small warn">⚠️ ${esc(e)}</p>`).join("")}
        ${S.imp.items.length ? `<ol class="list">${S.imp.items.map((x) => `<li><span class="muted small">${fmtDate(x.date)}${x.book ? " · " + esc(x.book) : ""}</span> ${dot(x.w)}<b>${esc(pname(x.w))}</b> ${gdesc(x)} ${x.h != null ? Stats.hlText(x.h) : ""} <span class="muted small">(${x.gp.map(pname).join(", ")})</span></li>`).join("")}</ol>` : ""}
        ${S.imp.zaps?.length ? `<ol class="list">${S.imp.zaps.map((x) => `<li>📝 <span class="muted small">${fmtDate(x.date)} · ${esc(x.book)} #${x.idx} · ${x.hands.length} ${pl(x.hands.length, "deljenje", "deljenja", "deljenja")}</span> ${dot(x.w)}<b>${esc(pname(x.w))}</b> ${gdesc(x)} ${x.h != null ? Stats.hlText(x.h) : ""} <b class="okc">✓ slaže se sa upisanim</b>${x.unwritten ? `<br><span class="small muted">Poslednje deljenje nije zapisano u svesci (pobednik ga je dobio, ostali ispali).</span>` : ""}${x.hNote ? `<br><span class="small warn">${esc(x.hNote)}</span>` : ""}${x.replace ? `<br><span class="small warn">Zamenjuje već postojeća deljenja ove partije.</span>` : ""}</li>`).join("")}</ol>` : ""}
        ${S.imp.items.length || S.imp.zaps?.length ? `<button id="impAdd" class="primary" ${S.imp.errors.length ? "disabled" : ""}>+ Dodaj ${[S.imp.items.length ? `${S.imp.items.length} partija` : "", S.imp.zaps?.length ? `deljenja za ${S.imp.zaps.length} ${pl(S.imp.zaps.length, "partiju", "partije", "partija")}` : ""].filter(Boolean).join(" i ")}</button>` : ""}</div>` : ""}
    </details>
    <div class="row sticky-save"><button id="saveGh" class="primary" ${S.dirty || store.get("mm_draft") ? "" : "disabled"} title="${S.dirty || store.get("mm_draft") ? "" : "Nema novih izmena za objavu"}">${S.dirty || store.get("mm_draft") ? "☁️ Sačuvaj i objavi" : "☁️ Nema izmena za objavu"}</button><button id="discard" class="ghost">Odbaci izmene</button></div>
    <details class="box" id="setBox" ${S.setOpen ? "open" : ""}><summary>⚙️ Podešavanja (admin, igrači i boje, lozinka, izvoz)</summary>
      <div class="form">
        <label>GitHub vlasnik <input id="cOwner" value="${esc(cfg.owner || "misacrni")}" placeholder="misacrni"></label>
        <label>Repozitorijum <input id="cRepo" value="${esc(cfg.repo || "maumau")}" placeholder="maumau"></label>
        <label>Grana <input id="cBranch" value="${esc(cfg.branch || "main")}"></label>
        <label>Token (fine-grained, samo Contents: write za ovaj repo) <input id="cToken" type="password" value="${esc(cfg.token)}"></label>
        <button id="saveCfg">Sačuvaj podešavanja (prijava kao admin)</button>
        <button id="adminOut" class="ghost">Odjavi admina (obriši token sa ovog uređaja)</button>
        <hr><b>Igrači</b>
        ${D.players.map((p) => `<div class="prow"><label>${dot(p.id)}Ime <input data-ren="${p.id}" value="${esc(p.name)}"></label>${swatches(color(p.id), D.players.filter((x) => x.id !== p.id).map((x) => color(x.id)), p.id)}
          <details class="pdet"><summary class="small">👤 Profil: opis, slika, kontakt</summary>
            <div class="row">${p.photo ? `<img class="avatar big" src="${p.photo}" alt="">` : ""}<label>Slika <input type="file" accept="image/*" data-photo="${p.id}"></label>${p.photo ? `<button class="ghost small" data-nophoto="${p.id}">Ukloni sliku</button>` : ""}</div>
            <label>Opis <textarea rows="2" data-pf="desc" data-pid="${p.id}" placeholder="npr. Kralj žandara, igra od 2017.">${esc(p.desc || "")}</textarea></label>
            <label>Mobilni <input type="tel" data-pf="phone" data-pid="${p.id}" value="${esc(p.phone || "")}" placeholder="+381 6x xxx xxxx"></label>
            <label>Email <input type="email" data-pf="email" data-pid="${p.id}" value="${esc(p.email || "")}"></label>
          </details></div>`).join("")}
        <p class="small muted">Kontakt podaci su šifrovani zajedno sa statistikom — vide ih samo oni koji imaju lozinku ekipe.</p>
        <div class="prow new"><b>➕ Novi igrač</b><input id="newPlayer" placeholder="Ime novog igrača" value="${esc(S.np?.name || "")}">
          <p class="small muted">Boja (slobodne boje):</p>${swatches(S.np?.color, D.players.map((x) => color(x.id)), "__new")}
          <button id="addPlayer">+ Dodaj igrača</button></div>
        <p class="small muted">Novi igrač dobija lozinku ekipe i odmah vidi sve izveštaje. Izmene važe posle „Sačuvaj i objavi“.</p>
        <hr><b>🔔 Obaveštenja</b>
        <p class="small muted">Push preko besplatne aplikacije <b>ntfy</b> (iPhone/Android). Posle svake objave igrači dobiju notifikaciju. Igrači instaliraju ntfy i pretplate se na temu (uputstvo im piše u ℹ️).</p>
        <div class="row"><label>ntfy tema <input id="ntfyTopic" value="${esc(D.settings?.ntfy || "")}" placeholder="npr. maumau-a7k3x9"></label><button id="ntfyGen" class="ghost small">Generiši</button><button id="ntfyTest" class="ghost small">Probna poruka</button></div>
        <hr><label>Nova lozinka ekipe <input id="newPw" type="text" autocomplete="off" placeholder="npr. zandar-kec-dama7"></label>
        <button id="pwChange">🔑 Promeni lozinku i objavi</button>
        <p class="small muted">Posle promene svi ostali se jednom uloguju novom lozinkom. Ovaj uređaj je pamti sam.</p>
        <button id="exportJson" class="ghost">⬇ Izvoz JSON</button> <button id="exportCsv" class="ghost">⬇ Izvoz CSV</button>
      </div>
    </details>`;
  }
  function swatches(cur, taken, attr) {
    return `<div class="sw">${PALETTE.map(([c, n]) => { const t = taken.includes(c); return `<button type="button" class="swb ${c === cur ? "on" : ""}" ${t ? "disabled" : ""} title="${n}${t ? " (zauzeta)" : ""}" style="--c:${c}" data-k="${attr}" data-c="${c}"></button>`; }).join("")}</div>`;
  }
  const gdesc = (x) => x.t === "F" ? `finale vs ${esc(pname(x.l[0]))}` : (x.t === "2" || x.t === "3") ? `vs ${x.l.map((i) => esc(pname(i))).join(", ").replace(/, ([^,]*)$/, " i $1")}` : "vs svi";
  // Igrači za novu partiju: kao prethodna partija te bleje, inače kao poslednja bleja
  function defaultPlayers(D, day) {
    const order = (arr) => S.players.map((p) => p.id).filter((id) => arr.includes(id));
    if (day) { const gs = D.games.filter((g) => g.day === day.n); const lg = gs[gs.length - 1]; return order(lg?.p || day.p); }
    const prev = [...D.days].filter((d) => d.date < S.edit.date).pop() || D.days[D.days.length - 1];
    if (prev) return order(prev.p);
    return S.players.map((p) => p.id);
  }
  // Posle svake izmene: igrači bleje = svi koji su igrali bar jednu partiju; brojevi bleja i svezaka redom po datumu
  function normalize(D) {
    for (const d of D.days) {
      const gs = D.games.filter((g) => g.day === d.n);
      gs.forEach((g) => { if (!g.p) g.p = [...d.p]; });
      d.p = S.players.map((p) => p.id).filter((id) => gs.some((g) => g.p.includes(id)));
      gs.forEach((g) => { if (g.p.length === d.p.length) delete g.p; });
    }
    D.days = D.days.filter((d) => D.games.some((g) => g.day === d.n));
    D.days.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n);
    const remap = {}, perBook = {};
    D.days.forEach((d, i) => { remap[d.n] = i + 1; d.n = i + 1; perBook[d.book] = (perBook[d.book] || 0) + 1; d.bookDay = perBook[d.book]; });
    D.games.forEach((g) => g.day = remap[g.day]);
    D.games.sort((a, b) => a.day - b.day || a.id - b.id);
  }
  function putGame(D, x, editId) {
    let day = D.days.find((d) => d.date === x.date);
    if (!day) {
      const book = x.book || [...D.days].filter((d) => d.date < x.date).pop()?.book || D.days[D.days.length - 1]?.book || "1";
      day = { n: Math.max(0, ...D.days.map((d) => d.n)) + 1, date: x.date, book, bookDay: 0, p: [...x.gp] };
      D.days.push(day);
    } else if (x.book && x.book !== day.book && x.fromImport) day.book = x.book;
    D.games.filter((g) => g.day === day.n).forEach((g) => { if (!g.p) g.p = [...day.p]; });
    const l = x.t === "A" ? x.gp.filter((id) => id !== x.w) : [...x.l];
    const g = editId != null ? D.games.find((y) => y.id === editId) : { id: Math.max(0, ...D.games.map((y) => y.id)) + 1, day: day.n };
    Object.assign(g, { w: x.w, l, t: x.t, p: [...x.gp] }); if (x.h != null) g.h = x.h; else delete g.h;
    if (editId == null) D.games.push(g);
    normalize(D);
  }
  // Parser teksta (npr. iz AI agenta koji čita sliku sveske)
  function parseImport(text, D) {
    const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "dj").toLowerCase().trim();
    const find = (name) => { const n = norm(name); if (!n) return null; return D.players.find((p) => norm(p.name) === n) || D.players.find((p) => norm(p.name).startsWith(n) && n.length >= 3) || null; };
    const items = [], errors = [], zaps = [];
    let date = S.edit?.date || today(), book = "", players = null, zb = null;
    text.split(/\r?\n/).forEach((raw, i) => {
      // ZAPIS dd.mm.gggg #96: Ugar, Nikod, Maleš, Šomi  + redovi zbirova kao u svesci
      const zh = raw.trim().match(/^zapis\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*#\s*(\d+)\s*:\s*(.+)$/i);
      if (zh) {
        const ps = zh[5].split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((n) => [n, find(n)]);
        ps.filter((x) => !x[1]).forEach((x) => errors.push(`Red ${i + 1}: nepoznat igrač „${x[0]}“`));
        zb = { line: i + 1, date: `${zh[3]}-${zh[2].padStart(2, "0")}-${zh[1].padStart(2, "0")}`, idx: +zh[4], cols: ps.map((x) => x[1]?.id).filter(Boolean), rows: [] };
        zaps.push(zb); return;
      }
      if (zb) {
        const toks = raw.replace(/[–—]/g, "-").replace(/\s#.*$/, "").trim().split(/\s+/).filter(Boolean);
        if (toks.length && toks.every((t) => /^(-?\d+\*{0,2}|x|-)$/i.test(t))) {
          if (/#\s*PROVERI/i.test(raw)) errors.push(`Red ${i + 1}: agent nije siguran – ${raw.split("#").pop().trim()}`);
          zb.rows.push({ line: i + 1, toks }); return;
        }
        zb = null;
      }
      const line = raw.replace(/[–—]/g, "-").replace(/\s#.*$/, "").trim(); if (!line || line.startsWith("#")) return;
      if (/#\s*PROVERI/i.test(raw)) errors.push(`Red ${i + 1}: agent nije siguran – ${raw.split("#").pop().trim()}`);
      const ln = `Red ${i + 1}: `;
      let m = line.match(/^bleja\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*(?:\|\s*(.+))?$/i);
      if (m) { date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; book = (m[4] || "").trim(); players = null; return; }
      m = line.match(/^igra[cč]i\s*:\s*(.+)$/i);
      if (m) { const ps = m[1].split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((n) => [n, find(n)]); ps.filter((x) => !x[1]).forEach((x) => errors.push(ln + `nepoznat igrač „${x[0]}“`)); players = ps.map((x) => x[1]).filter(Boolean).map((p) => p.id); return; }
      const [main, ...opts] = line.split("|").map((x) => x.trim());
      m = main.match(/^(.+?)\s*>\s*(.+)$/);
      if (!m) return errors.push(ln + `ne razumem „${line}“`);
      const w = find(m[1]); if (!w) return errors.push(ln + `nepoznat pobednik „${m[1]}“`);
      let gp = players ? [...players] : defaultPlayersFor(D, date, items);
      let h = null;
      for (const o of opts) {
        let mm;
        if ((mm = o.match(/^bez\s*:?\s*(.+)$/i))) mm[1].split(/[,;]/).forEach((n) => { const p = find(n); if (!p) errors.push(ln + `nepoznat igrač „${n.trim()}“`); else gp = gp.filter((x) => x !== p.id); });
        else if ((mm = o.match(/^igrali\s*:?\s*(.+)$/i))) gp = mm[1].split(/[,;]/).map((n) => find(n)?.id).filter(Boolean);
        else if ((mm = o.match(/clutch\s*(\d{3})/i))) { const v = +mm[1]; if (v < 190 || v > 200) errors.push(ln + "clutch mora biti 190–200"); else h = v; }
        else if (/^-\s*101$/.test(o.replace(/\s/g, ""))) h = -101;
        else if (/^hio|hole in one$/i.test(o)) h = "HIO";
        else errors.push(ln + `nepoznata oznaka „${o}“`);
      }
      if (!gp.includes(w.id)) gp.push(w.id);
      let t, l = [];
      if (/^svi$|^all$|^sve$/i.test(m[2].trim())) t = "A";
      else {
        const ls = m[2].split(/[,;]|\si\s/).map((n) => n.trim()).filter(Boolean).map((n) => [n, find(n)]);
        const bad = ls.filter((x) => !x[1]); if (bad.length) return errors.push(ln + `nepoznat igrač „${bad[0][0]}“`);
        l = ls.map((x) => x[1].id);
        l.forEach((id) => { if (!gp.includes(id)) gp.push(id); });
        t = l.length === 1 ? "F" : multiType(l, gp, w.id);
      }
      gp = S.players.map((p) => p.id).filter((id) => gp.includes(id));
      if (t === "A" && gp.length < 3) return errors.push(ln + "„svi“ traži bar 3 igrača u partiji");
      items.push({ date, book, gp, w: w.id, t, l, h, fromImport: true });
    });
    const zapItems = zaps.map((z) => zapisCheck(z, D, errors)).filter(Boolean);
    if (!items.length && !zapItems.length && !errors.length) errors.push("Nema partija u tekstu.");
    return { items, errors, zaps: zapItems };
  }
  // Redovi zbirova (kao u svesci) → deljenja; svaka greška se prijavljuje sa brojem reda
  function zapisHands(cols, rows) {
    const err = [], hands = [], prev = Object.fromEntries(cols.map((id) => [id, 0])), out = new Set();
    rows.forEach(({ line, toks }) => {
      if (err.length) return; // posle prve greške ostali redovi nemaju smisla
      const ln = `Red ${line}: `;
      if (toks.length !== cols.length) return err.push(ln + `${toks.length} vrednosti, a kolona je ${cols.length}`);
      const cell = (t) => /^-?\d/.test(t) ? { v: parseInt(t, 10), st: (t.match(/\*+$/) || [""])[0].length } : null;
      const cs = toks.map(cell), wi = cols.filter((id, k) => cs[k]?.st);
      if (wi.length !== 1) return err.push(ln + (wi.length ? "više igrača sa *" : "nema ko je završio ruku (*)"));
      const w = wi[0], j = cs[cols.indexOf(w)].st === 2, s = {};
      if (out.has(w)) return err.push(ln + `${pname(w)} je već ispao`);
      const need = prev[w] - (j ? 20 : 10);
      if (cs[cols.indexOf(w)].v !== need) return err.push(ln + `${pname(w)} završio ruku: ${prev[w]} ${j ? "− 20" : "− 10"} = ${need}, a piše ${cs[cols.indexOf(w)].v}`);
      for (const [k, id] of cols.entries()) {
        if (id === w) continue;
        const c = cs[k];
        if (out.has(id)) { if (c) err.push(ln + `${pname(id)} je već ispao, a ima broj ${c.v}`); continue; }
        if (!c) { s[id] = "x"; continue; }
        const d = c.v - prev[id];
        if (d < 0) { err.push(ln + `${pname(id)} pada sa ${prev[id]} na ${c.v} bez *`); continue; }
        if (j && d % 2) { err.push(ln + `žandar: ${pname(id)} ${prev[id]} → ${c.v}, razlika ${d} nije parna`); continue; }
        s[id] = j ? d / 2 : d;
      }
      cols.forEach((id, k) => { if (out.has(id)) return; if (id === w) prev[id] = need; else if (s[id] === "x") out.add(id); else { prev[id] = cs[k].v; if (prev[id] >= 201) out.add(id); } });
      hands.push({ w, j, d: null, s });
    });
    return { hands, err };
  }
  // Zapis iz sveske: proveri da li se slaže sa već upisanom partijom (pobednik, kraj, igrači)
  function zapisCheck(z, D, errors) {
    const ln = `Zapis #${z.idx} (red ${z.line}): `;
    if (z.cols.length < 2) return errors.push(ln + "treba bar 2 igrača"), null;
    if (!z.rows.length) return errors.push(ln + "nema redova sa zbirovima"), null;
    const r = zapisHands(z.cols, z.rows);
    if (r.err.length) return r.err.forEach((e) => errors.push(`Zapis #${z.idx}, ${e}`)), null;
    const day = D.days.find((d) => d.date === z.date), gs = day ? D.games.filter((g) => g.day === day.n) : [];
    const g = gs.find((x) => bookIdxIn(D, z.date, day.book, x.id) === z.idx);
    if (!g) return errors.push(ln + `partija #${z.idx} za ${fmtDate(z.date)} nije upisana — prvo upiši rezultat, pa nalepi zapis.`), null;
    let hands = r.hands, st = zCalc(z.cols, hands), unwritten = false;
    if (!st.end && st.active.includes(g.w) && st.active.length > 1) { // poslednje deljenje nije zapisano u svesci
      hands = [...hands, { w: g.w, j: false, n: 1, d: null, s: Object.fromEntries(st.active.filter((id) => id !== g.w).map((id) => [id, "x"])) }];
      st = zCalc(z.cols, hands); unwritten = true;
    }
    hands.forEach((h, k) => { h.d = k ? zDealer(z.cols, hands.slice(0, k), zCalc(z.cols, hands.slice(0, k))) : z.cols[0]; });
    if (!st.end) return errors.push(ln + `partija nema kraj — u igri su još ${st.active.map(pname).join(", ")}`), null;
    const e = st.end, gp = g.p || day.p, same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    const txt = (x) => `${pname(x.w)} ${x.t === "F" ? "finale vs " + pname(x.l[0]) : x.t === "A" ? "protiv svih" : "protiv " + x.l.map(pname).join(", ")}`;
    const diffs = [];
    if (!same(gp, z.cols)) diffs.push(`igrači – upisano ${gp.map(pname).join(", ")}, u zapisu ${z.cols.map(pname).join(", ")}`);
    if (g.w !== e.w || g.t !== e.t || !same(g.l, e.l)) diffs.push(`upisano „${txt(g)}“, a iz deljenja izlazi „${txt(e)}“`);
    if (diffs.length) return errors.push(ln + "NE slaže se: " + diffs.join("; ")), null;
    const hNote = (g.h ?? null) !== (e.h ?? null) ? `istaknuto: upisano ${g.h == null ? "ništa" : Stats.hlText(g.h)}, iz deljenja ${e.h == null ? "ništa" : Stats.hlText(e.h)} — biće upisano iz deljenja` : "";
    return { date: z.date, book: day.book, idx: z.idx, gid: g.id, w: e.w, t: e.t, l: e.l, h: e.h, cols: z.cols, hands, hNote, unwritten, replace: !!g.r };
  }
  function defaultPlayersFor(D, date, items) {
    const prevItem = [...items].reverse().find((x) => x.date === date); if (prevItem) return [...prevItem.gp];
    const day = D.days.find((d) => d.date === date); if (day) return defaultPlayers(D, day);
    const prev = [...D.days].filter((d) => d.date < date).pop(); if (prev) return defaultPlayers(D, prev);
    return S.players.map((p) => p.id);
  }
  // Slika igrača: smanji na 160px JPEG (da podaci ostanu mali)
  function shrinkPhoto(file) {
    return new Promise((res, rej) => {
      const img = new Image(); img.onerror = rej;
      img.onload = () => { const s = 160, c = document.createElement("canvas"); c.width = c.height = s; const k = Math.max(s / img.width, s / img.height);
        const w = img.width * k, h = img.height * k; c.getContext("2d").drawImage(img, (s - w) / 2, (s - h) / 2, w, h); res(c.toDataURL("image/jpeg", 0.8)); URL.revokeObjectURL(img.src); };
      img.src = URL.createObjectURL(file);
    });
  }
  // Tekst sa rezultatima bleje (za WhatsApp i push)
  function blejaSummary(data, date) {
    const day = data.days.find((d) => d.date === date); if (!day) return "";
    const gs = data.games.filter((g) => g.day === day.n), nm = (id) => (data.players.find((p) => p.id === id) || { name: id }).name;
    const cnt = {}; gs.forEach((g) => cnt[g.w] = (cnt[g.w] || 0) + 1);
    const sc = day.p.map((id) => [nm(id), cnt[id] || 0]).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(", ");
    const tx = (g) => g.t === "F" ? `${nm(g.w)} > ${nm(g.l[0])}` : g.t === "A" ? `${nm(g.w)} > svi` : `${nm(g.w)} > ${g.l.map(nm).join(", ")}`;
    const hl = (g) => g.h === "HIO" ? " ⛳" : g.h === -101 ? " 💥" : typeof g.h === "number" ? ` ⚡${g.h}` : "";
    const ins = blejaInsights(data, date);
    return `🂡 Mau Mau — bleja ${day.n} (${fmtDate(day.date)} · ${day.book} #${day.bookDay})\n🏆 ${sc}\n${gs.map((g, i) => `${i + 1}. ${tx(g)}${hl(g)}`).join("\n")}${ins.length ? "\n\n" + ins.join("\n") : ""}\n👉 https://misacrni.github.io/maumau/`;
  }
  // Zanimljivosti bleje: nizovi, prekinuti postovi, dueli u finalima, highlight, jubileji
  function blejaInsights(data, date) {
    const all = Stats.enrich(data), before = all.filter((g) => g.date < date), upto = all.filter((g) => g.date <= date), now = all.filter((g) => g.date === date);
    if (!now.length) return [];
    const nm = (id) => (data.players.find((p) => p.id === id) || { name: id }).name, out = [];
    const pl = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;
    const part = (n) => `${n} ${pl(n, "partija", "partije", "partija")}`, pob = (n) => `${n} ${pl(n, "pobeda", "pobede", "pobeda")}`;
    const ids = [...new Set(now.flatMap((g) => g.p))];
    const wins = {}; now.forEach((g) => wins[g.w] = (wins[g.w] || 0) + 1);
    // kralj bleje / razvalio
    const top = Object.entries(wins).sort((a, b) => b[1] - a[1]);
    if (top.length && top[0][1] === now.length && now.length >= 3) out.push(`🧹 ${nm(top[0][0])} razvalio — dobio svih ${now.length} partija!`);
    else if (top.length && top[0][1] >= 3 && (!top[1] || top[1][1] < top[0][1])) out.push(`👑 ${nm(top[0][0])} kralj bleje — ${pob(top[0][1])}`);
    ids.forEach((id) => { if (!wins[id] && now.filter((g) => g.p.includes(id)).length >= 3) out.push(`🙈 ${nm(id)} bez pobede na bleji (${part(now.filter((g) => g.p.includes(id)).length)})`); });
    // istaknute partije
    now.forEach((g) => { if (Stats.hlKind(g.h)) out.push(`${Stats.hlText(g.h)} — ${nm(g.w)}`); });
    // lični nizovi
    const recBefore = Math.max(0, ...data.players.map((p) => Math.max(0, ...Stats.streaks(before, p.id).win.map((x) => x.len))));
    ids.forEach((id) => {
      const b = Stats.streaks(before, id).current, a = Stats.streaks(upto, id).current;
      const mine = now.filter((g) => g.p.includes(id)), won = mine.some((g) => g.w === id);
      if (b && b.kind === "D" && b.len >= 5 && won) { const extra = mine.findIndex((g) => g.w === id); out.push(`💧 ${nm(id)} prekinuo post od ${part(b.len + extra)} bez pobede`); }
      if (b && b.kind === "W" && b.len >= 3 && mine.some((g) => g.w !== id)) out.push(`🛑 ${nm(id)}: prekinut niz od ${pob(b.len + mine.findIndex((g) => g.w !== id))} zaredom`);
      if (a && a.kind === "W" && a.len >= 3 && won) out.push(`🔥 ${nm(id)}: ${pob(a.len)} zaredom${a.len > recBefore ? " — NOVI REKORD!" : ""}`);
      if (a && a.kind === "D" && a.len >= 8 && !won) out.push(`🥶 ${nm(id)}: ${part(a.len)} bez pobede`);
      const wb = before.filter((g) => g.w === id).length, wa = upto.filter((g) => g.w === id).length;
      for (let m = Math.floor(wb / 50) + 1; m * 50 <= wa; m++) out.push(`🎯 ${nm(id)}: jubilarna ${m * 50}. pobeda!`);
    });
    // dueli u finalima
    const dB = Object.fromEntries(Stats.duelStreaks(before, data.players).map((x) => [x.a + x.b, x]));
    Stats.duelStreaks(upto, data.players).forEach((x) => {
      if (!now.some((g) => g.t === "F" && [x.a, x.b].includes(g.w) && [x.a, x.b].includes(g.l[0]))) return;
      const p = dB[x.a + x.b], loser = x.leader === x.a ? x.b : x.a;
      if (p && p.cur >= 3 && p.leader !== x.leader) out.push(`✂️ Finale ${nm(x.leader)} vs ${nm(p.leader)}: ${nm(x.leader)} prekinuo niz (${nm(p.leader)} je vodio ${p.cur} zaredom)`);
      if (x.cur >= 3) out.push(`⚔️ Finale ${nm(x.leader)} vs ${nm(loser)}: ${nm(x.leader)} pobedio ${x.cur}. put zaredom${x.cur > (p ? p.max : 0) ? " (rekord dvoboja)" : ""}`);
    });
    return out;
  }
  // Prozor za slanje: pregled i izmena poruke, pa push (ntfy) i/ili WhatsApp
  function shareModal(date, title) {
    const text = blejaSummary(S.data, date), topic = S.data.settings?.ntfy, admin = !!store.get("mm_admin")?.token;
    modal(`<h2>${title || "📣 Rezultati bleje"}</h2><p class="small muted">Pregledaj poruku i po želji je izmeni pre slanja.</p>
      <textarea id="shareText" rows="14">${esc(text)}</textarea>
      ${topic && admin ? `<button id="sendPush" class="primary">🔔 Pošalji notifikaciju igračima</button>` : ""}
      <button id="shareWa" class="primary ${topic && admin ? "ghost" : ""}">📣 Pošalji u WhatsApp grupu</button>`);
    const sp = $("#sendPush"); if (sp) sp.onclick = async () => { sp.disabled = true; try { await ntfy(topic, "Mau Mau - novi rezultati", $("#shareText").value); sp.textContent = "✅ Notifikacija poslata"; } catch (e) { sp.disabled = false; toast("Greška: " + e.message); } };
    $("#shareWa").onclick = () => shareText($("#shareText").value);
  }
  function shareText(text) {
    if (navigator.share) return navigator.share({ text }).catch(() => {});
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  }
  function ntfy(topic, title, msg) {
    return fetch("https://ntfy.sh/" + encodeURIComponent(topic), { method: "POST", body: msg, headers: { Title: encodeURIComponent(title).length === title.length ? title : "Mau Mau", Click: "https://misacrni.github.io/maumau/", Tags: "black_joker" } })
      .then((r) => { if (!r.ok) throw new Error(r.status); });
  }
  function canAdd() { const E = S.edit; return E && E.w && ((E.t === "F" && E.l.length === 1) || (E.t === "M" && E.l.length >= 2)); }
  // "Protiv više" -> tip partije: 2, 3 ili svi (A)
  function multiType(l, gp, w) { const others = gp.filter((x) => x !== w); return l.length === others.length && others.length >= 3 ? "A" : String(Math.min(l.length, 3)); }
  function bindUnos() {
    const E = S.edit, D = S.draft;
    const books = [...new Set(D.days.map((d) => d.book))];
    const reset = () => { E.w = null; E.l = []; E.t = "F"; E.h = null; E.gp = null; E.editId = null; };
    $("#eDate").onchange = (e) => { E.date = e.target.value; reset(); render(); };
    const cd = $("#chDate"); if (cd) cd.onclick = async () => {
      const day = D.days.find((d) => d.date === E.date); if (!day) return;
      const v = await ask(`Novi datum za bleju ${day.n} (sada ${fmtDate(day.date)}), u obliku dd.mm.gggg:`, "Promeni datum", fmtDate(day.date).replace(/\.$/, ""));
      if (!v) return;
      const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/); if (!m) return toast("Datum upiši kao dd.mm.gggg");
      const nd = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (D.days.some((d) => d.date === nd && d !== day)) return toast("Za taj datum već postoji bleja.");
      day.date = nd; E.date = nd; normalize(D); saveDraft(); toast(`Datum promenjen na ${fmtDate(nd)} — objavi da važi`); render();
    };
    const ep = $("#ePast"); if (ep) ep.onchange = (e) => { if (!e.target.value) return; E.date = e.target.value; reset(); render(); window.scrollTo(0, 0); };
    const nb = $("#nbBtn"); if (nb) nb.onclick = () => { E.newBook = (books.length + 1) + " "; render(); const i = $("#nbName"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    const nx = $("#nbX"); if (nx) nx.onclick = () => { E.newBook = null; render(); };
    const nok = $("#nbOk"); if (nok) nok.onclick = () => {
      const name = $("#nbName").value.trim();
      if (!name || /^\d+$/.test(name)) return toast("Upiši naziv, npr. „7 Black“.");
      if (books.includes(name)) return toast("Ta sveska već postoji.");
      E.newBook = null; E.book = name; const day = D.days.find((d) => d.date === E.date); if (day) { day.book = name; normalize(D); saveDraft(); }
      toast("Nova sveska: " + name); render();
    };
    $("#eBook").onchange = (e) => { E.book = e.target.value; const day = D.days.find((d) => d.date === E.date); if (day) { day.book = E.book; normalize(D); saveDraft(); } render(); };
    $$("[data-gp]").forEach((b) => b.onclick = () => { const i = E.gp.indexOf(b.dataset.gp); i >= 0 ? E.gp.splice(i, 1) : E.gp.push(b.dataset.gp); E.gp = S.players.map((p) => p.id).filter((id) => E.gp.includes(id)); if (!E.gp.includes(E.w)) E.w = null; E.l = E.l.filter((x) => E.gp.includes(x)); render(); });
    $$("[data-w]").forEach((b) => b.onclick = () => { E.w = b.dataset.w; E.l = E.l.filter((x) => x !== E.w); if (E.editId == null) E.h = null; render(); });
    $$("[data-h]").forEach((b) => b.onclick = () => { const v = b.dataset.h; E.h = v === "" ? null : v === "clutch" ? 195 : v === "-101" ? -101 : "HIO"; render(); });
    const ec = $("#eClutch"); if (ec) ec.onchange = () => { const v = Math.round(+ec.value); E.h = v >= 190 && v <= 200 ? v : 195; render(); };
    $$("[data-t]").forEach((b) => b.onclick = () => { E.t = b.dataset.t; E.l = []; render(); });
    $$("[data-l]").forEach((b) => b.onclick = () => {
      const id = b.dataset.l; if (E.t === "F") E.l = [id]; else { const i = E.l.indexOf(id); i >= 0 ? E.l.splice(i, 1) : E.l.push(id); }
      render();
    });
    const ao = $("#allOpp"); if (ao) ao.onclick = () => { E.l = E.gp.filter((x) => x !== E.w); render(); };
    const add = $("#addGame"); if (add) add.onclick = () => {
      if (E.gp.length < 2) return toast("U partiji moraju biti bar 2 igrača.");
      const day = D.days.find((d) => d.date === E.date);
      if (!day && E.gp.length < 3) return toast("Za novu bleju potrebna su najmanje 3 igrača (kvorum).");
      const wasEdit = E.editId != null;
      const tt = E.t === "F" ? "F" : multiType(E.l, E.gp, E.w);
      putGame(D, { date: E.date, book: E.book, gp: [...E.gp], w: E.w, t: tt, l: [...E.l], h: E.h }, E.editId);
      const keep = [...E.gp]; reset(); if (!wasEdit) E.gp = keep;
      saveDraft(); toast(wasEdit ? "Ispravka sačuvana" : "Partija dodata"); render();
    };
    const ce = $("#cancelEdit"); if (ce) ce.onclick = () => { reset(); render(); };
    $$("[data-ed]").forEach((b) => b.onclick = () => {
      const g = D.games.find((x) => x.id === +b.dataset.ed), day = D.days.find((d) => d.n === g.day);
      Object.assign(E, { editId: g.id, gp: [...(g.p || day.p)], w: g.w, t: g.t === "F" ? "F" : "M", l: [...g.l], h: g.h ?? null });
      render(); window.scrollTo(0, $(".box.editing")?.offsetTop - 70 || 0);
    });
    $$("[data-del]").forEach((b) => b.onclick = async () => { if (!(await ask("Obriši ovu partiju?", "Obriši"))) return; const id = +b.dataset.del; D.games.forEach((g) => { const d = D.days.find((x) => x.n === g.day); if (!g.p && d) g.p = [...d.p]; }); D.games = D.games.filter((g) => g.id !== id); if (E.editId === id) reset(); normalize(D); saveDraft(); render(); });
    $("#impBox").ontoggle = (e) => { S.impOpen = e.target.open; };
    $("#impText").oninput = (e) => { S.impText = e.target.value; S.imp = null; };
    $("#impParse").onclick = () => { S.impText = $("#impText").value; S.imp = parseImport(S.impText, D); render(); };
    const ia = $("#impAdd"); if (ia) ia.onclick = async () => {
      const its = S.imp.items;
      const dup = [...new Set(its.map((x) => x.date))].filter((dt) => { const d = D.days.find((y) => y.date === dt); return d && D.games.some((g) => g.day === d.n && g.r); });
      if (dup.length && !(await ask(`Za ${dup.map(fmtDate).join(", ")} već postoje partije iz zapisnika. Ako je ovo ista bleja iz sveske, partije bi se upisale dvaput.\nIpak dodaj?`, "Ipak dodaj"))) return; its.forEach((x) => putGame(D, x, null));
      const zs = S.imp.zaps || [];
      zs.forEach((x) => {
        const g = D.games.find((y) => y.id === x.gid); if (!g) return;
        g.o = [...x.cols]; g.r = x.hands.map(packHand); g.zs = 1;
        if (x.h == null) delete g.h; else g.h = x.h;
      });
      saveDraft(); E.date = (its[its.length - 1] || zs[zs.length - 1]).date; reset(); S.imp = null; S.impText = "";
      toast(`Dodato: ${[its.length ? its.length + " partija" : "", zs.length ? "deljenja za " + zs.length + " partije" : ""].filter(Boolean).join(" i ")} — proveri pa „Sačuvaj i objavi“`); render();
    };
    $("#discard").onclick = async () => { if (!(await ask("Odbaciti sve nesačuvane izmene? Vraća se poslednja objavljena verzija.", "Odbaci"))) return; store.del("mm_draft"); S.draft = null; S.dirty = false; S.edit = null; S.imp = null; S.impText = ""; S.players = S.data.players; toast("Izmene odbačene"); render(); };
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
    $("#saveGh").onclick = () => publish();
    $("#pwChange").onclick = async () => {
      const v = $("#newPw").value.trim();
      if (v.length < 8) return toast("Lozinka treba da ima bar 8 znakova.");
      if (!(await ask(`Nova lozinka ekipe: „${v}“\nZapamti je ili zapiši — bez nje se podaci ne mogu otvoriti.`, "Promeni lozinku"))) return;
      S.dirty = true; publish();
    };
    $$("[data-pf]").forEach((i) => i.onchange = () => { const p = D.players.find((x) => x.id === i.dataset.pid); const v = i.value.trim(); if (v) p[i.dataset.pf] = v; else delete p[i.dataset.pf]; saveDraft(); toast("Sačuvano u unosu — objavi da vide svi"); });
    $$("[data-photo]").forEach((i) => i.onchange = async () => {
      const f = i.files[0]; if (!f) return;
      try { const p = D.players.find((x) => x.id === i.dataset.photo); p.photo = await shrinkPhoto(f); saveDraft(); render(); } catch { toast("Slika ne može da se učita."); }
    });
    $$("[data-nophoto]").forEach((b) => b.onclick = () => { const p = D.players.find((x) => x.id === b.dataset.nophoto); delete p.photo; saveDraft(); render(); });
    $("#ntfyTopic").onchange = (e) => { D.settings = D.settings || {}; const v = e.target.value.trim().replace(/[^\w-]/g, ""); if (v) D.settings.ntfy = v; else delete D.settings.ntfy; saveDraft(); render(); };
    $("#ntfyGen").onclick = () => { D.settings = D.settings || {}; D.settings.ntfy = "maumau-" + Math.random().toString(36).slice(2, 10); saveDraft(); render(); };
    $("#ntfyTest").onclick = async () => { const t = D.settings?.ntfy; if (!t) return toast("Prvo upiši ili generiši temu."); try { await ntfy(t, "Probna poruka", "Ako ovo vidiš, obaveštenja rade 🎉"); toast("Poslato"); } catch (e) { toast("Greška: " + e.message); } };
    $("#setBox").ontoggle = (e) => { S.setOpen = e.target.open; };
    $("#adminOut").onclick = async () => { if (!(await ask("Obrisati GitHub token sa ovog uređaja?", "Obriši token"))) return; store.del("mm_admin"); store.del("mm_admin_on"); $("#navAdmin").classList.add("hidden"); S.view = "tabela"; $$("#nav button").forEach((x) => x.classList.toggle("on", x.dataset.v === "tabela")); toast("Admin odjavljen"); render(); };
    $$("[data-ren]").forEach((i) => i.onchange = () => { const p = D.players.find((x) => x.id === i.dataset.ren); if (i.value.trim()) { p.name = i.value.trim(); S.players = D.players; saveDraft(); render(); } });
    $$(".swb[data-k]").forEach((b) => b.onclick = () => {
      const k = b.dataset.k, c = b.dataset.c;
      if (k === "__new") S.np = { name: $("#newPlayer").value, color: c };
      else { const p = D.players.find((x) => x.id === k); p.color = c; S.players = D.players; saveDraft(); toast(`${p.name}: nova boja`); }
      render();
    });
    $("#newPlayer").oninput = (e) => { S.np = { ...(S.np || {}), name: e.target.value }; };
    $("#addPlayer").onclick = () => {
      const name = $("#newPlayer").value.trim(); if (!name) return toast("Upiši ime igrača.");
      if (!S.np?.color) return toast("Izaberi boju za novog igrača.");
      if (D.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast("Taj igrač već postoji.");
      let id = "P" + (D.players.length + 1); while (D.players.some((p) => p.id === id)) id += "x";
      D.players.push({ id, name, color: S.np.color }); S.players = D.players; S.np = null; saveDraft(); toast(`Dodat: ${name} — tapni „Sačuvaj i objavi“`); render();
    };
    $("#exportJson").onclick = () => download("maumau.json", JSON.stringify(D, null, 1), "application/json");
    $("#exportCsv").onclick = () => {
      const dm = new Map(D.days.map((d) => [d.n, d]));
      const rows = [["id", "bleja", "datum", "sveska", "igraci", "pobednik", "tip", "porazeni", "istaknuto"]].concat(D.games.map((g) => { const d = dm.get(g.day); return [g.id, g.day, d.date, d.book, d.p.map(pname).join("|"), pname(g.w), Stats.TIP[g.t], g.l.map(pname).join("|"), g.h ?? ""]; }));
      download("maumau.csv", "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
    };
  }
  // Unos: Zapisnik (partija deljenje po deljenje) ili ručni unos rezultata
  function vAdmin() {
    ensureDraft();
    if (!S.adminTab) S.adminTab = zLoad()?.cur ? "zap" : "unos";
    return `<div class="seg" role="tablist"><button role="tab" data-at="zap" class="${S.adminTab === "zap" ? "on" : ""}">📝 Zapisnik</button><button role="tab" data-at="unos" class="${S.adminTab === "unos" ? "on" : ""}">✏️ Unos rezultata</button></div>` + (S.adminTab === "zap" ? vZap() : vUnos());
  }
  bind.admin = () => {
    $$("[data-at]").forEach((b) => b.onclick = () => { S.adminTab = b.dataset.at; render(); window.scrollTo(0, 0); });
    S.adminTab === "zap" ? bindZap() : bindUnos();
  };

  // ---------- 📝 Zapisnik (vodi admin; sveska može paralelno) ----------
  // Stanje je na telefonu (mm_zap); posle svake ruke šalje se šifrovano na ntfy temu "<tema>-live" da svi prate uživo.
  const liveTopic = () => S.data?.settings?.ntfy ? S.data.settings.ntfy + "-live" : null;
  const zLoad = () => store.get("mm_zap", null);
  function zSave(z) { z.at = Date.now(); store.set("mm_zap", z); if (z.seat) store.set("mm_seat", z.seat); pushLive(z); }
  const rotate = (arr, first) => { const i = arr.indexOf(first); return i < 0 ? [...arr] : [...arr.slice(i), ...arr.slice(0, i)]; };
  const zActiveBleja = (z) => z && !z.done && Date.now() - (z.at || 0) < 10 * 3600 * 1000;

  // Predlog za sledeću partiju: ko igra, kako sede, ko prvi deli
  function zDefaults(D, date) {
    const ids = D.players.map((p) => p.id);
    let seat = store.get("mm_seat", null) || [...D.games].reverse().find((g) => g.o)?.o || ids;
    seat = [...seat.filter((id) => ids.includes(id)), ...ids.filter((id) => !seat.includes(id))];
    const day = D.days.find((d) => d.date === date), dayGames = day ? D.games.filter((g) => g.day === day.n) : [];
    const lastDay = [...D.days].filter((d) => d.date <= date).pop();
    const lg = dayGames[dayGames.length - 1] || (lastDay ? D.games.filter((g) => g.day === lastDay.n).pop() : null);
    const play = lg ? (lg.p || lastDay.p).filter((id) => ids.includes(id)) : ids.slice(0, 5);
    // Kolone = redosled sedenja, počev od onoga ko prvi deli (po pravilu); posle toga sve može ručno
    return { seat, order: rotate(seat.filter((id) => play.includes(id)), zFirstDealer(D, play).id) };
  }
  // Prvi deli pobednik poslednje partije; ako ne igra, pobednik partije pre toga...
  function zFirstDealer(D, play) {
    for (let i = D.games.length - 1; i >= 0; i--) if (play.includes(D.games[i].w)) return { id: D.games[i].w, why: i === D.games.length - 1 ? "pobednik poslednje partije" : `pobednik ranije partije (${esc(pname(D.games[D.games.length - 1].w))} sada ne igra)` };
    return { id: play[0], why: "prvi u redosledu" };
  }
  const bookIdxIn = (D, date, book, gid) => {
    let n = 0;
    for (const d of D.days) { if (d.book !== book) continue; for (const g of D.games) if (g.day === d.n) { n++; if (g.id === gid) return n; } if (d.date === date && gid == null) return n + 1; }
    return n + 1;
  };

  function vZap() {
    ensureDraft();
    const z = zLoad();
    if (z?.cur) { const st = zCalc(z.cur.o, z.cur.hands); return st.end ? vZapEnd(z, st) : vZapHand(z, st); }
    return vZapStart(z);
  }
  const zIntro = () => `<p class="small muted">Vodiš partiju deljenje po deljenje: posle svake ruke tapni ko je završio i upiši zbir karata ostalih. Aplikacija sabira, duplira kod žandara, izbacuje na 201, prepoznaje kraj i upisuje partiju. Sveska može da se vodi paralelno.${liveTopic() ? "" : " <b>Za praćenje uživo upiši ntfy temu u Unos → ⚙️ Podešavanja.</b>"}</p>`;

  function vZapStart(z) {
    const D = S.draft, active = zActiveBleja(z), date = active ? z.date : today();
    const day = D.days.find((d) => d.date === date), dayGames = day ? D.games.filter((g) => g.day === day.n) : [];
    const books = [...new Set(D.days.map((d) => d.book))];
    if (!S.zs || S.zs.date !== date) S.zs = { ...zDefaults(D, date), date, book: (active && z.book) || day?.book || D.days[D.days.length - 1]?.book || "" };
    const zs = S.zs, o = zs.order;
    const fd = zFirstDealer(D, o), n = dayGames.length + 1;
    const manual = dayGames.filter((g) => !g.r).length;
    return `<h2>📝 Zapisnik</h2>${zIntro()}
      <div class="box">
        <div class="spread"><b>Bleja ${fmtDate(date)} · ${n}. partija</b>
          <select id="zBook" aria-label="Sveska">${books.map((b) => `<option ${b === zs.book ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></div>
        <p class="small muted">${esc(zs.book)} #${bookIdxIn(D, date, zs.book, null)}${dayGames.length ? ` · danas već upisano ${dayGames.length}${manual ? ` (ručno ${manual})` : ""}` : ""}</p>
        <p class="small muted">Ko igra:</p>
        <div class="chips">${D.players.map((p) => `<button class="pchip ${o.includes(p.id) ? "on" : ""}" style="--c:${color(p.id)}" data-zp="${p.id}">${esc(p.name)}</button>`).join("")}</div>
        ${o.length ? `<p class="small muted">Kako sede — prevuci ☰ da zameniš mesta:</p>
          <ul class="order" id="zOrder">${o.map((id, i) => `<li data-id="${id}"><span class="drag" aria-label="Prevuci ${esc(pname(id))}">☰</span><span class="grow">${dot(id)}<b>${esc(pname(id))}</b>${i === 0 ? ` <span class="deli">DELI</span>` : ""}</span></li>`).join("")}</ul>
          <p class="small muted">${o[0] === fd.id ? `Prvi deli ${esc(pname(o[0]))} — ${fd.why}.` : `Po pravilu bi prvi delio ${esc(pname(fd.id))}.`}</p>
          <button id="zD0" class="ghost small">Neko drugi deli prvi</button>
          ${S.zD0open ? `<div class="chips">${o.map((id) => `<button class="chip ${id === o[0] ? "on" : ""}" data-zd0="${id}">${esc(pname(id))}</button>`).join("")}</div>` : ""}` : ""}
        <button id="zStart" class="primary" ${o.length >= 2 ? "" : "disabled"}>▶︎ Počni ${n}. partiju</button>
        ${!day && o.length < 3 ? `<p class="small warn hint">Za novu bleju potrebna su najmanje 3 igrača.</p>` : ""}
      </div>
      ${dayGames.length ? `<h3>Partije ove bleje</h3><ol class="list">${dayGames.map((g) => `<li>${dot(g.w)}<b>${esc(pname(g.w))}</b> ${gdesc(g)}${g.h != null ? " " + Stats.hlText(g.h) : ""} <span class="muted small">${g.r ? `📝 ${g.r.length} del.` : "ručno"}</span></li>`).join("")}</ol>
        <button id="zFinish" class="primary ghost">🏁 Završi bleju i obavesti ekipu</button>` : ""}`;
  }

  function vZapHand(z, st) {
    const D = S.draft, cur = z.cur, nh = cur.hands.length + 1;
    const H = S.zh || (S.zh = { w: null, j: false, s: {}, d: null });
    const dealer = H.d && st.active.includes(H.d) ? H.d : zDealer(cur.o, cur.hands, st);
    const others = st.active.filter((id) => id !== H.w);
    const ready = H.w && others.every((id) => H.s[id] !== undefined && H.s[id] !== "");
    const dayGames = (D.days.find((d) => d.date === z.date) ? D.games.filter((g) => g.day === D.days.find((d) => d.date === z.date).n) : []);
    const prev = (id) => { const v = H.s[id]; if (v === undefined || v === "") return `${st.tot[id]}`; const nt = st.tot[id] + (+v) * (H.j ? 2 : 1); return `${st.tot[id]} → ${nt}${nt >= 201 ? " · ispada" : ""}`; };
    return `<div class="zhead"><div><b>Zapisnik · ${dayGames.length + 1}. partija</b><span>${fmtDate(z.date)} · ${esc(z.book)} #${bookIdxIn(D, z.date, z.book, null)} · ruka ${nh}</span></div>${liveTopic() ? `<span class="livebadge">● Uživo za sve</span>` : ""}</div>
      ${sheetHTML(cur.o, cur.hands, { dealer, big: document.body.classList.contains("tablemode") })}
      <div class="row dealrow"><span>🃏 Deli ${nh}. ruku: <b style="color:${color(dealer)}">${esc(pname(dealer))}</b></span><button id="zDch" class="ghost small">Promeni delioca</button></div>
      ${S.zDch ? `<div class="chips">${st.active.map((id) => `<button class="chip ${dealer === id ? "on" : ""}" data-zdl="${id}">${esc(pname(id))}</button>`).join("")}</div>` : ""}
      <div class="box">
        <p class="small muted">Ko je završio ruku?</p>
        <div class="chips">${st.active.map((id) => `<button class="pchip ${H.w === id ? "on" : ""}" style="--c:${color(id)}" data-zw="${id}">${esc(pname(id))}</button>`).join("")}</div>
        ${H.w ? `<label class="chk left"><input type="checkbox" id="zJ" ${H.j ? "checked" : ""}> Završio žandarom (−20, ostalima duplo)</label>
        <p class="small muted">Zbir karata u ruci${H.j ? " — upiši kako jeste, aplikacija duplira" : ""}:</p>
        <div class="zin">${others.map((id) => `<label><span>${dot(id)}${esc(pname(id))}</span><input type="number" inputmode="numeric" min="0" step="1" data-zpts="${id}" value="${H.s[id] ?? ""}" aria-label="Zbir karata ${esc(pname(id))}"><small data-zprev="${id}">${prev(id)}</small></label>`).join("")}</div>` : ""}
        <button id="zAdd" class="primary" ${ready ? "" : "disabled"}>✔︎ Upiši ${nh}. ruku</button>
      </div>
      <div class="row">${cur.hands.length ? `<button id="zUndo" class="ghost">↩︎ Poništi poslednju ruku</button>` : ""}<button id="zFull" class="ghost">⛶ Ceo ekran</button><button id="zAbort" class="ghost">✖ Odbaci partiju</button></div>`;
  }

  function vZapEnd(z, st) {
    const D = S.draft, cur = z.cur, e = st.end, dayGames = (() => { const d = D.days.find((x) => x.date === z.date); return d ? D.games.filter((g) => g.day === d.n) : []; })();
    const h = S.zH === undefined ? e.h : S.zH;
    const inBook = D.games.filter((g) => { const d = D.days.find((x) => x.n === g.day); return d && d.book === z.book && g.w === e.w; }).length + 1;
    const early = cur.o.filter((id) => st.out[id] != null && !e.l.includes(id));
    const admin = !!store.get("mm_admin")?.token;
    return `<div class="zhead"><div><b>Zapisnik · kraj ${dayGames.length + 1}. partije</b><span>${fmtDate(z.date)} · ${esc(z.book)} #${bookIdxIn(D, z.date, z.book, null)} · ${cur.hands.length} ${pl(cur.hands.length, "ruka", "ruke", "ruku")}</span></div></div>
      <div class="wincard" style="--c:${color(e.w)}"><span class="trophy">🏆</span><span class="muted small">Pobednik</span><b>${esc(pname(e.w))}</b><span class="muted small">${inBook}. pobeda u svesci ${esc(z.book)}</span></div>
      <div class="box kv">
        <div><span>Kraj partije</span><b>${e.t === "F" ? `Finale – ${esc(pname(e.l[0]))}` : e.t === "A" ? `Protiv svih – ${names(e.l)}` : `Protiv ${e.t} – ${names(e.l)}`}</b></div>
        <div><span>Istaknuto</span><span class="chips">${e.h === -101 ? `<span class="hl">${Stats.hlText(-101)}</span>` : `
          <button class="chip ${h == null ? "on" : ""}" data-zh="">Ne</button>
          ${e.clutch != null ? `<button class="chip ${h === e.clutch ? "on" : ""}" data-zh="${e.clutch}">⚡ Clutch ${e.clutch}</button>` : ""}
          <button class="chip ${h === "HIO" ? "on" : ""}" data-zh="HIO">⛳ Hole in one</button>`}</span></div>
        ${early.length ? `<div><span>Ispali ranije</span><b>${early.map((id) => `${esc(pname(id))} (${st.out[id] + 1}. ruka)`).join(", ")}</b></div>` : ""}
        <div><span>Konačno</span><span>${[e.w, ...e.l].map((id) => `${esc(pname(id))} ${st.tot[id]}`).join(" · ")}</span></div>
      </div>
      <p class="small muted">Aplikacija je ovo prepoznala sama. Ako nešto nije tačno, poništi poslednju ruku i ispravi je.</p>
      <button id="zSave" class="primary">✔︎ Upiši partiju u rezultate${admin ? " i objavi" : ""}</button>
      ${sheetHTML(cur.o, cur.hands, {})}
      <button id="zUndo" class="primary ghost">↩︎ Poništi poslednju ruku</button>`;
  }

  // Prevlačenje igrača u listi (prst ili miš): ☰ ručka, ostali se razmiču
  function zDrag(ol, zs) {
    $$("li", ol).forEach((li) => {
      const h = $(".drag", li);
      h.onpointerdown = (e) => {
        e.preventDefault();
        const items = $$("li", ol), from = items.indexOf(li), rects = items.map((x) => x.getBoundingClientRect());
        const step = rects[from].height + 6, y0 = e.clientY;
        let to = from;
        li.classList.add("dragging");
        try { h.setPointerCapture(e.pointerId); } catch { }
        h.onpointermove = (ev) => {
          const dy = ev.clientY - y0;
          li.style.transform = `translateY(${dy}px)`;
          const cy = rects[from].top + rects[from].height / 2 + dy;
          to = rects.reduce((n, r, k) => n + (k !== from && cy > r.top + r.height / 2 ? 1 : 0), 0);
          items.forEach((x, k) => { if (x === li) return; const sh = from < to && k > from && k <= to ? -step : from > to && k >= to && k < from ? step : 0; x.style.transform = sh ? `translateY(${sh}px)` : ""; });
        };
        h.onpointerup = h.onpointercancel = () => {
          h.onpointermove = h.onpointerup = h.onpointercancel = null;
          if (to !== from) { const [x] = zs.order.splice(from, 1); zs.order.splice(to, 0, x); zs.manual = true; }
          render();
        };
      };
    });
  }

  function bindZap() {
    const D = S.draft;
    let z = zLoad();
    const zs = S.zs;
    const bk = $("#zBook"); if (bk) bk.onchange = (e) => { zs.book = e.target.value; render(); };
    $$("[data-zp]").forEach((b) => b.onclick = () => {
      const id = b.dataset.zp, i = zs.order.indexOf(id);
      if (zs.manual) { i >= 0 ? zs.order.splice(i, 1) : zs.order.push(id); }
      else { // dok niko ništa nije pomerao: zapamćena mesta, prvi deli po pravilu
        const play = i >= 0 ? zs.order.filter((x) => x !== id) : [...zs.order, id];
        zs.order = play.length ? rotate(zs.seat.filter((x) => play.includes(x)), zFirstDealer(D, play).id) : [];
      }
      render();
    });
    const ol = $("#zOrder"); if (ol) zDrag(ol, zs);
    const zd = $("#zD0"); if (zd) zd.onclick = () => { S.zD0open = !S.zD0open; render(); };
    $$("[data-zd0]").forEach((b) => b.onclick = () => { zs.order = rotate(zs.order, b.dataset.zd0); zs.manual = true; S.zD0open = false; render(); });
    const st0 = $("#zStart"); if (st0) st0.onclick = () => {
      const day = D.days.find((d) => d.date === zs.date), o = [...zs.order];
      if (o.length < 2) return;
      if (!day && o.length < 3) return toast("Za novu bleju potrebna su najmanje 3 igrača (kvorum).");
      // zapamti raspored sedenja (i gde su sedeli oni koji sada ne igraju)
      const seat = [...o, ...zs.seat.filter((id) => !o.includes(id))];
      if (!zActiveBleja(z)) z = { v: 1, date: zs.date, salt: MMCrypto.newSalt() };
      Object.assign(z, { book: zs.book, seat, done: false, cur: { o, hands: [] } });
      S.zh = null; S.zs = null; S.zD0open = false; zSave(z); render(); window.scrollTo(0, 0);
    };
    const fin = $("#zFinish"); if (fin) fin.onclick = async () => {
      if (!(await ask("Završiti bleju? Prikaz uživo se gasi, rezultati se objavljuju i možeš da obavestiš ekipu.", "Završi bleju"))) return;
      const date = zs?.date || z?.date;
      if (z) { z.done = true; z.cur = null; zSave(z); }
      S.zs = null;
      if (store.get("mm_draft")) { const ok = await publish({ quiet: true, date }); if (!ok) return render(); }
      render(); if (S.data.days.some((d) => d.date === date)) shareModal(date, "🏁 Bleja završena — obavesti ekipu");
    };
    if (!z?.cur) return;
    const cur = z.cur, st = zCalc(cur.o, cur.hands), H = S.zh || (S.zh = { w: null, j: false, s: {}, d: null });
    $$("[data-zw]").forEach((b) => b.onclick = () => { H.w = b.dataset.zw; delete H.s[H.w]; render(); const f = $("[data-zpts]"); if (f) f.focus(); });
    const dch = $("#zDch"); if (dch) dch.onclick = () => { S.zDch = !S.zDch; render(); };
    $$("[data-zdl]").forEach((b) => b.onclick = () => { H.d = b.dataset.zdl; S.zDch = false; render(); });
    const zj = $("#zJ"); if (zj) zj.onchange = (e) => { H.j = e.target.checked; render(); };
    const refresh = () => {
      const others = st.active.filter((id) => id !== H.w);
      $$("[data-zprev]").forEach((s) => { const id = s.dataset.zprev, v = H.s[id]; if (v === undefined || v === "") s.textContent = `${st.tot[id]}`; else { const nt = st.tot[id] + (+v) * (H.j ? 2 : 1); s.textContent = `${st.tot[id]} → ${nt}${nt >= 201 ? " · ispada" : ""}`; s.classList.toggle("warn", nt >= 201); } });
      const btn = $("#zAdd"); if (btn) btn.disabled = !(H.w && others.every((id) => H.s[id] !== undefined && H.s[id] !== ""));
    };
    $$("[data-zpts]").forEach((i) => {
      i.oninput = () => { H.s[i.dataset.zpts] = i.value === "" ? "" : Math.max(0, Math.round(+i.value) || 0); refresh(); };
      i.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); const all = $$("[data-zpts]"); const n = all[all.indexOf(i) + 1]; if (n) n.focus(); else $("#zAdd")?.click(); } };
    });
    refresh();
    const add = $("#zAdd"); if (add) add.onclick = () => {
      if (add.disabled) return;
      const s = {}; st.active.filter((id) => id !== H.w).forEach((id) => s[id] = +H.s[id] || 0);
      const d = H.d && st.active.includes(H.d) ? H.d : zDealer(cur.o, cur.hands, st);
      cur.hands.push({ w: H.w, j: !!H.j, d, s }); S.zh = null; S.zDch = false; S.zH = undefined; zSave(z); render(); window.scrollTo(0, 0);
    };
    const un = $("#zUndo"); if (un) un.onclick = () => { const p = cur.hands.pop(); S.zh = p ? { w: p.w, j: p.j, s: { ...p.s }, d: p.d } : null; S.zH = undefined; zSave(z); render(); };
    const ab = $("#zAbort"); if (ab) ab.onclick = async () => { if (!(await ask("Odbaciti ovu partiju (sve upisane ruke)?", "Odbaci partiju"))) return; z.cur = null; S.zh = null; zSave(z); render(); };
    const fu = $("#zFull"); if (fu) fu.onclick = tableMode;
    $$("[data-zh]").forEach((b) => b.onclick = () => { const v = b.dataset.zh; S.zH = v === "" ? null : v === "HIO" ? "HIO" : +v; render(); });
    const sv = $("#zSave"); if (sv) sv.onclick = async () => {
      const e = st.end; if (!e) return;
      const h = S.zH === undefined ? e.h : S.zH;
      putGame(D, { date: z.date, book: z.book, gp: [...cur.o], w: e.w, t: e.t, l: [...e.l], h }, null);
      const g = D.games.reduce((a, b) => b.id > a.id ? b : a);
      g.o = [...cur.o]; g.r = cur.hands.map(packHand);
      saveDraft(); z.cur = null; z.last = { o: g.o, r: g.r }; S.zH = undefined; S.zs = null; zSave(z);
      toast(`Upisano: ${pname(e.w)} pobedio`); render(); window.scrollTo(0, 0);
      if (store.get("mm_admin")?.token) publish({ quiet: true, date: z.date });
    };
  }

  // Ceo ekran (za tablet na stolu)
  function tableMode() {
    const on = !document.body.classList.contains("tablemode");
    document.body.classList.toggle("tablemode", on);
    try { if (on) document.documentElement.requestFullscreen?.().catch(() => { }); else if (document.fullscreenElement) document.exitFullscreen(); } catch { }
    render();
  }
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && document.body.classList.contains("tablemode")) { document.body.classList.remove("tablemode"); render(); } });

  // ---------- 🔴 Uživo ----------
  let liveT = null;
  function pushLive(z) {
    const topic = liveTopic(); if (!topic || !S.password || !z?.salt) return;
    clearTimeout(liveT);
    liveT = setTimeout(async () => {
      try {
        const D = S.draft || S.data, day = D.days.find((d) => d.date === z.date);
        const games = day ? D.games.filter((g) => g.day === day.n).map((g) => ({ w: g.w, t: g.t, l: g.l, h: g.h ?? null })) : [];
        const st = { v: 1, at: Date.now(), date: z.date, book: z.book, fin: !!z.done, games, cur: z.cur ? { o: z.cur.o, r: z.cur.hands.map(packHand) } : null, last: z.cur ? null : z.last || null };
        let body = JSON.stringify(await MMCrypto.encrypt(st, S.password, 250000, z.salt));
        if (body.length > 3900) { st.last = null; body = JSON.stringify(await MMCrypto.encrypt(st, S.password, 250000, z.salt)); }
        if (body.length > 3900) return;
        await fetch("https://ntfy.sh/" + encodeURIComponent(topic), { method: "POST", body });
      } catch { }
    }, 300);
  }
  const liveFresh = (st) => st && !st.fin && Date.now() - (st.at || 0) < 8 * 3600 * 1000;
  async function liveHandle(m) {
    if (!m || m.event !== "message" || !S.password) return;
    try { const st = await MMCrypto.decrypt(JSON.parse(m.message), S.password); if (st?.v === 1 && (!S.live || st.at >= S.live.at)) setLive(st); } catch { }
  }
  async function startLive() {
    const topic = liveTopic(); if (!topic || !S.password) return;
    if (S.es && S.es.readyState !== 2) return;
    try {
      const txt = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}/json?poll=1&since=10h`).then((r) => r.text());
      const ms = txt.trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((m) => m?.event === "message");
      if (ms.length) await liveHandle(ms[ms.length - 1]);
    } catch { }
    try { S.es = new EventSource(`https://ntfy.sh/${encodeURIComponent(topic)}/sse`); S.es.onmessage = (e) => { try { liveHandle(JSON.parse(e.data)); } catch { } }; } catch { }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.data && (!S.es || S.es.readyState === 2)) { S.es = null; startLive(); } });
  function setLive(st) {
    S.live = st;
    liveBar();
    if (S.view === "live") render();
  }
  function liveBar() {
    const b = $("#liveBar"), st = S.live; if (!b) return;
    const mine = zLoad(), own = zActiveBleja(mine) && mine.date === st?.date; // telefon koji vodi zapisnik ne treba traku
    const show = liveFresh(st) && !own && S.view !== "live";
    b.classList.toggle("hidden", !show);
    if (show) b.innerHTML = `<span class="dotlive"></span><span><b>Uživo</b> · ${fmtDate(st.date)} · ${st.cur ? `${st.games.length + 1}. partija, ruka ${st.cur.r.length + 1}` : `${st.games.length} ${pl(st.games.length, "partija", "partije", "partija")} odigrano`}</span><b>Gledaj ›</b>`;
  }
  function vLive() {
    const st = S.live;
    if (!st) return `<h2>🔴 Uživo</h2><p class="empty">Trenutno se ne vodi nijedna bleja.</p>`;
    const wc = winCount(st.games), ids = [...new Set([...(st.cur?.o || []), ...st.games.flatMap((g) => [g.w, ...g.l])])].sort((a, b) => (wc[b] || 0) - (wc[a] || 0));
    const t = new Date(st.at), hm = `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`;
    const cur = st.cur ? { o: st.cur.o, hands: st.cur.r.map(unpackHand) } : null;
    const curSt = cur ? zCalc(cur.o, cur.hands) : null;
    const last = !cur && st.last ? { o: st.last.o, hands: st.last.r.map(unpackHand) } : null;
    return `<div class="ptitle"><button class="back" id="liveBack" aria-label="Nazad">‹</button><div><h2>🔴 Bleja uživo · ${fmtDate(st.date)}</h2><p class="muted small">${esc(st.book || "")} · poslednja izmena u ${hm}${st.fin ? " · bleja završena" : ""}</p></div></div>
      ${ids.length ? `<div class="tags">${ids.map((id) => `<span class="wtag ${wc[id] ? "" : "zero"}" style="--c:${color(id)}">${esc(pname(id))} ${wc[id] || 0}</span>`).join("")}</div>` : ""}
      ${cur ? `<h3>${st.games.length + 1}. partija · ruka ${cur.hands.length + 1}</h3>${sheetHTML(cur.o, cur.hands, { dealer: curSt.end ? null : zDealer(cur.o, cur.hands, curSt), big: document.body.classList.contains("tablemode") })}`
        : last ? `<h3>Poslednja partija</h3>${sheetHTML(last.o, last.hands, { big: document.body.classList.contains("tablemode") })}` : `<p class="muted">Čeka se sledeća partija…</p>`}
      <div class="row"><button id="liveFull" class="ghost">⛶ Ceo ekran</button></div>
      ${st.games.length ? `<h3>Odigrane partije</h3><ol class="list">${st.games.map((g) => `<li>${dot(g.w)}<b>${esc(pname(g.w))}</b> ${gdesc(g)}${g.h != null ? " " + Stats.hlText(g.h) : ""}</li>`).join("")}</ol>` : ""}`;
  }
  bind.live = () => {
    $("#liveBack").onclick = () => { S.view = S.prevView || "tabela"; $$("#nav button").forEach((x) => x.classList.toggle("on", x.dataset.v === S.view)); render(); };
    $("#liveFull").onclick = tableMode;
  };

  function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }

  async function publish(opt = {}) {
    const cfg = store.get("mm_admin");
    if (!cfg?.token || !cfg.owner || !cfg.repo) { toast("Prvo unesi GitHub podešavanja (Unos → ⚙️)."); return false; }
    const newPw = opt.quiet ? "" : ($("#newPw")?.value || "").trim();
    const pw = newPw || S.password;
    if (!pw) { toast("Nema lozinke ekipe — uloguj se ponovo."); return false; }
    const btn = opt.quiet ? null : $("#saveGh");
    if (btn) { btn.disabled = true; btn.textContent = "Objavljujem…"; } else toast("Objavljujem…", 10000);
    try {
      S.draft.updated = new Date().toISOString(); delete S.draft.__base;
      const box = await MMCrypto.encrypt(S.draft, pw);
      const api = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_ENC}`;
      const H = { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" };
      const cur = await fetch(`${api}?ref=${cfg.branch}&t=${Date.now()}`, { headers: H, cache: "no-store" });
      let sha;
      if (cur.ok) {
        const j = await cur.json(); sha = j.sha;
        // Zaštita kad unosi više admina: ako je neko drugi u međuvremenu objavio, ne pregazi njegove izmene
        try {
          const remote = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, "")))));
          if (S.box && remote.ct && remote.ct.slice(0, 40) !== baseId()) throw new Error("CONFLICT");
        } catch (e) { if (e.message === "CONFLICT") throw new Error("neko je u međuvremenu objavio nove rezultate. Zapamti svoj unos, tapni „Odbaci izmene“, osveži aplikaciju i unesi ponovo."); }
      }
      const pubDate = opt.date || S.edit?.date || "";
      const body = { message: `Unos: ${pubDate}`, branch: cfg.branch, content: MMCrypto.b64(new TextEncoder().encode(JSON.stringify(box))), sha };
      const r = await fetch(api, { method: "PUT", headers: H, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).message || r.status);
      setData(S.draft); S.box = box; S.password = pw; if (newPw && store.get("mm_pw")) store.set("mm_pw", newPw);
      store.del("mm_draft"); S.draft = null; S.dirty = false; fillFilters();
      render();
      if (opt.quiet) toast("✅ Objavljeno — igrači vide za ~1 min.", 3500);
      else if (pubDate && S.data.days.some((d) => d.date === pubDate)) shareModal(pubDate, "✅ Objavljeno — obavesti ekipu");
      else toast("✅ Objavljeno. Igrači vide izmene za ~1 min.", 4000);
      return true;
    } catch (e) {
      toast("Greška: " + e.message + (opt.quiet ? " Rezultat je sačuvan na telefonu — objavi kasnije (Unos rezultata → Sačuvaj i objavi)." : ""), 7000);
      if (btn) { btn.disabled = false; btn.textContent = "☁️ Sačuvaj i objavi"; }
      return false;
    }
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
  boot();
})();
