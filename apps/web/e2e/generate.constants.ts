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

export const TS_PLUS_JSON_DIFF = `diff --git a/src/util.ts b/src/util.ts
index 1111111..2222222 100644
--- a/src/util.ts
+++ b/src/util.ts
@@ -1,2 +1,3 @@
-const old = 1;
+export const answer = 42;
+export function greet(name: string) { return "hi " + name; }
 const keep = true;
diff --git a/config/app.json b/config/app.json
index 3333333..4444444 100644
--- a/config/app.json
+++ b/config/app.json
@@ -1,3 +1,3 @@
 {
-  "version": "1.0.0"
+  "version": "1.1.0"
 }
`;

export const MULTI_FILE_DIFF = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 keep one
-old line in a
+new line in a
 keep two
diff --git a/src/b.ts b/src/b.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/b.ts
@@ -0,0 +1,2 @@
+hello from b
+second line of b
diff --git a/src/c.ts b/src/c.ts
deleted file mode 100644
index 4444444..0000000
--- a/src/c.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-bye from c
-gone forever
`;
