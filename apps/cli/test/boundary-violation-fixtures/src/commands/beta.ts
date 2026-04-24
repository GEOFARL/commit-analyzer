// Intentional boundary violation: commands may not call sibling commands.
import { alpha } from "./alpha.js";

export const beta = alpha;
