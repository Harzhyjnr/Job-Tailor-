/**
 * Builds small, valid PDF and DOCX byte fixtures in memory so extraction is
 * tested against the real libraries without committing binary files.
 *
 * Both formats are produced by hand: the DOCX is an uncompressed ZIP with the
 * minimal OPC parts mammoth needs, and the PDF is a single page with one text
 * content stream.
 */

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index]!
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function zip(files: { name: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const contentBytes = encoder.encode(file.content)
    const crc = crc32(contentBytes)

    const local = new Uint8Array(30 + nameBytes.length + contentBytes.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true) // version needed
    localView.setUint16(6, 0, true) // flags
    localView.setUint16(8, 0, true) // stored, no compression
    localView.setUint16(10, 0, true) // mod time
    localView.setUint16(12, 0x21, true) // mod date (1996-01-01)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, contentBytes.length, true)
    localView.setUint32(22, contentBytes.length, true)
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true)
    local.set(nameBytes, 30)
    local.set(contentBytes, 30 + nameBytes.length)
    locals.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, 0, true)
    centralView.setUint16(14, 0x21, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, contentBytes.length, true)
    centralView.setUint32(24, contentBytes.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centrals.push(central)

    offset += local.length
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)

  const total = offset + centralSize + end.length
  const output = new Uint8Array(total)
  let cursor = 0
  for (const part of [...locals, ...centrals, end]) {
    output.set(part, cursor)
    cursor += part.length
  }

  return output
}

const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const DOCX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function docxParagraphs(lines: string[]): string {
  const paragraphs = lines.map((line) =>
    line.length === 0
      ? '<w:p/>'
      : `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`,
  )

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs.join('')}</w:body>
</w:document>`
}

/** A valid .docx containing the given lines as paragraphs. */
export function buildDocx(lines: string[]): Uint8Array {
  return zip([
    { name: '[Content_Types].xml', content: DOCX_CONTENT_TYPES },
    { name: '_rels/.rels', content: DOCX_RELS },
    { name: 'word/document.xml', content: docxParagraphs(lines) },
  ])
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

/** A single-page PDF with the given lines drawn as text. */
export function buildPdf(lines: string[]): Uint8Array {
  const encoder = new TextEncoder()
  const textOperations = lines
    .map((line, index) => {
      const y = 780 - index * 16
      return `BT /F1 11 Tf 60 ${y} Td (${escapePdfText(line)}) Tj ET`
    })
    .join('\n')

  const contentStream = `${textOperations}\n`

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  objects.forEach((body, index) => {
    offsets.push(encoder.encode(pdf).length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = encoder.encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return encoder.encode(pdf)
}
