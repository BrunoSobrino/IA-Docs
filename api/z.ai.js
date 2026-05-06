const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN — Variables de entorno en Vercel:
//    Settings → Environment Variables
//    GROQ_API_KEY   → tu key de console.groq.com
//    GEMINI_API_KEY → tu key de aistudio.google.com
// ═══════════════════════════════════════════════════════════════════════════════
const GROQ_API_KEY   = process.env.GROQ_API_KEY   || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// ─── Catálogo de modelos (los que muestra el selector en el HTML) ─────────────
// Cada entrada: { provider, model, supportsSearch, supportsThinking }
const MODEL_CATALOG = {
    // ── GROQ ─────────────────────────────────────────────────────────────────
    'groq-llama4-scout': {
        label: 'Llama 4 Scout 17B (Groq)',
        provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        supportsSearch: false, supportsThinking: false
    },
    'groq-llama4-maverick': {
        label: 'Llama 4 Maverick 17B (Groq)',
        provider: 'groq', model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        supportsSearch: false, supportsThinking: false
    },
    'groq-llama33-70b': {
        label: 'Llama 3.3 70B Versatile (Groq)',
        provider: 'groq', model: 'llama-3.3-70b-versatile',
        supportsSearch: false, supportsThinking: false
    },
    'groq-llama31-8b': {
        label: 'Llama 3.1 8B Instant (Groq — Rápido)',
        provider: 'groq', model: 'llama-3.1-8b-instant',
        supportsSearch: false, supportsThinking: false
    },
    'groq-deepseek-r1': {
        label: 'DeepSeek R1 Distill 70B · Pensamiento (Groq)',
        provider: 'groq', model: 'deepseek-r1-distill-llama-70b',
        supportsSearch: false, supportsThinking: true
    },
    'groq-qwen-32b': {
        label: 'Qwen QwQ 32B · Pensamiento (Groq)',
        provider: 'groq', model: 'qwen-qwq-32b',
        supportsSearch: false, supportsThinking: true
    },
    // ── GEMINI ────────────────────────────────────────────────────────────────
    'gemini-2-flash': {
        label: 'Gemini 2.0 Flash (Google)',
        provider: 'gemini', model: 'gemini-2.0-flash',
        supportsSearch: true, supportsThinking: false
    },
    'gemini-25-flash': {
        label: 'Gemini 2.5 Flash · Pensamiento (Google)',
        provider: 'gemini', model: 'gemini-2.5-flash-preview-05-20',
        supportsSearch: true, supportsThinking: true
    },
    'gemini-25-flash-lite': {
        label: 'Gemini 2.5 Flash-Lite · Rápido (Google)',
        provider: 'gemini', model: 'gemini-2.5-flash-lite-preview-06-17',
        supportsSearch: false, supportsThinking: false
    },
};

// Modelo por defecto si el cliente manda uno no reconocido
const DEFAULT_MODEL = 'groq-llama33-70b';

// ─── Llamada a Groq ───────────────────────────────────────────────────────────
async function callGroq(modelId, messages, useThinking) {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY no configurada.');

    const body = {
        model:       modelId,
        messages,
        max_tokens:  8192,
        temperature: useThinking ? 0.6 : 0.7,
        stream:      false,
    };

    const resp = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        body,
        {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 55000,
        }
    );

    const content = resp.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq no retornó contenido.');
    return content.trim();
}

// ─── Llamada a Gemini (OpenAI-compatible endpoint) ────────────────────────────
async function callGemini(modelId, messages, useSearch, useThinking) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada.');

    const body = {
        model:    modelId,
        messages,
        max_tokens:  8192,
        temperature: 0.7,
        stream:      false,
    };

    // Búsqueda web nativa de Gemini
    if (useSearch) {
        body.tools = [{ googleSearch: {} }];
    }

    // Pensamiento adaptativo de Gemini
    if (useThinking) {
        body.thinking_config = { thinking_budget: 8192 };
    }

    const resp = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        body,
        {
            headers: { 'Authorization': `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 55000,
        }
    );

    const content = resp.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Gemini no retornó contenido.');
    return content.trim();
}

// ─── Dispatcher principal ─────────────────────────────────────────────────────
async function chat(messages, modelKey, options = {}) {
    const cfg         = MODEL_CATALOG[modelKey] || MODEL_CATALOG[DEFAULT_MODEL];
    const useSearch   = options.search   && cfg.supportsSearch;
    const useThinking = options.thinking && cfg.supportsThinking;

    console.log(`[AI] modelo=${modelKey} | provider=${cfg.provider} | search=${useSearch} | thinking=${useThinking}`);

    try {
        if (cfg.provider === 'groq') {
            return await callGroq(cfg.model, messages, useThinking);
        } else {
            return await callGemini(cfg.model, messages, useSearch, useThinking);
        }
    } catch (err) {
        // Fallback automático al otro proveedor si hay key disponible
        console.warn(`[AI] ${cfg.provider} falló: ${err.message}. Intentando fallback...`);
        if (cfg.provider === 'groq' && GEMINI_API_KEY) {
            const fallbackCfg = MODEL_CATALOG['gemini-2-flash'];
            return await callGemini(fallbackCfg.model, messages, false, false);
        }
        if (cfg.provider === 'gemini' && GROQ_API_KEY) {
            const fallbackCfg = MODEL_CATALOG['groq-llama33-70b'];
            return await callGroq(fallbackCfg.model, messages, false);
        }
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────────────────────

const sessions = {};

const SYSTEM_PROMPT = `Eres un asistente inteligente especializado en generar y editar documentos profesionales en formato APA 7ma edición.

## REGLAS DE FORMATO APA 7 PARA TODOS LOS DOCUMENTOS:
- Fuente: Times New Roman, tamaño 12
- Color de texto: negro (#000000)
- Márgenes: 2.54 cm (1 pulgada) en todos los lados
- Interlineado: doble (excepto tablas, figuras y referencias donde se indica diferente)
- Sangría: 0.5 pulgadas (1.27 cm) en la primera línea de cada párrafo
- Títulos en NEGRITA (bold: true)
  - Nivel 1: Centrado, negrita, mayúscula en palabras principales
  - Nivel 2: Alineado a la izquierda, negrita
  - Nivel 3: Alineado a la izquierda, negrita, cursiva
- Numeración de páginas: esquina inferior derecha
- Encabezado: título abreviado del documento en mayúsculas (solo en docx)
- Tablas: usar ÚNICAMENTE cuando el usuario lo solicite explícitamente o cuando los datos NO se puedan expresar claramente en texto. Incluir nota bajo la tabla si es necesario.
- Listas: usar con moderación, preferir párrafos cohesivos
- Citas y referencias en formato APA 7 si el contenido lo requiere

## GENERACIÓN DE DOCUMENTOS:
Cuando el usuario pida generar un documento nuevo, responde con un bloque JSON en este formato exacto:

\`\`\`docgen
{
  "type": "docx" | "xlsx" | "pptx" | "csv" | "txt" | "html",
  "filename": "nombre_del_archivo",
  "title": "Título del documento",
  "description": "Descripción breve",
  "content": { ... estructura según el tipo ... }
}
\`\`\`

## EDICIÓN DE DOCUMENTOS:
Cuando el usuario pida MODIFICAR, CORREGIR, ACTUALIZAR o EDITAR un documento que ya fue generado en la conversación, responde con un bloque JSON con el campo "edit": true y el contenido COMPLETO actualizado (no solo los cambios):

\`\`\`docgen
{
  "edit": true,
  "type": "docx",
  "filename": "mismo_nombre_anterior",
  "title": "Título del documento",
  "description": "Descripción actualizada",
  "content": { ... contenido completo con las modificaciones aplicadas ... }
}
\`\`\`

IMPORTANTE sobre edición:
- Siempre incluye el contenido COMPLETO en el JSON, no solo los fragmentos modificados
- Conserva todo el contenido anterior que no fue pedido cambiar
- Usa el mismo filename que el documento original
- Indica brevemente qué se cambió antes del bloque docgen

## ESTRUCTURA DE CONTENIDO POR TIPO:

### docx (APA 7):
{
  "sections": [
    { "heading": "Título", "level": 1 },
    { "text": "Párrafo con sangría automática.", "indent": true },
    { "text": "Texto en negrita", "bold": true },
    { "text": "Texto en cursiva", "italic": true },
    { "list": ["item1", "item2"], "ordered": false },
    { "table": { "headers": ["Col1","Col2"], "rows": [["a","b"]] }, "note": "Nota: descripción si aplica." },
    { "pageBreak": true }
  ]
}

### xlsx:
{
  "sheets": [{ "name": "Hoja1", "headers": ["Col1","Col2"], "rows": [["a","b"]] }]
}

### pptx:
{
  "slides": [{ "title": "Título", "body": ["punto 1", "punto 2"], "notes": "notas" }]
}

### csv:
{ "headers": ["Col1","Col2"], "rows": [["a","b"]] }

### txt / html:
{ "body": "contenido completo" }

## COMPORTAMIENTO GENERAL:
- Si el usuario NO pide un documento, responde normalmente como asistente conversacional
- Responde SIEMPRE en el idioma del usuario
- Recuerda el contexto de documentos generados en la conversación para poder editarlos`;

// ─── Handler Vercel ───────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        message,
        model    = DEFAULT_MODEL,
        sessionId = 'default',
        search   = false,
        thinking  = false,
    } = req.body;

    if (!message) return res.status(400).json({ error: 'El campo "message" es requerido.' });

    try {
        if (!sessions[sessionId]) sessions[sessionId] = [];

        sessions[sessionId].push({ role: 'user', content: message });

        if (sessions[sessionId].length > 40) {
            sessions[sessionId] = sessions[sessionId].slice(-40);
        }

        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...sessions[sessionId]
        ];

        const aiContent = await chat(fullMessages, model, { search, thinking });

        if (!aiContent) {
            return res.status(502).json({ status: false, error: 'El modelo no retornó contenido. Intenta de nuevo.' });
        }

        sessions[sessionId].push({ role: 'assistant', content: aiContent });

        // Detectar bloque docgen (nuevo o edición)
        const docgenMatch  = aiContent.match(/```docgen\s*([\s\S]*?)```/);
        let docgenData     = null;
        let displayContent = aiContent;
        let isEdit         = false;

        if (docgenMatch) {
            try {
                docgenData = JSON.parse(docgenMatch[1].trim());
                isEdit     = docgenData.edit === true;
                displayContent = aiContent.replace(/```docgen[\s\S]*?```/, '').trim();
                if (!displayContent) {
                    displayContent = isEdit
                        ? `He actualizado el documento **${docgenData.title || docgenData.filename}**. Descárgalo con el botón.`
                        : `He generado el documento **${docgenData.title || docgenData.filename}**. Haz clic en el botón para descargarlo.`;
                }
            } catch (_) {
                docgenData = null;
            }
        }

        const modelCfg = MODEL_CATALOG[model] || MODEL_CATALOG[DEFAULT_MODEL];

        return res.json({
            status:    true,
            model,
            sessionId,
            content:   displayContent,
            reasoning: null,
            docgen:    docgenData,
            isEdit,
            modelInfo: {
                supportsSearch:   modelCfg.supportsSearch,
                supportsThinking: modelCfg.supportsThinking,
            }
        });

    } catch (e) {
        console.error('[Chat] Error:', e.message);
        return res.status(500).json({ status: false, error: e.message });
    }
};

// Exportar catálogo para que el HTML pueda consultarlo
module.exports.MODEL_CATALOG = MODEL_CATALOG;
