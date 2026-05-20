/* App orchestrator — scroll-driven phases:
   Phase A  (0.0–0.18): landing — graph at center, title visible, clickable.
   Phase B  (0.18–0.42): zoom — focal node grows to fill screen, fades to black.
   Phase C  (0.42–0.85): timeline — programme scrolls, time-cursor moves.
   Phase D  (0.85–1.0):  venue — slides up from below, register CTA.
*/

const PHASE = {
  A_END: 0.10,   // landing end
  B_END: 0.22,   // zoom transition end
  C_END: 0.82,   // timeline end
  // D_END = 1.0
};

function useScroll() {
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    const onScroll = () => {
      const sc = document.documentElement;
      const max = sc.scrollHeight - window.innerHeight;
      const p = Math.max(0, Math.min(1, window.scrollY / Math.max(1, max)));
      setP(p);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return p;
}

function App() {
  const [schedule, setSchedule] = React.useState([]);
  const cfg = JSON.parse(document.getElementById('ohb-config').textContent);

  // Load schedule
  React.useEffect(() => {
    fetch('content/schedule.md').then(r => r.text()).then(md => {
      setSchedule(window.parseSchedule(md));
    });
  }, []);

  // Set scroller height: enough room for landing(100vh) + zoom(120vh) + 12 talks*70vh + venue(140vh)
  React.useEffect(() => {
    if (!schedule.length) return;
    const vh = window.innerHeight;
    const total =
      vh * 1.0 +                  // landing
      vh * 1.4 +                  // zoom
      vh * 0.7 * schedule.length + // timeline slots
      vh * 1.4;                   // venue
    document.getElementById('ohb-scroller').style.height = total + 'px';
  }, [schedule]);

  const scrollP = useScroll();

  // Phase progress
  const landingP = Math.min(1, scrollP / PHASE.A_END);
  const zoomP = Math.max(0, Math.min(1, (scrollP - PHASE.A_END) / (PHASE.B_END - PHASE.A_END)));
  const tlSpan = PHASE.C_END - PHASE.B_END;
  const tlP = Math.max(0, Math.min(1, (scrollP - PHASE.B_END) / tlSpan));
  const venueP = Math.max(0, Math.min(1, (scrollP - PHASE.C_END) / (1.0 - PHASE.C_END)));

  // Stage scale + opacity transitions
  // - Landing/title visible while scrollP < A_END
  // - During zoomP: title fades; graph blows up
  // - At zoomP=1: graph fully zoomed; timeline takes over
  const titleOpacity = Math.max(0, 1 - landingP * 1.4 - zoomP * 1.2);
  const titleY = (zoomP) * -40;
  const graphOpacity = Math.max(0, 1 - Math.max(0, zoomP - 0.65) / 0.35);

  // Timeline visibility & shift
  const timelineVisible = zoomP > 0.5;
  const timelineOpacity = Math.max(0, Math.min(1, (zoomP - 0.55) / 0.4));
  // Timeline slides out upward as venue takes over
  const timelineExit = venueP; // 0..1
  const timelineY = -timelineExit * window.innerHeight * 0.6;
  const timelineFade = 1 - venueP;

  // Update topbar
  React.useEffect(() => {
    const label = scrollP < PHASE.A_END ? 'landing'
                : scrollP < PHASE.B_END ? 'zoom · entering'
                : scrollP < PHASE.C_END ? 'programme'
                : 'venue · register';
    document.getElementById('ohb-progress-label').textContent = label;
    document.getElementById('ohb-progress-fill').style.width = (scrollP * 100).toFixed(1) + '%';
  }, [scrollP]);

  // Sync focus index for hit-test
  React.useEffect(() => { window.__ohbmFocusIdx = cfg.focusNodeIdx; }, [cfg.focusNodeIdx]);

  // Schedule timing range
  const dayStart = schedule.length ? Math.floor(schedule[0].start / 60) * 60 : 9*60;
  const dayEnd = schedule.length ? Math.ceil(schedule[schedule.length-1].end / 60) * 60 : 18*60;

  return (
    <React.Fragment>
      {/* Graph layer (always present, fades during venue) */}
      <div className="ohb-graph" style={{
        opacity: graphOpacity * (1 - venueP),
        transform: `translateY(${-12 * (1 - zoomP)}%) scale(${0.78 + 0.22 * zoomP})`,
        transformOrigin: '50% 42%',
        transition: 'none',
      }}>
        <ConnectomeGraph
          zoomProgress={zoomP}
          focusNodeIdx={cfg.focusNodeIdx}
          paused={zoomP > 0.5}
        />
      </div>

      {/* Scrim behind the landing title — soft radial fade so the brain
          dissolves into the dark page above the headline. */}
      <div className="ohb-title-scrim" style={{
        opacity: Math.max(0, 1 - zoomP * 1.6),
      }} />

      {/* Fog veils above & below */}
      <div className="ohb-fog-top" />
      <div className="ohb-fog-bot" />

      {/* Landing title (fades during zoom) */}
      <div className="ohb-landing" style={{
        opacity: titleOpacity,
        transform: `translateY(${titleY}px)`,
      }}>
        <div>
          <div className="ohb-landing-kicker">OHBM 2026 · workshop · 13 june</div>
          <h1 className="ohb-landing-title">
            Promises &amp; perils of<br/>
            connectome-constrained<br/>
            neuro-AI models<span className="ohb-period">.</span>
          </h1>
          <div className="ohb-landing-meta">
            <span><b>Full-day workshop</b></span>
            <span><b>10 talks</b></span>
            <span><b>90 min hackathon</b></span>
            <span><b>09:00 — 17:30</b></span>
          </div>
        </div>
        <div className="ohb-scroll-hint">
          <span>scroll · enter network</span>
          <span className="ohb-scroll-tick"></span>
        </div>
      </div>

      {/* Timeline (only visible after zoom) */}
      {timelineVisible && schedule.length > 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 25,
          opacity: timelineOpacity * timelineFade,
          transform: `translateY(${timelineY}px)`,
          transition: 'opacity 240ms ease',
          pointerEvents: venueP > 0.5 ? 'none' : 'auto',
          filter: venueP > 0.2 ? `blur(${venueP * 6}px)` : 'none',
        }}>
          <TimelinePage
            slots={schedule}
            progress={tlP}
            dayStart={dayStart}
            dayEnd={dayEnd}
          />
        </div>
      )}

      {/* Venue */}
      <VenuePage visibility={venueP} />
    </React.Fragment>
  );
}

const stageEl = document.getElementById('ohb-stage');
const root = ReactDOM.createRoot(stageEl);
root.render(<App />);
