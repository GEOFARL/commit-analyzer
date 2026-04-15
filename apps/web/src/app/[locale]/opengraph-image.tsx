import { ImageResponse } from "next/og";

export const alt = "Commit Analyzer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 100px",
          background:
            "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35), transparent 50%), radial-gradient(circle at 80% 80%, rgba(236,72,153,0.35), transparent 50%), #0a0a0f",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Commit Analyzer
          </div>
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.05,
            maxWidth: 900,
            background: "linear-gradient(180deg, #ffffff 0%, #c4b5fd 100%)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Ship better commits, faster.
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 28,
            color: "rgba(255,255,255,0.65)",
            maxWidth: 900,
          }}
        >
          AI-assisted commit message generation and repository analytics.
        </div>
      </div>
    ),
    { ...size },
  );
}
