/**
 * Regenerates `src/services/helveticaWidths.ts`.
 *
 * The preview has to know where the PDF will break a line, and the only honest
 * way to know that is to use the same advance widths the PDF writer uses. Rather
 * than transcribe a width table by hand, this reads the widths straight out of
 * the fonts pdf-lib embeds, so the two can never disagree.
 *
 * It also reports the characters WinAnsi cannot encode at all, because those have
 * to be filtered out of the export rather than handed to the font and allowed to
 * throw. `printable()` in resumePdf.ts uses the same rule.
 *
 * Run it with: node scripts/generate-helvetica-widths.mjs
 */
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PUNCTUATION = ['…', '†', '‡', '•', '‰', '’', '‘', '“', '”', '–', '—', '™']

const document = await PDFDocument.create()
const regular = await document.embedFont(StandardFonts.Helvetica)
const bold = await document.embedFont(StandardFonts.HelveticaBold)

/** Width in 1/1000 em: measuring at 1000pt returns the AFM value unscaled. */
function widthOf(font, character) {
  return Math.round(font.widthOfTextAtSize(character, 1000))
}

function encodable(character) {
  try {
    regular.encodeText(character)

    return true
  } catch {
    return false
  }
}

const rejected = []
const characters = []

for (let code = 32; code <= 255; code += 1) {
  const character = String.fromCharCode(code)

  if (encodable(character)) {
    characters.push(character)
  } else {
    rejected.push(`0x${code.toString(16)}`)
  }
}

for (const character of PUNCTUATION) {
  if (encodable(character)) {
    characters.push(character)
  } else {
    rejected.push(`0x${character.codePointAt(0).toString(16)}`)
  }
}

function label(character) {
  if (character === '\\') return 'backslash'
  if (character === "'") return 'quote'
  if (character === ' ') return 'space'
  return character
}

function table(font) {
  return characters
    .map(
      (character) =>
        `  ${JSON.stringify(character)} /* ${label(character)} */: ${widthOf(font, character)},`,
    )
    .join('\n')
}

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'services',
  'helveticaWidths.ts',
)

writeFileSync(
  target,
  `/**
 * GENERATED FILE - do not edit by hand.
 * Regenerate with: node scripts/generate-helvetica-widths.mjs
 *
 * Advance widths in 1/1000 em for the standard PDF Helvetica faces, read out of
 * the fonts themselves. The preview needs these to break lines where the PDF
 * breaks them; Arial has the same widths, so the same numbers also describe what
 * is drawn on screen.
 *
 * Only characters the standard fonts can actually encode appear here, which is
 * also the set the exporter is allowed to pass through. Some of them are
 * whitespace the linter objects to inside a string literal, hence the disable.
 */
/* eslint-disable no-irregular-whitespace */

const REGULAR: Record<string, number> = {
${table(regular)}
}

const BOLD: Record<string, number> = {
${table(bold)}
}

/**
 * The width of \`text\` at \`sizePt\` in points. A character the table does not
 * cover is measured as a mid-range digit, so an unexpected character narrows the
 * line instead of running off the page.
 */
export function helveticaWidth(text: string, sizePt: number, isBold = false) {
  const widths = isBold ? BOLD : REGULAR
  let total = 0

  for (const character of text) {
    total += widths[character] ?? 556
  }

  return (total * sizePt) / 1000
}

/** Every character the standard PDF fonts can draw, as one string. */
export const HELVETICA_CHARSET = ${JSON.stringify(characters.join(''))}
`,
  'utf8',
)

console.log(`wrote ${characters.length} widths to ${target}`)
console.log(`cannot be encoded: ${rejected.join(', ') || 'none'}`)
