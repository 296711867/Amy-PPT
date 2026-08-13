import amyLogoUrl from '@renderer/assets/images/logo.png'

export function AmyLogoMotion(): React.JSX.Element {
  return (
    <div
      className="amy-logo-scene pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="amy-logo-orbit amy-logo-orbit-left">
        <span />
        <span />
        <span />
      </div>
      <div className="amy-logo-orbit amy-logo-orbit-right">
        <span />
        <span />
      </div>
      <div className="amy-logo-stage">
        <div className="amy-logo-shadow" />
        <div className="amy-logo-character">
          <div className="amy-logo-spark amy-logo-spark-one">+</div>
          <div className="amy-logo-spark amy-logo-spark-two">+</div>
          <img src={amyLogoUrl} alt="" draggable={false} />
        </div>
      </div>
    </div>
  )
}
