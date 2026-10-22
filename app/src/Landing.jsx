// The public page. Built to taste-skill's page run, direction "One motif": the rule's own object,
// two keys that must turn together, becomes two circles. They are the hero, the photo masks, the
// approval slots, the buttons and the closing mark. "Try to break it" (BreakIt.jsx) is the real
// prototype: every move calls the plant controller and every result is read back from it.
import { useEffect, useState } from "react";
import BreakIt from "./BreakIt.jsx";
import Evidence from "./Evidence.jsx";
import { kpa } from "./shared.js";

const REPO_URL = "https://github.com/beaaan/rmit-hackathon-2026-c2";
const P = `${import.meta.env.BASE_URL}photos/`;
const PHOTO = {
  hall: `${P}interior-of-western-pumping-station-geograph-org.jpg`,
  filters: `${P}view-of-upper-level-of-filtration-room.jpg`,
  basins: `${P}overall-view-of-flocculation-sedimentation-basins-1778.jpg`,
  backwash: `${P}backwashing-demo-at-a-water-filtration-plant.webm`,
  backwashPoster: `${P}backwashing-demo-at-a-water-filtration-plant-poster.jpg`,
};
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrances: each section's parts rise in once as it enters. Content is visible without script. */
function useReveal() {
  useEffect(() => {
    document.documentElement.classList.add("reveal-on");
    const io = new IntersectionObserver(
      (items) =>
        items.forEach((it) => {
          if (it.isIntersecting) {
            it.target.classList.add("in");
            io.unobserve(it.target);
          }
        }),
      { threshold: 0.15 },
    );
    document.querySelectorAll(".landing [data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing(props) {
  const line = props.plant?.lines.find((l) => l.id === "L3");
  useReveal();
  useEffect(() => {
    document.body.dataset.view = "landing";
    return () => delete document.body.dataset.view;
  }, []);

  return (
    <div className="landing">
      <nav className="topbar" aria-label="Page">
        <a className="wordmark" href="#top">
          <Mark /> Two-Person Rule
        </a>
        <div className="links">
          <a href="#happening">It's happening</a>
          <a href="#who">Who can act</a>
          <a href="#/control-room">Control room</a>
          <a className="pill" href="#try">
            Try to break it
          </a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="hero-copy" data-reveal>
          <h1>
            The AI can ask.
            <br />
            Two people decide.
          </h1>
          <p className="lead">
            An AI watches a city's water plant overnight and can propose a shutdown. It runs only once two
            operators approve, and neither the AI, an admin nor a server hacker can skip that step.
          </p>
          <div className="hero-actions">
            <a className="pill" href="#try">
              Try to break it
            </a>
            <a className="text-link" href="#who">
              See who can't
            </a>
          </div>
        </div>
        <div className="hero-discs" aria-hidden="false">
          <figure className="disc photo drift">
            <img src={PHOTO.hall} width="1920" height="2560" alt="Inside a pumping station: a long arched hall over green pumps" />
          </figure>
          <div className="disc blue" data-ui>
            <span className="disc-label">Line 3 right now</span>
            <span className="disc-figure num">{line ? kpa(line.pressureKpa) : "–"}</span>
            <span className="disc-label">kPa · pumps {line?.pumps ?? "–"}</span>
          </div>
        </div>
      </header>

      <section className="problem" aria-labelledby="problem-title">
        <div className="problem-copy" data-reveal>
          <h2 id="problem-title">Why plants keep AI out</h2>
          <p className="statement">
            AI could spot a burst main in seconds. Plants keep it from the controls because one stolen key or one
            tricked AI could cut a city's water.
          </p>
        </div>
        <div className="problem-discs" data-reveal>
          <figure className="disc photo one">
            <video autoPlay={!reducedMotion()} muted loop playsInline preload="metadata" poster={PHOTO.backwashPoster} width="854" height="480" aria-label="Two filter columns at a water filtration plant being backwashed">
              <source src={PHOTO.backwash} type="video/webm" />
            </video>
          </figure>
          <figure className="disc photo two">
            <img src={PHOTO.filters} width="1920" height="1546" loading="lazy" alt="A filtration room: rows of tanks and control valves" />
          </figure>
        </div>
      </section>

      <Evidence />

      <WhoCanAct />

      <section className="band" aria-labelledby="band-title" data-reveal>
        <div>
          <h2 id="band-title">Built with TideCloak</h2>
          <p>
            TideCloak keeps no password store and puts no signing key on any server. Making someone an operator takes
            two of the three admins, so even the people who run the system can't give themselves the right to approve.
          </p>
        </div>
        <figure className="disc photo">
          <img src={PHOTO.basins} width="1920" height="1517" loading="lazy" alt="Settling basins at a water treatment plant beside the sea" />
        </figure>
      </section>

      <BreakIt {...props} />

      <Footer />
    </div>
  );
}

function Mark({ size = 22 }) {
  return (
    <svg className="mark-svg" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="12" r="7" fill="currentColor" />
      <circle cx="16" cy="12" r="7" fill="var(--accent)" style={{ mixBlendMode: "multiply" }} />
    </svg>
  );
}

const WHO = [
  {
    id: "ai",
    label: "Sentinel, the AI",
    verdict: "No",
    tone: "dark",
    reply: ["Run the shutdown", "Refused", "Needs 2 operator approvals, has 0."],
    fact: "It has no login and no key, so however it's tricked, it has nothing that counts as an approval.",
  },
  {
    id: "admin",
    label: "Jo, the IT admin",
    verdict: "No",
    tone: "dark",
    reply: ["Approve the shutdown", "Refused", "Signed in, but not a plant operator."],
    fact: "He can't make himself an operator either. In TideCloak, that change waits for 2 of the 3 admins.",
  },
  {
    id: "server",
    label: "Whoever hacks the server",
    verdict: "No",
    tone: "dark",
    reply: ["Forged approval", "Refused", "Not signed by this realm's key."],
    fact: "No server holds the key that signs logins. Tide's network signs them, and the plant only checks the signature.",
  },
  {
    id: "kim",
    label: "Kim, on her own",
    verdict: "Not yet",
    tone: "grey",
    reply: ["Kim approves", "1 of 2", "The same person twice still counts once."],
    fact: "Her approval counts as one of the two the command needs.",
  },
  {
    id: "both",
    label: "Kim and Raj together",
    verdict: "Yes",
    tone: "blue",
    reply: ["Raj approves", "2 of 2", "Pumps stopped."],
    fact: "The command runs once two different operators, each signed in through TideCloak, have approved it.",
  },
];

function WhoCanAct() {
  const [active, setActive] = useState(0);
  const item = WHO[active];
  return (
    <section className="who" id="who" aria-labelledby="who-title">
      <div className="who-list" data-reveal>
        <h2 id="who-title">Who can stop the pumps?</h2>
        <ul role="tablist" aria-label="People and machines">
          {WHO.map((w, i) => (
            <li key={w.id}>
              <button role="tab" aria-selected={i === active} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}>
                {w.label}
              </button>
              {/* On touch screens each row shows its answer inline. */}
              <p className="who-inline">
                <strong>{w.verdict}.</strong> {w.fact}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="who-stage" data-reveal>
        <div className={`disc big ${item.tone}`}>
          <div className="reply" data-ui key={item.id}>
            <span className="reply-verdict">{item.verdict}</span>
            <span className="reply-row">
              <span>{item.reply[0]}</span>
              <span className={`chip ${item.tone}`}>{item.reply[1]}</span>
            </span>
            <span className="reply-why">{item.reply[2]}</span>
          </div>
        </div>
        <p className="who-fact" key={item.id + "-fact"}>
          {item.fact}
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer" aria-labelledby="footer-title">
      <h2 id="footer-title" className="footer-mark">
        <span className="big-disc ink" />
        <span className="big-disc blue" />
        <span className="footer-name">Two-Person Rule</span>
      </h2>
      <div className="footer-cols">
        <ul>
          <li>
            <a href="#try">Try to break it</a>
          </li>
          <li>
            <a href="#happening">It's already happening</a>
          </li>
          <li>
            <a href="#who">Who can act</a>
          </li>
          <li>
            <a href="#/control-room">Control room</a>
          </li>
        </ul>
        <ul>
          <li>
            <a href={REPO_URL}>Source code</a>
          </li>
          <li>
            <a href="https://tide.org/tidecloak">TideCloak</a>
          </li>
          <li>
            <a href="https://tide.org/unlocked">UNLOCKED challenge</a>
          </li>
        </ul>
        <div className="footer-about">
          <p>Built for Tide's UNLOCKED challenge at RMIT, October 2026.</p>
          <p>Riverbend and every reading on this page are synthetic.</p>
        </div>
      </div>
      <p className="credits">
        Photographs, shown in black and white: pumping station hall by Paul Farmer (CC BY-SA 2.0); filtration room and
        basins by Bruce D. Judd, Historic American Engineering Record (public domain). Video: backwashing demo at a water filtration plant by Z22 (CC BY-SA 4.0).
        All via Wikimedia Commons.
      </p>
      <div className="footer-last">
        <span>Two-Person Rule, 2026</span>
        <a className="pill small" href="#try">
          Try to break it
        </a>
      </div>
    </footer>
  );
}
