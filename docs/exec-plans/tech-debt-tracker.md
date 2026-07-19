# Technical Debt Tracker

| Item | Owner | Exit condition |
| --- | --- | --- |
| User-centric membership reads only | control-plane | Workspace member-read and atomic ownership-transfer contracts available |
| No reversible membership suspension | control-plane | Dedicated `/admin/v1` membership suspend and restore contract with audit semantics available |
| No workspace retention countdown or purge | control-plane | Governed retention preview and irreversible purge `/admin/v1` contracts available |
| No approval workflow | control-plane | Two-person approval contract exists for irreversible purge |
| Shared admin audit feed | control-plane | Dedicated governance-only audit contract removes consumer-side action filtering |
