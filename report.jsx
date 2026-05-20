/* Minimizable perturbation report panel. */

function ReportPanel({ stats, onPerturb, onReset }) {
  const [min, setMin] = React.useState(false);
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth;
    const h = cvs.clientHeight;
    cvs.width = w * dpr; cvs.height = h * dpr;
    const ctx = cvs.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // grid baseline
    ctx.strokeStyle = 'rgba(244,244,240,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h - 0.5); ctx.lineTo(w, h - 0.5); ctx.stroke();
    const hist = stats.history || [];
    if (!hist.length) return;
    const maxV = Math.max(2, ...hist);
    ctx.strokeStyle = '#F53A61';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    hist.forEach((v, i) => {
      const x = (i / (hist.length - 1 || 1)) * w;
      const y = h - (v / maxV) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // fill below
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = 'rgba(245,58,97,0.12)';
    ctx.fill();
  }, [stats]);

  return (
    <div className={"ohb-report" + (min ? " is-min" : "")}>
      <div className="ohb-report-head">
        <div className="ohb-report-title">
          <span className="ohb-report-dot" />
          <span>activity report</span>
        </div>
        <div className="ohb-report-controls">
          {!min && (
            <button className="ohb-report-btn" onClick={onReset} title="reset">↺</button>
          )}
          <button className="ohb-report-btn" onClick={() => setMin(m => !m)} title={min ? "expand" : "minimize"}>
            {min ? '▢' : '–'}
          </button>
        </div>
      </div>
      {!min && (
        <div className="ohb-report-body">
          <div className="ohb-report-stats">
            <div>
              <div className="ohb-stat-label">packets</div>
              <div className="ohb-stat-value">{String(stats.packets || 0).padStart(4, '0')}</div>
            </div>
            <div>
              <div className="ohb-stat-label">active</div>
              <div className="ohb-stat-value">{stats.active || 0}<span className="ohb-stat-sub">/{stats.total || 133}</span></div>
            </div>
          </div>
          <canvas ref={canvasRef} className="ohb-report-canvas" />
          <div className="ohb-report-foot">
            <span>click a node to perturb the network</span>
            <button className="ohb-report-kick" onClick={onPerturb}>kick random ↯</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.ReportPanel = ReportPanel;
