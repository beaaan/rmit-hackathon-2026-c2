import { useEffect, useState } from "react";
import { AUTH_MODE, auth } from "./auth.js";
import ControlRoom from "./ControlRoom.jsx";
import { controller } from "./controller.js";
import { usePoll } from "./shared.js";
import Story from "./Story.jsx";

const TIDECLOAK_URL = __TIDECLOAK_URL__;
const VIEWS = { story: "#/", room: "#/control-room" };

function useView() {
  const read = () => (location.hash === VIEWS.room ? "room" : "story");
  const [view, setView] = useState(read);
  useEffect(() => {
    const onHash = () => {
      setView(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return view;
}

export default function App() {
  const view = useView();
  const [session, setSession] = useState(undefined);
  const [authError, setAuthError] = useState(null);
  const [plant, plantError] = usePoll(controller.state, 1000);
  const [commands, , refreshCommands] = usePoll(controller.commands, 1000);
  const [audit, , refreshAudit] = usePoll(controller.audit, 1000);

  useEffect(() => {
    auth.init().then(setSession, (err) => {
      setAuthError(err.message);
      setSession(null);
    });
  }, []);

  const data = { session, authError, plant, plantError, commands, audit, refreshAll: () => Promise.all([refreshCommands(), refreshAudit()]) };

  return (
    <div className="app">
      <Rail view={view} session={session} />
      <main className="canvas">
        {view === "room" ? <ControlRoom {...data} /> : <StoryShell {...data} />}
      </main>
    </div>
  );
}

function StoryShell(props) {
  const { session, authError, plantError } = props;
  return (
    <>
      <div className="story-bar">
        <span className="product">Two-Person Rule</span>
        <span className="muted">
          {AUTH_MODE === "rehearsal"
            ? "Rehearsal: sign-ins come from a stand-in realm on this machine, not TideCloak."
            : session
              ? `Signed in with TideCloak as ${session.username}${session.isOperator ? ", plant operator" : ""}`
              : "Built with TideCloak"}
        </span>
        {AUTH_MODE === "tide" && session === null && (
          <button className="btn" onClick={() => auth.login()}>
            Sign in with TideCloak
          </button>
        )}
      </div>
      {plantError && <p className="error-line">{plantError} Start it with `npm run demo`.</p>}
      {authError && <p className="error-line">{authError}</p>}
      <Story {...props} />
    </>
  );
}

function Rail({ view, session }) {
  return (
    <nav className="rail" aria-label="Two-Person Rule">
      <svg className="mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-label="Two-Person Rule">
        <title>Two-Person Rule</title>
        <circle cx="10" cy="9" r="5" />
        <path d="M10 14v14M10 22h4M10 26h3" />
        <circle cx="22" cy="9" r="5" />
        <path d="M22 14v14M22 22h-4M22 26h-3" />
      </svg>
      <a className="rail-item" href={VIEWS.story} aria-current={view === "story" ? "page" : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M8 10h8M8 14h8M8 18h5" />
        </svg>
        <span className="tip">The story</span>
      </a>
      <a className="rail-item" href={VIEWS.room} aria-current={view === "room" ? "page" : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 12a9 9 0 1 1 18 0" />
          <path d="M12 12l4.5-4.5" />
          <path d="M3 17h18" />
        </svg>
        <span className="tip">Control room</span>
      </a>
      <div className="bottom">
        {AUTH_MODE === "tide" && TIDECLOAK_URL && (
          <a className="rail-item" href={`${TIDECLOAK_URL}/tide-console/`} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="tip">TideCloak approvals</span>
          </a>
        )}
        {AUTH_MODE === "tide" && session && (
          <button className="rail-item" onClick={auth.logout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            </svg>
            <span className="tip">Sign out</span>
          </button>
        )}
      </div>
    </nav>
  );
}
