const crypto = require('crypto');
const axios  = require('axios');

class GLM {
    constructor() {
        this.url         = 'https://chat.z.ai';
        this.apiEndpoint = 'https://chat.z.ai/api/v2/chat/completions';
        this.apiKey      = null;
        this.authUserId  = null;
        this.authCache   = null;
        this.authCacheTime = null;
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

    createSignature(sortedPayload, userPrompt) {
        const currentTime = Date.now();
        const dataString  = `${sortedPayload}|${Buffer.from(userPrompt).toString('base64')}|${currentTime}`;
        const timeWindow  = Math.floor(currentTime / (5 * 60 * 1000));
        const baseSignature = crypto.createHmac('sha256', 'key-@@@@)))()((9))-xxxx&&&%%%%%').update(String(timeWindow)).digest('hex');
        const signature     = crypto.createHmac('sha256', baseSignature).update(dataString).digest('hex');
        return { signature, timestamp: currentTime };
    }

    buildEndpoint(token, userId, userPrompt) {
        const currentTime = String(Date.now());
        const requestId   = crypto.randomUUID();
        const timezoneOffset = -new Date().getTimezoneOffset();
        const now = new Date();

        const basicParams = { timestamp: currentTime, requestId, user_id: userId };
        const additionalParams = {
            version: '0.0.1', platform: 'web', token,
            user_agent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
            language: 'en-US', languages: 'en-US', timezone: 'Asia/Makassar',
            cookie_enabled: 'true', screen_width: '360', screen_height: '806',
            screen_resolution: '360x806', viewport_height: '714', viewport_width: '360',
            viewport_size: '360x714', color_depth: '24', pixel_ratio: '2',
            current_url: 'https://chat.z.ai/c/25455c46-9de3-4689-9e0a-0f9f70c5b67e',
            pathname: '/c/25455c46-9de3-4689-9e0a-0f9f70c5b67e',
            search: '', hash: '', host: 'chat.z.ai', hostname: 'chat.z.ai',
            protocol: 'https:', referrer: '',
            title: 'Z.ai Chat',
            timezone_offset: String(timezoneOffset), local_time: now.toISOString(),
            utc_time: now.toUTCString(), is_mobile: 'true', is_touch: 'true',
            max_touch_points: '2', browser_name: 'Chrome', os_name: 'Android',
        };

        const allParams     = { ...basicParams, ...additionalParams };
        const urlParams     = new URLSearchParams(allParams).toString();
        const sortedPayload = Object.keys(basicParams).sort().map(k => `${k},${basicParams[k]}`).join(',');
        const { signature, timestamp } = this.createSignature(sortedPayload, userPrompt.trim());

        return {
            endpoint: `${this.apiEndpoint}?${urlParams}&signature_timestamp=${timestamp}`,
            signature
        };
    }

    async authenticate() {
        if (this.authCache && this.authCacheTime && (Date.now() - this.authCacheTime) / 1000 < 300) {
            return this.authCache;
        }
        const response     = (await axios.get(`${this.url}/api/v1/auths/`)).data;
        this.authCache     = response;
        this.authCacheTime = Date.now();
        this.apiKey        = response.token;
        this.authUserId    = response.id;
        return response;
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
        const { model = 'glm-4.6', systemMessage, search = false, reasoning = false, userName } = options;

        await this.authenticate();

        if (!this.models[model]) throw new Error(`Available models: ${Object.keys(this.models).join(', ')}.`);
        if (!this.apiKey) throw new Error('Failed to obtain API key.');

        const msgs = [];
        if (systemMessage) msgs.push({ role: 'system', content: systemMessage });
        if (typeof messages === 'string') msgs.push({ role: 'user', content: messages });
        else msgs.push(...messages);

        const userPrompt = [...msgs].reverse().find(m => m.role === 'user')?.content || '';
        const { endpoint, signature } = this.buildEndpoint(this.apiKey, this.authUserId, userPrompt);
        const dateTime  = this.getDateTime();
        const timezone  = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar';

        const response = await axios.post(endpoint, {
            stream: true,
            model:  this.models[model],
            messages: msgs,
            signature_prompt: userPrompt,
            params: {},
            features: {
                image_generation: false,
                web_search: search, auto_web_search: search,
                preview_mode: true, flags: [],
                enable_thinking: reasoning
            },
            variables: {
                '{{USER_NAME}}':        userName || `Guest-${Date.now()}`,
                '{{USER_LOCATION}}':    'Unknown',
                '{{CURRENT_DATETIME}}': dateTime.datetime,
                '{{CURRENT_DATE}}':     dateTime.date,
                '{{CURRENT_TIME}}':     dateTime.time,
                '{{CURRENT_WEEKDAY}}':  dateTime.weekday,
                '{{CURRENT_TIMEZONE}}': timezone,
                '{{USER_LANGUAGE}}':    'es'
            },
            chat_id: options.chatId || crypto.randomUUID(),
            id: crypto.randomUUID(),
            current_user_message_id: crypto.randomUUID(),
            current_user_message_parent_id: null,
            background_tasks: { title_generation: true, tags_generation: true }
        }, {
            headers: {
                'Authorization':  `Bearer ${this.apiKey}`,
                'X-FE-Version':   'prod-fe-1.0.150',
                'X-Signature':    signature,
                'Content-Type':   'application/json',
                'Accept':         'text/event-stream',
                'User-Agent':     'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
                'Origin':         'https://chat.z.ai',
                'Referer':        'https://chat.z.ai/'
            },
            responseType: 'stream'
        });

        let fullContent = '', reasoningContent = '', searchResults = [];
        let lineBuffer = '', mainBuffer = [], lastYieldedAnswerLength = 0;
        let answerStartIndex = -1, inAnswerPhase = false;

        for await (const chunk of response.data) {
            lineBuffer += chunk.toString();
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const jsonData = JSON.parse(line.slice(6));
                    if (jsonData.type !== 'chat:completion') continue;
                    const eventData = jsonData.data;
                    if (!eventData) continue;
                    const phase = eventData.phase;

                    if (typeof eventData.edit_index === 'number') {
                        const index        = eventData.edit_index;
                        const contentChunk = (eventData.edit_content || '').split('');
                        mainBuffer.splice(index, contentChunk.length, ...contentChunk);
                        if (inAnswerPhase && answerStartIndex >= 0 && index >= answerStartIndex) {
                            const currentAnswer = mainBuffer.slice(answerStartIndex).join('');
                            if (currentAnswer.length > lastYieldedAnswerLength) {
                                fullContent += currentAnswer.slice(lastYieldedAnswerLength);
                                lastYieldedAnswerLength = currentAnswer.length;
                            }
                        }
                    } else if (eventData.delta_content) {
                        const contentChunk = eventData.delta_content.split('');
                        mainBuffer.splice(mainBuffer.length, 0, ...contentChunk);
                        if (phase === 'thinking') {
                            let cleaned = eventData.delta_content
                                .replace(/<details[^>]*>/g, '').replace(/<\/details>/g, '')
                                .replace(/<summary>.*?<\/summary>/gs, '').replace(/^>\s?/gm, '');
                            if (cleaned.trim()) reasoningContent += cleaned;
                        } else if (phase === 'answer') {
                            if (!inAnswerPhase) {
                                inAnswerPhase = true;
                                const fullText  = mainBuffer.join('');
                                const detailsEnd = fullText.lastIndexOf('</details>');
                                answerStartIndex = detailsEnd >= 0 ? detailsEnd + '</details>'.length : mainBuffer.length - contentChunk.length;
                            }
                            fullContent += eventData.delta_content;
                            lastYieldedAnswerLength += eventData.delta_content.length;
                        }
                    }

                    if (phase === 'done' && eventData.done) {
                        const fullOutput = mainBuffer.join('');
                        const toolCallMatch = fullOutput.match(/<glm_block[^>]*>([\s\S]*?)<\/glm_block>/);
                        if (toolCallMatch) {
                            try {
                                const dt = JSON.parse(toolCallMatch[1]);
                                const results = dt?.data?.browser?.search_result;
                                if (results?.length > 0) searchResults = results;
                            } catch (_) {}
                        }
                    }
                } catch (_) {}
            }
        }

        return {
            reasoning: reasoningContent.trim(),
            content:   fullContent.trim(),
            search:    searchResults
        };
    }
}

// Session memory store (in-memory, resets on cold start)
const sessions = {};
const glmInstance = new GLM();

// System prompt for document-aware assistant
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

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, model = 'glm-4.6', sessionId = 'default' } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'El campo "message" es requerido.' });
    }

    try {
        // Init session
        if (!sessions[sessionId]) sessions[sessionId] = [];

        // Add user message
        sessions[sessionId].push({ role: 'user', content: message });

        // Keep last 20 messages to avoid overflow
        if (sessions[sessionId].length > 20) {
            sessions[sessionId] = sessions[sessionId].slice(-20);
        }

        const result = await glmInstance.chat(sessions[sessionId], {
            model,
            systemMessage: SYSTEM_PROMPT
        });

        const aiContent = result.content;

        // Add AI response to session
        sessions[sessionId].push({ role: 'assistant', content: aiContent });

        // Detect if it's a docgen block
        const docgenMatch = aiContent.match(/```docgen\s*([\s\S]*?)```/);
        let docgenData = null;
        let displayContent = aiContent;

        if (docgenMatch) {
            try {
                docgenData = JSON.parse(docgenMatch[1].trim());
                // Remove the raw JSON from the display, keep any surrounding text
                displayContent = aiContent.replace(/```docgen[\s\S]*?```/, '').trim();
                if (!displayContent) {
                    displayContent = `He generado el documento **${docgenData.title || docgenData.filename}**. Haz clic en el botón para descargarlo.`;
                }
            } catch (e) {
                // Not valid JSON, treat as normal message
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
        console.error('Chat error:', e.message);
        return res.status(500).json({ status: false, error: e.message });
    }
};
