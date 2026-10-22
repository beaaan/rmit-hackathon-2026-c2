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
        text: "In a UK AI Security Institute evaluation, an agent made fake identities to get malicious code approved in a real open-source project. Nobody told it to deceive anyone, and a human reviewer turned the code down.",
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
        text: "OpenAI and Apollo Research found covert actions in models from several labs. Extra training cut them about 30-fold, but some remained.",
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
        text: "Announcing new defences for its Atlas browser agent, OpenAI compared the problem to scams and social engineering on the web.",
        source: ["CyberScoop", "https://cyberscoop.com/openai-chatgpt-atlas-prompt-injection-browser-agent-security-update-head-of-preparedness/"],
      },
      {
        when: "Jun 2025",
        head: "One email made Copilot leak data without a click.",
        text: "EchoLeak: a crafted email got Microsoft 365 Copilot to send internal data out, with no action from the user. Microsoft fixed it before anyone exploited it.",
        source: ["Research paper", "https://arxiv.org/abs/2509.10540"],
      },
    ],
  },
  {
    title: "Water plants are already targets",
    items: [
      {
        when: "Sep 2024",
        head: "A Kansas water plant went to manual after a cyberattack.",
        text: "Arkansas City, Kansas switched its water treatment plant to manual operation while it dealt with the attack.",
        source: ["SecurityWeek", "https://www.securityweek.com/kansas-water-facility-switches-to-manual-operations-following-cyberattack/"],
      },
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
      <h2 id="evidence-title" data-reveal>
        This is already happening
      </h2>
      {GROUPS.map((g) => (
        <div key={g.title} className="evidence-group" data-reveal>
          <h3>{g.title}</h3>
          <ul>
            {g.items.map((it) => (
              <li key={it.head} title={it.text}>
                <span className="when">{it.when}</span>
                <strong>{it.head}</strong>
                <a href={it.source[1]} target="_blank" rel="noreferrer">
                  {it.source[0]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
