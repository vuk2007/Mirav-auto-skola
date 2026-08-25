export const OPTION_KEYS = ["a", "b", "c"];
export const AREAS = ["I", "II", "III"];
export const QUESTION_KINDS = [
    "znak",
    "teorija",
    "policajac",
    "kosnik",
    "situacija",
    "ostalo",
];
export function isOrdering(q) {
    return q.type === "ordering";
}
export function isChoice(q) {
    return q.type === "text" || q.type === "image";
}
