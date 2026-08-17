// PATH: src/content/docs/types.ts
//
// Shape of the in-app documentation content. Pure data — no React, no lucide
// imports — so the three locale files stay diffable against each other and
// against docs/features/, which is the source of truth for what each feature
// actually does.
//
// Icons are referenced by key, not by component, for two reasons: the content
// files must not pull in a React dependency, and the public /docs page and the
// in-dashboard /dashboard/docs page render the same content with their own icon
// maps. See src/components/docs/docIcons.ts for the key → component mapping.

/** Icon keys the doc groups may reference. Keep in sync with DOC_ICONS. */
export type DocIconKey =
  | 'start'
  | 'overview'
  | 'setup'
  | 'monitor'
  | 'insights'
  | 'optimize'
  | 'account'
  | 'disabled'
  | 'glossary'

export interface DocSection {
  /**
   * Stable anchor. Never rename an existing id — it is a deep-link target and
   * the three locale files must use identical ids so switching language keeps
   * the reader on the same section.
   */
  id: string
  title: string
  /**
   * Plain text. The renderer splits on blank lines; a paragraph whose lines all
   * start with `•` becomes a list, and inside a bullet `term — definition`
   * renders the term emphasised. No markdown, no HTML.
   */
  content: string
}

export interface DocGroup {
  /** Stable group id, identical across locales. */
  id: string
  /** Localised group heading shown in the sidebar and as the section header. */
  group: string
  icon: DocIconKey
  sections: DocSection[]
}

export type DocContent = DocGroup[]
