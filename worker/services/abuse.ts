/**
 * Agresión verbal en el chat: groserías e insultos. Teca no guarda esos mensajes (ni su propia respuesta):
 * la empresa no los ve en el panel. Sin IA: es una lista fija, instantánea y que no se cruza con el resto.
 */

/** Primera vez: se pide repetir, como si no se hubiera entendido. */
export const NOT_UNDERSTOOD_TEXT = 'Disculpa, no logré entenderte. ¿Puedes repetirlo?'

/** El cliente insiste: Teca reconoce la agresión y lo dice con calma. */
export const AGGRESSION_TEXT =
  'Noto un tono agresivo y no puedo seguir la conversación así. Cuando quieras retomarla con respeto, con gusto te ayudo con tus dudas o tu pedido.'

/**
 * Groserías e insultos del español de varios países, y los más comunes en inglés, portugués e italiano. Se comparan sin
 * tildes ni letras repetidas (ver `plain`) y también en plural («maricones», «pingas»). Solo palabras sin otro uso
 * corriente: quedan fuera «perro», «polla» (la de apuestas), «coger», «pinche» (de cocina), «maraca», «puñal», «porra»,
 * «concha», «Gil» (apellido), «cola», «bicho» o «paja».
 */
const WORDS = [
  // Partes del cuerpo y sexo.
  'pene', 'pinga', 'pingon', 'verga', 'vergon', 'choto', 'pija', 'culo', 'orto', 'ojete', 'tetona', 'chucha', 'cachero', 'cachera',
  'follar', 'chingar', 'chingada', 'chingatumadre', 'chingas', 'mamala', 'chupala', 'chupamela', 'mamamela', 'pajero', 'pajera', 'puñeta', 'puñetero',
  'buceta', 'caralho', 'minchia',
  // Madre, prostitución y «hijo de…».
  'puta', 'puto', 'putamadre', 'putita', 'prostituta', 'ramera', 'zorra', 'hdp', 'ctm', 'csm', 'ptm', 'conchatumadre', 'conchetumare', 'conchesumare',
  'conchasumadre', 'conchatumare', 'conchesumadre', 'chuchatumadre', 'conchudo', 'conchuda', 'hijueputa', 'hijoputa', 'malparido', 'malparida', 'coñoetumadre',
  // Exclamaciones groseras.
  'mierda', 'mierdoso', 'mierdosa', 'carajo', 'coño', 'joder', 'jodete', 'cagar', 'cagada', 'cagon', 'cagona', 'merda', 'fodase', 'foda',
  'vaffanculo', 'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'wtf', 'stfu',
  // Insultos a la persona.
  'cojudo', 'cojuda', 'cojudazo', 'huevon', 'huevona', 'aweonao', 'aweonado', 'webon', 'weon', 'guevon', 'pendejo', 'pendeja', 'cabron', 'cabrona', 'boludo',
  'boluda', 'pelotudo', 'pelotuda', 'garca', 'sorete', 'culiao', 'culiado', 'culero', 'culera', 'mamon', 'mamona', 'mamaguevo',
  'mamahuevo', 'gonorrea', 'pirobo', 'piroba', 'gilipollas', 'capullo', 'soplapollas', 'chupapollas', 'lameculos', 'lamebotas',
  'imbecil', 'idiota', 'estupido', 'estupida', 'retrasado', 'retrasada', 'mongolico', 'mongolica', 'mogolico', 'mogolica', 'subnormal', 'tarado', 'tarada',
  'baboso', 'babosa', 'basura', 'porqueria', 'asqueroso', 'asquerosa', 'maldito', 'maldita', 'stronzo', 'arrombado', 'bitch', 'asshole', 'dick', 'cunt',
  'bastard', 'whore', 'slut', 'retard', 'dumbass',
  // Insultos homofóbicos.
  'marica', 'maricon', 'maricona', 'mariconazo', 'cabro', 'cabrazo', 'rosquete', 'trolo', 'trola', 'joto', 'maraco', 'viado',
  'faggot', 'fag',
]

/**
 * Abreviaturas que se escriben en el chat (sobre todo en Perú): «rctmr», «crj», «mrd», «pn», «kk»… Se comparan tal como se
 * escriben, sin juntar letras repetidas: así «kk» cuenta, pero una «k» suelta («k precio tiene») no. «np» se incluye a
 * pedido del equipo, aunque a veces se use como «no problem».
 */
const ABBREVIATIONS = [
  'rctmr', 'rctm', 'rptmr', 'rtmr', 'ctmr', 'ctmre', 'csmr', 'csmre', 'ptmr', 'ptmre', 'cdtm', 'hdpt', 'hpt', 'hp', 'hpta',
  'crj', 'crjo', 'crjos', 'mrd', 'mrda', 'mrdas', 'pn', 'pndj', 'pndjo', 'pndja', 'cjdo', 'cjda', 'hvn', 'hvon', 'wn', 'np', 'kk', 'kks', 'ql', 'mmgv', 'ptmdr',
]

/**
 * Palabras que con letras dobles son un insulto y con una sola son otra cosa: «forro» y no «foro», «brocca» y no «broca»,
 * «cazzo» y no «cazo». Se comparan tal como se escriben, igual que las abreviaturas.
 */
const DOUBLE_LETTER = ['forro', 'forra', 'forros', 'forras', 'brocca', 'broccas', 'cazzo', 'cazzi']

/** Frases de varias palabras. */
const PHRASES = [
  'concha tu madre', 'concha de tu madre', 'la concha de tu madre', 'concha su madre', 'hijo de puta', 'hija de puta', 'hijo de perra', 'hija de perra',
  'vete a la mierda', 'anda a la mierda', 'me cago en', 'chupame', 'chupa mi', 'que te jodan', 'callate', 'come mierda', 'saco de wea', 'tu puta madre',
  'la puta madre', 'chinga tu madre', 'te voy a violar', 'son of a bitch', 'fuck you', 'filho da puta',
]

/** Minúsculas, sin tildes y con cifras y símbolos comunes cambiados por su letra («m1erda» → «mierda»). */
function letters(text: string): string {
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
    .trim()
}

/** Como `letters`, pero sin letras repetidas («puuuta» → «puta»). */
const plain = (text: string) => letters(text).replace(/([a-zñ])\1+/g, '$1')

const WORD_SET = new Set(WORDS.map(plain))
const PHRASE_LIST = PHRASES.map(plain)
const AS_WRITTEN = new Set([...ABBREVIATIONS, ...DOUBLE_LETTER])

/** La palabra y su singular («maricones» → «maricon», «pingas» → «pinga»). */
const forms = (word: string) => [word, word.replace(/es$/, ''), word.replace(/s$/, '')]

/** ¿El mensaje trae groserías o insultos? Ignora las palabras parecidas («Vergara», «computadora», «peneca»). */
export function isAbusive(text: string): boolean {
  const flat = plain(text)
  if (!flat) return false
  const padded = ` ${flat} `
  if (PHRASE_LIST.some((phrase) => padded.includes(` ${phrase} `))) return true
  if (flat.split(' ').some((word) => forms(word).some((form) => WORD_SET.has(form)) || AS_WRITTEN.has(word))) return true
  // Tal como se escribió, con tres o más letras iguales contadas como dos («kkkk» → «kk», «forrrro» → «forro»).
  return letters(text)
    .replace(/([a-zñ])\1{2,}/g, '$1$1')
    .split(' ')
    .some((word) => AS_WRITTEN.has(word))
}

/**
 * Qué responde Teca. `warnings` son los mensajes agresivos seguidos que ya recibió: el primero se toma como algo que no se
 * entendió y, si el cliente insiste, Teca reconoce la agresión.
 */
export function abuseReply(warnings: number): string {
  return warnings >= 1 ? AGGRESSION_TEXT : NOT_UNDERSTOOD_TEXT
}
