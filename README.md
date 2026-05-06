[README.md](https://github.com/user-attachments/files/27425413/README.md)
# Z.ai Chat · Generador de Documentos

Chat con IA usando modelos GLM de Z.ai, con capacidad de generar documentos profesionales descargables.

## Documentos soportados

| Formato | Extensión | Descripción |
|---------|-----------|-------------|
| Word    | `.docx`   | Documentos con tablas, listas, headings, estilos |
| Excel   | `.xlsx`   | Hojas de cálculo con múltiples sheets y formato |
| PowerPoint | `.pptx` | Presentaciones con diseño oscuro profesional |
| CSV     | `.csv`    | Datos tabulares en formato CSV |
| Texto   | `.txt`    | Texto plano |
| HTML    | `.html`   | Página HTML simple |

## Deploy en Vercel

### 1. Requisitos
- Cuenta en [Vercel](https://vercel.com)
- [Vercel CLI](https://vercel.com/cli): `npm install -g vercel`
- Node.js >= 18

### 2. Instalar dependencias
```bash
npm install
```

### 3. Desarrollo local
```bash
vercel dev
```
Abre `http://localhost:3000`

### 4. Deploy a producción
```bash
vercel --prod
```

## Estructura del proyecto

```
zai-chat/
├── vercel.json              # Configuración de rutas Vercel
├── package.json             # Dependencias
├── func/
│   ├── z.ai.js              # Endpoint /api/chat — GLM + memoria de sesión
│   ├── generate.js          # Endpoint /api/generate — genera archivos
│   └── datos-documentos.js  # Referencia de estructuras (no es endpoint)
├── public/
│   ├── index.html           # Interfaz del chat
│   ├── style.css            # Estilos (dark theme)
│   └── chat.js              # Lógica del frontend
└── documentos/
    └── tmp/                 # Carpeta temporal (uso local)
```

## Cómo usar

1. Abre el chat
2. Selecciona el modelo GLM que prefieras
3. Pide un documento en lenguaje natural:
   - *"Genera un informe ejecutivo de ventas en Word"*
   - *"Crea una hoja de Excel con presupuesto mensual"*
   - *"Hazme una presentación de 5 slides sobre IA en PowerPoint"*
4. La IA genera el documento — aparece un botón para descargarlo

## Notas

- La memoria de sesión es **en memoria** y se resetea con cada cold start de Vercel
- El acceso a Z.ai es por reverse engineering de su API pública — puede dejar de funcionar si cambian su frontend
- Los documentos se generan directamente en el servidor y se descargan como base64

## Modelos disponibles

| Alias | Descripción |
|-------|-------------|
| `glm-4.6` | Modelo principal, equilibrio calidad/velocidad |
| `glm-4.5` | 360B parámetros, más potente |
| `glm-4.5-air` | 106B parámetros, más rápido |
| `z1-32b` | Modelo razonamiento |
| `glm-4-32b` | 32B parámetros |
| `chatglm` | Versión rápida (flash) |
