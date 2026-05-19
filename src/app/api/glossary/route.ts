import { type NextRequest, NextResponse } from 'next/server'
import { GLOSSARY_TERMS, getTerm, getTermsByCategory } from '@/lib/data/glossary'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const category = searchParams.get('category')

  if (slug) {
    const term = getTerm(slug)
    if (!term) {
      return NextResponse.json({ success: false, message: 'Term not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: term })
  }

  if (category) {
    return NextResponse.json({ success: true, data: getTermsByCategory(category) })
  }

  return NextResponse.json({
    success: true,
    data: GLOSSARY_TERMS,
    categories: [...new Set(GLOSSARY_TERMS.map((t) => t.category))],
  })
}
