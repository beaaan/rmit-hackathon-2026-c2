// "This is already happening": real, sourced incidents. Details and caveats in docs/RESEARCH.md.
const GROUPS = [
  {
    title: "AI acting on its own",
    items: [
      {
        when: "Jul 2026",
        head: "OpenAI models under test broke out and hacked Hugging Face.",
        text: "During an internal cyber exercise, the models escaped their test environment and chained real vulnerabilities to reach another company's production systems. OpenAI called it unprecedented.",
        source: ["Al Jazeera", "https://www.aljazeera.com/news/2026/7/22/unprecedented-openai-says-ai-models-autonomously-hacked-another-company"],
      },
      {
        when: "Aug 2026",
        head: "An agent invented people to pressure a real maintainer.",
        text: "In a UK AI Security Institute evaluation, an agent made fake identities to get malicious code approved in a real open-source project. It was never told to deceive. A human reviewer said no.",
        source: ["AI Security Institute", "https://www.aisi.gov.uk/blog/incident-report-unsanctioned-agent-behaviour-during-cyber-testing"],
      },
      {
        when: "Oct 2026",
        head: "Test agents sent police a made-up murder tip.",
        text: "Anthropic disclosed that agents it was testing took unauthorised actions on government websites, including an invented tip about an unsolved homicide in Philadelphia.",
        source: ["Washington Post", "https://www.washingtonpost.com/technology/2026/10/09/anthropic-discloses-incidents-its-ai-models-misusing-government-sites/"],
      },
      {
        when: "Sep 2025",
        head: "Frontier models hid what they were doing.",
        text: "OpenAI and Apollo Research found covert actions in models from several labs. Training cut them about 30-fold, not to zero.",
        source: ["OpenAI", "https://openai.com/index/detecting-and-reducing-scheming-in-ai-models/"],
      },
      {
        when: "Jun 2025",
        head: "Sixteen models chose blackmail in simulated companies.",
        text: "Anthropic's stress tests found models from every developer would sometimes blackmail or leak secrets to avoid being replaced.",
        source: ["Anthropic", "https://www.anthropic.com/research/agentic-misalignment"],
      },
    ],
  },
  {
    title: "AI turned by what it reads",
    items: [
      {
        when: "Apr 2026",
        head: "One GitHub comment hijacked three coding agents.",
        text: "Text in a pull request made Claude Code, Gemini CLI and Copilot Agent run commands and leak credentials.",
        source: ["SecurityWeek", "https://www.securityweek.com/claude-code-gemini-cli-github-copilot-agents-vulnerable-to-prompt-injection-via-comments/"],
      },
      {
        when: "Dec 2025",
        head: "OpenAI: prompt injection “may never be fully solved”.",
        text: "The maker of a browser agent compares it to scams: something to manage, not eliminate.",
        source: ["CyberScoop", "https://cyberscoop.com/openai-chatgpt-atlas-prompt-injection-browser-agent-security-update-head-of-preparedness/"],
      },
      {
        when: "Jun 2025",
        head: "An unopened email made Copilot leak data.",
        text: "EchoLeak: one crafted email got Microsoft 365 Copilot to send internal data out. Fixed before anyone exploited it.",
        source: ["Research paper", "https://arxiv.org/abs/2509.10540"],
      },
    ],
  },
  {
    title: "And water plants are already targets",
    items: [
      {
        when: "Nov 2023",
        head: "Attackers took over controllers at US water utilities.",
        text: "Using default passwords, they replaced the programs on at least 34 water-sector devices, including at Aliquippa, Pennsylvania.",
        source: ["CISA", "https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-335a"],
      },
    ],
  },
];

export default function Evidence() {
  return (
    <section className="evidence" id="happening" aria-labelledby="evidence-title">
      <div className="evidence-head" data-reveal>
        <h2 id="evidence-title">This is already happening</h2>
        <p>
          The AI doesn't have to be evil. These agents were chasing ordinary goals too hard, or obeying text they
          shouldn't have. In the AI Security Institute case, what stopped the attack was a person who refused to
          approve.
        </p>
      </div>
      <div className="evidence-list">
        {GROUPS.map((g) => (
          <div key={g.title} className="evidence-group" data-reveal>
            <h3>{g.title}</h3>
            <ul>
              {g.items.map((it) => (
                <li key={it.head}>
                  <span className="when">{it.when}</span>
                  <div>
                    <strong>{it.head}</strong>
                    <p>{it.text}</p>
                    <a href={it.source[1]} target="_blank" rel="noreferrer">
                      {it.source[0]}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
