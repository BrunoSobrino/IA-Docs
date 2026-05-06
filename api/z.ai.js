const crypto = require('crypto');
const axios  = require('axios');

// ── Configura tu API Key de Z.ai aquí ────────────────────────────────────────
// OPCIÓN 1: Variable de entorno en Vercel (recomendado)
//   En Vercel → Settings → Environment Variables → agrega: Z_AI_API_KEY
// OPCIÓN 2: Escríbela directamente aquí (solo para pruebas locales)
const Z_AI_API_KEY = process.env.Z_AI_API_KEY || 'a3cb561f7ad1483e911f0c4256251999.FhB7PjgzHgjg1RDU';
// ─────────────────────────────────────────────────────────────────────────────

class GLM {
    constructor() {
        this.url         = 'https://chat.z.ai';
        this.apiEndpoint = 'https://chat.z.ai/api/v2/chat/completions';
        this.models = {
            'glm-4.6':              'GLM-4-6-API-V1',
            'glm-4.6v':             'glm-4.6v',
            'glm-4.5':              '0727-360B-API',
            'glm-4.5-air':          '0727-106B-API',
            'glm-4.5v':             'glm-4.5v',
            'glm-4.1v-9b-thinking': 'GLM-4.1V-Thinking-FlashX',
            'z1-rumination':        'deep-research',
            'z1-32b':               'zero',
            'chatglm':              'glm-4-flash',
            '0808-360b-dr':         '0808-360B-DR',
            'glm-4-32b':            'glm-4-air-250414'
        };
    }

    getDateTime() {
        const now  = new Date();
        const pad  = n => String(n).padStart(2, '0');
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        return {
            datetime: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
            date:     `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
            time:     `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
            weekday:  days[now.getDay()]
        };
    }

    async chat(messages, options = {}) {
        const { model = 'glm-4.6', systemMessage, search = false, userName } = options;

        if (!this.models[model]) throw new Error(`Modelos disponibles: ${Object.keys(this.models).join(', ')}.`);
        if (!Z_AI_API_KEY || Z_AI_API_KEY === 'TU_API_KEY_AQUI') throw new Error('API Key de Z.ai no configurada.');

        const msgs = [];
        if (systemMessage) msgs.push({ role: 'system', content: systemMessage });
        if (typeof messages === 'string') msgs.push({ role: 'user', content: messages });
        else msgs.push(...messages);

        console.log('[GLM] Iniciando chat | modelo:', model, '→', this.models[model]);
        console.log('[GLM] Mensajes en sesión:', msgs.length);

        const requestBody = {
            model:       this.models[model],
            messages:    msgs,
            stream:      true,
            temperature: 0.7,
            top_p:       0.9,
            max_tokens:  4096,
        };

        let response;
        try {
            response = await axios.post(this.apiEndpoint, requestBody, {
                headers: {
                    'Authorization': `Bearer ${Z_AI_API_KEY}`,
                    'Content-Type':  'application/json',
                    'Accept':        'text/event-stream',
                    'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                responseType: 'stream',
                timeout:      60000,
            });
        } catch (err) {
            const status = err.response?.status;
            const body   = err.response?.data;
            console.error('[GLM] Error HTTP:', status, body || err.message);
            if (status === 401) throw new Error('API Key inválida o sin permisos (401).');
            if (status === 403) throw new Error('API Key sin acceso a este modelo (403).');
            if (status === 429) throw new Error('Límite de peticiones alcanzado (429). Espera un momento.');
            throw new Error(`Error conectando a Z.ai: ${status || err.message}`);
        }

        console.log('[GLM] HTTP status:', response.status);
        console.log('[GLM] Content-Type:', response.headers['content-type']);

        let fullContent = '';
        let lineBuffer  = '';
        let chunkCount  = 0;

        for await (const chunk of response.data) {
            chunkCount++;
            const raw = chunk.toString();

            // Log diagnóstico — primeros 5 chunks para ver formato real
            if (chunkCount <= 5) {
                console.log(`[GLM] Chunk #${chunkCount}:`, JSON.stringify(raw.slice(0, 400)));
            }

            lineBuffer += raw;
            const lines = lineBuffer.split('\n');
            lineBuffer  = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;

                const dataStr = trimmed.slice(5).trim();
                if (dataStr === '[DONE]') {
                    console.log('[GLM] Stream completado → [DONE]');
                    continue;
                }

                try {
                    const parsed = JSON.parse(dataStr);

                    // ── Formato 1: OpenAI-compatible (estándar para API keys de Z.ai)
                    const delta = parsed?.choices?.[0]?.delta?.content;
                    if (typeof delta === 'string') {
                        fullContent += delta;
                        continue;
                    }

                    // ── Formato 2: content directo en el objeto
                    if (typeof parsed?.content === 'string') {
                        fullContent += parsed.content;
                        continue;
                    }

                    // ── Formato 3: SSE nativo de Z.ai (usado en web sin API key)
                    if (parsed?.type === 'chat:completion' && parsed?.data) {
                        const eventData = parsed.data;
                        if (eventData.delta_content && eventData.phase !== 'thinking') {
                            fullContent += eventData.delta_content;
                        }
                        continue;
                    }

                    // ── Formato 4: message completo (algunos modelos retornan sin stream real)
                    const msgContent = parsed?.choices?.[0]?.message?.content;
                    if (typeof msgContent === 'string') {
                        fullContent += msgContent;
                        continue;
                    }

                } catch (_) {
                    // línea no es JSON válido, ignorar
                }
            }
        }

        console.log('[GLM] Chunks totales:', chunkCount);
        console.log('[GLM] fullContent length:', fullContent.length);
        if (!fullContent.trim()) {
            console.warn('[GLM] ⚠ fullContent vacío después del stream completo');
        }

        return {
            content:   fullContent.trim(),
            reasoning: '',
            search:    []
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────

const sessions    = {};
const glmInstance = new GLM();

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

// ─────────────────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message, model = 'glm-4.6', sessionId = 'default' } = req.body;
    if (!message) return res.status(400).json({ error: 'El campo "message" es requerido.' });

    try {
        if (!sessions[sessionId]) sessions[sessionId] = [];

        sessions[sessionId].push({ role: 'user', content: message });

        if (sessions[sessionId].length > 20) {
            sessions[sessionId] = sessions[sessionId].slice(-20);
        }

        const result = await glmInstance.chat(sessions[sessionId], { model, systemMessage: SYSTEM_PROMPT });
        const aiContent = result.content;

        if (!aiContent) {
            console.error('[Chat] Respuesta vacía | sessionId:', sessionId);
            return res.status(502).json({
                status: false,
                error:  'El modelo no retornó contenido. Intenta de nuevo.'
            });
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
            reasoning: result.reasoning || null,
            docgen:    docgenData
        });

    } catch (e) {
        console.error('[Chat] Error:', e.message);
        return res.status(500).json({ status: false, error: e.message });
    }
};
