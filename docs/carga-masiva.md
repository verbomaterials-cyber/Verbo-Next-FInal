# Carga masiva de preguntas (JSON)

Formato aceptado por **Admin → Examen → Preguntas → Carga masiva**. Pensado
para que agentes (Cowork) generen lotes de preguntas listos para importar.

## Estructura del payload

```json
{
  "questions": [
    {
      "questionType": "Listen and Type",
      "prompt": { "audioUrl": "https://…/audio1.mp3" },
      "answer": { "transcript": "The weather is nice today." },
      "feedback": "Se evalúa la transcripción exacta del audio.",
      "difficulty": 2
    }
  ]
}
```

También se acepta un array JSON directo (`[ {...}, {...} ]`).

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `questionType` | string | sí | Nombre **exacto** del tipo de pregunta dentro del examen (no distingue mayúsculas). |
| `prompt` | objeto | sí | Contenido de la pregunta. Sus keys deben corresponder a los campos con `target: "prompt"` del `adminFieldSchema` del tipo. |
| `answer` | objeto \| null | según el tipo | Respuesta correcta. Keys según los campos con `target: "answer"`. `null` u omitido para tipos con `isScored: false` o cuya calificación vive fuera del schema (ver mapa abajo). |
| `feedback` | string | no | Explicación mostrada al alumno (solo aplica en versiones con feedback). |
| `difficulty` | 1–5 | no | Reservado para la fase adaptativa. |

## Reglas de validación

1. Cada pregunta se valida contra el `adminFieldSchema` de su tipo: los campos
   requeridos deben venir en el objeto correcto (`prompt` o `answer`).
2. Los campos `options` con `withCorrect: true` **en la raíz** esperan las
   opciones en `prompt.<key>` (array de strings) y los índices correctos en
   `answer.<key>` (número si `multiple: false`, array de números si
   `multiple: true`, base 0).
3. Dentro de un `repeater`, cada elemento es un objeto; las `options`
   anidadas con correcta **no** usan el objeto `answer` externo — se guardan
   dentro del propio elemento como `{ "options": [...], "correct": 0 }`
   (o `"correct": [0,2]` si `multiple: true`).
4. La importación es **todo o nada**: si cualquier pregunta falla, no se
   importa ninguna y se reportan los errores con su índice.
5. El `order` se asigna automáticamente al final de la versión destino.
6. Cuando un tipo no tiene ningún campo `target: "answer"` en su schema
   (respuesta abierta: audio, foto, ensayo), `answer` debe ser `null` u
   omitirse — no existe nada que validar ahí.

---

## Mapa completo por tipo de actividad

Fuente de verdad: `prisma/seed-data/det.ts` y `prisma/seed-data/toefl.ts`
(el `adminFieldSchema` real vive en la fila `QuestionType` de cada examen en
BD — este mapa refleja el seed actual; si se edita un tipo desde
**Admin → Estructura**, ese tipo puede divergir de esta tabla).

### Duolingo English Test (`det`) — sección Adaptive Test

#### Read and Complete
Texto con letras faltantes marcadas entre corchetes.

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `text` | string | sí | `"The w[eather] was n[ice] yesterday."` |
| answer | `answers` | string[] | sí | letras faltantes, en el orden de aparición |

```json
{ "questionType": "Read and Complete",
  "prompt": { "text": "The w[eather] was n[ice] yesterday." },
  "answer": { "answers": ["eather", "ice"] } }
```

#### Read and Select
Palabras reales mezcladas con pseudo-palabras.

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `words` | string[] (options, multiple) | sí | todas las palabras mostradas |
| answer | `words` | number[] | sí | índices (0-based) de las palabras reales |

```json
{ "questionType": "Read and Select",
  "prompt": { "words": ["house", "brithel", "window", "clazzle"] },
  "answer": { "words": [0, 2] } }
```

#### Complete the Words
Mismo formato que Read and Complete.

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `text` | string | sí | corchetes para letras faltantes |
| answer | `answers` | string[] | sí | letras faltantes en orden |

#### Listen and Select
Audios de palabras, algunas reales, otras inventadas.

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `audioWords` | repeater | sí | cada item: `{ audioUrl (string, req), label? (string) }` |
| answer | `correctIndexes` | number[] | sí | posiciones (0-based) de audios que son palabras reales |

```json
{ "questionType": "Listen and Select",
  "prompt": { "audioWords": [
    { "audioUrl": "https://…/w1.mp3", "label": "real" },
    { "audioUrl": "https://…/w2.mp3", "label": "pseudo" }
  ] },
  "answer": { "correctIndexes": [0] } }
```

#### Listen and Type
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `audioUrl` | string (url) | sí | audio del enunciado |
| answer | `transcript` | string | sí | transcripción exacta esperada |

#### Read Aloud
Grabación de audio — sin calificación automática por schema.

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `sentence` | string | sí | oración a leer en voz alta |
| answer | — | — | — | `null` |

#### Write About the Photo
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `imageUrl` | string (url) | sí | fotografía a describir |
| answer | — | — | — | `null` |

#### Speak About the Photo
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `imageUrl` | string (url) | sí | fotografía a describir en voz alta |
| answer | — | — | — | `null` |

#### Read, Then Write
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `prompt` | string | sí | pregunta de escritura |
| prompt | `minWords` | number | no | mínimo sugerido (DET real: 50) |
| answer | — | — | — | `null` |

#### Read, Then Speak
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `prompt` | string | sí | pregunta a responder hablando |
| answer | — | — | — | `null` |

#### Listen, Then Speak
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `audioUrl` | string (url) | sí | audio de la pregunta |
| answer | — | — | — | `null` |

#### Interactive Reading
Pasaje con sub-preguntas anidadas; cada una lleva su propia respuesta correcta dentro del `repeater` (no hay `answer` externo).

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `passage` | string | sí | pasaje base |
| prompt | `subQuestions` | repeater | sí | cada item: `{ question (string, req), options: { options: string[], correct: number } }` |
| answer | — | — | — | `null` |

```json
{ "questionType": "Interactive Reading",
  "prompt": {
    "passage": "Marie Curie was a physicist…",
    "subQuestions": [
      { "question": "What field did she work in?",
        "options": { "options": ["Physics", "Law", "Medicine"], "correct": 0 } }
    ]
  },
  "answer": null }
```

#### Interactive Listening
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `scenario` | string | sí | contexto de la conversación |
| prompt | `turns` | repeater | sí | cada item: `{ audioUrl (string, req), options: { options: string[], correct: number } }` |
| answer | — | — | — | `null` |

### Duolingo English Test — sección Writing Sample

#### Writing Sample
`isScored: false` — pasa directo a `PENDING_REVIEW` para la sesión en vivo.

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `prompt` | string | sí | tema de escritura extendida |
| answer | — | — | — | `null` |

### Duolingo English Test — sección Speaking Sample

#### Speaking Sample
`isScored: false` — pasa a `PENDING_REVIEW`.

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `prompt` | string | sí | tema a hablar (1–3 min) |
| answer | — | — | — | `null` |

---

### TOEFL iBT (`toefl-ibt`) — sección Reading

#### Reading Comprehension
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `passage` | string | sí | pasaje académico (se muestra en panel izquierdo, split screen) |
| prompt | `question` | string | sí | |
| prompt | `options` | string[] (options) | sí | 1 correcta (`multiple: false`) |
| answer | `options` | number | sí | índice de la opción correcta |

```json
{ "questionType": "Reading Comprehension",
  "prompt": {
    "passage": "Photosynthesis is the process…",
    "question": "What is the main idea of the passage?",
    "options": ["Plant biology", "Energy conversion in plants", "Ocean life", "Cell division"]
  },
  "answer": { "options": 1 } }
```

### TOEFL iBT — sección Listening

#### Listening Comprehension
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `audioUrl` | string (url) | sí | conferencia o conversación |
| prompt | `context` | string | no | texto breve mostrado en pantalla |
| prompt | `question` | string | sí | |
| prompt | `options` | string[] (options) | sí | 1 correcta |
| answer | `options` | number | sí | índice correcto |

### TOEFL iBT — sección Speaking

#### Interview Speaking
Formato 2026: sin tiempo de preparación, 45 s de respuesta; la pregunta se escucha, no se lee.

| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `audioUrl` | string (url) | sí | audio de la pregunta del entrevistador |
| prompt | `topicLabel` | string | no | **`studentHidden: true`** — solo referencia interna del admin, nunca se muestra al alumno |
| answer | — | — | — | `null` |

### TOEFL iBT — sección Writing

#### Academic Discussion
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `professorPost` | string | sí | publicación inicial del profesor |
| prompt | `studentReplies` | repeater | sí | cada item: `{ author (string, req), text (string, req) }` |
| prompt | `minWords` | number | no | |
| answer | — | — | — | `null` |

```json
{ "questionType": "Academic Discussion",
  "prompt": {
    "professorPost": "Should universities require students to study abroad?",
    "studentReplies": [
      { "author": "Maria", "text": "I think it broadens perspective, but it's costly." },
      { "author": "James", "text": "Online exchange programs achieve similar goals." }
    ],
    "minWords": 100
  },
  "answer": null }
```

#### Write an Email
| Bucket | key | tipo | req. | notas |
|---|---|---|---|---|
| prompt | `scenario` | string | sí | situación y destinatario |
| prompt | `requiredPoints` | string[] (list) | no | puntos que debe cubrir el correo |
| prompt | `minWords` | number | no | |
| answer | — | — | — | `null` |

---

## Resumen rápido (20 tipos activos)

| Examen | Sección | Tipo | `isScored` | `answer` |
|---|---|---|---|---|
| DET | Adaptive Test | Read and Complete | sí | `answers: string[]` |
| DET | Adaptive Test | Read and Select | sí | `words: number[]` |
| DET | Adaptive Test | Complete the Words | sí | `answers: string[]` |
| DET | Adaptive Test | Listen and Select | sí | `correctIndexes: number[]` |
| DET | Adaptive Test | Listen and Type | sí | `transcript: string` |
| DET | Adaptive Test | Read Aloud | sí | `null` |
| DET | Adaptive Test | Write About the Photo | sí | `null` |
| DET | Adaptive Test | Speak About the Photo | sí | `null` |
| DET | Adaptive Test | Read, Then Write | sí | `null` |
| DET | Adaptive Test | Read, Then Speak | sí | `null` |
| DET | Adaptive Test | Listen, Then Speak | sí | `null` |
| DET | Adaptive Test | Interactive Reading | sí | `null` (anidada en prompt) |
| DET | Adaptive Test | Interactive Listening | sí | `null` (anidada en prompt) |
| DET | Writing Sample | Writing Sample | no | `null` |
| DET | Speaking Sample | Speaking Sample | no | `null` |
| TOEFL | Reading | Reading Comprehension | sí | `options: number` |
| TOEFL | Listening | Listening Comprehension | sí | `options: number` |
| TOEFL | Speaking | Interview Speaking | sí | `null` |
| TOEFL | Writing | Academic Discussion | sí | `null` |
| TOEFL | Writing | Write an Email | sí | `null` |

Nota: "`isScored: sí` + `answer: null`" significa que el tipo cuenta para el
puntaje pero no tiene calificación automática por reactivo cerrado (audio,
foto, ensayo) — hoy esas respuestas quedan en `PENDING_REVIEW` para
calificación humana; la calificación asistida por IA es fase 2 (ver README).
