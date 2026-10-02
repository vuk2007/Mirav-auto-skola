/** Tipovi za `proj.mjs` — da ga igra (editor grada) uvozi iz istog izvora kao skripte. */
export declare const ZONA: string;
export declare function uMetre(lat: number, lon: number): { x: number; y: number };
export declare function uStepene(x: number, y: number): { lat: number; lon: number };
export declare function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number;
