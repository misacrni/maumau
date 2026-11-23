# Mau Mau — Bleja od 2017.

Statistika naše Mau Mau ekipe: tabela, finala 1 na 1 (H2H), pregledi (pivoti), nizovi i istorija svih večeri.
Radi kao aplikacija na telefonu (PWA): otvori link u Safari/Chrome → **Dodaj na početni ekran**.

## Kako radi
- Sajt je statičan (GitHub Pages). Podaci su u `data/data.enc.json`, **šifrovani lozinkom ekipe** (AES-256-GCM),
  pa bez lozinke niko ne može da ih pročita, iako je repozitorijum javan.
- Igrači samo gledaju. **Unos** ima samo admin: aplikacija čuva izmene preko GitHub API-ja tokenom koji postoji samo na adminovom telefonu.

## Admin — prvi put
1. Napravi GitHub token: *Settings → Developer settings → Fine-grained tokens → Generate new token*
   - Repository access: **Only select repositories → maumau**
   - Permissions → Repository → **Contents: Read and write**
2. Otvori aplikaciju sa `#admin` na kraju linka (npr. `https://<nalog>.github.io/maumau/#admin`), uloguj se lozinkom ekipe.
3. **Unos → ⚙️ Podešavanja**: vlasnik, repo, grana `main`, token → *Sačuvaj podešavanja*.

## Unos večeri
Unos → datum, sveska, ko je došao → za svaku partiju: pobednik + kako je završeno (finale protiv koga / protiv 2 / protiv svih)
→ **Sačuvaj i objavi**. Igrači vide izmene za ~1 minut. Nesačuvan unos ostaje na telefonu i ako se aplikacija zatvori.

## Novi igrač
Unos → ⚙️ Podešavanja → *Dodaj igrača* → Sačuvaj i objavi. Novom igraču pošalji link i lozinku ekipe.

## Promena lozinke ekipe
Unos → ⚙️ Podešavanja → *Nova lozinka ekipe* → Sačuvaj i objavi. Svi ostali se uloguju novom lozinkom.

## Ponovni uvoz iz Excela (alat za admina)
```
python3 tools/convert.py MAU-MAU.xlsx data.json      # čita listove 'unos' i 'H2H', proverava da se slažu
python3 tools/encrypt.py data.json data/data.enc.json "lozinka"
```
`data.json` (nešifrovan) se nikad ne stavlja u repo (vidi `.gitignore`).
