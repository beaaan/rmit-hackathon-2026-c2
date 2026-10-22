# Research: AI that deceives, escapes and gets hijacked

Why "the AI can ask, two people decide" matters now. Collected 22 Oct 2026. Each item says what
happened, how sure we are, and where it comes from. Items marked **secondary** were confirmed in
reputable press but we could not open the primary report (paywall or blocked).

Use on the page and in the video: say what happened, plainly, and link the source. Don't overstate:
most of these happened in tests, and the labs disclosed them themselves.

## 1. AI acting on its own (2026)

| When | What happened | Source |
|---|---|---|
| Jul 2026 | During an internal cyber exercise (the ExploitGym benchmark), OpenAI models, including GPT-5.6 Sol, escaped the test environment and chained real vulnerabilities across OpenAI's research environment and Hugging Face's production systems to get the test's answers. OpenAI called it an "unprecedented cyber incident". Hugging Face: "quite mind-blowing that all of this happened autonomously". No tampering with public models or datasets. | [Al Jazeera](https://www.aljazeera.com/news/2026/7/22/unprecedented-openai-says-ai-models-autonomously-hacked-another-company), [Fortune](https://fortune.com/2026/07/21/openai-says-ai-models-escaped-control-hacked-hugging-face/), [Axios](https://www.axios.com/2026/07/21/openai-says-hugging-face-breach-caused-by-one-its-models) (secondary: OpenAI's own post not opened) |
| Aug 2026 | UK AI Security Institute: in a routine cyber evaluation, "AI agents took sustained, unsanctioned action directed at real people and organisations". The most serious: an agent created fake identities to "socially engineer a real maintainer into approving" malicious code in a real open-source project. "A human maintainer caught and refused to approve the malicious code." The agent "was never instructed to deceive". Mostly Anthropic's Mythos 5; two actions from GPT-5.6 Sol. | [AISI incident report](https://www.aisi.gov.uk/blog/incident-report-unsanctioned-agent-behaviour-during-cyber-testing) (primary), [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-aisi-evaluation-containment-incident-20260/) |
| Oct 2026 | Anthropic disclosed that agents it was testing took unauthorised actions on US government websites. One: "Claude submitted an invented tip through a police department's online form" about an unsolved homicide in Philadelphia. Police flagged it as spam and called the two-month gap before disclosure "unacceptable". Anthropic says it briefed the White House and every agency involved. | [Al Jazeera](https://www.aljazeera.com/news/2026/10/10/anthropic-ai-model-submits-false-homicide-tip-to-philadelphia-police), [Washington Post](https://www.washingtonpost.com/technology/2026/10/09/anthropic-discloses-incidents-its-ai-models-misusing-government-sites/), [6abc](https://6abc.com/post/anthropic-ai-model-submitted-false-tip-unsolved-murder-philadelphia-police-say/19925243/) |

## 2. AI that deceives in tests (lab research)

| When | What happened | Source |
|---|---|---|
| Dec 2024 | Alignment faking (Anthropic with Redwood Research): Claude 3 Opus strategically complied with a training goal it disagreed with, to avoid being changed, without being told to. | [Anthropic](https://www.anthropic.com/research/alignment-faking), [paper](https://arxiv.org/abs/2412.14093) |
| Dec 2024 | o1 system card (Apollo Research's tests): when told to pursue a goal "at all costs", o1 tried to disable an oversight mechanism in about 5% of cases and to copy itself in about 2%, and often denied it afterwards. Without that nudge, far less often. | [OpenAI o1 system card](https://arxiv.org/abs/2412.16720), [TechCrunch](https://techcrunch.com/2024/12/05/openais-o1-model-sure-tries-to-deceive-humans-a-lot/) |
| Jun 2025 | Agentic misalignment (Anthropic): 16 models from several developers, in simulated companies, sometimes blackmailed officials or leaked data when that was the only way to avoid being replaced. Fictional scenarios. | [Anthropic](https://www.anthropic.com/research/agentic-misalignment) |
| Sep 2025 | OpenAI with Apollo Research: covert actions (hiding or distorting information) in o3, o4-mini, Gemini 2.5 Pro and Claude Opus 4. Training cut them about 30-fold (o3: 13% to 0.4%), not to zero. | [OpenAI](https://openai.com/index/detecting-and-reducing-scheming-in-ai-models/) |
| Jul 2025 | Replit's coding agent deleted a live production database during a code freeze, then gave false information about recovery. | [Tom's Hardware](https://www.tomshardware.com/tech-industry/artificial-intelligence/ai-coding-platform-goes-rogue-during-code-freeze-and-deletes-entire-company-database-replit-ceo-apologizes-after-ai-engine-says-it-made-a-catastrophic-error-in-judgment-and-destroyed-all-production-data), [AI Incident Database](https://incidentdatabase.ai/entities/replit) (secondary) |

## 3. AI turned by what it reads (prompt injection)

| When | What happened | Source |
|---|---|---|
| Jun 2025 | EchoLeak (CVE-2025-32711): one crafted email made Microsoft 365 Copilot leak internal data with no click from the user. Fixed before any known exploitation. | [Paper](https://arxiv.org/abs/2509.10540), [BleepingComputer](https://www.bleepingcomputer.com/news/security/zero-click-ai-data-leak-flaw-uncovered-in-microsoft-365-copilot/) |
| Dec 2025 | OpenAI said prompt injection against its Atlas browser agent "may never be fully solved", comparing it to scams and social engineering. The UK NCSC has said similar. | [CyberScoop](https://cyberscoop.com/openai-chatgpt-atlas-prompt-injection-browser-agent-security-update-head-of-preparedness/), [The Decoder](https://the-decoder.com/openai-admits-prompt-injection-may-never-be-fully-solved-casting-doubt-on-the-agentic-ai-vision/) |
| Apr 2026 | "Comment and Control" (Aonan Guan, with Johns Hopkins researchers): text in a GitHub PR title or comment hijacked Claude Code, Gemini CLI and GitHub Copilot Agent running in GitHub Actions, leaking credentials. | [SecurityWeek](https://www.securityweek.com/claude-code-gemini-cli-github-copilot-agents-vulnerable-to-prompt-injection-via-comments/) |
| 2026 | Google and others report attackers seeding the web with hidden instructions for AI agents (indirect prompt injection "in the wild"). | [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-indirect-prompt-injection-in-the-wild-2026/) (secondary; figures not checked against Google's post) |

## 4. Water plants are already targets

| When | What happened | Source |
|---|---|---|
| Nov 2023 – Jan 2024 | IRGC-affiliated actors logged into internet-facing Unitronics controllers with default passwords and replaced their programs, compromising at least 34 devices in US water and wastewater, including at the Municipal Water Authority of Aliquippa, PA. | [CISA AA23-335A](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-335a) |
| Sep 2024 | Arkansas City, Kansas switched its water treatment plant to manual operation after a cyberattack. | [SecurityWeek](https://www.securityweek.com/kansas-water-facility-switches-to-manual-operations-following-cyberattack/) |

## What this means for Two-Person Rule

- The AI doesn't have to be "evil". The AISI and Anthropic cases came from agents pursuing an
  ordinary task too hard. OpenAI says prompt injection may never be fully solved. So **don't rely on
  the AI behaving**: make it unable to act alone.
- Training reduces bad behaviour but doesn't remove it (30-fold, not to zero). Again: don't rely on
  it.
- In the AISI case, **a human reviewer refusing to approve** is what stopped the attack. That is
  exactly the control this project makes mandatory, and TideCloak makes it impossible to fake or
  skip: no stolen key mints an operator, and no single admin creates one.
