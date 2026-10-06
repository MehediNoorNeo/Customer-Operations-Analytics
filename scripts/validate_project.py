"""Validate cleaned customer-operations data and print reconciled KPIs."""

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "processed"


def main() -> None:
    customers = pd.read_csv(DATA / "customers_clean.csv", parse_dates=["signup_date"])
    campaigns = pd.read_csv(DATA / "campaigns_clean.csv", parse_dates=["campaign_date"])
    responses = pd.read_csv(DATA / "responses_clean.csv", parse_dates=["response_date"])
    tickets = pd.read_csv(
        DATA / "support_tickets_clean.csv",
        parse_dates=["created_date", "resolution_date"],
    )
    transactions = pd.read_csv(
        DATA / "transactions_clean.csv", parse_dates=["transaction_date"]
    )

    signup = customers.set_index("customer_id")["signup_date"]
    campaign_start = campaigns.set_index("campaign_id")["campaign_date"]

    checks = {
        "unique customer IDs": customers["customer_id"].is_unique,
        "unique campaign IDs": campaigns["campaign_id"].is_unique,
        "unique response IDs": responses["response_id"].is_unique,
        "unique ticket IDs": tickets["ticket_id"].is_unique,
        "unique transaction IDs": transactions["transaction_id"].is_unique,
        "response customer keys": responses["customer_id"].isin(customers["customer_id"]).all(),
        "response campaign keys": responses["campaign_id"].isin(campaigns["campaign_id"]).all(),
        "ticket customer keys": tickets["customer_id"].isin(customers["customer_id"]).all(),
        "transaction customer keys": transactions["customer_id"].isin(customers["customer_id"]).all(),
        "positive campaign budgets": campaigns["budget"].gt(0).all(),
        "binary conversion values": responses["converted"].isin([0, 1]).all(),
        "positive transaction amounts": transactions["amount"].gt(0).all(),
        "valid CSAT values": tickets["satisfaction_score"].dropna().between(1, 5).all(),
        "resolutions after ticket creation": (
            tickets["resolution_date"].isna()
            | tickets["resolution_date"].ge(tickets["created_date"])
        ).all(),
        "responses after signup": responses["response_date"].ge(responses["customer_id"].map(signup)).all(),
        "responses after campaign date": responses["response_date"].ge(responses["campaign_id"].map(campaign_start)).all(),
        "tickets after signup": tickets["created_date"].ge(tickets["customer_id"].map(signup)).all(),
        "transactions after signup": transactions["transaction_date"].ge(transactions["customer_id"].map(signup)).all(),
    }

    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise AssertionError("Validation failed: " + ", ".join(failed))

    resolved = tickets.dropna(subset=["resolution_date"]).copy()
    resolved["resolution_hours"] = (
        resolved["resolution_date"] - resolved["created_date"]
    ).dt.total_seconds() / 3600

    kpis = pd.Series(
        {
            "Customers": len(customers),
            "Campaigns": len(campaigns),
            "Responses": len(responses),
            "Response conversion rate": responses["converted"].mean(),
            "Transaction value (BDT)": transactions["amount"].sum(),
            "Average transaction value (BDT)": transactions["amount"].mean(),
            "Tickets": len(tickets),
            "Ticket resolution rate": tickets["resolution_date"].notna().mean(),
            "Average resolution hours": resolved["resolution_hours"].mean(),
            "Average CSAT": tickets["satisfaction_score"].mean(),
        },
        name="Value",
    )

    print(f"All {len(checks)} validation checks passed.\n")
    print(kpis.to_string())


if __name__ == "__main__":
    main()
