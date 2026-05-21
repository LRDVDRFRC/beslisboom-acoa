export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { answers, outcome, name } = req.body;

    const dimensionMap = {
      q1: 'Verhaal (inzichten/ervaringen)',
      q2: 'Marktvraag (is er vraag naar het onderwerp)',
      q3: 'Keynote (presentatie uitgewerkt)',
      q4: 'Podiumkracht (plezier en zelfvertrouwen)',
      q5: 'Ervaring (podiumervaring en bewijs van waarde)',
      q6: 'Zichtbaarheid (vindbaar als spreker)',
      q_explore: 'Bereidheid om unieke verhaal te onderzoeken',
      q_invest: 'Bereidheid om te investeren',
    };

    const answerSummary = answers
      .map((a) => `- ${dimensionMap[a.nodeId] || a.nodeId}: ${a.answer}`)
      .join('\n');

    const outcomeLabels = {
      ready: 'Klaar om betaald spreker te worden',
      work: 'Er is werk aan de winkel (motivatie is er, skills/positionering nog niet)',
      not_ready: 'Nog niet klaar (niet bereid om te investeren)',
    };

    const prompt = `Je bent een warme, bemoedigende coach van A Cup of Ambition — een Nederlands bedrijf dat vrouwen helpt om betaald spreker te worden. Je spreekt de gebruiker direct aan met "je/jij".

Een gebruiker${name ? ' genaamd ' + name : ''} heeft zojuist een test gedaan om te ontdekken of ze klaar is om betaald spreker te worden. Hier zijn haar antwoorden:

${answerSummary}

Uitkomst: ${outcomeLabels[outcome] || outcome}

Schrijf een persoonlijke, warme analyse van maximaal 120 woorden in het Nederlands. Benoem specifiek wat ze goed doet (op basis van "Ja"-antwoorden) en waar de groeikans zit (op basis van "Nee" of onzekere antwoorden). Sluit af met een bemoedigende zin. Gebruik geen opsommingstekens, schrijf in vloeiende alinea's. Wees specifiek, niet generiek.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.Antrkey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', await response.text());
      return res.status(200).json({ text: null });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || null;

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Personalize error:', err);
    return res.status(200).json({ text: null });
  }
}
