import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const userId = process.env.DEV_USER_ID || 'dev-user-local-001'

  // ─── Brand: Ekonomirådgivarna ──────────────────────────────────────────────
  const brand = await prisma.brand.upsert({
    where: { slug: 'ekonomiradgivarna' },
    update: {},
    create: {
      userId,
      name: 'Ekonomirådgivarna',
      slug: 'ekonomiradgivarna',
      description: 'Redovisningsbyrå i Falun — Mer än en redovisningsbyrå',
      domain: 'ekonomiradgivarna.se',
      aliases: ['Ekonomirådgivarna', 'ekonomiradgivarna', 'Ekonomiradgivarna'],
      domains: ['ekonomiradgivarna.se', 'www.ekonomiradgivarna.se'],
      competitors: ['Wint', 'Björn Lundén', 'Fortnox'],
      industry: 'Accounting & Financial Services',
      color: '#2563eb',
    },
  })

  console.log('✅ Brand created:', brand.name)

  // ─── Prompts: 50 real queries from AEO strategy document ───────────────────

  const promptsData: Array<{ text: string; category: string; language: string; market: string }> = [
    // LOCAL (15)
    {
      text: 'Bästa redovisningsbyrå i Falun',
      category: 'awareness',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Redovisningskonsult Falun rekommendation',
      category: 'awareness',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Hur mycket kostar en redovisningsbyrå i Falun?',
      category: 'comparison',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    { text: 'Bokföringsbyrå Dalarna', category: 'awareness', language: 'sv', market: 'SE-Dalarna' },
    { text: 'Ekonomirådgivare Falun', category: 'awareness', language: 'sv', market: 'SE-Dalarna' },
    {
      text: 'Redovisningsbyråer i Falun jämförelse',
      category: 'comparison',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Billig redovisning Falun',
      category: 'comparison',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Bra redovisningskonsult nära Falun',
      category: 'awareness',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Redovisningsbyrå Borlänge Falun',
      category: 'awareness',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Hjälp med bokföring Dalarna',
      category: 'awareness',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Starta företag Falun ekonomisk rådgivning',
      category: 'features',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Redovisning enskild firma Falun',
      category: 'features',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Årsredovisning hjälp Falun',
      category: 'features',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Skattedeklaration hjälp Dalarna',
      category: 'features',
      language: 'sv',
      market: 'SE-Dalarna',
    },
    {
      text: 'Företagsrådgivning Falun',
      category: 'awareness',
      language: 'sv',
      market: 'SE-Dalarna',
    },

    // NATIONAL (20)
    {
      text: 'Bästa redovisningsbyrå i Sverige',
      category: 'awareness',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Hur väljer jag redovisningsbyrå?',
      category: 'comparison',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Vad kostar en redovisningskonsult?',
      category: 'comparison',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Skillnad mellan redovisningskonsult och revisor',
      category: 'comparison',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Kan jag byta redovisningsbyrå mitt i bokföringsåret?',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    { text: 'Vad ingår i löpande bokföring?', category: 'features', language: 'sv', market: 'SE' },
    {
      text: 'Hur ofta behöver jag träffa min redovisningskonsult?',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Vad är ett framtidsmöte med ekonomirådgivare?',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Hur lång tid tar det att byta redovisningsbyrå?',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Vilka handlingar behöver jag spara för bokföringen?',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    { text: 'Budget för småföretag guide', category: 'features', language: 'sv', market: 'SE' },
    {
      text: 'Bokföring för enskild firma allt du behöver veta',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    { text: 'Momsdeklaration steg för steg', category: 'features', language: 'sv', market: 'SE' },
    {
      text: 'Löpande bokföring vs årsbokslut',
      category: 'comparison',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Fortnox vs Visma vs Bokio jämförelse',
      category: 'alternative',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Årsbokslut checklista småföretag',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Bästa bokföringssystem för småföretag',
      category: 'comparison',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Redovisning aktiebolag vs enskild firma',
      category: 'comparison',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Vad gör en redovisningskonsult?',
      category: 'awareness',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Nöjdkundgaranti redovisningsbyrå',
      category: 'awareness',
      language: 'sv',
      market: 'SE',
    },

    // INDUSTRY (15)
    {
      text: 'Best accounting firm for small businesses Sweden',
      category: 'awareness',
      language: 'en',
      market: 'SE',
    },
    {
      text: 'Accounting services Dalarna region',
      category: 'awareness',
      language: 'en',
      market: 'SE-Dalarna',
    },
    {
      text: 'Swedish bookkeeping consultant recommendations',
      category: 'awareness',
      language: 'en',
      market: 'SE',
    },
    {
      text: 'What does a Swedish redovisningskonsult do?',
      category: 'features',
      language: 'en',
      market: 'SE',
    },
    {
      text: 'How to choose accounting firm in Sweden',
      category: 'comparison',
      language: 'en',
      market: 'SE',
    },
    {
      text: 'Redovisningsbyrå med nöjdkundgaranti',
      category: 'awareness',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Personlig redovisningskonsult Sverige',
      category: 'awareness',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Redovisningsbyrå som hjälper med budget',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Ekonomisk rådgivning för nystartade företag',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Digital bokföring eller traditionell',
      category: 'comparison',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Auktoriserad redovisningskonsult fördelar',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Företagsrådgivning utöver redovisning',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Redovisningsbyrå med framtidsmöte',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    {
      text: 'Helhetslösning ekonomi småföretag',
      category: 'features',
      language: 'sv',
      market: 'SE',
    },
    { text: 'Mer än en redovisningsbyrå', category: 'awareness', language: 'sv', market: 'SE' },
  ]

  let created = 0
  for (const p of promptsData) {
    const existing = await prisma.prompt.findFirst({
      where: { brandId: brand.id, text: p.text },
    })
    if (!existing) {
      await prisma.prompt.create({
        data: {
          brandId: brand.id,
          userId,
          text: p.text,
          language: p.language,
          market: p.market,
          category: p.category,
          engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
          runFrequency: 'weekly',
        },
      })
      created++
    }
  }

  console.log(`✅ Prompts: ${created} created, ${promptsData.length - created} already existed`)

  // ─── Alert rule: notify when brand is mentioned for first time ─────────────
  const existingRule = await prisma.alertRule.findFirst({
    where: { brandId: brand.id, type: 'mention_new' },
  })
  if (!existingRule) {
    await prisma.alertRule.create({
      data: {
        brandId: brand.id,
        userId,
        name: 'New Brand Mention',
        type: 'mention_new',
        condition: { action: 'new_mention' },
        channels: ['email'],
      },
    })
    console.log('✅ Alert rule created')
  }

  console.log('🎉 Seed complete! Run monitoring to start collecting data.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
