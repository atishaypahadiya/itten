# Telemetry test repositories

Each folder stands for one public repository, for `scripts/telemetry.js --from fixtures/telemetry`. `scripts/check.js` runs it and expects CRF-16 to be flagged and nothing else.

| Folder | ITTEN in `.gitmodules` | Overrides | Counts |
|---|---|---|---|
| alpha | yes, https URL | CRF-16, LAY-10 | yes |
| beta | yes, ssh URL, beside another submodule | CRF-16, TYP-05 | yes |
| gamma | yes, URL without `.git` | CRF-16, LAY-10 | yes |
| delta | yes | CRF-16, but the file does not validate | no: listed as invalid |
| epsilon | no: `itten-notes` is another repository | LAY-10 | no: never read |
| zeta | yes | no file | no overrides |
| eta | no `.gitmodules` | none | no |

CRF-16 is overridden in three valid projects, so it is flagged. LAY-10 is in two that count; it would reach three if epsilon's file were read, so it shows that the script reads overrides only where ITTEN is a submodule. delta's CRF-16 would make four if invalid files were counted.
