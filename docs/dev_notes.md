# Dev Notes

## 2026-05-01

- `broker_clients` remains the CRM layer for processed leads and deals
- the unified CSV company base is imported into `broker_company_directory`, not into `broker_clients`
- this keeps campaign target generation separate from actual broker CRM records
- UI now reads from an aggregated company registry layer so a single company card can show master-directory emails, CRM presence, deal count, and outreach history together
