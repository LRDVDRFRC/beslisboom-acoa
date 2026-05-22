export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { mode, messages, currentDimension, coveredDimensions, name } = req.body;

    if (mode === 'respond') {
      const allDimensions = [
        { key: 'verhaal', desc: 'haar verhaal, inzichten en ervaringen die waardevol zijn voor publiek' },
        { key: 'markt', desc: 'of er vraag is naar haar onderwerp vanuit bedrijven, events of organisaties' },
        { key: 'keynote', desc: 'of ze een keynote of presentatie heeft uitgewerkt met opbouw en kernboodschap' },
        { key: 'podium', desc: 'of ze met plezier en zelfvertrouwen op het podium kan staan' },
        { key: 'ervaring', desc: 'of ze podiumervaring heeft en bewijs van waarde (testimonials, video, betaalde optredens)' },
        { key: 'zichtbaarheid', desc: 'of ze zichtbaar en vindbaar is als spreker en bereid is daarin te investeren' },
      ];

      const covered = coveredDimensions || [];
      const remaining = allDimensions.filter(d => !covered.includes(d.key));
      const current = allDimensions.find(d => d.key === currentDimension);
      const nextUncovered = remaining.find(d => d.key !== currentDimension);

      const systemPrompt = `Je bent Britt van A Cup of Ambition — een Nederlands bedrijf dat vrouwen helpt om betaald spreker te worden. Je voert een warm, persoonlijk gesprek.

Het huidige onderwerp is: "${current ? current.desc : currentDimension}".
${nextUncovered ? `Het volgende onderwerp na dit is: "${nextUncovered.desc}".` : 'Dit is het laatste onderwerp.'}
Reeds besproken: ${covered.length > 0 ? covered.join(', ') : 'nog niets'}.

BELANGRIJK — Beoordeel eerst het antwoord van de gebruiker:
A) Als ze een inhoudelijk antwoord gaf over "${currentDimension}" (ook al is het kort of onzeker) → reageer warm, en stel dan een vraag over het VOLGENDE onderwerp. Eindig je antwoord met de tag [COVERED]
B) Als ze verward is, om uitleg vraagt, "huh" zegt, of NIET inhoudelijk antwoordde → leg het onderwerp "${currentDimension}" uit op een toegankelijke manier en stel de vraag opnieuw. Eindig ZONDER [COVERED]

Regels:
- Gebruik je/jij, schrijf in het Nederlands
- Wees bemoedigend en warm
- Reageer specifiek op wat ze zei
- Max 80 woorden (exclusief de tag)
- Geen markdown-opmaak (geen #, **, __ etc)
- De [COVERED] tag moet ALTIJD op een eigen regel helemaal aan het eind staan, OF helemaal weggelaten worden`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.Antrkey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 250,
          system: systemPrompt,
          messages: messages,
        }),
      });

      if (!response.ok) {
        console.error('Anthropic API error:', await response.text());
        return res.status(200).json({ reply: null, covered: false });
      }

      const data = await response.json();
      let text = data.content?.[0]?.text || '';

      // Parse [COVERED] tag
      const isCovered = text.includes('[COVERED]');
      text = text.replace(/\[COVERED\]/g, '').trim();

      return res.status(200).json({ reply: text || null, covered: isCovered });
    }

    if (mode === 'score') {
      const systemPrompt = `Je bent een expert beoordelaar voor A Cup of Ambition. Analyseer het volgende gesprek en beoordeel de gebruiker op 6 dimensies.

Dimensies (geef per dimensie een score van 0-100):
- verhaal: Heeft ze waardevolle inzichten of ervaringen om te delen?
- markt: Is er vraag naar haar onderwerp?
- keynote: Heeft ze een presentatie uitgewerkt?
- podium: Kan ze met plezier en zelfvertrouwen presenteren?
- ervaring: Heeft ze podiumervaring en bewijs van waarde?
- zichtbaarheid: Is ze vindbaar als spreker?

Bepaal de uitkomst:
- "ready": gemiddeld >= 65% en geen dimensie onder 30%
- "work": motivatie is er maar er zijn gaps
- "not_ready": niet bereid te investeren of gemiddeld < 30%

Schrijf ook een persoonlijke, warme analyse van max 120 woorden in het Nederlands. Spreek haar aan met je/jij. Benoem wat ze goed doet en waar de groeikans zit. Wees specifiek op basis van wat ze verteld heeft. Geen markdown.

Antwoord ALLEEN met valid JSON in dit formaat:
{"scores":{"verhaal":0,"markt":0,"keynote":0,"podium":0,"ervaring":0,"zichtbaarheid":0},"outcome":"ready","text":"..."}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.Antrkey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Gesprek met${name ? ' ' + name : ' de gebruiker'}:\n\n${messages.map(m => (m.role === 'user' ? 'Gebruiker' : 'Britt') + ': ' + m.content).join('\n')}\n\nBeoordeel dit gesprek en geef je analyse als JSON.` }],
        }),
      });

      if (!response.ok) {
        console.error('Anthropic API error:', await response.text());
        return res.status(200).json({ scores: null });
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json(parsed);
      } catch (e) {
        console.error('JSON parse error:', e, text);
        return res.status(200).json({ scores: null });
      }
    }

    return res.status(400).json({ error: 'Invalid mode' });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(200).json({ reply: null, scores: null });
  }
}
