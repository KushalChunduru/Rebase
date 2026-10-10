# Research Brief: Hackwave 3.0 — PS3: The Internet After the API

## Executive Summary

This research investigates the five failure categories identified in the challenge: altered defaults, error response changes, pagination changes, rate limit changes, and semantic data drift. The core finding is that **detection tooling is maturing rapidly, but automatic repair remains almost entirely unsolved**. The strongest hackathon opportunity lies in the gap between detection and adaptation — specifically, building a system that combines behavioral baseline monitoring (not just schema diffing) with LLM-powered impact analysis and adapter generation.

---

## Category A: Altered Defaults and Implicit Behaviour

### Do these problems exist in the real world?

**Yes, extensively documented.**

- **Personio Absence API (2024):** Introduced pagination defaults on a previously-unpaginated endpoint. Clients that expected all results suddenly received only the first page. Personio had to reverse the change — results are now paginated only when the caller sends `limit` and `offset` parameters.
- **Google AIP-158 guidance** explicitly warns: "If the API later adds pagination fields, and sets the default to 50, then that user's code breaks; it was getting all resources, and now is only getting the first 50." Google considers this a known breaking-change pattern.
- **Stripe's `invoice.payment_intent` removal:** On a newer API version, the `payment_intent`, `charge`, and `paid` fields were removed from invoice objects. A developer reported: "My code got a 404 and the workflow stopped silently, with no retry, no email for that customer."
- **Twitter/X API v1.1 (2012):** Added mandatory authentication for all endpoints — a default behavior change that broke every unauthenticated integration.

### What existing tools solve

| Tool | What it detects |
|------|----------------|
| oasdiff | Field removals, type changes, added required fields — 755 distinct change types across OpenAPI specs |
| pb33f/openapi-changes | Same category, supports OpenAPI 3.0–3.2, git history walking |
| Wardrift (Rust, open-source) | Schema drift from live traffic — no spec required. Flags missing/added fields and type changes |
| API Sentinel (Python) | Real-time OpenAPI drift detection as ASGI middleware |

### Verified limitations

- **All spec-diffing tools require the provider to publish and update their spec.** Third-party APIs often don't.
- **Default value changes are invisible to schema diffs.** If a field goes from `null` to `false` as default, the schema hasn't changed.
- **Behavioral changes (timing, ordering, implicit constraints) are outside schema scope.** The 2026 systematic literature review on breaking changes confirms: "These tools miss behavioral changes."
- **No tool automatically repairs or adapts consumer code.** Every tool stops at detection/reporting.

### Gap assessment

**Detect:** Partially solved (structural only). **Explain:** Unsolved for behavioral changes. **Repair:** Unsolved. **Validate:** Unsolved.

---

## Category B: Different Error Responses and Error-Recovery Behaviour

### Do these problems exist in the real world?

**Yes, but public postmortems are scarce.**

- **Cloudflare Tiered Cache incident:** A server-side change caused some requests to return status 530, an undocumented code. Impact lasted ~6 hours.
- **Practitioner anecdotes:** One developer reported that renaming `user_name` to `username` in error responses broke a client's field-by-field parser.
- **Stripe's compatibility guidance** explicitly lists as non-breaking: "changing the length or format of opaque strings, such as object IDs, error messages, and other human-readable strings." This implicitly acknowledges that clients do parse error messages, even though they shouldn't.
- **Enum drift** is flagged as a real category: "New enum values appear that are not defined in the specification. Status code drift: new status codes (e.g., 429, 500) are returned but not documented."

### What existing tools solve

- **oasdiff** can detect status code additions/removals and response schema changes in OpenAPI diffs.
- **Pact** can verify that error responses match consumer expectations — but only for providers that run Pact verification.
- **API Sentinel** and **Wardrift** can detect when live responses include unexpected fields or status codes.

### Verified limitations

- **Pact cannot test third-party APIs.** Pact's own FAQ: "Pact may not be the best tool for public testing APIs." The provider must cooperate.
- **Status code semantics are invisible to schema tools.** A provider changing a 200 to a 201, or a 400 to a 422, has the same schema but different client behavior.
- **Error body structure changes** (e.g., moving from `{error: "msg"}` to `{errors: [{code: "X", message: "msg"}]}`) break client parsers but are only caught if someone encoded the exact shape expectation.
- **No tool maps error changes to downstream impact.** Which retry logic, which fallback path, which user-facing message depends on which error code?
- **No tool proposes error-handling adaptations.** The gap between "this error format changed" and "here's how to update your catch block" is entirely manual.

### Gap assessment

**Detect:** Partially solved (structural changes to error responses). **Explain:** Unsolved (which code paths are affected). **Repair:** Unsolved. **Validate:** Unsolved.

---

## Category C: Changed Pagination and Data-Retrieval Behaviour

### Do these problems exist in the real world?

**Yes, well-documented across major providers.**

- **Personio** (see Category A) — pagination introduced as a default.
- **Shopify API 2019-07:** Deprecated the `page` parameter on some endpoints, requiring migration to cursor-based pagination via Link headers. Broke the ShopifySharp library.
- **Google AIP-158:** Documents the exact breaking-change mechanism: auto-paginating client libraries face a separate break when pagination is added to a previously-unpaginated method.
- **UptimeKit (#194):** An empty `?limit=` was coerced to 0, returning correct metadata but zero results — a silent data loss.

### What existing tools solve

- **Spec diffing** catches when pagination parameters are added or removed from the OpenAPI spec.
- **Contract tests** can verify pagination if the consumer encodes page-size and next-token expectations.

### Verified limitations

- **No tool detects behavioral pagination changes** like: page size reduced from 100 to 25, cursor format changed, ordering changed within pages, or total count became approximate.
- **Auto-pagination libraries mask drift.** If a library auto-pages, a reduced page size causes more requests but the same data — until rate limits kick in.
- **No tool correlates pagination changes with data completeness.** The question "did we get all the records?" requires semantic understanding, not schema validation.
- **Offset→cursor migration requires code changes** that no tool generates automatically.

### Gap assessment

**Detect:** Mostly unsolved for behavioral changes. Structural changes (parameter additions) are partially caught by spec diffing. **Explain:** Unsolved (which data flows lose records?). **Repair:** Unsolved. **Validate:** Unsolved (how do you prove data completeness after adaptation?).

---

## Category D: Rate Limits and Dynamic Availability Constraints

### Do these problems exist in the real world?

**Yes, but the evidence is more diffuse.**

- **Provider header inconsistency is a documented problem.** GitHub's `x-ratelimit-reset` uses Unix epoch timestamps; many clients assume seconds-until-reset. Stripe doesn't document `Retry-After`; its SDKs handle retries internally.
- **IETF standardization is still in draft.** The `RateLimit-Policy` and `RateLimit` header fields are defined in `draft-ietf-httpapi-ratelimit-headers-10` (September 2025), still a Standards Track Internet-Draft. Until this becomes an RFC, providers will continue using incompatible header formats.
- **Unannounced limit changes** are described as a common failure pattern: "rate limits change... You find out when your integration breaks in production."
- **Dynamic/behavior-based rate limiting** is emerging: providers apply different limits based on user behavior, time of day, or endpoint — making static client-side budgeting unreliable.

### What existing tools solve

- **API gateways** (Kong, Envoy, AWS API Gateway) implement rate limiting on the provider side and can expose metrics.
- **Client-side retry libraries** (e.g., Polly for .NET, tenacity for Python) handle 429 responses with exponential backoff.
- **Monitoring dashboards** can alert on 429 rates and latency percentiles.

### Verified limitations

- **No tool detects rate limit policy changes.** If a provider drops your limit from 1000/min to 100/min, existing tools can observe the increased 429 rate but can't distinguish "policy changed" from "traffic increased."
- **No tool adapts request patterns.** Reducing batch sizes, spreading requests, or implementing token-bucket pacing requires manual client code changes.
- **Header format parsing is fragile.** Every provider uses different header names and value formats. The IETF draft isn't finalized, and adoption will be slow.
- **Burst vs. sustained limits** are rarely distinguished. A client may stay under the per-minute limit but exceed a per-second burst limit that wasn't documented.

### Gap assessment

**Detect:** Partially solved (429 monitoring exists). Policy change detection is unsolved. **Explain:** Unsolved (why are we being limited? which endpoints? which consumers?). **Repair:** Partially solved (retry logic exists, but rate adaptation/request scheduling is manual). **Validate:** Unsolved.

---

## Category E: Internal Data Changes and Semantic Drift

### Do these problems exist in the real world?

**Yes, and this is the hardest category.**

- **The challenge's own example** (`name` → `display_name`) is a field rename — structurally detectable. But the harder variant is: `name` still exists but now contains a display name instead of a username.
- **Android API study (2024):** Researchers found APIs where "the signature stays the same across two consecutive versions" but the body behavior changed — same types, different semantics. Their taxonomy includes cases where "the API potentially returns different variable types or values."
- **API drift statistics:** A KushoAI report (cited in a DEV Community analysis) claims 41% of APIs drift within 30 days, with field additions accounting for 86% of drift events. Treat this statistic with caution — it's from a vendor report.
- **LLM tool-use vulnerability:** When an LLM-based agent faces a changed tool schema, it "adapts — generating parameters based on the new schema without understanding the semantic change." A renamed parameter can produce "syntactically valid but semantically wrong requests."
- **Google Data Studio** documents this explicitly: "A Number that represents US Dollars can't be automatically detected as a currency type."

### What existing tools solve

- **Spec diffing** catches structural changes (field additions, removals, type changes).
- **Wardrift** detects shape changes from live traffic without needing a spec.
- **Value-distribution monitoring** (available in data pipeline tools like Great Expectations) can detect statistical drift in field values — but these are designed for data pipelines, not API responses.

### Verified limitations

- **No tool detects semantic drift.** If `price` changes from USD cents to USD dollars, the field is still a number. If `status` adds a new enum value, exhaustive match logic crashes.
- **No tool correlates data changes with business logic.** The question "does this field rename preserve the original meaning?" requires understanding both the data and the consumer's use of it.
- **LLM-based repair is nascent.** The quantum-api-drift benchmark (2026) tested LLM repair of SDK version changes and found repair success rates of 0.19–0.59 across models — highly variable and often below 50%.
- **Automated semantic versioning tools** acknowledge: "semantic meaning [of annotations] cannot be determined automatically, so the tool can't reliably classify these changes."

### Gap assessment

**Detect:** Mostly unsolved for semantic changes. Structural changes are well-covered. **Explain:** Unsolved. **Repair:** Unsolved (LLM repair is early-stage, unreliable). **Validate:** Unsolved.

---

## Gap Matrix

| Failure Category | Existing Approaches | Verified Limitation | Supporting Evidence | Potential Innovation | Feasible Hackathon Demo |
|---|---|---|---|---|---|
| **A: Altered Defaults** | OpenAPI spec diffing (oasdiff), Wardrift live monitoring | Default value changes invisible to schema diffs; behavioral changes undetected | 2026 systematic literature review confirms tools miss behavioral changes; Personio, Google AIP-158 incidents | Behavioral baseline monitoring: record response value distributions over time, alert on statistical shifts even when schema is unchanged | Simulate a service where a default page size is introduced; show the system detecting the change via response distribution shift, mapping affected data flows, and proposing a fix |
| **B: Error Response Changes** | Pact contract testing, spec diffing for status codes | Pact requires provider cooperation (unusable for 3rd-party); status code semantic changes invisible; error body structure changes only caught with exact shape assertions; no impact mapping | Pact FAQ: "may not be the best tool for public testing APIs"; Cloudflare 530 incident; Stripe compatibility docs | Proxy-based error fingerprinting: record error response shapes, status code distributions, and retry-header formats; detect deviations; map to consumer error-handling code paths using static analysis | Simulate an API changing from `{error: "msg"}` to `{errors: [{code, message}]}`; show detection, impact on 3 consumer error handlers, and generated adapter |
| **C: Pagination Changes** | Spec diffing for parameter changes; manual contract tests | No detection of behavioral changes (page size, cursor format, ordering); no data completeness validation; auto-pagination masks some drift until rate limits hit | Personio reversal; Shopify page→cursor migration; Google AIP-158 breaking change documentation; UptimeKit silent data loss | Record pagination fingerprints (page sizes, result counts, cursor formats, ordering consistency); detect behavioral shifts; generate migration adapters for common patterns (offset→cursor, page-size changes) | Simulate an endpoint switching from offset to cursor pagination and reducing page size; show detection, data completeness check, and adapted client code |
| **D: Rate Limit Changes** | 429 monitoring; client retry libraries (Polly, tenacity); provider-side gateways | No policy change detection (can't distinguish "policy changed" from "traffic up"); no automatic rate adaptation; header format fragmentation (IETF draft still not RFC) | GitHub vs Stripe header format differences; IETF draft-ietf-httpapi-ratelimit-headers-10 still in draft (Sep 2025); vendor blogs on unannounced limit changes | Parse and normalize rate-limit headers across providers (handle epoch vs delta, vendor-specific names); detect policy changes by tracking limit/remaining/reset values over time; auto-tune request scheduling | Simulate a provider halving the rate limit; show the system detecting the policy change from header analysis, adjusting request pacing, and alerting on affected batch jobs |
| **E: Semantic Drift** | Spec diffing for structural changes; Wardrift for live schema changes | No detection of value-level semantic changes (same type, different meaning); no business logic correlation; LLM repair success rates 19–59%; automated tools can't determine semantic meaning | Android API compatibility study (2024); quantum-api-drift benchmark (2026); Google Data Studio docs on type inference limits | Value-distribution monitoring on API responses (ranges, enum sets, null rates, string patterns); LLM-powered semantic comparison ("does this field rename preserve meaning?"); golden-request replay with output diffing | Simulate `price` changing from cents to dollars and `name` changing meaning; show distribution-based detection, LLM-powered semantic analysis, and confidence-scored repair proposal with human-in-the-loop |

---

## Cross-Cutting Analysis: Where the Real Gap Is

### What the ecosystem already does well
1. **Structural change detection** is largely solved for APIs with published OpenAPI specs. Tools like oasdiff, pb33f, and Wardrift are mature and open-source.
2. **Retry and backoff** for transient failures is well-understood and widely implemented in client libraries.
3. **Contract testing** works well for internal microservices where both sides cooperate (Pact, Dredd).

### What no existing tool does
1. **Behavioral baseline learning** — recording not just schema but actual response patterns (value distributions, timing, pagination behavior, error patterns) and detecting meaningful deviations.
2. **Dependency mapping** — given a detected change, identifying which parts of the consumer application are affected (which functions, which data flows, which business logic).
3. **Automatic adapter generation** — producing code that maps old behavior to new behavior. The closest work is a 2005 paper on the "Data Concierge" and vendor marketing from MuleSoft. No open-source tool does this.
4. **Validation that repairs preserve business correctness** — running adapted code against known-good test cases to verify the adaptation didn't introduce regressions.
5. **Confidence scoring and human-in-the-loop** — deciding when auto-repair is safe vs. when a human must approve. Self-healing test automation research warns that "mature implementations require auditable change logs, confidence scoring, rollback capability."

### The specific innovation opportunity

The strongest hackathon angle is a **proxy-based behavioral monitor + LLM-powered impact analyzer + adapter generator**:

1. **Proxy layer** sits between the application and external APIs. Records behavioral baselines: response schemas, value distributions, pagination patterns, error shapes, rate-limit headers, timing.
2. **Change detector** compares live behavior to baselines using statistical methods (not just schema diffing). Classifies changes by category (A–E).
3. **Impact analyzer** uses static analysis of the consumer codebase to map detected changes to affected code paths. Answers: "which functions use the changed field? which error handlers match the old status code?"
4. **Adapter generator** uses an LLM to propose code patches or middleware adapters. Crucially, it scores confidence and distinguishes safe auto-repairs (field rename with clear mapping) from uncertain ones (semantic drift requiring human review).
5. **Validation harness** replays golden requests through the adapted code path and verifies outputs match expected behavior.

This pipeline is technically feasible for a hackathon demo because:
- The proxy can be built with standard HTTP middleware (mitmproxy, Express middleware, or a simple reverse proxy).
- Behavioral baselines can be stored as JSON statistics (no ML training needed).
- Change detection can use straightforward statistical tests (value range shifts, new enum values, schema diffs).
- Impact analysis can use grep/AST parsing for a demo codebase.
- LLM adapter generation can use Claude or GPT with the detected change and affected code as context.
- Validation can use a small set of golden test cases.

### What would make this credible vs. toy

- **Don't try to solve all five categories equally.** Structural changes (field renames, type changes) and error format changes are the most feasible to demo. Semantic drift is genuinely hard and a confidence-scored "needs human review" response is more credible than claiming full automation.
- **Show the failure mode.** Demo what happens when the system encounters a change it can't confidently repair — the human-in-the-loop path is as important as the auto-repair path.
- **Use real API patterns.** Simulate changes based on documented incidents (Personio pagination, Stripe field removal, Shopify cursor migration) rather than artificial examples.

---

## Key Sources

### Academic / Research
- [Breaking Changes in Software Ecosystems: A Systematic Literature Review (2026)](https://arxiv.org/html/2605.24397v1)
- [Semantically Incompatible APIs in Android Apps (2024)](https://arxiv.org/pdf/2406.17431)
- [Benchmarking API Drift in LLM-Generated Quantum Code (2026)](https://arxiv.org/html/2607.04072)
- [Roseau: Source-based API Breaking Change Analysis in Java (2025)](https://arxiv.org/pdf/2507.17369)
- [LLM Agents for Automated Dependency Upgrades (2025)](https://arxiv.org/pdf/2510.03480)
- [LLM-based Automated Program Repair: Survey (2025)](https://arxiv.org/pdf/2506.23749)
- [Dynamic Adapter Generation for Data Integration Middleware (2005)](https://dl.acm.org/doi/10.1145/1108473.1108476)
- [Self-Adaptive Microservice-based Systems Survey](https://arxiv.org/pdf/2103.08688)

### Tools & Standards
- [oasdiff — API breaking change detection](https://www.oasdiff.com/)
- [pb33f/openapi-changes](https://github.com/pb33f/openapi-changes)
- [Wardrift — schema-less API drift detector](https://github.com/Matth-computer-scientist/WARDRIFT)
- [api-drift-detector (Python)](https://pypi.org/project/api-drift-detector/0.1.2/)
- [Specmatic MCP Auto-Test](https://specmatic.io/updates/testing-mcp-servers-how-specmatic-mcp-auto-test-catches-schema-drift-and-automates-regression/)
- [IETF RateLimit Headers Draft (v10, Sep 2025)](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-10)
- [Google AIP-158: Pagination](https://google.aip.dev/158)

### Incidents & Case Studies
- [Personio Absence API pagination breaking change](https://developer.personio.de/changelog/absence-api-fixed-breaking-change-introduced-by-pagination-update)
- [Shopify pagination migration (ShopifySharp #380)](https://github.com/nozzlegear/ShopifySharp/issues/380)
- [Twitter/X free API shutdown impact](https://9to5mac.com/2023/04/06/twitter-shuts-down-free-api/)
- [Stripe field removal breaking workflow](https://dev.to/karan_palukuri/stripe-removed-invoicepaymentintent-in-the-basil-api-and-it-quietly-broke-my-failed-payment-2aa8)
- [Stripe API versioning analysis](https://myappapi.com/blog/postmortems/stripe-api-versioning)
- [API drift statistics (41% within 30 days)](https://dev.to/flarecanary/41-of-apis-drift-within-30-days-what-the-data-says-about-api-reliability-bhi)

### Practitioner Guidance
- [Pact FAQ on third-party API limitations](https://docs.pact.io/faq)
- [API Schema Drift Detection Tools Compared (2026)](https://dev.to/flarecanary/api-schema-drift-detection-tools-compared-2026-1ib4)
- [Breaking changes in JSON APIs](https://blog.sbensu.com/posts/api-breaking-changes/)
- [Consumer-Driven Contract Testing for Breaking Changes](https://oneuptime.com/blog/post/2026-08-24-consumer-driven-contract-breaking-changes/view)
- [Optic discontinued (Jan 2026)](https://dev.to/flarecanary/optic-is-dead-what-now-for-api-drift-detection-2kb8)
