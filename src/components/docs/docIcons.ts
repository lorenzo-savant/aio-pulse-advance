// PATH: src/components/docs/docIcons.ts
//
// Icon key → component mapping for the documentation groups. Lives here rather
// than in src/content/docs so the locale content files stay pure data with no
// React dependency, and so the public and in-dashboard docs pages can share one
// mapping instead of each maintaining its own.

import {
  Rocket,
  LayoutDashboard,
  Building2,
  Radio,
  BarChart3,
  Wand2,
  Settings,
  Lock,
  BookOpen,
} from 'lucide-react'
import type { DocIconKey } from '@/content/docs/types'

/** Every DocIconKey must have an entry — the Record type enforces it. */
export const DOC_ICONS: Record<DocIconKey, React.ElementType> = {
  start: Rocket,
  overview: LayoutDashboard,
  setup: Building2,
  monitor: Radio,
  insights: BarChart3,
  optimize: Wand2,
  account: Settings,
  disabled: Lock,
  glossary: BookOpen,
}
