# Creator OS — external open-source integration register

**Status: awaiting the owner's original project plan.** The exact GitHub repositories chosen in the earlier discussion are **not currently available**. No unverified repository is listed as selected or integrated.

## Rules for source selection

Record one entry for each repo that is explicitly in the recovered plan or subsequently approved. Distinguish historical choice from a new recommendation.

For each entry include:

| Field | Required information |
| --- | --- |
| Component/module | Creator OS functionality it supplies |
| Upstream repo | Exact verified GitHub URL and canonical owner |
| Status | Historical selection / candidate / approved / integrating / integrated / rejected / replaced |
| Version | Tag and pin SHA used for reproducibility |
| License | SPDX identifier, redistribution duties, patent/codec/weight considerations |
| Upstream health | Activity, maintainers, releases, issue trends and security policy, checked date |
| Technical fit | Tauri 2 / Rust / React / Python / local-first / OS compatibility |
| Integration | Adapter boundary, data formats, build strategy, source attribution and rollback |
| Alternatives | Existing Creator OS functionality and other evaluated repos |
| Risks & decision | Security, privacy, performance, bundle size, cost, maintenance, acceptance and ADR/issue |

## Entries

**None confirmed yet. Await the original plan from the owner.**

Preliminary **new and unapproved** third-party candidates are researched separately in [OPEN_SOURCE_CANDIDATE_RESEARCH.md](OPEN_SOURCE_CANDIDATE_RESEARCH.md). These must never be represented as the historical selection, an approved dependency, or an integration already present in the app.

Do not confuse frameworks or infrastructure already present in Creator OS (Tauri, React, FFmpeg, optional faster-whisper) with an owner-approved list of **GitHub repositories to integrate**. A dependency inventory is not the same as an agreed upstream integration plan.

## Procedure

1. Capture the source plan and exact URLs.
2. Verify licenses/upstream state before installing or copying code.
3. Assess integration over replacement; do not erase existing work.
4. Record implementation decisions, CI evidence and approved version pins.
5. Update this register and the master context in the same PR as a new integration.
