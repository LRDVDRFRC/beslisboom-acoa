export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { mode, messages, nextDimension, name } = req.body;

    if (mode === 'respond') {
      const systemPrompt = `Je bent Britt van A Cup of Ambition — een Nederlands bedrijf dat vrouwen helpt om betaald spreker te worden. Je voert een warm, persoonlijk gesprek.

Je taak: reageer kort en warm op het antwoord van de gebruiker (max 2 zinnen), en stel dan een nieuwe vraag over het volgende onderwerp: "${nextDimension}".

Regels:
- Gebruik je/jij, schrijf in het Nederlands
- Wees bemoedigend maar oprecht
- Reageer specifiek op wat ze zei (niet generiek)
- Sluit af met een open vraag over het volgende onderwerp
- Max 60 woorden totaal
- Geen markdown-opmaak (geen #, **, __ etc). Schrijf platte tekst.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.Antrkey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: systemPrompt,
          messages: messages,
        }),
      });

      if (!response.ok) {
        console.error('Anthropic API error:', await response.text());
        return res.status(200).json({ reply: null });
      }

      const data = await response.json();
      return res.status(200).json({ reply: data.content?.[0]?.text || null });
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
