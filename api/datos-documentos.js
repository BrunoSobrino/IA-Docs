/**
 * datos-documentos.js
 * Referencia de estructuras y plantillas para generación de documentos.
 * Este archivo es SOLO documentación / referencia para el sistema.
 * No es un endpoint de Vercel.
 */

module.exports = {

    // ─── Tipos soportados ────────────────────────────────────────────────────
    tiposSoportados: ['docx', 'xlsx', 'pptx', 'csv', 'txt', 'html'],

    // ─── Paleta de colores usada en documentos ───────────────────────────────
    colores: {
        docx: {
            headerBg:     '2D4A8A',   // Azul oscuro - fondo de encabezados de tabla
            headerText:   'FFFFFF',   // Blanco - texto de encabezados
            rowEven:      'F5F7FF',   // Azul muy claro - filas pares
            rowOdd:       'FFFFFF',   // Blanco - filas impares
            border:       'CCCCCC',   // Gris claro - bordes de tabla
            heading1:     '2D4A8A',   // Azul oscuro - Heading 1
            heading2:     '3D5FA0',   // Azul medio - Heading 2
            heading3:     '4A6DB5',   // Azul claro - Heading 3
            footer:       '888888',   // Gris - pie de página
        },
        xlsx: {
            headerBg:     'FF2D4A8A', // Argb: azul oscuro
            headerText:   'FFFFFFFF', // Argb: blanco
            rowEven:      'FFF5F7FF', // Argb: azul muy claro
            rowOdd:       'FFFFFFFF', // Argb: blanco
            border:       'FFCCCCCC', // Argb: gris
        },
        pptx: {
            bg:           '0F1B3C',   // Azul muy oscuro - fondo slides
            accent:       '4A7FFF',   // Azul brillante - barra top / detalles
            accent2:      '7FAAFF',   // Azul claro - títulos de slide
            text:         'FFFFFF',   // Blanco - texto principal
            sub:          'AABBDD',   // Azul grisáceo - subtítulos / footer
        }
    },

    // ─── Estructura DOCX ─────────────────────────────────────────────────────
    estructuraDocx: {
        sections: [
            // Heading (nivel 1, 2 o 3)
            { heading: 'Título de sección', level: 1 },

            // Texto simple
            { text: 'Párrafo normal' },

            // Texto con formato
            { text: 'Texto en negrita', bold: true },
            { text: 'Texto en cursiva', italic: true },
            { text: 'Texto centrado', center: true },
            { text: 'Texto más grande', size: 16 }, // size en pt

            // Lista sin orden
            { list: ['Elemento 1', 'Elemento 2', 'Elemento 3'], ordered: false },

            // Lista numerada
            { list: ['Paso 1', 'Paso 2', 'Paso 3'], ordered: true },

            // Tabla
            {
                table: {
                    headers: ['Columna 1', 'Columna 2', 'Columna 3'],
                    rows: [
                        ['Dato A', 'Dato B', 'Dato C'],
                        ['Dato D', 'Dato E', 'Dato F']
                    ]
                }
            },

            // Salto de página
            { pageBreak: true }
        ]
    },

    // ─── Estructura XLSX ─────────────────────────────────────────────────────
    estructuraXlsx: {
        sheets: [
            {
                name: 'Nombre de hoja',
                headers: ['Columna 1', 'Columna 2', 'Columna 3'],
                rows: [
                    ['valor1', 'valor2', 'valor3'],
                    ['valor4', 'valor5', 'valor6']
                ]
            }
        ]
    },

    // ─── Estructura PPTX ─────────────────────────────────────────────────────
    estructuraPptx: {
        slides: [
            // Slide 0 = portada (diseño especial)
            {
                title: 'Título de la presentación',
                body: ['Subtítulo o descripción', 'Autor: Nombre']
            },
            // Slides de contenido
            {
                title: 'Título del slide',
                body: ['Punto 1', 'Punto 2', 'Punto 3'],
                notes: 'Notas del presentador (opcionales)'
            }
        ]
    },

    // ─── Estructura CSV ──────────────────────────────────────────────────────
    estructuraCsv: {
        headers: ['Columna1', 'Columna2', 'Columna3'],
        rows: [
            ['valor1', 'valor2', 'valor3'],
            ['valor4', 'valor5', 'valor6']
        ]
    },

    // ─── Estructura TXT / HTML ───────────────────────────────────────────────
    estructuraSimple: {
        body: 'Contenido completo del archivo aquí...'
    },

    // ─── Límites y configuración ─────────────────────────────────────────────
    limites: {
        docx: {
            maxSecciones:   200,
            maxFilasTabla:  1000,
            tamañoPagina:   'US Letter (8.5 x 11 in)',
            margenes:       '1 pulgada por lado',
            fuente:         'Calibri 12pt'
        },
        xlsx: {
            maxHojas:       10,
            maxFilasPorHoja: 10000,
            maxColumnas:    50
        },
        pptx: {
            maxSlides:      50,
            layout:         '16:9 (widescreen)'
        },
        csv: {
            maxFilas:       50000,
            encoding:       'UTF-8'
        }
    },

    // ─── Ejemplos de prompts para el usuario ─────────────────────────────────
    ejemplosPrompts: [
        'Genera un informe ejecutivo sobre ventas Q1 en Word (.docx)',
        'Crea una hoja de cálculo con presupuesto mensual en Excel (.xlsx)',
        'Hazme una presentación de 5 slides sobre marketing digital en PowerPoint (.pptx)',
        'Genera un CSV con una lista de 10 países y sus capitales',
        'Crea un reporte en texto plano con los pasos para instalar Node.js',
        'Dame un currículo profesional en Word',
        'Genera una tabla comparativa de lenguajes de programación en Excel'
    ]
};
