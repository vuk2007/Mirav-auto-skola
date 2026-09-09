# Ivice grafa: sta OSM kaze

Napravljeno: 2026-09-09T09:49:20.995Z

Ukupno ivica: 54. Slaze se sa grafom: 43. Za provjeru: 11.

Skripta NE mijenja graf. Ovo je spisak mjesta na kojima se stvarna mreza puteva
i unijeta kilometraza ne poklapaju, da ih neko pogleda.

## Za provjeru

| ivica | graf [km] | OSM [km] | odnos | oznake puta | lijepljenje a/b [m] | sta je |
| --- | --- | --- | --- | --- | --- | --- |
| `matesevo--andrijevica` | 30 | 39.9 | 1.33 | R-13, R-19, R-2 | 2341 / 193 | duzina odstupa vise od 25% |
| `pljevlja--rance-jabuka` | 20 | 27.1 | 1.35 | R-3, R-4, 192 | 876 / 4551 | duzina odstupa vise od 25% |
| `pljevlja--bijelo-polje` | 60 | 77.6 | 1.29 | M-6, 29, 23, M-2 | 762 / 221 | duzina odstupa vise od 25% |
| `rozaje--dracenovac` | 20 | 39.0 | 1.95 | M-5, 22, 203, 202 | 37 / 549 | ruta ide sasvim druguda |
| `rozaje--kula` | 25 | 15.8 | 0.63 | M-5 | 37 / 2681 | duzina odstupa vise od 25% |
| `zabljak--savnik` | 40 | 24.6 | 0.62 | M-6 | 381 / 715 | duzina odstupa vise od 25% |
| `ulcinj--sukobin` | 20 | 10.7 | 0.53 | M-1 | 501 / 265 | duzina odstupa vise od 25% |
| `bar--sutomore` | 10 | 7.5 | 0.75 | M-1 | 230 / 1337 | duzina odstupa vise od 25% |
| `kotor--kamenari` | 30 | 13.5 | 0.45 | M-1, M-11 | 23 / 170 | duzina odstupa vise od 25% |
| `tivat--kamenari` | 8 | 3.8 | 0.47 | M-11 | 114 / 170 | duzina odstupa vise od 25% |
| `herceg-novi--debeli-brijeg` | 8 | 11.1 | 1.39 | M-1, D8 | 566 / 2087 | duzina odstupa vise od 25% |

## Koordinate cvorova koje treba provjeriti

Sve koordinate u `roadGraph.ts` su procjena (`coordsVerified: false`). Ovdje su
cvorovi kod kojih je najblizi put dalje od 1000 m — to obicno znaci da
koordinata nije tacna, a ne da puta nema. Prijedlog je tacka na koju se cvor
prilijepio; nista nije upisano u graf.

| cvor | vrsta | u grafu | najblizi put [m] | prijedlog |
| --- | --- | --- | --- | --- |
| Smokovac | cvoriste | 42.49, 19.29 | 1352 | 42.4848, 19.3049 |
| Mateševo | cvoriste | 42.72, 19.55 | 2990 | 42.7437, 19.5327 |
| Petrovac | cvoriste | 42.2, 18.94 | 1014 | 42.2049, 18.9504 |
| Njeguši | cvoriste | 42.42, 18.83 | 1062 | 42.4281, 18.8232 |
| Kučka Korita | cvoriste | 42.55, 19.47 | 1189 | 42.5554, 19.4575 |
| Božaj | granica | 42.3, 19.38 | 1030 | 42.3086, 19.3753 |
| Debeli Brijeg | granica | 42.51, 18.44 | 1146 | 42.5091, 18.4261 |
| Ilino Brdo | granica | 42.79, 18.55 | 2525 | 42.7718, 18.5316 |
| Dobrakovo | granica | 43.19, 19.79 | 1710 | 43.1926, 19.7693 |
| Kula | granica | 42.87, 20.33 | 2681 | 42.8849, 20.3042 |
| Ranče/Jabuka | granica | 43.5, 19.36 | 4528 | 43.4952, 19.4156 |

## Cvorovi koji se rasipaju

Isti cvor je na razlicitim ivicama zavrsio na razlicitim mjestima, udaljenim
vise od 400 m. To znaci da je koordinata dvosmislena — tacka pada izmedju
dva puta koji se ne spajaju, ili izmedju dvije obale.

| cvor | rasipanje [m] | jedna ivica ga vidi ovdje | druga ovdje |
| --- | --- | --- | --- |
| Mateševo | 1747 | 42.7328, 19.5137 (`smokovac--matesevo`) | 42.7375, 19.5340 (`matesevo--kolasin`) |
| Petrovac | 1546 | 42.2049, 18.9504 (`virpazar--petrovac`) | 42.2089, 18.9324 (`petrovac--budva`) |
| Pljevlja | 1324 | 43.3578, 19.3496 (`pljevlja--rance-jabuka`) | 43.3543, 19.3652 (`pljevlja--bijelo-polje`) |
| Smokovac | 1043 | 42.4838, 19.3049 (`podgorica--smokovac`) | 42.4931, 19.3068 (`smokovac--matesevo`) |
| Sutomore | 932 | 42.1426, 19.0458 (`bar--sutomore`) | 42.1460, 19.0355 (`sutomore--petrovac`) |
| Kolašin | 789 | 42.8163, 19.5116 (`bioce--kolasin`) | 42.8209, 19.5190 (`kolasin--mojkovac`) |
| Šavnik | 755 | 42.9625, 19.0919 (`zabljak--savnik`) | 42.9565, 19.0963 (`savnik--niksic`) |
| Njeguši | 585 | 42.4299, 18.8259 (`cetinje--njegusi`) | 42.4274, 18.8197 (`njegusi--kotor`) |
| Bioče | 573 | 42.5020, 19.3176 (`podgorica--bioce`) | 42.5046, 19.3236 (`bioce--kolasin`) |
| Berane | 538 | 42.8424, 19.8652 (`bijelo-polje--berane`) | 42.8397, 19.8706 (`berane--petnjica`) |
| Kamenari | 524 | 42.4593, 18.6818 (`kotor--kamenari`) | 42.4600, 18.6755 (`kamenari--herceg-novi`) |

## Sve ivice

| ivica | vrsta | graf [km] | OSM [km] | odnos | oznake puta | status |
| --- | --- | --- | --- | --- | --- | --- |
| `podgorica--danilovgrad` | magistrala | 20 | 21.3 | 1.07 | M-3, R-23 | ok |
| `danilovgrad--niksic` | magistrala | 35 | 31.3 | 0.90 | R-23, M-3 | ok |
| `podgorica--zeta` | magistrala | 12 | 11.9 | 0.99 | M-2 | ok |
| `podgorica--tuzi` | magistrala | 12 | 11.3 | 0.95 | M-2, M-4 | ok |
| `tuzi--bozaj` | magistrala | 10 | 8.8 | 0.88 | M-4 | ok |
| `podgorica--cetinje` | magistrala | 30 | 34.7 | 1.16 | M-3, M-10, R-25 | ok |
| `podgorica--smokovac` | magistrala | 8 | 7.2 | 0.90 | M-2 | ok |
| `smokovac--matesevo` | autoput | 41 | 34.9 | 0.85 | A-1, A1 | ok |
| `podgorica--bioce` | magistrala | 12 | 9.8 | 0.82 | M-2 | ok |
| `podgorica--kucka-korita` | planinski | 35 | 31.7 | 0.91 | — | ok |
| `bioce--kolasin` | planinski | 60 | 57.9 | 0.97 | M-2 | ok |
| `matesevo--kolasin` | regionalni | 15 | 12.7 | 0.85 | R-13 | ok |
| `matesevo--andrijevica` | regionalni | 30 | 39.9 | 1.33 | R-13, R-19, R-2 | duzinaNeSlaze |
| `kolasin--mojkovac` | magistrala | 25 | 22.2 | 0.89 | M-2 | ok |
| `mojkovac--bijelo-polje` | magistrala | 25 | 28.8 | 1.15 | M-2 | ok |
| `mojkovac--djurdjevica-tara` | planinski | 40 | 46.8 | 1.17 | M-2, R-10, M-6 | ok |
| `djurdjevica-tara--zabljak` | regionalni | 20 | 19.8 | 0.99 | M-6 | ok |
| `djurdjevica-tara--pljevlja` | magistrala | 35 | 37.5 | 1.07 | M-6, R-18 | ok |
| `pljevlja--rance-jabuka` | magistrala | 20 | 27.1 | 1.35 | R-3, R-4, 192 | duzinaNeSlaze |
| `pljevlja--bijelo-polje` | regionalni | 60 | 77.6 | 1.29 | M-6, 29, 23, M-2 | duzinaNeSlaze |
| `bijelo-polje--dobrakovo` | magistrala | 20 | 17.1 | 0.85 | M-2, 23 | ok |
| `bijelo-polje--berane` | magistrala | 35 | 34.7 | 0.99 | M-2, M-5, R-2 | ok |
| `berane--petnjica` | regionalni | 20 | 19.7 | 0.98 | M-5, R-11, R-12, R-12.1 | ok |
| `berane--rozaje` | magistrala | 35 | 32.0 | 0.91 | M-5 | ok |
| `rozaje--dracenovac` | magistrala | 20 | 39.0 | 1.95 | M-5, 22, 203, 202 | drugiKoridor |
| `rozaje--kula` | magistrala | 25 | 15.8 | 0.63 | M-5 | duzinaNeSlaze |
| `berane--andrijevica` | magistrala | 20 | 15.9 | 0.79 | R-2 | ok |
| `andrijevica--plav` | magistrala | 25 | 23.2 | 0.93 | R-2 | ok |
| `plav--gusinje` | regionalni | 10 | 11.5 | 1.15 | R-2 | ok |
| `zabljak--savnik` | planinski | 40 | 24.6 | 0.62 | M-6 | duzinaNeSlaze |
| `savnik--niksic` | magistrala | 40 | 46.5 | 1.16 | M-6, M-3 | ok |
| `zabljak--pluzine` | planinski | 45 | 48.6 | 1.08 | M-6, R-16, M-3 | ok |
| `niksic--pluzine` | magistrala | 60 | 56.7 | 0.94 | M-3 | ok |
| `pluzine--scepan-polje` | planinski | 25 | 26.0 | 1.04 | M-3 | ok |
| `niksic--vilusi` | magistrala | 30 | 30.3 | 1.01 | M-3, M-7 | ok |
| `vilusi--ilino-brdo` | magistrala | 10 | 11.8 | 1.18 | M-7, M-9 | ok |
| `vilusi--herceg-novi` | planinski | 50 | 62.0 | 1.24 | M-7, M-8, M-1 | ok |
| `cetinje--budva` | magistrala | 30 | 29.8 | 0.99 | R-25, M-10, M-1 | ok |
| `cetinje--njegusi` | planinski | 15 | 18.4 | 1.23 | R-25, M-10, M-13, R-1 | ok |
| `njegusi--kotor` | planinski | 20 | 24.5 | 1.23 | R-1, M-1 | ok |
| `podgorica--virpazar` | magistrala | 30 | 30.3 | 1.01 | M-2 | ok |
| `virpazar--bar` | magistrala | 25 | 22.1 | 0.88 | M-2, M-1.1, M-1 | ok |
| `virpazar--petrovac` | regionalni | 20 | 23.3 | 1.16 | M-2, M-1.1, M-1 | ok |
| `bar--ulcinj` | magistrala | 25 | 27.2 | 1.09 | M-1 | ok |
| `ulcinj--sukobin` | magistrala | 20 | 10.7 | 0.53 | M-1 | duzinaNeSlaze |
| `bar--sutomore` | magistrala | 10 | 7.5 | 0.75 | M-1 | duzinaNeSlaze |
| `sutomore--petrovac` | magistrala | 12 | 11.5 | 0.95 | M-1 | ok |
| `petrovac--budva` | magistrala | 18 | 15.7 | 0.87 | M-1 | ok |
| `budva--tivat` | magistrala | 20 | 23.6 | 1.18 | M-1, M-11 | ok |
| `tivat--kotor` | magistrala | 12 | 9.7 | 0.81 | M-11, M-1 | ok |
| `kotor--kamenari` | magistrala | 30 | 13.5 | 0.45 | M-1, M-11 | duzinaNeSlaze |
| `tivat--kamenari` | regionalni | 8 | 3.8 | 0.47 | M-11 | duzinaNeSlaze |
| `kamenari--herceg-novi` | magistrala | 15 | 13.7 | 0.91 | M-1 | ok |
| `herceg-novi--debeli-brijeg` | magistrala | 8 | 11.1 | 1.39 | M-1, D8 | duzinaNeSlaze |
