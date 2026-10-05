import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

function scale(name: string): Record<number, string> {
  return Object.fromEntries(shades.map((s) => [s, `{${name}.${s}}`]))
}

// Aura with the design tokens from docs/design/README.md:
// emerald-700 primary and zinc neutrals. Light scheme only.
export const AtlasPreset = definePreset(Aura, {
  semantic: {
    primary: scale('emerald'),
    colorScheme: {
      light: {
        primary: {
          color: '{emerald.700}',
          contrastColor: '#ffffff',
          hoverColor: '{emerald.800}',
          activeColor: '{emerald.900}',
        },
        surface: { 0: '#ffffff', ...scale('zinc') },
      },
    },
  },
})
