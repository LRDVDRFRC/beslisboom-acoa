/**
 * Cloudflare Worker — AI-personalized beslisboom results
 * ======================================================
 * Deploy this to Cloudflare Workers, then set AI_ENDPOINT in v2.html
 * to the worker URL (e.g. https://beslisboom-ai.youraccount.workers.dev).
 *
 * Setup:
 *   1. Create a Cloudflare account (free) at https://dash.cloudflare.com
 *   2. Install Wrangler: npm install -g wrangler
 *   3. wrangler login
 *   4. wrangler secret put ANTHROPIC_API_KEY   (paste your key)
 *   5. wrangler deploy ai-worker.js --name beslisboom-ai
 *   6. Copy the worker URL into v2.html's AI_ENDPOINT variable
 *
 * Cost: ~$0.005–$0.01 per result (Claude Haiku).
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { answers, outcome, name } = await request.json();

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

Schrijf een persoonlijke, warme analyse van maximaal 120 woorden in het Nederlands. Benoem specifiek wat ze goed doet (op basis van "Ja"-antwoorden) en waar de groeikans zit (op basis van "Nee" of onzekere antwoorden). Sluit af met een bemoedigende zin. Gebruik geen opsommingstekens, schrijf in vloeiende alinea's. Wees specifiek, niet generiek. Gebruik geen markdown-opmaak (geen #, **, __ etc). Schrijf platte tekst.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Anthropic API error:', err);
        return new Response(JSON.stringify({ text: null }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || null;

      return new Response(JSON.stringify({ text }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ text: null }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
