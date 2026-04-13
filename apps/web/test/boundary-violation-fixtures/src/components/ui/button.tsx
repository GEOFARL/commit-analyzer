// Intentional boundary violation: ui primitives may not depend on features.
import { Header } from "../layout/header.js";

export const Button = (): string => Header();
