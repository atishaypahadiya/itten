# Part of a set: README section

Each project in the set carries this section near the top of its README. Copy everything below the line as it is. Put your own row first, then the others in the order shown. Change a row's state when that project ships. Link a name only once its repository is public, in the commit that makes it public.

---

## Part of a set

| Name | Role | State |
|---|---|---|
| ITTEN | Design detail: checks the rendered page up close against a system measured from the owner's inspiration. | v0.3 |
| KERCKHOFFS | Security: checks the owner's own code and deployments, never third-party sites. | In development |
| ERLANG | Load and resilience: tests the owner's own services, never third-party or production systems without the owner's say-so. | In development |

Each one stands alone, and all of them write the same formats: findings in finding/1, defined in `schema/finding.schema.json`, inside reports in report/1, defined in `schema/report.schema.json`.

Where two of them conflict, security floors come first, then accessibility floors, then craft.
