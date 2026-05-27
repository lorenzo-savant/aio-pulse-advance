import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'var(--font-geist-sans)', ...fontFamily.sans],
        body: ['Inter', 'var(--font-geist-sans)', ...fontFamily.sans],
        display: ['Lato', 'var(--font-geist-sans)', ...fontFamily.serif],
        mono: ['Fragment Mono', 'Fira Code', 'var(--font-geist-mono)', ...fontFamily.mono],
        soft: ['Fustat', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* ═══ Semantic Colors (using CSS variables) ══════════════════════════════ */
        border: {
          DEFAULT: 'oklch(var(--border))',
        },
        input: {
          DEFAULT: 'oklch(var(--input))',
        },
        ring: {
          DEFAULT: 'oklch(var(--ring))',
        },
        background: {
          DEFAULT: 'oklch(var(--background))',
        },
        foreground: {
          DEFAULT: 'oklch(var(--foreground))',
        },
        primary: {
          DEFAULT: 'oklch(var(--primary))',
          foreground: 'oklch(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary))',
          foreground: 'oklch(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'oklch(var(--muted))',
          foreground: 'oklch(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'oklch(var(--accent))',
          foreground: 'oklch(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive))',
          foreground: 'oklch(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'oklch(var(--card))',
          foreground: 'oklch(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'oklch(var(--popover))',
          foreground: 'oklch(var(--popover-foreground))',
        },

        /* ═══ Status Colors ══════════════════════════════════════════════════════ */
        success: {
          DEFAULT: 'oklch(var(--success))',
          foreground: 'oklch(var(--success-foreground))',
          muted: 'oklch(var(--success-muted))',
        },
        warning: {
          DEFAULT: 'oklch(var(--warning))',
          foreground: 'oklch(var(--warning-foreground))',
          muted: 'oklch(var(--warning-muted))',
        },
        error: {
          DEFAULT: 'oklch(var(--error))',
          foreground: 'oklch(var(--error-foreground))',
          muted: 'oklch(var(--error-muted))',
        },
        info: {
          DEFAULT: 'oklch(var(--info))',
          foreground: 'oklch(var(--info-foreground))',
          muted: 'oklch(var(--info-muted))',
        },

        /* ═══ Qvery Brand Colors ════════════════════════════ */
        brand: {
          DEFAULT: 'oklch(var(--color-accent))',
          hover: 'oklch(var(--color-accent-hover))',
          muted: 'oklch(var(--color-accent-muted))',
          foreground: 'oklch(var(--color-accent-foreground))',
        },
        ink: '#011C25',
        teal: '#0AD0BC',
        red: '#FF3131',
        'brand-bg': '#F6F8FF',
        'brand-surface': '#FFFFFF',
        'brand-line': '#E8E8E8',
        'brand-line-2': '#EAEAEC',
        'brand-mute-1': '#798283',
        'brand-mute-2': '#999999',

        /* ═══ UI Components Colors ════════════════════════════════════════════ */
        nav: {
          bg: 'oklch(var(--nav-bg))',
          border: 'oklch(var(--nav-border))',
          text: 'oklch(var(--nav-text))',
          'text-hover': 'oklch(var(--nav-text-hover))',
          'active-bg': 'oklch(var(--nav-active-bg))',
          'active-text': 'oklch(var(--nav-active-text))',
        },
        auth: {
          bg: 'oklch(var(--auth-bg))',
          card: 'oklch(var(--auth-card))',
          input: 'oklch(var(--auth-input))',
          'input-border': 'oklch(var(--auth-input-border))',
          label: 'oklch(var(--auth-label))',
        },
        search: {
          bg: 'oklch(var(--search-bg))',
          border: 'oklch(var(--search-border))',
          text: 'oklch(var(--search-text))',
          placeholder: 'oklch(var(--search-placeholder))',
        },
        dashboard: {
          bg: 'oklch(var(--dashboard-bg))',
          card: 'oklch(var(--dashboard-card))',
          border: 'oklch(var(--dashboard-border))',
          text: 'oklch(var(--dashboard-text))',
          muted: 'oklch(var(--dashboard-muted))',
          'input-bg': 'oklch(var(--dashboard-bg))',
          'input-border': 'oklch(var(--dashboard-border))',
        },

        /* ═══ Surface Scale (using CSS variables) ════════════════════════════ */
        surface: {
          0: 'oklch(var(--surface-0))',
          50: 'oklch(var(--surface-50))',
          100: 'oklch(var(--surface-100))',
          200: 'oklch(var(--surface-200))',
          300: 'oklch(var(--surface-300))',
          400: 'oklch(var(--surface-400))',
          500: 'oklch(var(--surface-500))',
          600: 'oklch(var(--surface-600))',
          700: 'oklch(var(--surface-700))',
          800: 'oklch(var(--surface-800))',
          900: 'oklch(var(--surface-900))',
          950: 'oklch(var(--surface-950))',
        },

        /* ═══ Horizon Navy Scale (for dark mode backgrounds) ══════════════════ */
        navy: {
          50: 'oklch(0.82 0.03 250)' /* #d0dcfb */,
          100: 'oklch(0.68 0.05 250)' /* #aac0fe */,
          200: 'oklch(0.65 0.06 250)' /* #a3b9f8 */,
          300: 'oklch(0.55 0.08 250)' /* #728fea */,
          400: 'oklch(0.40 0.10 250)' /* #3652ba */,
          500: 'oklch(0.32 0.12 250)' /* #1b3bbb */,
          600: 'oklch(0.25 0.10 250)' /* #24388a */,
          700: 'oklch(0.18 0.08 250)' /* #1B254B */,
          800: 'oklch(0.11 0.06 250)' /* #111c44 */,
          900: 'oklch(0.07 0.04 250)' /* #0b1437 */,
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        nav: 'var(--shadow-nav)',
        glow: 'var(--shadow-glow)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-up': 'fadeUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'pulse-dot': 'q-pulse 1.8s ease-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'q-pulse': {
          '0%': { transform: 'scale(.6)', opacity: '.4' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'glow-teal': 'var(--gradient-glow-teal)',
        'glow-red': 'var(--gradient-glow-red)',
        'gradient-mesh': 'var(--gradient-mesh)',
        'grid-pattern':
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}

export default config
