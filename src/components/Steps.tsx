export type StepState = 'done' | 'current' | 'todo'

export interface Step {
  label: string
  state: StepState
}

/** Progress rail shown beside the page card (collapses to a top strip on mobile). */
export function Steps({ steps, label }: { steps: readonly Step[]; label: string }) {
  return (
    <aside className="wizard__steps" aria-label={label}>
      <ol className="steps">
        {steps.map((step) => (
          <li
            key={step.label}
            className={`steps__item steps__item--${step.state}`}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span className="steps__dot" aria-hidden="true" />
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
