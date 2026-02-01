"use client"

/**
 * Hidden SVG filter definitions for liquid glass displacement and specular effects.
 * Mount once in layout - elements reference these filters via CSS filter: url(#filterName).
 */
export default function LiquidGlassFilters() {
  return (
    <svg
      className="absolute w-0 h-0 overflow-hidden"
      aria-hidden="true"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <defs>
        {/* Displacement map for glass refraction distortion */}
        <filter id="liquid-glass-distort" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="3"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Specular lighting for glass surface highlights */}
        <filter id="liquid-glass-specular" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blurred" />
          <feSpecularLighting
            in="blurred"
            surfaceScale="5"
            specularConstant="0.75"
            specularExponent="20"
            lightingColor="#ffffff"
            result="specular"
          >
            <fePointLight x="100" y="50" z="200" />
          </feSpecularLighting>
          <feComposite
            in="specular"
            in2="SourceAlpha"
            operator="in"
            result="specular-clipped"
          />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="specular-clipped" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}
