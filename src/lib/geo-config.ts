/**
 * Single source of truth for the geographic/locale context of data
 * collection. Imported by the SERP provider, the LLM prompt builder, and
 * the report methodology section so the declared methodology can never
 * drift from actual behavior.
 *
 * Defaults target the Swedish market. Every value is env-overridable so a
 * deployment for another market stays honest without code changes.
 *
 * DataForSEO location codes: Sweden = 2752, United States = 2840.
 */
export const GEO = {
  /** Human-readable market name shown in the report methodology. */
  marketName: process.env.AIO_MARKET_NAME || 'Sweden',
  /** ISO-ish language used for LLM prompt localization. */
  languageName: process.env.AIO_LANGUAGE_NAME || 'Swedish',
  languageCode: process.env.AIO_LANGUAGE_CODE || 'sv',
  /** DataForSEO geo targeting (server-side geolocation, IP-independent). */
  dataForSeoLocationCode: Number(process.env.DATAFORSEO_LOCATION_CODE) || 2752,
  dataForSeoLanguageCode: process.env.DATAFORSEO_LANGUAGE_CODE || 'sv',
  /**
   * Where serverless functions execute (Vercel region). Used only for the
   * methodology disclosure. Keep in sync with vercel.json "regions".
   */
  collectionRegion: process.env.AIO_COLLECTION_REGION || 'Stockholm, Sweden (arn1)',
} as const

/** One-paragraph methodology/limitations note for reports (localized text). */
export function geoMethodologyNote(locale: 'en' | 'it' | 'sv'): string {
  const g = GEO
  if (locale === 'it') {
    return (
      `Raccolta dati eseguita da server in ${g.collectionRegion}. ` +
      `I risultati SERP / Google AI Overview sono richiesti esplicitamente per il mercato ` +
      `${g.marketName} (DataForSEO location_code ${g.dataForSeoLocationCode}, lingua ${g.dataForSeoLanguageCode}), ` +
      `geolocalizzati lato provider e quindi indipendenti dall'IP di uscita. ` +
      `Le risposte dei modelli LLM (ChatGPT, Gemini, Perplexity, Claude) sono globali ` +
      `e non geolocalizzate per IP: il contesto di mercato (${g.marketName}, ${g.languageName}) ` +
      `è iniettato esplicitamente nei prompt. Eventuali variazioni iperlocali percepite da un ` +
      `utente reale in ${g.marketName} possono differire.`
    )
  }
  if (locale === 'sv') {
    return (
      `Datainsamling utförd från servrar i ${g.collectionRegion}. ` +
      `SERP / Google AI Overview-resultat begärs explicit för marknaden ${g.marketName} ` +
      `(DataForSEO location_code ${g.dataForSeoLocationCode}, språk ${g.dataForSeoLanguageCode}), ` +
      `geolokaliserade på leverantörssidan och därmed oberoende av utgående IP. ` +
      `LLM-svar (ChatGPT, Gemini, Perplexity, Claude) är globala och IP-oberoende; ` +
      `marknadskontexten (${g.marketName}, ${g.languageName}) injiceras explicit i prompterna. ` +
      `Hyperlokala variationer kan avvika från vad en faktisk användare i ${g.marketName} ser.`
    )
  }
  return (
    `Data collected from servers in ${g.collectionRegion}. ` +
    `SERP / Google AI Overview results are requested explicitly for the ${g.marketName} market ` +
    `(DataForSEO location_code ${g.dataForSeoLocationCode}, language ${g.dataForSeoLanguageCode}), ` +
    `geolocated provider-side and therefore independent of the egress IP. ` +
    `LLM answers (ChatGPT, Gemini, Perplexity, Claude) are global and not IP-geolocated; ` +
    `the market context (${g.marketName}, ${g.languageName}) is injected explicitly into the prompts. ` +
    `Hyper-local variations may differ from what a real user in ${g.marketName} sees.`
  )
}
