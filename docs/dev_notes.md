# Dev Notes

## 2026-05-01

- `broker_clients` remains the CRM layer for processed leads and deals
- the unified CSV company base is imported into `broker_company_directory`, not into `broker_clients`
- this keeps campaign target generation separate from actual broker CRM records
