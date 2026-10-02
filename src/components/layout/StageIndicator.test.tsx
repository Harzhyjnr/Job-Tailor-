import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StageIndicator } from '@/components/layout/StageIndicator'
import { STAGES } from '@/constants/workflow'

describe('StageIndicator', () => {
  it('marks the current stage for assistive technology', () => {
    render(<StageIndicator current="Job" />)

    expect(screen.getByText('Job').closest('[aria-current]')).toHaveAttribute(
      'aria-current',
      'step',
    )
  })

  it('announces position without relying on colour', () => {
    render(<StageIndicator current="Job" />)

    expect(
      screen.getByText(`Step ${STAGES.indexOf('Job') + 1} of ${STAGES.length}: Job`),
    ).toBeInTheDocument()
  })

  it('labels completed stages as completed', () => {
    render(<StageIndicator current="Tailor" />)

    expect(screen.getAllByText('(completed)')).toHaveLength(STAGES.indexOf('Tailor'))
  })

  it('renders every stage', () => {
    render(<StageIndicator current="Resume" />)

    for (const stage of STAGES) {
      expect(screen.getByText(stage)).toBeInTheDocument()
    }
  })
})
