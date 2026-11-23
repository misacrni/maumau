#!/usr/bin/env python3
"""Pretvara Mau-Mau Excel (sheet 'unos' + 'H2H') u data.json za aplikaciju.

Upotreba:
  python3 convert.py MauMau.xlsx data.json
  python3 convert.py --text unos.txt h2h.txt data.json   (tab-separated dump, fallback)
"""
import sys, json, re, datetime as dt

PLAYERS = [  # kod, ime, slovo u H2H zaglavljima
    ("S", "Šomi", "Š"), ("M", "Mićko", "M"), ("N", "Nikod", "N"),
    ("L", "Lešma", "L"), ("U", "Ugar", "U"),
]
LET = {p[2]: p[0] for p in PLAYERS}
UNOS_COL = {"L": "Maleš"}  # u listu 'unos' kolona se zove Maleš
PLY_COLS = {"S": "Šomi PLY", "M": "Mićko PLY", "N": "Nikod PLY", "L": "Lešma PLY", "U": "Ugar PLY"}

def norm_date(v):
    if isinstance(v, (dt.date, dt.datetime)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", s)
    if m:
        return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}"
    MES = ["januar","februar","mart","april","maj","jun","jul","avgust","septembar","oktobar","novembar","decembar"]
    m = re.search(r"(\d{1,2})\.\s*([a-zčćšžđ]+)\s+(\d{4})", s.lower())
    if m and m[2] in MES:
        return f"{m[3]}-{MES.index(m[2])+1:02d}-{int(m[1]):02d}"
    raise ValueError(f"Nepoznat datum: {v!r}")

def rows_from_xlsx(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    def sheet(name, must):
        rows = list(wb[name].iter_rows(values_only=True))
        hi = next(i for i, r in enumerate(rows[:10]) if must in [str(v).strip() for v in r if v is not None])
        hdr = [str(h).strip() if h is not None else "" for h in rows[hi]]
        out = []
        for r in rows[hi + 1:]:
            if r is None or all(v in (None, "") for v in r):
                continue
            out.append({hdr[i]: r[i] for i in range(min(len(hdr), len(r))) if hdr[i]})
        return out
    return sheet("unos", "Game day"), sheet("H2H", "Kontrolna suma")

def rows_from_text(path, header_line_startswith):
    lines = open(path, encoding="utf-8").read().split("\n")
    i = next(k for k, l in enumerate(lines) if l.startswith(header_line_startswith))
    hdr = [h.strip() for h in lines[i].split("\t")]
    out = []
    for l in lines[i + 1:]:
        if not l.strip() or l.startswith("Formulas") or l.startswith("[") or l.startswith("##"):
            if l.startswith("Formulas") or l.startswith("##"):
                break
            continue
        c = l.split("\t")
        out.append({hdr[k]: (c[k] if k < len(c) else "") for k in range(len(hdr)) if hdr[k]})
    return out

def truthy(v):
    if v in (None, ""):
        return False
    try:
        return float(v) != 0
    except (TypeError, ValueError):
        return str(v).upper() == "TRUE"

def build(unos, h2h):
    days = {}
    for r in unos:
        if r.get("Game day") in (None, ""):
            continue
        if not isinstance(r.get("Date"), (dt.date, dt.datetime)) and not re.search(r"\d{4}", str(r.get("Date"))):
            continue  # red sa ukupnim zbirom
        n = int(float(r["Game day"]))
        played = [code for code, name, _ in PLAYERS if r.get(UNOS_COL.get(code, name)) not in (None, "")]
        days[n] = {"n": n, "date": norm_date(r["Date"]), "book": str(r.get("Sveska") or "").strip(),
                   "bookDay": int(float(r.get("Sveska Game Day") or 0)), "p": played}
    games, problems = [], []
    for r in h2h:
        if not isinstance(r.get("RB kola"), (int, float)) and not str(r.get("RB kola") or "").isdigit():
            if str(r.get("RB kola") or "").strip():
                break  # kraj tabele (ispod je pomoćna tabela "Highlight")
            continue
        if r.get("Global ID") in (None, ""):
            continue  # red sa zbirom
        n = int(float(r["RB kola"]))
        day = days.get(n)
        w, l, t = None, [], None
        for k, v in r.items():
            if not truthy(v):
                continue
            k = k.strip()
            if re.fullmatch(r"[ŠMNLU]{2}", k):
                w, l, t = LET[k[0]], [LET[k[1]]], "F"
            elif re.fullmatch(r"[ŠMNLU]-[ŠMNLU]&[ŠMNLU]", k):
                w, l, t = LET[k[0]], [LET[k[2]], LET[k[4]]], "2"
            elif re.fullmatch(r"[ŠMNLU]-ALL", k):
                w, l, t = LET[k[0]], None, "A"  # svi ostali
        if day is None:
            problems.append(f"Partija {r.get('Global ID')}: nema kola {n} u 'unos'")
            continue
        p = day["p"] if day["p"] else [c for c, col in PLY_COLS.items() if truthy(r.get(col))]
        if w is None:
            problems.append(f"Partija {r.get('Global ID')} ({day['date']}): nije upisan pobednik/finale")
            continue
        if l is None:
            gp = [c for c, col in PLY_COLS.items() if truthy(r.get(col))] or p
            l = [x for x in gp if x != w]
        g = {"id": int(float(r.get("Global ID") or len(games) + 1)), "day": n, "w": w, "l": l, "t": t}
        gp = [c for c, col in PLY_COLS.items() if truthy(r.get(col))]
        if gp and sorted(gp) != sorted(day["p"]):
            g["p"] = gp  # u ovoj partiji nisu igrali svi iz večeri
        if r.get("Highlight W") not in (None, ""):
            hv = r["Highlight W"]
            g["h"] = int(hv) if isinstance(hv, (int, float)) else str(hv).strip()
        games.append(g)
    # provera: pobede po danu iz 'unos' == broj partija iz H2H
    return {
        "version": 1,
        "players": [{"id": c, "name": nm} for c, nm, _ in PLAYERS],
        "days": [days[k] for k in sorted(days)],
        "games": games,
    }, problems

def check(data, unos):
    by = {}
    for g in data["games"]:
        by.setdefault(g["day"], {}).setdefault(g["w"], 0)
        by[g["day"]][g["w"]] += 1
    diffs = []
    for r in unos:
        if r.get("Game day") in (None, ""):
            continue
        if not isinstance(r.get("Date"), (dt.date, dt.datetime)):
            continue
        n = int(float(r["Game day"]))
        if n not in by:
            continue
        for c, nm, _ in PLAYERS:
            a = int(float(r.get(UNOS_COL.get(c, nm)) or 0)); b = by[n].get(c, 0)
            if a != b:
                diffs.append(f"Kolo {n}: {nm} unos={a} H2H={b}")
    return diffs

# Ispravke potvrđene sa adminom (23.11.2026)
DATE_FIX = {92: "2019-03-20"}   # kolo 92: greška u mesecu
MERGE_DAYS = [(318, 319)]       # isto veče uneto kao dva kola (igrači menjani u toku večeri)

def apply_fixes(data):
    days = {d["n"]: d for d in data["days"]}
    for n, dte in DATE_FIX.items():
        if n in days: days[n]["date"] = dte
    for keep, drop in MERGE_DAYS:
        a, b = days.get(keep), days.get(drop)
        if not a or not b or a["date"] != b["date"]:
            continue
        union = [c for c, _, _ in PLAYERS if c in a["p"] or c in b["p"]]
        for g in data["games"]:
            if g["day"] in (keep, drop):
                src = a if g["day"] == keep else b
                g.setdefault("p", list(src["p"]))
                g["day"] = keep
                if sorted(g["p"]) == sorted(union):
                    del g["p"]
        a["p"] = union
        data["days"] = [d for d in data["days"] if d["n"] != drop]
    data["days"].sort(key=lambda d: (d["date"], d["n"]))
    return data

if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "--text":
        unos = rows_from_text(a[1], "Game day\t"); h2h = rows_from_text(a[2], "Kontrolna suma\t"); out = a[3]
    else:
        unos, h2h = rows_from_xlsx(a[0]); out = a[1]
    data, problems = build(unos, h2h)
    problems += check(data, unos)
    data = apply_fixes(data)
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"Kola: {len(data['days'])}, partije: {len(data['games'])}")
    for p in problems[:50]:
        print("!", p)
    print(f"Ukupno upozorenja: {len(problems)}")
