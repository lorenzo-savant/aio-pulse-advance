import { redirect } from 'next/navigation'

// The standalone Prompt Generator was merged into the Prompts page (the
// "Generate (AI)" panel) to avoid a redundant second generator. This route is
// kept only to redirect old links/bookmarks to the single source of truth.
export default function PromptGeneratorRedirect() {
  redirect('/dashboard/prompts')
}
