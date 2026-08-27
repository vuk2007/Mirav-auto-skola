# Kako se unose i mijenjaju kazne

Ovo uputstvo je za osobu koja unosi kazne, ne za programera. Treba vam pristup
podešavanjima projekta na Vercelu i računar sa browserom.

Zakon se mijenja. Kad se promijeni, ovo je postupak — ne treba zvati programera.

---

## Ukratko

1. Uključite editor na Vercelu (dva podešavanja).
2. Uđete na `mirav.me/admin/kazne` sa lozinkom.
3. Prođete kroz pitanja i za svako kažete koja kazna mu pripada.
4. Kliknete **Preuzmi fajlove** i pošaljete ta dva fajla.
5. Kad je gotovo — isključite editor, uključite prikaz kazni.

Rad se čuva sam, u browseru, poslije svake radnje. Možete zatvoriti prozor i
nastaviti sjutra **na istom računaru i u istom browseru**.

---

## 1. Uključivanje editora

Na [vercel.com](https://vercel.com) → projekat **mirav** → **Settings** →
**Environment Variables**. Treba da postoje ove tri:

| Ime | Vrijednost | Čemu služi |
| --- | ---------- | ---------- |
| `NEXT_PUBLIC_ADMIN_ENABLED` | `true` | otvara editor |
| `ADMIN_PASSWORD` | lozinka koju sami izaberete | prijava u editor |
| `NEXT_PUBLIC_KAZNE_ENABLED` | `false` dok traje unos | prikaz kazni polaznicima |

Poslije svake izmjene ovih vrijednosti idite na **Deployments** → najnoviji →
**Redeploy**. Bez toga promjena ne važi — vrijednosti se ugrađuju u sajt kad se
pravi, ne kad se otvara.

> **Lozinku ne dijelite i ne šaljite porukom.** Ko je ima, može mijenjati kazne.

---

## 2. Ulazak

Otvorite **mirav.me/admin/kazne** i upišite lozinku.

Ako dobijete stranicu „404" — `NEXT_PUBLIC_ADMIN_ENABLED` nije `true`, ili
poslije izmjene nije urađen Redeploy.

Prijava traje osam sati. Poslije toga se ponovo traži lozinka.

**Prvi put:** otvorite karticu **Kazne** i gore upišite svoje ime. Ono se
automatski upisuje uz svaku kaznu koju potvrdite, pa se kasnije zna ko je šta
provjerio.

---

## 3. Unos

Prikazuje se jedno pitanje po ekranu, sa slikom i **zeleno označenim tačnim
odgovorom**. Ispod su tri mogućnosti:

### „Nema kazne za ovo pitanje" — veliko crno dugme

Za pitanja koja ne opisuju prekršaj: definicije, prva pomoć, značenje znakova.
**Ovo je najčešći odgovor.** Jedan klik i odmah se prelazi na sljedeće pitanje,
bez ikakve dodatne potvrde.

Prečica: **razmaknica** radi isto.

### „Izaberi postojeću kaznu"

Polje za pretragu i spisak. Kucajte dio naziva ili kategoriju. Kad kliknete na
kaznu, ona se veže za pitanje i ide se dalje.

**Ovo koristite kad god možete.** Dvadeset pitanja o brzini treba da pokazuje na
**istu** kaznu — tako, kad se iznos promijeni, dovoljno ga je ispraviti jednom i
mijenja se na svih dvadeset.

### „Napravi novu kaznu"

Tek kad takve kazne stvarno nema u spisku.

Dok kucate naslov, ispod se javljaju slične postojeće kazne uz pitanje „da li
ste mislili na neku od ovih?". Ako jeste — zatvorite formu i izaberite je iz
spiska; nemojte unositi istu kaznu dvaput.

Dugme **„Potvrdi"** je zaključano dok ne upišete:

- **član zakona** (npr. `čl. 318 st. 1 tač. 3`),
- **izvor** (npr. `Sl. list CG 111/2026`),
- i bar jednu sankciju — iznos, kazneni poeni ili zabrana upravljanja.

Bez člana se kazna ne može provjeriti, pa se ne može ni potvrditi.

**Fiksan iznos** — upišite isti broj u „od" i „do".

### Ostala dugmad

- **Preskoči** — pitanje ostaje nepregledano, vratite mu se kasnije.
- **← Nazad** — prethodno pitanje.
- **Strelice ← →** na tastaturi rade isto.

### Kartica „Pitanja"

Spisak svih 421, sa stanjem svakog: *nepregledano*, *bez kazne*, ili naziv
kazne. Filter po stanju. Klik na red vodi pravo na to pitanje.

Gore stalno piše dokle ste stigli: `pregledano 87 / 421 · sa kaznom 23 · bez
kazne 64`.

### Kartica „Kazne"

Spisak svih kazni. Uz svaku piše **koliko pitanja je koristi**. Klik otvara
izmjenu — a izmjena mijenja **sva** ta pitanja odjednom.

Kazna koju ne koristi nijedno pitanje je označena; obično je to duplikat.

---

## 4. Čuvanje i slanje

Gore desno piše **„sačuvano u 14:32"**. To znači da je rad zapamćen u ovom
browseru, na ovom računaru.

> **To nije dovoljno.** Brisanje istorije pregledanja ili drugi računar znače
> izgubljen rad. Zato na kraju svakog sjedanja kliknite **„Preuzmi fajlove"**.

Skinuće se dva fajla:

- `kazne.json` — spisak kazni,
- `pitanje-kazna.json` — koje pitanje ima koju kaznu.

**Oba pošaljite** osobi koja održava sajt. Ako ih ne pošaljete, ne vide se
nigdje osim na vašem računaru.

Prije preuzimanja se javljaju upozorenja ako nešto izgleda pogrešno — kazna bez
člana, iznos preko 5.000 €, kazna koju ne koristi nijedno pitanje. Ona ne
blokiraju preuzimanje, samo skreću pažnju.

**Nastavak drugi dan ili na drugom računaru:** kliknite **„Učitaj fajlove"** i
izaberite oba fajla koja ste ranije preuzeli.

---

## 5. Kad je unos gotov

Javite da su fajlovi spremni. Onaj ko održava sajt ih ubacuje u projekat, pa se
na Vercelu mijenjaju dva podešavanja:

```
NEXT_PUBLIC_ADMIN_ENABLED = false     zatvara editor
NEXT_PUBLIC_KAZNE_ENABLED = true      pali prikaz kazni polaznicima
```

pa **Redeploy**.

Od tada polaznici vide kaznu uz pitanje — u vježbi poslije odgovora i u pregledu
grešaka poslije simulacije. **Tokom same simulacije se ne prikazuje ništa**, kao
ni na pravom ispitu. Uz to se pravi i stranica `mirav.me/kazne` sa spiskom.

**Vide se samo potvrđene kazne.** Nepotvrđena nigdje ne postoji za polaznika —
ni na ekranu, ni u podacima koje njegov browser preuzme.

---

## 6. Kad se zakon promijeni

Isti postupak, samo kraći:

1. Uključite editor (korak 1) i uđite (korak 2).
2. Kartica **Kazne** → nađite kaznu → kliknite je → ispravite iznos → **Potvrdi**.
   Time se mijenjaju **sva pitanja** koja je koriste.
3. **Preuzmi fajlove** i pošaljite ih.
4. Isključite editor.

Pitanja ne treba ponovo prolaziti — veza pitanje → kazna ostaje.

---

## Ako nešto ne radi

| Šta se vidi | Šta je | Šta uraditi |
| ----------- | ------ | ----------- |
| „404" na `/admin/kazne` | editor je isključen | `NEXT_PUBLIC_ADMIN_ENABLED=true` pa Redeploy |
| „Na serveru nije postavljen ADMIN_PASSWORD" | nema lozinke | postavite `ADMIN_PASSWORD` pa Redeploy |
| „Pogrešna lozinka" | lozinka se ne poklapa | provjerite razmak na kraju vrijednosti na Vercelu |
| Rad je nestao | drugi browser ili obrisana istorija | **Učitaj fajlove** i izaberite zadnje preuzete |
| Kazna se ne vidi polaznicima | nije potvrđena, ili je prikaz isključen | kartica **Kazne** → status; pa `NEXT_PUBLIC_KAZNE_ENABLED=true` |
| Stranica `/kazne` je 404 | nema nijedne potvrđene kazne | potvrdite bar jednu |
