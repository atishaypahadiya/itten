# Part of a set: README section

Each project in the set carries this section near the top of its README. Copy everything below the line as it is. Put your own row first, then the others in the order shown. Change a row's state when that project ships.

---

## Part of a set

| Name | Checks | State |
|---|---|---|
| ITTEN | Design detail | v0.3 |
| KERCKHOFFS | Security | Planned |
| ERLANG | Load and resilience | Planned |

Each one stands alone, and all of them write the same formats: findings in finding/1, defined in `schema/finding.schema.json`, inside reports in report/1, defined in `schema/report.schema.json`.

Where two of them conflict, security floors come first, then accessibility floors, then craft.
