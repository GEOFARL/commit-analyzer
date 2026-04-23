// TTFT acceptance gate per the issue body and 10-testing.md §6. Measured
// from the moment the user clicks Generate to the first suggestion frame
// being painted in the DOM. Shared between the stub-backed `generate.spec.ts`
// and the live-provider `generate.live.spec.ts` so the budget can never
// drift between the two.
export const TTFT_BUDGET_MS = 2_000;

export const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index e69de29..b6fc4c6 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -0,0 +1,3 @@
+export const signIn = async (email, password) => {
+  return await api.post("/auth/sign-in", { email, password });
+};
`;
