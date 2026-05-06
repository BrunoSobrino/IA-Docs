const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE API KEYS
//  Ponlas como variables de entorno en Vercel:
//    Settings → Environment Variables → agregar cada una
// ═══════════════════════════════════════════════════════════════════════════════
const GROQ_API_KEY   = process.env.GROQ_API_KEY   || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Modelos disponibles por proveedor ───────────────────────────────────────
const PROVIDERS = {
    groq: {
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey:  () => GROQ_API_KEY,
        models: {
            'default':    'llama-3.3-70b-versatile',  // Recomendado — rápido y capaz
            'fast':       'llama-3.1-8b-instant',      // Ultra rápido, respuestas cortas
            'smart':      'llama-3.3-70b-versatile',   // Mayor razonamiento
            'glm-4.6':    'llama-3.3-70b-versatile',   // Alias de compatibilidad
            'glm-4.5':    'llama-3.3-70b-versatile',
            'chatglm':    'llama-3.1-8b-instant',
            'z1-32b':     'llama-3.3-70b-versatile',
        }
    },
    gemini: {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey:  () => GEMINI_API_KEY,
        models: {
            'default':    'gemini-2.0-flash',
            'fast':       'gemini-2.0-flash',
            'smart':      'gemini-2.5-flash-preview-05-20',
            'glm-4.6':    'gemini-2.0-flash',
            'glm-4.5':    'gemini-2.5-flash-preview-05-20',
            'chatglm':    'gemini-2.0-flash',
            'z1-32b':     'gemini-2.5-flash-preview-05-20',
        }
    }
};

// ─── Llamada a cualquier proveedor OpenAI-compatible ─────────────────────────
async function callProvider(providerName, modelAlias, messages) {
    const provider   = PROVIDERS[providerName];
    const apiKey     = provider.apiKey();
    const model      = provider.models[modelAlias] || provider.models['default'];

    if (!apiKey) throw new Error(`API Key de ${providerName} no configurada.`);

    console.log(`[AI] Usando ${providerName} → modelo: ${model}`);

    const response = await axios.post(
        `${provider.baseURL}/chat/completions`,
        {
            model,
            messages,
            max_tokens:  4096,
            temperature: 0.7,
            stream:      false,   // Sin stream — más simple y confiable en Vercel
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type':  'application/json',
            },
            timeout: 55000,   // 55s (límite de Vercel Hobby es 60s)
        }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${providerName} no retornó contenido.`);

    console.log(`[AI] Respuesta recibida — ${content.length} caracteres`);
    return content.trim();
}

// ─── Función principal con fallback automático ────────────────────────────────
async function chat(messages, modelAlias = 'default') {
    const errors = [];

    // Intentar Groq primero (más rápido)
    if (GROQ_API_KEY) {
        try {
            return await callProvider('groq', modelAlias, messages);
        } catch (err) {
            console.warn(`[AI] Groq falló: ${err.message}. Intentando Gemini...`);
            errors.push(`Groq: ${err.message}`);
        }
    }

    // Fallback a Gemini
    if (GEMINI_API_KEY) {
        try {
            return await callProvider('gemini', modelAlias, messages);
        } catch (err) {
            console.error(`[AI] Gemini también falló: ${err.message}`);
            errors.push(`Gemini: ${err.message}`);
        }
    }

    // Si ninguno funciona
    throw new Error(
        errors.length > 0
            ? `Todos los proveedores fallaron — ${errors.join(' | ')}`
            : 'No hay API Keys configuradas. Agrega GROQ_API_KEY y/o GEMINI_API_KEY en Vercel.'
    );
}

// ─────────────────────────────────────────────────────────────────────────────

const sessions = {};

const SYSTEM_PROMPT = `Eres un asistente inteligente especializado en generar documentos profesionales. 
Cuando el usuario pida generar un documento, debes responder con un JSON especial en este formato exacto:

\`\`\`docgen
{
  "type": "docx" | "xlsx" | "pptx" | "csv" | "txt" | "html",
  "filename": "nombre_del_archivo",
  "title": "Título del documento",
  "description": "Descripción breve",
  "content": { ... estructura del contenido según el tipo ... }
}
\`\`\`

Tipos de documentos que PUEDES generar:
- **docx**: Documentos Word con texto, tablas, listas, headings
- **xlsx**: Hojas de cálculo con datos, tablas, múltiples hojas
- **pptx**: Presentaciones con slides y contenido
- **csv**: Datos en formato CSV
- **txt**: Texto plano
- **html**: Página HTML simple

Para docx, el content debe ser:
{
  "sections": [
    { "heading": "Título sección", "level": 1 },
    { "text": "Párrafo de texto", "bold": false, "italic": false },
    { "table": { "headers": ["Col1","Col2"], "rows": [["a","b"],["c","d"]] } },
    { "list": ["item1", "item2"], "ordered": false }
  ]
}

Para xlsx, el content debe ser:
{
  "sheets": [
    {
      "name": "Hoja1",
      "headers": ["Columna1", "Columna2"],
      "rows": [["dato1", "dato2"]]
    }
  ]
}

Para pptx, el content debe ser:
{
  "slides": [
    { "title": "Título slide", "body": ["punto 1", "punto 2"], "notes": "notas opcionales" }
  ]
}

Para csv:
{
  "headers": ["Col1","Col2"],
  "rows": [["a","b"],["c","d"]]
}

Para txt y html, solo incluye:
{
  "body": "contenido completo aquí"
}

Cuando el usuario NO pide un documento, responde normalmente como asistente conversacional.
Responde siempre en el idioma del usuario.`;

// ─── Handler de Vercel ────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message, model = 'glm-4.6', sessionId = 'default' } = req.body;
    if (!message) return res.status(400).json({ error: 'El campo "message" es requerido.' });

    try {
        if (!sessions[sessionId]) sessions[sessionId] = [];

        sessions[sessionId].push({ role: 'user', content: message });

        // Mantener últimos 20 mensajes para no exceder contexto
        if (sessions[sessionId].length > 20) {
            sessions[sessionId] = sessions[sessionId].slice(-20);
        }

        // Construir mensajes con system prompt
        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...sessions[sessionId]
        ];

        const aiContent = await chat(fullMessages, model);

        if (!aiContent) {
            return res.status(502).json({ status: false, error: 'El modelo no retornó contenido. Intenta de nuevo.' });
        }

        sessions[sessionId].push({ role: 'assistant', content: aiContent });

        // Detectar bloque docgen
        const docgenMatch  = aiContent.match(/```docgen\s*([\s\S]*?)```/);
        let docgenData     = null;
        let displayContent = aiContent;

        if (docgenMatch) {
            try {
                docgenData     = JSON.parse(docgenMatch[1].trim());
                displayContent = aiContent.replace(/```docgen[\s\S]*?```/, '').trim();
                if (!displayContent) {
                    displayContent = `He generado el documento **${docgenData.title || docgenData.filename}**. Haz clic en el botón para descargarlo.`;
                }
            } catch (_) {
                docgenData = null;
            }
        }

        return res.json({
            status:    true,
            model,
            sessionId,
            content:   displayContent,
            reasoning: null,
            docgen:    docgenData
        });

    } catch (e) {
        console.error('[Chat] Error:', e.message);
        return res.status(500).json({ status: false, error: e.message });
    }
};
