/**
 * Agresión verbal en el chat: groserías e insultos. Teca no guarda esos mensajes (ni su propia respuesta):
 * la empresa no los ve en el panel. Sin IA: es una lista fija, instantánea y que no se cruza con el resto.
 */

/** Primera vez: se pide repetir, como si no se hubiera entendido. */
export const NOT_UNDERSTOOD_TEXT = 'Disculpa, no logré entenderte. ¿Puedes repetirlo?'

/** El cliente insiste: Teca reconoce la agresión y lo dice con calma. */
export const AGGRESSION_TEXT =
  'Noto un tono agresivo y no puedo seguir la conversación así. Cuando quieras retomarla con respeto, con gusto te ayudo con tus dudas o tu pedido.'

/** Palabras ya sin tildes ni letras repetidas (ver `plain`). Solo las que no tienen otro uso corriente. */
const WORDS = [
  'pene', 'verga', 'puta', 'puto', 'putas', 'putos', 'putamadre', 'mierda', 'carajo', 'coño', 'cojudo', 'cojuda', 'huevon', 'huevona', 'pendejo', 'pendeja',
  'cabron', 'cabrona', 'marica', 'maricon', 'imbecil', 'idiota', 'estupido', 'estupida', 'retrasado', 'retrasada', 'subnormal', 'basura', 'porqueria', 'asqueroso',
  'asquerosa', 'maldito', 'maldita', 'hdp', 'ctm', 'csm', 'ptm', 'mrd', 'conchatumadre', 'conchetumare', 'conchesumare', 'culo', 'cagada', 'chingar',
  'chingada', 'joder', 'jodete', 'follar', 'tarado', 'tarada', 'zorra', 'gilipollas', 'pelotudo', 'boludo',
]
/** Frases de varias palabras. */
const PHRASES = ['concha tu madre', 'concha de tu madre', 'hijo de puta', 'hija de puta', 'vete a la mierda', 'me cago en', 'chupame', 'que te jodan', 'callate']

/** Minúsculas, sin tildes, cifras y símbolos comunes cambiados por su letra y sin letras repetidas («puuuta» → «puta»). */
function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/[^a-zñ]+/g, ' ')
    .replace(/([a-zñ])\1+/g, '$1')
    .trim()
}

const collapsed = (value: string) => plain(value)
const WORD_SET = new Set(WORDS.map(collapsed))
const PHRASE_LIST = PHRASES.map(collapsed)

/** ¿El mensaje trae groserías o insultos? Ignora las palabras parecidas («Vergara», «computadora», «peneca»). */
export function isAbusive(text: string): boolean {
  const flat = plain(text)
  if (!flat) return false
  const padded = ` ${flat} `
  if (PHRASE_LIST.some((phrase) => padded.includes(` ${phrase} `))) return true
  return flat.split(' ').some((word) => WORD_SET.has(word))
}

/**
 * Qué responde Teca. `warnings` son los mensajes agresivos seguidos que ya recibió: el primero se toma como algo que no se
 * entendió y, si el cliente insiste, Teca reconoce la agresión.
 */
export function abuseReply(warnings: number): string {
  return warnings >= 1 ? AGGRESSION_TEXT : NOT_UNDERSTOOD_TEXT
}
