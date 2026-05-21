/* Timeline + Venue pages.
   Schedule is loaded from content/schedule.md and parsed.
   Each slot block looks like:
     ## HH:MM – HH:MM · Speaker name
     ### Title
     Paragraph(s) of abstract.
*/

function parseSchedule(md) {
  const lines = md.split(/\r?\n/);
  const slots = [];
  let cur = null;
  const headerRe = /^##\s+(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})\s*[·.\-]\s*(.+?)\s*$/;
  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      if (cur) slots.push(cur);
      const [, h1, m1, h2, m2, name] = m;
      cur = {
        start: parseInt(h1)*60 + parseInt(m1),
        end:   parseInt(h2)*60 + parseInt(m2),
        startStr: `${h1}:${m1}`,
        endStr:   `${h2}:${m2}`,
        name: name.trim(),
        title: '',
        abstract: '',
      };
      continue;
    }
    if (!cur) continue;
    const tmatch = line.match(/^###\s+(.+?)\s*$/);
    if (tmatch && !cur.title) { cur.title = tmatch[1].trim(); continue; }
    if (line.startsWith('#')) continue;
    if (line.trim()) cur.abstract += (cur.abstract ? ' ' : '') + line.trim();
  }
  if (cur) slots.push(cur);
  return slots;
}

// ── Timeline ───────────────────────────────────────────────────────
function TimelineColumn({ slots, scrollProgress, dayStart, dayEnd, activeIdx }) {
  if (!slots.length) return null;
  // Map minutes-of-day → vertical px in the timeline
  const PX_PER_MIN = 8; // 8 hours * 60 * 8 = 3840px tall track. We translate by progress.
  const totalMin = dayEnd - dayStart;
  const trackHeight = totalMin * PX_PER_MIN;
  // Focus line is at 32% from top of viewport. Use the stable viewport height
  // (frozen at load by app.jsx) so iOS URL-bar show/hide during a swipe doesn't
  // shift the focus line and make the whole track jump.
  const vh = window.__ohbStableVh || window.innerHeight;
  const focusY = vh * 0.36;
  // Current "time-cursor" follows progress between first slot's start and last slot's end
  const firstStart = slots[0].start;
  const lastEnd = slots[slots.length - 1].end;
  const cursorMin = firstStart + (lastEnd - firstStart) * scrollProgress;
  const cursorY = (cursorMin - dayStart) * PX_PER_MIN;
  const translateY = focusY - cursorY;

  return (
    <div className="ohb-timeline" style={{ transform: `translateY(${translateY}px)`, height: trackHeight + 'px' }}>
      {/* Vertical spine (faint) */}
      <div className="ohb-spine" style={{ height: trackHeight + 'px' }} />
      {/* Hour ticks */}
      {Array.from({length: Math.floor(totalMin/60) + 1}, (_, i) => {
        const min = dayStart + i*60;
        const y = (min - dayStart) * PX_PER_MIN;
        const hour = Math.floor(min/60);
        return (
          <div key={'h'+i} className="ohb-hour-tick" style={{ top: y + 'px' }}>
            <span className="ohb-hour-label">{String(hour).padStart(2,'0')}:00</span>
          </div>
        );
      })}
      {/* Slots */}
      {slots.map((sl, i) => {
        const y = (sl.start - dayStart) * PX_PER_MIN;
        const endY = (sl.end - dayStart) * PX_PER_MIN;
        const isActive = i === activeIdx;
        return (
          <div key={i} className={"ohb-slot" + (isActive ? " is-active" : "")} style={{ top: y + 'px' }}>
            <div className={"ohb-circle" + (isActive ? " is-active" : "")}>
              <span className="ohb-circle-idx">{String(i+1).padStart(2,'0')}</span>
            </div>
            <div className="ohb-bar" style={{ height: (endY - y) + 'px' }} />
            <div className="ohb-end-dash" style={{ top: (endY - y) + 'px' }} />
            <div className="ohb-time-label">{sl.startStr}</div>
            <div className="ohb-time-label ohb-time-end" style={{ top: (endY - y - 6) + 'px' }}>{sl.endStr}</div>
            <div className="ohb-mini-name">{sl.name}</div>
          </div>
        );
      })}
    </div>
  );
}

function InfoPanel({ slots, activeIdx }) {
  const slot = slots[activeIdx];
  if (!slot) return null;
  return (
    <div className="ohb-info" key={activeIdx}>
      <div className="ohb-info-time">{slot.startStr} — {slot.endStr}</div>
      <div className="ohb-info-name">{slot.name}</div>
      <h2 className="ohb-info-title">{slot.title}</h2>
      <p className="ohb-info-abstract">{slot.abstract}</p>
      <div className="ohb-info-meta">
        Talk {String(activeIdx+1).padStart(2,'0')} / {String(slots.length).padStart(2,'0')}
        <span className="ohb-info-meta-sep">·</span>
        {slot.end - slot.start} min
      </div>
    </div>
  );
}

function TimelinePage({ slots, progress, dayStart, dayEnd }) {
  if (!slots.length) return null;
  // active idx based on progress
  const first = slots[0].start;
  const last  = slots[slots.length - 1].end;
  const cursorMin = first + (last - first) * progress;
  let activeIdx = 0;
  let bestDist = Infinity;
  slots.forEach((s, i) => {
    const center = (s.start + s.end) / 2;
    const d = Math.abs(center - cursorMin);
    if (d < bestDist) { bestDist = d; activeIdx = i; }
  });

  return (
    <div className="ohb-timeline-page">
      <div className="ohb-timeline-col">
        <TimelineColumn
          slots={slots}
          scrollProgress={progress}
          dayStart={dayStart}
          dayEnd={dayEnd}
          activeIdx={activeIdx}
        />
      </div>
      <div className="ohb-info-col">
        <InfoPanel slots={slots} activeIdx={activeIdx} />
      </div>
      <div className="ohb-section-label">Programme · 13 June 2026</div>
    </div>
  );
}

// ── Venue ──────────────────────────────────────────────────────────
function VenuePage({ visibility = 0 }) {
  // visibility: 0..1 — comes from below
  const translate = (1 - visibility) * 100;
  return (
    <div className="ohb-venue" style={{ transform: `translateY(${translate}%)`, opacity: visibility }}>
      <div className="ohb-venue-inner">
        <div className="ohb-venue-kicker">VENUE · 13 JUNE 2026</div>
        <h1 className="ohb-venue-title">Promises &amp; perils of connectome-constrained neuro-AI models.</h1>
        <div className="ohb-venue-meta">
          <div>
            <div className="ohb-venue-meta-label">where</div>
            <div className="ohb-venue-meta-value">OHBM 2026 · Bordeaux, France</div>
          </div>
          <div>
            <div className="ohb-venue-meta-label">when</div>
            <div className="ohb-venue-meta-value">Saturday 13 June 2026 · 09:00 – 17:30 · Room F</div>
          </div>
          <div>
            <div className="ohb-venue-meta-label">format</div>
            <div className="ohb-venue-meta-value">In-person workshop · 10 talks &amp; panel</div>
          </div>
        </div>
        <p className="ohb-venue-blurb">
          Register so we have a rough estimate of attendance. The form is short: only your name and affiliation. Walk-ins are welcome but a head count helps us have an estimate of attendance.
        </p>
        <div className="ohb-venue-cta">
          <a className="ohb-btn-register"
             href="https://forms.gle/DjykaEp2rmWvo2Gj8"
             target="_blank" rel="noopener noreferrer">
            Register your interest →
          </a>
          <span className="ohb-venue-note">opens a Google form · free of charge</span>
        </div>
        <div className="ohb-venue-bottom">
          <span>OHBM 2026 · Annual Meeting of the Organization for Human Brain Mapping</span>
          <span>workshop.ohbm26</span>
        </div>
      </div>
    </div>
  );
}

window.parseSchedule = parseSchedule;
window.TimelinePage = TimelinePage;
window.VenuePage = VenuePage;
