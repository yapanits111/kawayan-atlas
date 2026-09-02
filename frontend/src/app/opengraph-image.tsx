import { ImageResponse } from "next/og";

export const alt = "Kawayan Atlas — Bamboo structures, learned and designed";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #f2f7f0 0%, #ece7d8 100%)",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: 56 }}>🎋</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#33522a" }}>
            Kawayan Atlas
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              fontWeight: 700,
              color: "#25381f",
              lineHeight: 1.05,
            }}
          >
            <span>Design bamboo structures</span>
            <span>with confidence.</span>
          </div>
          <div style={{ fontSize: 32, color: "#635130" }}>
            A Philippine reference &amp; design sandbox — atlas, joints, templates, 3D studio.
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          {["#538343", "#9a8248", "#a9623a", "#c2b184"].map((c) => (
            <div
              key={c}
              style={{ width: 120, height: 14, borderRadius: 7, background: c }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
