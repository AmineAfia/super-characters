"use client"

interface GradientMeshBackgroundProps {
  accentColor?: string
}

export default function GradientMeshBackground({ accentColor }: GradientMeshBackgroundProps) {
  // Default to system blue if no accent color
  const accent = accentColor || "#007AFF"

  return (
    <div
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Noise texture overlay for organic feel */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* Blob 1 - Accent color (top-left) */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full will-change-transform"
        style={{
          top: "-10%",
          left: "-5%",
          background: `radial-gradient(circle, ${accent}40 0%, ${accent}10 50%, transparent 70%)`,
          filter: "blur(80px)",
          animation: "blob-drift-1 20s ease-in-out infinite",
        }}
      />

      {/* Blob 2 - Purple (top-right) */}
      <div
        className="absolute w-[450px] h-[450px] rounded-full will-change-transform"
        style={{
          top: "5%",
          right: "-8%",
          background:
            "radial-gradient(circle, rgba(175,82,222,0.35) 0%, rgba(175,82,222,0.08) 50%, transparent 70%)",
          filter: "blur(90px)",
          animation: "blob-drift-2 18s ease-in-out infinite",
        }}
      />

      {/* Blob 3 - Teal (center) */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full will-change-transform"
        style={{
          top: "35%",
          left: "30%",
          background:
            "radial-gradient(circle, rgba(90,200,250,0.3) 0%, rgba(90,200,250,0.06) 50%, transparent 70%)",
          filter: "blur(70px)",
          animation: "blob-drift-3 22s ease-in-out infinite",
        }}
      />

      {/* Blob 4 - Pink (bottom-left) */}
      <div
        className="absolute w-[420px] h-[420px] rounded-full will-change-transform"
        style={{
          bottom: "-5%",
          left: "10%",
          background:
            "radial-gradient(circle, rgba(255,45,85,0.25) 0%, rgba(255,45,85,0.06) 50%, transparent 70%)",
          filter: "blur(85px)",
          animation: "blob-drift-4 25s ease-in-out infinite",
        }}
      />

      {/* Blob 5 - Orange (bottom-right) */}
      <div
        className="absolute w-[380px] h-[380px] rounded-full will-change-transform"
        style={{
          bottom: "10%",
          right: "5%",
          background:
            "radial-gradient(circle, rgba(255,149,0,0.25) 0%, rgba(255,149,0,0.06) 50%, transparent 70%)",
          filter: "blur(75px)",
          animation: "blob-drift-5 15s ease-in-out infinite",
        }}
      />
    </div>
  )
}
