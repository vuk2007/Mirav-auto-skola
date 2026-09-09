/**
 * Binarna gomila po najmanjem kljucu.
 *
 * Postoji zato sto Dijkstra nad mrezom od nekoliko stotina hiljada cvorova bez
 * nje trazi minimum linearno, pa se jedna ruta racuna minutima umjesto
 * milisekundama. Nista pametnije od udzbenika.
 */

export class Gomila {
  #kljuc = [];
  #vrijednost = [];

  get velicina() {
    return this.#kljuc.length;
  }

  dodaj(kljuc, vrijednost) {
    this.#kljuc.push(kljuc);
    this.#vrijednost.push(vrijednost);
    let i = this.#kljuc.length - 1;
    while (i > 0) {
      const roditelj = (i - 1) >> 1;
      if (this.#kljuc[roditelj] <= this.#kljuc[i]) break;
      this.#zamijeni(i, roditelj);
      i = roditelj;
    }
  }

  /** Najmanji element, ili `null` kad je gomila prazna. */
  uzmi() {
    if (this.#kljuc.length === 0) return null;
    const kljuc = this.#kljuc[0];
    const vrijednost = this.#vrijednost[0];
    const zadnji = this.#kljuc.length - 1;
    this.#zamijeni(0, zadnji);
    this.#kljuc.pop();
    this.#vrijednost.pop();

    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const d = 2 * i + 2;
      let najmanji = i;
      if (l < this.#kljuc.length && this.#kljuc[l] < this.#kljuc[najmanji]) najmanji = l;
      if (d < this.#kljuc.length && this.#kljuc[d] < this.#kljuc[najmanji]) najmanji = d;
      if (najmanji === i) break;
      this.#zamijeni(i, najmanji);
      i = najmanji;
    }
    return { kljuc, vrijednost };
  }

  #zamijeni(a, b) {
    [this.#kljuc[a], this.#kljuc[b]] = [this.#kljuc[b], this.#kljuc[a]];
    [this.#vrijednost[a], this.#vrijednost[b]] = [this.#vrijednost[b], this.#vrijednost[a]];
  }
}
