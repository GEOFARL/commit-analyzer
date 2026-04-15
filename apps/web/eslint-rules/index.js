import featuresRequireServerOnly from "./features-require-server-only.js";
import namespaceMatch from "./i18n-namespace-match.js";
import noCrossFeatureImports from "./no-cross-feature-imports.js";

export default {
  rules: {
    "namespace-match": namespaceMatch,
    "no-cross-feature-imports": noCrossFeatureImports,
    "features-require-server-only": featuresRequireServerOnly,
  },
};
