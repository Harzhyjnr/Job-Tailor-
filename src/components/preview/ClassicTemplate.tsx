import {
  BASE_FONT_PT,
  buildResumeDocument,
  metricsFor,
  paginateDocument,
} from '@/services/resumeDocument'
import type { DocumentLine } from '@/services/resumeDocument'
import type { Resume } from '@/types/resume'
import type { UserPreferences } from '@/types/analysis'

/**
 * One face, on purpose. The PDF is written with the standard fonts, and Helvetica
 * is the only one of those a browser can match metric-for-metric, so offering any
 * other face here would put a different font in the file than the one on screen.
 */
export const PREVIEW_FONT = 'Arial, Helvetica, sans-serif'

const DEFAULT_PREFERENCES: UserPreferences = {
  templateId: 'ats-classic',
  fontSizePt: BASE_FONT_PT,
  lineHeight: 1.25,
  marginIn: 0.5,
}

export interface ClassicTemplateProps {
  resume: Resume
  preferences?: Partial<UserPreferences>
}

/**
 * The ATS Classic layout: one column, standard headings, no graphics, no tables
 * and no sidebars. Everything an applicant-tracking system struggles with is left
 * out on purpose, so what is left is what actually gets parsed.
 *
 * The lines come from `buildResumeDocument`, the same model the PDF export lays
 * out, so this is a preview of the file rather than a lookalike of it. Page
 * geometry is expressed in points and inches to match the exported page exactly.
 */
export function ClassicTemplate({ resume, preferences }: ClassicTemplateProps) {
  const settings = { ...DEFAULT_PREFERENCES, ...preferences }
  const fontSizePt = clamp(settings.fontSizePt, 8, 14)
  const lineHeight = clamp(settings.lineHeight, 0.9, 2)
  const marginIn = clamp(settings.marginIn, 0.25, 1.5)
  const scale = fontSizePt / BASE_FONT_PT
  const lines = buildResumeDocument(resume)
  const placed = paginateDocument(lines, { lineHeight, marginPt: marginIn * 72, scale })
  const breakBefore = new Map<number, number>()

  placed.forEach((item, index) => {
    if (item.startsPage && item.pageIndex > 0) {
      breakBefore.set(index, item.pageIndex + 1)
    }
  })

  return (
    <article
      data-testid="ats-classic"
      style={{
        fontFamily: PREVIEW_FONT,
        fontSize: `${fontSizePt}pt`,
        lineHeight,
        padding: `${marginIn}in`,
        color: '#111111',
        backgroundColor: '#ffffff',
        textAlign: 'left',
      }}
    >
      {lines.map((line, index) => {
        const pageStartingHere = breakBefore.get(index)

        return (
          <div key={`${line.style}-${index}`}>
            {pageStartingHere ? (
              <div
                data-testid="page-break"
                role="separator"
                aria-label={`Page ${pageStartingHere} starts here`}
                className="my-6 flex items-center gap-3 print:hidden"
              >
                <span className="h-px flex-1 bg-border" />
                <span className="shrink-0 text-[10px] font-medium tracking-wide text-ink-subtle uppercase">
                  Page {pageStartingHere}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : null}
            <Line line={line} scale={scale} lineHeight={lineHeight} />
          </div>
        )
      })}
    </article>
  )
}

function Line({
  line,
  scale,
  lineHeight,
}: {
  line: DocumentLine
  scale: number
  lineHeight: number
}) {
  const metrics = metricsFor(line.style, scale)

  return (
    <p
      style={{
        fontSize: `${metrics.fontSize}pt`,
        lineHeight: metrics.lineHeight * lineHeight,
        fontWeight: metrics.bold ? 700 : 400,
        letterSpacing: line.style === 'section' ? '0.04em' : undefined,
        marginTop: `${line.spaceBefore * scale}pt`,
        marginBottom: `${line.spaceAfter * scale}pt`,
        marginLeft: `${line.indent * scale}pt`,
        paddingBottom: line.rule ? '1pt' : undefined,
        borderBottom: line.rule ? '0.75pt solid #333333' : undefined,
      }}
    >
      {markerFor(line)}
    </p>
  )
}

function markerFor(line: DocumentLine) {
  return line.style === 'bullet' ? `• ${line.text}` : line.text
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}
