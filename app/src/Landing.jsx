// The public page. Built to taste-skill's page run, direction "One motif": the rule's own object,
// two keys that must turn together, becomes two circles (the lock's two keyholes, the photo masks,
// the buttons, the closing mark). The console right under the headline (BreakIt.jsx) is the working
// prototype: every move calls the plant controller and every result is read back from it.
import { useEffect } from "react";
import { AUTH_MODE, auth } from "./auth.js";
import BreakIt from "./BreakIt.jsx";
import Evidence from "./Evidence.jsx";

const REPO_URL = "https://github.com/beaaan/rmit-hackathon-2026-c2";
const P = `${import.meta.env.BASE_URL}photos/`;
const PHOTO = {
  hall: `${P}interior-of-western-pumping-station-geograph-org.jpg`,
  filters: `${P}view-of-upper-level-of-filtration-room.jpg`,
  basins: `${P}overall-view-of-flocculation-sedimentation-basins-1778.jpg`,
  backwash: `${P}backwashing-demo-at-a-water-filtration-plant.webm`,
  backwashPoster: `${P}backwashing-demo-at-a-water-filtration-plant-poster.jpg`,
};
const MODE = __PREVIEW__
  ? ["Preview", "The controller, Sentinel and a stand-in sign-in service all run inside this page."]
  : AUTH_MODE === "rehearsal"
    ? ["Rehearsal", "Sign-ins come from a stand-in realm on this machine, not TideCloak."]
    : null;
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
  const { session } = props;
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
          {MODE && (
            <span className="mode-chip" title={MODE[1]}>
              {MODE[0]}
            </span>
          )}
          {AUTH_MODE === "tide" &&
            (session ? (
              <button className="link-btn" onClick={auth.logout}>
                {session.username} · Sign out
              </button>
            ) : (
              session === null && (
                <button className="link-btn" onClick={() => auth.login()}>
                  Sign in
                </button>
              )
            ))}
          <a className="pill small" href="#/control-room">
            Control room
          </a>
        </div>
      </nav>

      <header className="hero" id="top">
        <h1>
          <span>The AI can ask.</span> <span className="blue">Two people decide.</span>
        </h1>
      </header>

      <BreakIt {...props} />

      <section className="problem" id="problem" aria-labelledby="problem-title">
        <div className="problem-copy" data-reveal>
          <h2 id="problem-title">Why plants keep AI out</h2>
          <p className="statement">
            AI could spot a burst main in seconds. But one stolen key or one tricked AI could cut a city's water.
          </p>
        </div>
        <div className="problem-discs" data-reveal>
          <figure className="disc photo one">
            <video autoPlay={!reducedMotion()} muted loop playsInline preload="metadata" poster={PHOTO.backwashPoster} width="854" height="480" aria-label="Two filter columns at a water filtration plant being backwashed">
              <source src={PHOTO.backwash} type="video/webm" />
            </video>
          </figure>
          <figure className="disc photo three">
            <img src={PHOTO.hall} width="1920" height="2560" loading="lazy" alt="Inside a pumping station: a long arched hall over the pumps" />
          </figure>
          <figure className="disc photo two">
            <img src={PHOTO.filters} width="1920" height="1546" loading="lazy" alt="A filtration room: rows of tanks and control valves" />
          </figure>
        </div>
      </section>

      <Evidence />

      <section className="band" aria-labelledby="band-title" data-reveal>
        <div>
          <h2 id="band-title">What TideCloak does here</h2>
          <ul className="band-points">
            <li>
              <strong>No server can forge an operator.</strong>
              <span>Tide's network signs every sign-in. The plant holds only a public key.</span>
            </li>
            <li>
              <strong>No admin can make themselves one.</strong>
              <span>Granting the operator role takes 2 of the 3 admins.</span>
            </li>
            <li>
              <strong>The AI has nothing to steal.</strong>
              <span>Sentinel never signs in, so a tricked Sentinel holds no key.</span>
            </li>
          </ul>
        </div>
        <figure className="disc photo">
          <img src={PHOTO.basins} width="1920" height="1517" loading="lazy" alt="Settling basins at a water treatment plant beside the sea" />
        </figure>
      </section>

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
            <a href="#/control-room">Control room</a>
          </li>
          <li>
            <a href="#happening">It's already happening</a>
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
          <p>Built for Tide's UNLOCKED challenge at RMIT, October 2026. Riverbend and its readings are synthetic.</p>
        </div>
      </div>
      <p className="credits">
        Photographs, shown in black and white: pumping station hall by Paul Farmer (CC BY-SA 2.0); filtration room
        and basins by Bruce D. Judd, Historic American Engineering Record (public domain). Video: backwashing demo at a
        water filtration plant by Z22 (CC BY-SA 4.0). All via Wikimedia Commons.
      </p>
    </footer>
  );
}
