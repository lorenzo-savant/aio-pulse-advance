// PATH: src/content/docs/sv.ts
//
// Svensk in-app-dokumentation. Svenska är plattformens standardspråk
// (defaultLocale i src/i18n/config.ts), så detta är den version flest läsare
// ser. Speglar docs/features/ (sanningskälla för funktionsbeteende) och
// NAV_SECTIONS (sanningskälla för vad som är nåbart). Grupp-id och sektions-id
// måste vara identiska med en.ts och it.ts.

import type { DocContent } from './types'

export const docsSv: DocContent = [
  {
    id: 'getting-started',
    group: 'Kom igång',
    icon: 'start',
    sections: [
      {
        id: 'what-is-aeo-pulse',
        title: 'Vad är AEO Pulse?',
        content: `AEO Pulse är en plattform för synlighet i AI-sökning. Den bevakar hur ert varumärke framträder när människor frågar AI-assistenter om produkter och tjänster i er bransch.

Traditionell SEO mäter er position på Google. AEO Pulse mäter något annat: om AI-assistenterna nämner ert varumärke när någon frågar "vilken marknadsplats för begagnat ska jag använda?" eller "vilken är den bästa redovisningsbyrån i Falun?"

Det spelar roll eftersom en växande andel av köpresearchen i dag sker inne i en AI-assistent istället för på en resultatsida. Om assistenten inte nämner er är ni osynliga för den efterfrågan — och till skillnad från en Google-placering finns ingen resultatsida där ni kan se er själva på plats 11.

Plattformen besvarar fyra frågor:

• Synlighet — hur ofta och hur framträdande ni syns i AI-svaren.
• Jämförelse — om motorerna föredrar era konkurrenter, och med hur mycket.
• Korrekthet — vad motorerna faktiskt säger om er, och om det är sant.
• Åtgärd — vad som ska ändras, i prioritetsordning, och vad det bör flytta.`,
      },
      {
        id: 'key-concepts',
        title: 'Nyckelbegrepp',
        content: `Lär er dessa åtta begrepp, sedan läser resten av produkten sig själv.

• AVI (AI Visibility Index) — kompositpoäng 0-100. Det enda talet att följa dag för dag.
• GEO-poäng — komposit 0-100 med bokstavsbetyg (A-F) som mäter hur väl ni är byggda för att bli citerade. AVI är resultatet; GEO-poängen är förmågan bakom det.
• Citeringsgrad — andelen bevakade svar som nämner ert varumärke. Omnämnanden ÷ totalt antal svar × 100.
• Omnämnandeposition — i vilken mening ni först förekommer. Mening 1 är bäst; senare betyder att läsaren kanske aldrig når dit.
• Sentiment — tonen i ett svar om er: positiv, neutral eller negativ, med poäng från -1,0 till +1,0.
• Motor — en AI-plattform: ChatGPT, Gemini eller Perplexity.
• Prompt — en fråga vi skickar till motorerna i ert namn, som ställföreträdare för en verklig kundfråga.
• Ögonblicksbild — dagens aggregat av övervakningsresultaten. Varje trendgraf i produkten läser ögonblicksbilder, inte råa svar.

Två distinktioner orsakar nästan all förvirring, så de är värda att säga rakt ut:

• Omnämnd är inte citerad. Ett omnämnande är att motorn säger ert namn. En citering är att motorn länkar er domän som källa. Omnämnanden är räckvidd; citeringar är förtroende.
• Bredd är inte tyngd. "I hur många svar förekommer ni alls" och "vilken andel av alla varumärkesomnämnanden är er" är olika mått, och en konkurrent kan slå er på det ena och förlora stort på det andra.`,
      },
      {
        id: 'quick-start',
        title: 'Snabbstart',
        content: `Fem steg från tomt konto till verkliga data.

Steg 1 — Lägg till varumärket. Konfiguration → Varumärken. Namn, domän, alias, konkurrenter, bransch, locale, varumärkesfärg.

Steg 2 — Skapa prompts. Konfiguration → Prompts, sedan "Generate (AI)" för att expandera varumärke och bransch till färdiga frågor, eller skriv egna. Sikta på 30-50 prompts spridda över lokal, nationell och kategoriavsikt.

Steg 3 — Kör första kontrollen. Övervakning → Live-övervakning. Ni kan också låta schemat ta det: övervakningen körs automatiskt tre gånger per dag.

Steg 4 — Läs resultatet. Översikten ger nyckeltalen. Insikter → Citat, Sentiment och Konkurrent bryter ner dem.

Steg 5 — Agera. Optimera → Strategirådgivare för den rangordnade berättelsen, Rekommendationer för den bestående listan, Webbplatsgranskning för vad som ska åtgärdas på sajten.

Vill ni hellre bli guidade genom steg 1-3, använd Konfiguration → Börja här. Det är samma arbete i en wizard, och den avslutas med att starta er första skanning.`,
      },
      {
        id: 'first-brand-setup',
        title: 'Ert första varumärke, fält för fält',
        content: `Varje varumärkesfält matar något specifikt. Att få dem rätt från början sparar ommätning senare.

• Varumärkesnamn — det officiella namnet som det bör framträda i svaren. Används för exakt matchning.
• Domän — er primära sajt. Används för att upptäcka när en motor citerar er som källa istället för att bara nämna er.
• Alias — alternativa stavningar, mellanslag och accentvarianter. Avgörande utanför engelska, där motorerna varierar versaler och diakritiska tecken fritt. Ett saknat alias läses som ett saknat omnämnande.
• Konkurrenter — era verkliga rivaler, 3-5 av dem. Driver varje jämförande panel i produkten.
• Bransch / mall — branschklassificering. Driver promptgenerering och rekommendationsreglerna.
• Locale — er marknads språk. Ett svenskt varumärke behöver svenska prompts för att synas i svenska svar; fel inställning mäter fel marknad.
• Beskrivning — ett kort stycke om vad ni gör. Används som kontext när sentiment och korrekthet bedöms.
• Varumärkesfärg — används i grafer och i exporterade PDF-rapporter.

Fältet som oftast behöver korrigeras i efterhand är Konkurrenter. Motorerna jämför er med vilka de tror att ni konkurrerar med, inte med listan ni konfigurerade — och Insikter → Konkurrent rapporterar de rivaler den upptäckt utanför er konfiguration. När den upptäckta listan säger emot den konfigurerade: lita på den upptäckta och uppdatera konfigurationen.`,
      },
    ],
  },

  {
    id: 'overview',
    group: 'Översikt',
    icon: 'overview',
    sections: [
      {
        id: 'dashboard-page',
        title: 'Instrumentpanelen',
        content: `Landningssidan efter inloggning. Den hämtar ett nyckeltal från varje Insikter-yta så att ni med en blick ser om något rört sig, och därifrån klickar in på den yta som äger detaljen.

Den äger medvetet ingen egen data. Varje tal här kommer från samma ställe som den dedikerade sidan läser. Om ett tal här avviker från sin egen sida: lita på sidan.

Varje kort laddar oberoende, så en långsam eller trasig källa försämrar ett kort istället för hela skärmen. Under en övervakningskörning kan ett kort visa ny data medan kortet intill fortfarande visar det föregående värdet — ladda om för att jämna ut dem.`,
      },
      {
        id: 'reading-kpis',
        title: 'Att läsa nyckeltalen',
        content: `Fyra tal bär det mesta av innebörden, och varje har en vanlig feltolkning värd att undvika.

• AVI — er synlighet i dag. Läs perioden, inte dagen: med omkring 30 svar per dag och motorer som inte är deterministiska är en enskild dag som svänger 20 poäng normalt brus, inte ett sammanbrott.
• GEO-poäng med bokstavsbetyg — er förmåga. Ett lågt betyg intill ett friskt AVI betyder att ni presterar över er struktur, vilket är goda nyheter: strukturen är den del som går att bygga om.
• Citeringsgrad — hur ofta ni nämns. Stigande citeringsgrad med platt sentiment betyder mer räckvidd, inte mer preferens.
• Sentimentfördelning — positiv / neutral / negativ. Noll negativa är ett skydd, inte en vinst. En stor neutral andel betyder att ni räknas upp bland alternativ snarare än rekommenderas, och nästa mål är att gå från omnämnd till rekommenderad.

Det enda inget enskilt tal berättar är om motorerna beskriver er korrekt. Det finns i Insikter → Sentiment och i svarstexten själv.`,
      },
    ],
  },

  {
    id: 'setup',
    group: '1 · Konfiguration',
    icon: 'setup',
    sections: [
      {
        id: 'onboarding-wizard',
        title: 'Börja här — den guidade wizarden',
        content: `En wizard i fyra steg som tar ett nytt konto från tomt till en pågående skanning utan att lämna sidan: välkomst och gränssnittsspråk, varumärke, prompts, start.

Ni kan inte hoppa framåt över ett ofullständigt steg — varumärkessteget kräver ett giltigt varumärke, promptsteget minst en prompt — men ni kan gå tillbaka till allt som redan är klart.

Två saker att veta. Wizarden återupptas inte efter en omladdning: rader som redan skapats finns kvar, så om ni laddar om efter varumärkessteget hittar ni varumärket väntande under Konfiguration → Varumärken. Och språket ni väljer i steg 1 är gränssnittsspråket, inte varumärkets marknadsspråk — de ställs in separat, och det är varumärkets locale som avgör promptspråket.`,
      },
      {
        id: 'brands-aliases',
        title: 'Varumärken och aliasdetektering',
        content: `Detekteringen är exakt och ordgränsbaserad, med avsikt. Matcharen letar efter hela ord, inte delsträngar, eftersom delsträngsmatchning gav verkliga falska positiva — "Acast" matchade "Acasting", två helt orelaterade företag.

Den precisionen är skälet till att alias betyder så mycket. Varje stavning en motor kan använda måste finnas med, annars räknas inte omnämnandet:

• Varianter av versaler och mellanslag — "Ekonomirådgivarna", "Ekonomi Rådgivarna", "ekonomi radgivarna".
• Former utan diakritiska tecken, som motorerna producerar hela tiden för nordiska och romanska namn.
• Förkortningar och bolagsformen om någon av dem förekommer på marknaden.

En citeringsgrad som ser omöjligt låg ut är betydligt oftare ett aliasproblem än ett synlighetsproblem. Kontrollera svarstexten i Insikter → Citat innan ni drar slutsatsen att ni är frånvarande.`,
      },
      {
        id: 'competitors-setup',
        title: 'Konfiguration av konkurrenter',
        content: `De konkurrenter ni konfigurerar definierar varje jämförande panel: röstandel, jämförelsenivåer, gapanalys.

Konfigurera 3-5 verkliga rivaler — de en kund faktiskt skulle väga er mot, inte de som står i er kategori på pappret. Distinktionen har praktiska konsekvenser: ett varumärke som är positionerat som en sak men opererar som en annan hamnar mätt mot fel marknad, och varje jämförelse i produkten ärver det felet.

Att lägga till en konkurrent fyller inte i historiken bakåt. Dess serie börjar den dag ni lade till den, så en nykonfigurerad rival ser ut att komma från ingenstans. Lägg till dem tidigt.

Insikter → Konkurrent rapporterar upptäckta aktörer — varumärken motorerna nämner som ni aldrig konfigurerat. Behandla listan som korrigeringen av er konfiguration.`,
      },
      {
        id: 'prompts',
        title: 'Prompts — vad ska frågas',
        content: `En prompt är en kundfråga ni vill vara svaret på. Bra prompts är specifika, på er marknads språk, och formulerade som en människa faktiskt skriver.

Skriv för avsikt, inte för nyckelord:

• Kategoriavsikt — "vilka plattformar säljer begagnad elektronik i Sverige?"
• Lokal avsikt — "bästa redovisningsbyrån i Falun".
• Jämförelseavsikt — "X eller Y för ett litet företag?"
• Problemavsikt — "hur kontrollerar jag skicket på en begagnad telefon innan köp?"

Undvik prompts som bara nämner ert eget varumärke. "Är Relovie bra?" kommer nämna er varje gång och lär er ingenting; den blåser upp er omnämnandegrad och döljer om ni syns när kunden inte redan känner er.

30-50 prompts är en fungerande portfölj. Under 20 blir dagstalen för brusiga att läsa.`,
      },
      {
        id: 'prompt-generator',
        title: 'Generera prompts med AI',
        content: `Konfiguration → Prompts → "Generate (AI)" expanderar varumärkesnamn, branschmall och valfri ort till 20-30 konkreta prompts.

Den arbetar från branschmallar med lokaliserade mönster per avsiktsgrupp och fyller platshållare — varumärke, konkurrent, kategori, roll, ort, år — kombinatoriskt. Utdata är en startportfölj, inte en färdig: läs igenom, ta bort det som inte matchar hur era kunder talar, och lägg till frågorna bara ni vet att de ställer.

Samma motor körs i wizarden Börja här, så prompts skapade där och här är av samma slag.`,
      },
    ],
  },

  {
    id: 'monitor',
    group: '2 · Övervakning',
    icon: 'monitor',
    sections: [
      {
        id: 'how-monitoring-works',
        title: 'Hur övervakningen fungerar',
        content: `Varje prompt skickas till varje valt motor som en ny fråga, utan minne av tidigare körningar och utan någon ledtråd om att ett varumärke mäts. Svaret analyseras sedan för fyra saker: om ni nämndes, var i svaret, i vilken ton, och vilka källor som citerades.

Resultaten hamnar i två lager, och att veta vilket en graf läser förklarar nästan alla skenbara motsägelser:

• Råa svar — en rad per prompt per motor per körning, med hela svarstexten. Det är vad CSV-exporter läser.
• Dagliga ögonblicksbilder — en aggregerad rad per motor, kategori och språk per dag. Det är vad varje trendgraf läser.

Eftersom de två lagren aggregerar olika kan en exporterad CSV och en trend på skärmen för samma period skilja sig något. Det är aggregeringsgränsen, inte ett fel i någon av dem.

Motorerna är inte deterministiska. Samma prompt kan ge ett annat svar en timme senare, vilket är skälet till att en enskild körning är svag evidens och en period är stark evidens.`,
      },
      {
        id: 'supported-engines',
        title: 'Motorer som bevakas',
        content: `Tre motorer bevakas, och de beter sig tillräckligt olika för att tal per motor betyder mer än genomsnittet.

• ChatGPT — normalt den högsta omnämnandegraden. Belönar strukturerade jämförelser, listor och beslutsramverk.
• Perplexity — normalt den tidigaste omnämnandepositionen, eftersom den är byggd kring att citera källor i svarets löptext. Belönar faktatätt innehåll med länkar i texten.
• Gemini — normalt den lägsta omnämnandegraden, och mest känslig för auktoritetssignaler: vem skrev detta, när, och är det märkt maskinläsbart.
Claude pensionerades av kostnadsskäl: den stod för 65 % av leverantörskostnaden men bara 10 % av körningarna, och på ett varumärke med 427 resultat gav den 4 användbara. De historiska mätningarna finns kvar i databasen och i råexporten, men motorn anropas inte längre och syns inte längre i uppdelningar per motor eller i kundrapporter.

Om en motor släpar långt efter medan de andra är friska är orsaken oftast strukturell snarare än ett synlighetsproblem i allmänhet. Ett gap på just Gemini pekar på saknad författare, saknade datum och saknad schema-märkning — se Optimera → Webbplatsgranskning.`,
      },
      {
        id: 'schedules',
        title: 'Vad som körs, och när',
        content: `Övervakningen körs automatiskt tre gånger per dag; resten av bakgrundsarbetet har egna scheman. Alla tider är UTC.

• Övervakning — 06:00, 12:00 och 18:00, varje dag.
• Rapportleverans — varannan sjätte timme, skickar de scheman som förfallit.
• GSC-synkronisering — 03:00 dagligen.
• Synkronisering av externa data — 04:00 dagligen.
• AEO-utdragsbrygga — 07:00 dagligen.
• Veckogenomgång — måndagar 07:00.
• Sammanfattningsmejl — måndagar 08:00.
• Uppdatering av nyckelord — måndagar 06:00.
• GEO-analys — måndagar 05:00.

En första fullständig genomgång är normalt klar inom 24 timmar efter att ett varumärke skapats. Ni kan alltid starta en körning manuellt från Övervakning → Live-övervakning istället för att vänta.`,
      },
      {
        id: 'workflows',
        title: 'Arbetsflöden — kördes bakgrundsarbetet?',
        content: `Arbetsflöden är körningsloggen för bakgrundsjobb. När ett tal ser gammalt ut är det den här sidan som säger om jobbet som producerar det kördes, misslyckades, eller aldrig startade.

Kontrollera den innan ni undersöker data: en tom panel någon annanstans i produkten är mycket ofta ett jobb som inte kördes, inte ett varumärke utan något att rapportera. De två fallen ser identiska ut överallt utom här.`,
      },
      {
        id: 'alerts',
        title: 'Aviseringar och webhooks',
        content: `Aviseringsregler meddelar er när något rör sig utan att ni tittar. Vanliga utlösare är ett synlighetsfall, en konkurrent som går om er, ett korrekthetsproblem, eller en citering som försvinner.

Leverans sker via e-post eller webhook. Mottagarna bor med regeln själv, inte i Inställningar — det ändrades, och Inställningar har inte längre ett fält för aviserings-e-post.

En webhook tar emot en JSON-payload som identifierar varumärket, regeln som utlöstes, det observerade värdet mot tröskeln, och en tidsstämpel. Peka den mot det ni redan använder för driftnotiser.

Aviseringar säger att något ändrats. De säger inte varför — det är vad Insikter-ytorna är till för.`,
      },
    ],
  },

  {
    id: 'insights',
    group: '3 · Insikter',
    icon: 'insights',
    sections: [
      {
        id: 'geo-score',
        title: 'GEO-poäng och dess fem pelare',
        content: `En komposit 0-100 med bokstavsbetyg som mäter hur väl ni är byggda för att hittas och citeras av generativa motorer. Det är ett viktat medelvärde av fem pelare:

• Citeringar — 30 %. Länkar motorerna er domän som källa, inte bara nämner ert namn? Nästan alltid den svagaste pelaren och alltid den med mest hävstång.
• Närvaro — 25 %. Hur ofta ni nämns alls.
• Auktoritet — 20 %. Hur ofta ni aktivt rekommenderas istället för att räknas upp.
• Position — 15 %. Hur tidigt i svaret ni framträder.
• Förtroende — 10 %. Sentiment, omskalat till 0-100.

Läs betyget som ett utgångsläge, inte som en dom. Ett D intill ett friskt AVI betyder att resultaten ligger före strukturen — och de två svagaste pelarna, Citeringar och Position, är precis de två som svarar snabbast på arbete med sajten.

Pelarna behöver övervakningsdata. Ett varumärke utan körningar ger ingen poäng och visar ett förklarande tomt läge istället för en nolla.`,
      },
      {
        id: 'fan-out',
        title: 'Sökfrågor — vad motorerna faktiskt söker på',
        content: `När en fråga beror på vad som är sant just nu svarar motorn inte ur minnet. Den gör om er fråga till en till tre verkliga webbsökningar och sammanfattar det den hittar. Det är de strängarna — inte er prompt — ni konkurrerar om.

De är sällan samma sak. En verklig mätning från 19 augusti 2026: prompten "Vilka sajter är bäst för att köpa begagnad elektronik i Sverige 2026?" fick Gemini att söka på "basta sajter begagnad elektronik sverige" och "kop begagnad elektronik garanti sverige". Diakriterna borta, årtalet borta, en fråga blev två sökningar, och ett begrepp prompten aldrig innehöll — garanti — lades till.

Den praktiska följden: en sida anpassad efter promptens formulering är anpassad efter en sträng ingen sökte på. Kolumnen Avvikelse mäter det avståndet, så ett högt tal visar var sidan och sökningen har glidit isär.

Vad sidan visar:

• Täckning — hur många körningar som gav sökfrågor alls. Två tal hålls isär med avsikt: ej fångat betyder att vi inte kunde se sökningarna, svarade utan att söka betyder att motorn använde modellens minne istället för webben. Att behandla det första som noll sökningar vore en lögn om motorn.
• Sökningar per körning — hur mycket en fråga expanderar. Vanligtvis en till tre.
• Rangordningen — varje söksträng, hur ofta den kördes, på vilka motorer, hur ofta ni nämndes och citerades när den kördes, och vilka av era prompts som utlöste den.

Rangordningen sätter volym först och sedan lägst omnämnandegrad, så de sökningar motorerna kör hela tiden och där ni saknas hamnar överst. Det är arbetslistan.

En uttalad begränsning: Perplexity visar inte vilka sökningar den kör. Dess svar mäts normalt överallt annars i produkten, men här kan den inte bidra, och dess körningar räknas som ej fångade — inte som noll.

Insamlingen startade 19 augusti 2026. Körningar före det datumet saknar sökfrågor och går inte att återskapa.`,
      },
      {
        id: 'citations-rate',
        title: 'Citat — graden över tid',
        content: `Citeringsgraden är andelen svar som nämner er, ritad över tid som en trend för alla motorer plus en uppdelning per motor, med konkurrenternas nivåer på samma axel.

Den här sidan svarar på hur ofta. Citatkällor svarar på av vem. De läser olika fält och kommer inte att stämma överens.

De två AI-beredskapspanelerna på sidan — crawler-åtkomst och citation capture — ligger här med avsikt: en citeringsgrad nära noll är oftast ett crawler-problem, och svaret hör hemma intill symptomet.

Konkurrentnivåerna täcker bara konkurrenter ni konfigurerat. En rival motorerna nämner men ni aldrig listat syns inte alls här.`,
      },
      {
        id: 'citation-sources',
        title: 'Citatkällor — vilka domäner citeras',
        content: `Den rangordnade listan över domäner motorerna citerar när de besvarar era prompts, inklusive er egen.

Att vara den mest citerade domänen på sin marknad är en stark position, och den är förenlig med en svag Citeringar-pelare i GEO-poängen: rangordningen jämför er med andra, pelaren mäter hur ofta en citering följer med ett omnämnande. Ni kan leda jämförelsen och samtidigt misslyckas med att omvandla de flesta omnämnanden till länkar.

Källmixen är i sig ett fynd. Att kommersiella sajter dominerar betyder att motorerna hämtar där köp sker; att forum och communityn förekommer betyder att användaropinion formar er beskrivning; att nyhetsmedia saknas betyder att pressbevakningen inte når motorerna.`,
      },
      {
        id: 'sentiment',
        title: 'Sentiment, aspekter, källor och teman',
        content: `Fyra vyer av vad motorerna säger om er.

• Genomsnittligt sentiment — fördelningen positiv / neutral / negativ för perioden.
• Aspekter — sentiment upplöst per ämne (pris, service, kvalitet) istället för per svar, så att "bra överlag men svag på pris" förblir synligt istället för att jämnas ut.
• Sentiment per källa — samma fördelning grupperad efter den domän motorn citerade. Det är vad som visar om en negativ ton går tillbaka till en enda tredjepartssida.
• Teman — semantiska kluster av svarstexten, så att återkommande berättelser framträder utan att någon läser hundratals svar.

Det finns även en manuell analysator: klistra in valfri text och få samma klassificering. Den är medvetet tillståndslös — inget sparas och ingen poäng påverkas.

Aspektetiketterna kommer från modellen, inte från en fast lista, så de glider över långa perioder och är inte säkra som permanenta grafkategorier.`,
      },
      {
        id: 'brand-overview-gsc',
        title: 'Varumärkesöversikt — bryggan till Search Console',
        content: `Prestandavyn per varumärke, och det enda stället i produkten som visar Google Search Console-data. Det gör den till platsen där ni kan fråga om AI-exponeringen driver varumärkessökningar eller tyst äter era organiska klick.

Två paneler finns ingen annanstans:

• Striking distance — sökfrågor som rankar strax under gränsen, där en liten innehållsfix omvandlas direkt till trafik.
• Kannibalisering — flera av era URL:er som konkurrerar om en sökfråga och delar auktoriteten mellan sig.

Båda kräver en ansluten Search Console-egendom. Utan en sådan renderas de tomma, och orsaken är en saknad integration snarare än saknad prestanda.`,
      },
      {
        id: 'aeo-snippets',
        title: 'AEO-utdrag',
        content: `Svarsfärdiga fråga-svar-par härledda från vad människor faktiskt frågar, formaterade så att en motor kan lyfta dem som ett direkt svar.

Poängen är extraherbarhet. En motor som citerar ert svar ordagrant är den starkaste citering ni kan få, och den beror på att svaret är det första i blocket, självbärande, och märkt maskinläsbart.

Utdrag exporteras också som schema-märkning för era egna sidor, vilket matar den strukturerade datasignalen som mäts i Webbplatsgranskning.`,
      },
      {
        id: 'keywords',
        title: 'Nyckelordsbevakning',
        content: `Orden som återkommer i svar där ni nämns, följda över tid och korrelerade med omnämnanden.

Läs det som vokabulär, inte som en SEO-nyckelordslista. Vad språket berättar är vilket samtal ni är i: köpord betyder att ni framträder i köpbeslut, och kategoriord som inte matchar er positionering betyder att motorerna har sorterat in er under fel sak.

Att konkurrentnamn ligger högt i listan är normalt och användbart — det bekräftar vem ni faktiskt jämförs med.`,
      },
      {
        id: 'competitor-sov',
        title: 'Konkurrent — röstandel och upptäckta rivaler',
        content: `Två mått på en sida, och att blanda ihop dem är det enklaste sättet att missförstå produkten.

• Röstandel — av alla varumärkesomnämnanden i svaren, vilken andel är er. Detta är tyngden.
• Samomnämnandegrad — i vilken andel av svaren varje konkurrent förekommer vid sidan av er. Detta är bredden.

En konkurrent kan förekomma i fler svar än ni och samtidigt ha en betydligt mindre röstandel, eftersom ni nämns oftare och tidigare i de svar ni väl är med i. Båda talen är korrekta; de mäter olika saker. Bredd är räckvidd, tyngd är framträdande plats.

Upptäckta aktörer är varumärken motorerna nämner som inte finns i er konfiguration. Den listan är hur en felaktig konkurrensbild hittas och rättas.

Konkurrentanalysen är den enda debiterade åtgärden här: den anropar en modell och sparar resultatet. Röstandelen beräknas från data ni redan har och kostar ingenting.`,
      },
      {
        id: 'snapshots',
        title: 'Ögonblicksbilder — aggregeringslagret',
        content: `Ögonblicksbilder omvandlar råa svar till den dagliga serie varje trendgraf läser: en rad per motor, kategori och språk per dag, med er citeringsgrad och varje konfigurerad konkurrents grad för den delmängden.

Detta lager är bärande. Ser en trend fel ut — kontrollera här innan ni misstänker grafen.

Att räkna om en dag är säkert och upprepbart. En dag utan övervakningskörningar ger ingen rad alls istället för en nollrad — så en lucka i en graf betyder ingen data, inte ett fall till noll.`,
      },
      {
        id: 'ai-funnel',
        title: 'AI-tratt — den kundfärdiga berättelsen',
        content: `Presentationsytan. Där de andra Insikter-sidorna äger ett mätvärde var, ordnar den här dem i en tratt ni kan gå igenom uppifrån och ner i ett möte.

• Topp — synlighet och röstandel: talet som öppnar samtalet.
• Mitt — verkliga AI-svar, ordagrant, med ert varumärke markerat. Det är steget som övertygar: procent är abstrakt, en motor som beskriver ert företag med sina egna ord är det inte.
• Botten — tillväxt i varumärkessökningar, AI-assist-domen, och citeringsfärskhet för de sidor motorerna faktiskt hämtar.

Tre exporter: en executive summary byggd på fyra frågor (var syns vi, hur korrekt beskrivs vi, vinner eller förlorar vi, förbättras affärsmålen), en nivåindelad kunddeck, och en sexmånaderstrend.

Bottensteget kräver Search Console-data. Utan det renderas den mest kundrelevanta delen av tratten tom.`,
      },
      {
        id: 'reports',
        title: 'Rapporter och schemalagd leverans',
        content: `Två skilda saker på en sida: att exportera nu, och att schemalägga leverans.

Exportera nu ger CSV, JSON eller PDF för ett varumärke och ett valfritt datumintervall. PDF:en bär white-label-branding — er färg, logotyp och kundnamn — så den kan gå till en kund utan redigering.

Schemalagd leverans mejlar en rapport dagligen, veckovis eller månadsvis till upp till 20 mottagare. Schemat registrerar när det senast skickade, hur många gånger, och senaste felet, så ett schema som tyst misslyckats kan diagnostiseras från listan.

Två varningar. Inget aviserar när ett schema misslyckas — felet registreras, det annonseras inte. Och exporter läser råa svar istället för dagliga ögonblicksbilder, så en exporterad CSV kan skilja sig något från en trend på skärmen för samma period.`,
      },
      {
        id: 'scan-history',
        title: 'Skanningshistorik',
        content: `Loggen över enstaka analyser ni körde från Innehållsgranskning och Innehållsoptimering mot inklistrad text eller en URL. Det är inte historiken över schemalagd varumärkesövervakning — den finns i Övervakning och i ögonblicksbildernas trender.

Posterna bär en poäng, källan, om indata var text eller URL, motor och modell som användes, och en tidsstämpel, med sökning, filtrering och export till CSV eller JSON.

Två gränser värda att känna till: listan håller de 50 senaste posterna, och "rensa historik" tömmer vyn utan att radera något på servern — ladda om och posterna kommer tillbaka.`,
      },
    ],
  },

  {
    id: 'optimize',
    group: '4 · Optimera',
    icon: 'optimize',
    sections: [
      {
        id: 'strategy-advisor',
        title: 'Strategirådgivare',
        content: `Syntetiserar allt Insikter mäter till en prioriterad berättelse, grundad i era levande varumärkesdata istället för i generiska råd.

Använd den när ni vill ha argumentet — varför denna åtgärd före den, och vad den bör flytta. Använd Rekommendationer när ni vill ha den bestående listan att arbeta igenom.

Där en åtgärd bär ett förväntat poänglyft är den siffran en modelluppskattning ankrad i GEO-poängens vikter. Den är gedigen för att bestämma arbetsordning. Den är inte en garanti, och den bör aldrig presenteras för en kund som en sådan.`,
      },
      {
        id: 'recommendations',
        title: 'Rekommendationer',
        content: `Den bestående åtgärdslistan. Genererade rekommendationer sparas med det datafönster de kom från, så ni alltid kan se vad som rekommenderades, när, och på vilken grund.

Var och en bär en prioritet — hög, medel eller låg — plus ett motiv och konkreta åtgärder. Prioriteten sätts av modellen, så två genereringar över samma data kan ordna samma åtgärd olika. Behandla den som vägledning snarare än som en stabil rangordning.

Att generera igen ersätter inte den tidigare uppsättningen; den läggs till historiken. Inget slås samman eller ersätts, så listan växer och äldre poster förblir synliga som ett register.

Veckogenomgången ställer det som rekommenderades mot det som faktiskt rörde sig.`,
      },
      {
        id: 'content-audit',
        title: 'Innehållsgranskning — vilken URL som helst, två granskningar',
        content: `En fullständig beredskapsgranskning av en enskild URL. Två oberoende granskningar körs mot samma adress: en innehållsanalys av hur citerbar sidan är, och en deterministisk teknisk granskning.

Den tekniska granskningen kontrollerar transport (HTTPS, blandat innehåll, svarsstorlek, time to first byte), indexering (titel, meta description, robots, canonical, hreflang), Core Web Vitals, och AI-citerbarhet.

Två av dessa kontroller finns specifikt för AI-motorer och inte för klassisk SEO: om jämförelsetabeller är extraherbara, eftersom motorerna lyfter dem ordagrant, och om sidan bär en signal om senaste uppdatering, eftersom motorerna nedviktar innehåll utan färskhetsmarkör.

De två granskningarna ger separata poäng och inget förenar dem, så ni kan se en stark innehållspoäng intill en svag teknisk. Åtgärda de tekniska bristerna först — de begränsar allt annat.

Core Web Vitals här är labbmätningar från en enda hämtning. De kommer inte att matcha fältdata en kund citerar från Search Console.`,
      },
      {
        id: 'content-optimizer',
        title: 'Innehållsoptimering och de fem citeringssignalerna',
        content: `Fördjupningsverktyget. Klistra in text eller peka på en URL, välj leverantör, modell och målmotor, och få en redigerbar uppdelning av varför innehållet får sin poäng: avsiktsklassificering, uppdelning per motor, nyckelordstäthet, och expanderbara förslag.

Dess Citation Quality-kort är den viktiga delen, och det är deterministiskt — rena heuristiker över HTML och text, inget modellanrop, så samma indata ger alltid samma poäng. Det mäter fem signaler med observerat citeringslyft:

• Tydlighet och sammanfattning — +33 %.
• E-E-A-T-signaler, det vill säga synligt författarskap, meriter och datum — +30 %.
• Fråga-svar-format — +25 %.
• Sektionsstruktur — +23 %.
• Strukturerad data — +22 %.

Sekundära formheuristiker kommer från forskning om featured snippets: låg läsnivå, alt-textdensitet, listor med minst 8 poster, tabeller med minst 5 rader och 7 kolumner, minst 10 utgående länkar. Den innehållsform som vinner Googles featured snippets vinner också AI-citeringar.

Observera att de två poängen på sidan beter sig olika: totalanalysen kommer från en modell och varierar mellan körningar på identiska indata, medan Citation Quality inte gör det. Om ett tal ändras när ni inte ändrat något var det det modellbaserade.

Procenten är korrelationer från en stor studie, inte kausala löften för en enskild sida. Använd dem för att prioritera, inte för att garantera.`,
      },
      {
        id: 'site-audit',
        title: 'Webbplatsgranskning — är mitt varumärke AI-redo?',
        content: `Den konsoliderade beredskapskontrollen för ett varumärke, i fem paneler ordnade efter beroende. Åtgärda röda poster högst upp innan något nedanför optimeras.

• Grunder — HTTPS, llms.txt, sitemap. Om dessa fallerar betyder inget annat något.
• AI-crawler-åtkomst — er robots.txt läst ur GPTBots, ClaudeBots, PerplexityBots, Google-Extendeds och de övrigas perspektiv. Att blockera dem är det enda misstag som gör varje annan insats meningslös.
• Citation capture — om era befintliga övervakningsdata visar att domänen faktiskt citeras.
• Topic Finder — era citeringsluckor klustrade till rangordnade innehållsmöjligheter.
• Citation Quality — er startsida poängsatt mot de fem signalerna ovan.

Den sista panelen körs bara när ni klickar Score, eftersom den hämtar er live-sajt och att göra det vid varje sidvisning skulle träffa er server tyst.

Den poängsätter specifikt startsidan. Om ert citerbara innehåll finns på undersidor: granska dem var för sig i Innehållsgranskning.

Det finns inget enda "AI-redo"-tal här — fem paneler, fem domar. Det närmaste en komposit är GEO-poängen, som läser andra indata och inte kommer matcha panel för panel.`,
      },
      {
        id: 'content-generator',
        title: 'Innehållsgenerator',
        content: `Skriver utkast till Markdown-artiklar byggda mot samma fem citeringssignaler som Optimeringen mäter, och poängsätter sedan sin egen utdata med samma poängsättare. Det sluter kretsen: plattformen mäter vad som citeras och genererar innehåll formad för det, med en enda definition av kvalitet i båda riktningarna.

Ni väljer en avsiktsgrupp och en längd. Varumärkeskontexten sätts samman från varumärkesposten istället för att skrivas in på nytt.

Eftersom den poängsätter sig själv med de heuristiker den optimerat för betyder en hög poäng "formad som poängsättaren belönar", inte "verifierat citerbar". Bara övervakningen kan bekräfta det senare, veckor senare.

Utdata är ett utkast. Det finns ingen faktakontroll och ingen tillämpning av varumärkesröst utöver prompten — redigera innan publicering.

Generering är begränsad till 5 per minut och användare: generöst för en människa, medvetet ogästvänligt mot en loop.`,
      },
      {
        id: 'engine-info',
        title: 'Motorinfo — leverantörsstatus',
        content: `Statustavlan för AI-leverantörerna. Den besvarar frågan som blockerar allt annat när något går fel: misslyckas övervakningen på grund av våra data eller på grund av en död leverantörsnyckel?

Tillgänglighet rapporteras i fyra tillstånd istället för två, eftersom en nyckel med tömt saldo autentiserar utmärkt och sedan vägrar varje debiterad förfrågan:

• Konfigurerad — en nyckel finns.
• Tillgänglig — den autentiserar och har kredit.
• Kredit tömd — den autentiserar men saldot är slut. Oanvändbar.
• Kredit okänd — konfigurerad och nåbar, men inget debiterat anrop har bekräftat den ännu.

Kredit okänd är det ärliga tillståndet för en nyss tillagd nyckel. Plattformen hävdar inte att en nyckel fungerar innan ett verkligt anrop bevisat det.

Trots routenamnet är den här sidan inte övervakningen. Den kör inga prompts och rör inga av era data.`,
      },
    ],
  },

  {
    id: 'account',
    group: '5 · Konto',
    icon: 'account',
    sections: [
      {
        id: 'settings',
        title: 'Inställningar',
        content: `Fyra kort: er profil, era API-nycklar för AI-leverantörer, aviseringsinställningar, och gränssnittsspråket — English, Italiano eller Svenska.

Leverantörsnycklar krypteras i vila med AES-256-GCM och visas alltid maskerade. När en nyckel sparats kan den inte läsas tillbaka, bara ersättas. Nycklar kan inaktiveras utan att raderas, vilket är vad ni vill när en leverantör krånglar: stäng av, behåll raden, aktivera igen senare utan att klistra in hemligheten på nytt.

Inget validerar en nyckel när ni sparar den. Ett skrivfel framträder senare som en otillgänglig leverantör i Motorinfo, eller som körningar som faller igenom till nästa leverantör.

Gränssnittsspråket är skilt från ett varumärkes marknadsspråk. Att ändra det här ändrar inte på vilket språk era frågor ställs.`,
      },
      {
        id: 'roles-sharing',
        title: 'Roller och delade varumärken',
        content: `Varumärkesdata delas per varumärke, och åtkomst finns i tre nivåer: viewer, editor och owner, i ökande ordning av behörighet.

Viewers läser. Editors ändrar konfiguration och utlöser åtgärder som kostar pengar eller skickar data utåt — att generera en artikel, att skapa ett rapportschema. Owners äger dessutom varumärkesposten.

Regeln att internalisera: ett varumärkes data tillhör varumärket, inte den som råkade skapa en rad. En editor som skriver och en viewer som läser tittar på samma data, och uppgiften om vem som skapade något är härkomst, inte behörighet.

Åtgärder med utåtriktad eller debiterad effekt är begränsade till editor-nivå just eftersom de antingen kostar pengar eller skickar varumärkesdata till tredje part.`,
      },
    ],
  },

  {
    id: 'not-enabled',
    group: 'Inte aktivt här',
    icon: 'disabled',
    sections: [
      {
        id: 'commercial-layer',
        title: 'Fakturering, Krediter och API-kostnader',
        content: `Denna driftsättning körs i unlimited-läge. Hela det kommersiella lagret är medvetet avstängt:

• Varje förfrågan tillåts utan kostnad och förbrukar inget saldo.
• Kreditredovisningen är avstängd.
• Stripe-checkout är inte ansluten.

De tre sidorna finns fortfarande och var och en förklarar sitt läge, så att ett gammalt bokmärke renderar något meningsfullt istället för ett trasigt kassaflöde. Ingen av dem syns i navigeringen.

Inget togs bort — kostnadsaggregeringen fungerar fortfarande bakom kulisserna och leverantörskostnaden syns i driftloggarna. Att aktivera lagret igen är en konfigurationsändring, inte en ombyggnad.

Behöver ni kostnad per funktion anger det interna arkivet under docs/features kostnadsprofilen för varje yta. Utan en mätare exponerad i produkten är det arkivet kostnadsmodellen.`,
      },
    ],
  },

  {
    id: 'glossary',
    group: 'Ordlista',
    icon: 'glossary',
    sections: [
      {
        id: 'glossary-terms',
        title: 'Begrepp och definitioner',
        content: `• AEO — Answer Engine Optimization. Att strukturera innehåll så att motorerna kan extrahera det som ett direkt svar.
• GEO — Generative Engine Optimization. Den bredare strategin för att vara synlig i genererade svar: djup, auktoritet, strukturerad data, citeringar.
• AVI — AI Visibility Index. Komposit 0-100; det dagliga nyckeltalet.
• GEO-poäng — komposit 0-100 med bokstavsbetyg som mäter hur väl ni är byggda för att bli citerade. AVI är resultatet, GEO-poängen förmågan.
• Citeringsgrad — andelen bevakade svar som nämner ert varumärke. Omnämnanden ÷ totalt antal svar × 100.
• Omnämnande — att en motor säger ert namn. Räckvidd.
• Citering — att en motor länkar er domän som källa. Förtroende.
• Omnämnandeposition — meningen där ni först förekommer. Lägre är bättre.
• Röstandel — er andel av alla varumärkesomnämnanden. Tyngd.
• Samomnämnandegrad — andelen svar där en konkurrent förekommer vid sidan av er. Bredd.
• Sentiment — ton gentemot ert varumärke, från -1,0 till +1,0.
• Aspekt — ett specifikt ämne inom ett svar som sentimentet upplöses mot, till exempel pris eller service.
• Hallucination — att en motor anger något falskt om er som faktum: fel datum, påhittade produkter, uppdiktade utmärkelser.
• Motor — en AI-plattform: ChatGPT, Gemini eller Perplexity.
• Prompt — en fråga vi skickar till motorerna som ställföreträdare för en kundfråga.
• Ögonblicksbild — dagens aggregat av övervakningsresultaten. Det varje trendgraf läser.
• Alias — en alternativ stavning av ert varumärke som detekteringen måste känna till.
• Upptäckt aktör — ett varumärke motorerna nämner som ni aldrig konfigurerat som konkurrent.
• Svaret först — att skriva så att första meningen innehåller svaret, eftersom motorerna hoppar över inledningar.
• E-E-A-T — de synliga signalerna om vem som står bakom innehållet och när det skrevs.
• Schema / JSON-LD — maskinläsbar märkning som talar om vad en sida innehåller.
• llms.txt — en fil som presenterar ert varumärke direkt för AI-motorerna.
• Striking distance — en sökfråga som rankar strax under synlighetsgränsen, där en liten fix omvandlas till trafik.
• Kannibalisering — flera av era URL:er som konkurrerar om en sökfråga och delar auktoriteten.
• Roll — viewer, editor eller owner; vad en person får göra med ett varumärke.`,
      },
    ],
  },
]
