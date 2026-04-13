// Intentional boundary violation: sibling module import is banned.
import { alpha } from "../alpha/alpha.js";

export const beta = alpha;
