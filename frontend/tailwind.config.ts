import type { Config } from "tailwindcss";

const config = {
	darkMode: ["class", '[data-theme="dark"]'],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			fontFamily: {
				// Apple-inspired font stack
				sans: [
					"var(--font-sf-pro)",
					"var(--font-nunito)",
					"var(--font-geist-sans)",
					"-apple-system",
					"BlinkMacSystemFont",
					"SF Pro Display",
					"SF Pro Text",
					"Helvetica Neue",
					"sans-serif",
				],
				mono: [
					"var(--font-geist-mono)",
					"SF Mono",
					"Menlo",
					"Monaco",
					"monospace",
				],
			},
			colors: {
				// Character accent colors
				peach: {
					DEFAULT: "var(--peach)",
					light: "var(--peach-light)",
				},
				rose: "var(--rose)",
				lavender: {
					DEFAULT: "var(--lavender)",
					light: "var(--lavender-light)",
				},
				cream: "var(--cream)",
				iridescent: "var(--iridescent-blue)",
				gold: "var(--soft-gold)",
				mint: "var(--mint)",
				
				// Core semantic colors
				border: "var(--border)",
				"border-subtle": "var(--border-subtle)",
				input: "var(--input)",
				ring: "var(--ring)",
				background: "var(--background)",
				"background-solid": "var(--background-solid)",
				foreground: "var(--foreground)",
				
				// Component colors
				primary: {
					DEFAULT: "var(--primary)",
					foreground: "var(--primary-foreground)",
				},
				secondary: {
					DEFAULT: "var(--secondary)",
					foreground: "var(--secondary-foreground)",
				},
				destructive: {
					DEFAULT: "var(--destructive)",
					foreground: "var(--destructive-foreground)",
				},
				muted: {
					DEFAULT: "var(--muted)",
					foreground: "var(--muted-foreground)",
				},
				accent: {
					DEFAULT: "var(--accent)",
					foreground: "var(--accent-foreground)",
				},
				popover: {
					DEFAULT: "var(--popover)",
					foreground: "var(--popover-foreground)",
				},
				card: {
					DEFAULT: "var(--card)",
					foreground: "var(--card-foreground)",
				},
				
				// Liquid Glass specific
				glass: {
					DEFAULT: "var(--glass-bg)",
					elevated: "var(--glass-bg-elevated)",
					border: "var(--glass-border)",
					highlight: "var(--glass-highlight)",
					shadow: "var(--glass-shadow)",
				},
				
				// Apple System Colors
				system: {
					blue: "var(--system-blue)",
					green: "var(--system-green)",
					orange: "var(--system-orange)",
					red: "var(--system-red)",
					yellow: "var(--system-yellow)",
					purple: "var(--system-purple)",
					pink: "var(--system-pink)",
					teal: "var(--system-teal)",
					indigo: "var(--system-indigo)",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 4px)",
				sm: "calc(var(--radius) - 8px)",
				xl: "calc(var(--radius) + 8px)",
				"2xl": "calc(var(--radius) + 16px)",
				"3xl": "calc(var(--radius) + 24px)",
			},
			boxShadow: {
				// Liquid Glass shadow system
				'glass': '0 8px 32px var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
				'glass-sm': '0 4px 16px var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
				'glass-lg': '0 12px 48px var(--glass-shadow), 0 4px 16px var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
				'glass-xl': '0 24px 64px var(--glass-shadow), 0 8px 24px var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
				'glass-glow': '0 0 0 1px var(--primary), 0 8px 32px rgba(0, 122, 255, 0.15), 0 4px 16px var(--glass-shadow)',
				'glass-inset': 'inset 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 0 0 1px var(--glass-border)',
				// Legacy support
				'soft': '0 4px 20px var(--glass-shadow)',
				'soft-lg': '0 8px 30px var(--glass-shadow)',
				'glow': '0 0 20px rgba(0, 122, 255, 0.2)',
				'glow-lg': '0 0 40px rgba(0, 122, 255, 0.3)',
			},
			backdropBlur: {
				'glass': 'var(--glass-blur)',
				'glass-light': 'var(--glass-blur-light)',
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
				"liquid-fade-in": {
					from: { opacity: "0", transform: "scale(0.96)" },
					to: { opacity: "1", transform: "scale(1)" },
				},
				"liquid-fade-out": {
					from: { opacity: "1", transform: "scale(1)" },
					to: { opacity: "0", transform: "scale(0.96)" },
				},
				"liquid-slide-up": {
					from: { opacity: "0", transform: "translateY(8px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"liquid-slide-down": {
					from: { opacity: "0", transform: "translateY(-8px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"glass-shimmer": {
					"0%": { backgroundPosition: "-200% 0" },
					"100%": { backgroundPosition: "200% 0" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"liquid-fade-in": "liquid-fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
				"liquid-fade-out": "liquid-fade-out 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
				"liquid-slide-up": "liquid-slide-up 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
				"liquid-slide-down": "liquid-slide-down 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
				"glass-shimmer": "glass-shimmer 4s ease-in-out infinite",
			},
			transitionTimingFunction: {
				'apple': 'cubic-bezier(0.4, 0, 0.2, 1)',
				'apple-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
			},
		},
	},
	plugins: [],
} satisfies Config;

export default config;
