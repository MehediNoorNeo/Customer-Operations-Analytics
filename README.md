# Customer Operations Analytics & Workflow Automation

An end-to-end analytics project that prepares customer, campaign, response, support-ticket, and transaction records for operational reporting. It demonstrates a repeatable workflow from raw CSV extracts through quality controls, clean data, KPI analysis, and reporting-ready outputs.

## What this project delivers

- Quality assessment that profiles missing data, duplicate rows, inconsistent values, invalid dates, and broken relationships.
- Reproducible cleaning rules that standardize categories, validate keys, remove duplicates, and preserve only analysis-ready records.
- Temporal validation that excludes responses, tickets, and transactions recorded before their related signup or campaign dates.
- Exploratory analysis with commercial, campaign, customer, and support-service KPIs.
- MySQL table definitions and reusable KPI queries for database-backed reporting.
- An Excel KPI workbook suitable for review or import into Google Sheets. The cleaned CSV outputs are also ready for Looker Studio.

## Workflow

```text
Raw CSV extracts
    -> 01_data_quality.ipynb
    -> 02_data_cleaning.ipynb
    -> data/processed/*.csv
    -> 03_eda_and_kpis.ipynb / SQL / Excel / Looker Studio
```

## Project structure

```text
data/raw/              Source extracts
data/processed/        Validated, analysis-ready CSVs
notebooks/             Quality, cleaning, and KPI analysis notebooks
sql/                   MySQL schema and reporting queries
reports/               Excel KPI deliverable
scripts/               Pipeline runner and automated validation checks
```

## Run the Python workflow

Install the dependencies and run the notebooks in order from the `notebooks/` folder.

```bash
python -m pip install -r requirements.txt
jupyter notebook
```

1. `01_data_quality.ipynb` documents raw-data issues.
2. `02_data_cleaning.ipynb` creates the cleaned CSVs in `data/processed/`.
3. `03_eda_and_kpis.ipynb` calculates the KPIs and renders charts.

For a repeatable command-line run, execute:

```bash
python scripts/run_pipeline.py
```

This executes all notebooks in sequence and then runs the project validation checks. To validate existing processed outputs without rerunning the notebooks:

```bash
python scripts/validate_project.py
```

The quality outputs are separated by purpose: `raw_quality_report.csv` summarizes source quality, `clean_quality_report.csv` reconciles raw and cleaned row counts, and `temporal_exclusion_report.csv` records chronology-based exclusions.

The finished reporting artifact is `reports/customer_operations_kpi_dashboard.xlsx`. Its Dashboard sheet contains the executive scorecard, complete-month transaction trend, channel response and conversion volumes, and support-category performance. The Data sheet records source row counts and KPI definitions for handoff.

## KPI definitions

| KPI | Definition |
| --- | --- |
| Response conversion rate | Converted responses / all valid responses |
| Transaction value | Sum of valid positive transaction amounts; this is not net revenue because refunds are not linked to refund amounts |
| Average transaction value | Transaction value / valid transactions |
| Ticket resolution rate | Tickets with a resolution timestamp / all tickets |
| Average resolution time | Mean time from ticket creation to resolution for resolved tickets only |
| Average CSAT | Mean valid satisfaction score; missing scores are excluded |

## MySQL and dashboard use

Run `sql/01_create_schema.sql`, load the clean CSV exports into the matching tables, then use `sql/02_kpi_queries.sql` for the dashboard views. In Looker Studio or Google Sheets, connect the cleaned CSVs or database tables and use the same KPI definitions above.

## Data limitations

- The files are a fixed analytical sample, not a live production extract. Operational dates extend through October 2026, with some ticket resolutions in November 2026.
- October 2026 is incomplete in the transaction extract and is excluded from the complete-month trend chart.
- No campaign identifier exists on transactions, so campaign-attributed revenue and marketing ROI cannot be calculated.
- Refund records do not include linked refund amounts, so transaction value is not net revenue.
- Missing resolution dates are treated as unresolved or unavailable; they are excluded from average resolution-time calculations.
