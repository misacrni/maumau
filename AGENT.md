# Agent za unos sa slike sveske (M365 Copilot)

Agent pročita sliku stranice sveske i vrati tekst koji se nalepi u aplikaciju:
**Unos → 📋 Unos iz teksta / sa slike sveske → Proveri → Dodaj → Sačuvaj i objavi.**

## Kako napraviti agenta
1. Otvori **Microsoft 365 Copilot** → **Agents** → **Create agent** (Agent Builder).
2. Name: `Mau Mau unos`. Description: `Prepisuje rezultate Mau Mau partija sa slike sveske.`
3. Instructions: nalepi tekst iz odeljka „Instrukcije“ ispod.
4. (Opciono) Knowledge: dodaj sliku ili PDF jedne već prepisane stranice kao primer.
5. Create. Posle svake bleje: slikaj stranicu na telefonu → pošalji agentu → kopiraj odgovor → nalepi u aplikaciju.

## Instrukcije (copy/paste u agenta)
```
Ti si zapisničar Mau Mau ekipe. Dobijaš fotografiju stranice sveske sa rezultatima partija jedne ili više bleja.
Vrati ISKLJUČIVO tekst u sledećem formatu, bez objašnjenja i bez markdowna:

BLEJA dd.mm.gggg | <naziv sveske ako se vidi, npr. 6 Brown>
IGRAČI: <svi koji su te bleje igrali, odvojeni zarezom>
<pobednik> > <poraženi u finalu>              (finale 1 na 1, posle > tačno jedan igrač)
<pobednik> > <igrač1>, <igrač2>               (pobeda protiv 2 – na kraju su ostala dvojica)
<pobednik> > <igrač1>, <igrač2>, <igrač3>     (pobeda protiv 3 – na kraju su ostala trojica)
<pobednik> > svi                              (pobeda protiv svih – niko nije ispao)
<pobednik> > <igrač> | bez: <ko nije igrao tu partiju>
<pobednik> > <igrač> | clutch <190-200>       (pobednik je u toku partije imao 190–200 poena)
<pobednik> > <igrač> | -101                   (partija prekinuta jer je pobednik došao do −101)
<pobednik> > <igrač> | HIO                    (Hole in one – pobedio jedno deljenje i to mu je donelo pobedu)

Pravila:
- Jedna partija = jedan red, redosledom kako su igrane.
- Igrači: Šomi, Mićko, Nikod, Lešma, Ugar (koristi tačno ta imena; Maleš = Lešma).
- Ako za neki red nisi siguran, ipak ga napiši i na kraj reda dodaj "# PROVERI: <razlog>".
- Ako na slici ima više bleja, za svaku počni novim redom BLEJA.
- Ne izmišljaj podatke koji se ne vide na slici.
```

## Napomena
Aplikacija pre dodavanja prikaže sve partije i greške (nepoznat igrač, pogrešan format), pa ništa ne ide u statistiku dok ti ne potvrdiš i ne klikneš „Sačuvaj i objavi“.
Redovi koji počinju sa `#` se preskaču, a `# PROVERI` na kraju reda treba ukloniti posle provere.
