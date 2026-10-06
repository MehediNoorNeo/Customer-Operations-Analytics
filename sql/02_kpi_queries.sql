USE customer_operations_analytics;

-- Executive KPI scorecard
SELECT
    (SELECT COUNT(*) FROM customers) AS customers,
    (SELECT COUNT(*) FROM campaigns) AS campaigns,
    (SELECT COUNT(*) FROM responses) AS responses,
    (SELECT AVG(converted) FROM responses) AS response_conversion_rate,
    (SELECT SUM(amount) FROM transactions) AS transaction_value,
    (SELECT AVG(amount) FROM transactions) AS average_transaction_value,
    (SELECT COUNT(*) FROM support_tickets) AS tickets,
    (SELECT AVG(resolution_date IS NOT NULL) FROM support_tickets) AS ticket_resolution_rate,
    (SELECT AVG(TIMESTAMPDIFF(HOUR, created_date, resolution_date))
       FROM support_tickets
      WHERE resolution_date IS NOT NULL) AS average_resolution_hours,
    (SELECT AVG(satisfaction_score) FROM support_tickets) AS average_csat;

-- Monthly transaction value and volume
SELECT
    DATE_FORMAT(transaction_date, '%Y-%m-01') AS month_start,
    COUNT(*) AS transactions,
    SUM(amount) AS transaction_value,
    AVG(amount) AS average_transaction_value
FROM transactions
GROUP BY DATE_FORMAT(transaction_date, '%Y-%m-01')
ORDER BY month_start;

-- Campaign and channel performance.
-- Budget is aggregated before joining responses, preventing a campaign's budget
-- from being repeated once for every response.
WITH campaign_budget AS (
    SELECT
        channel,
        COUNT(*) AS campaigns,
        SUM(budget) AS total_budget
    FROM campaigns
    GROUP BY channel
),
response_per_channel AS (
    SELECT
        c.channel,
        COUNT(r.response_id) AS responses,
        COALESCE(SUM(r.converted), 0) AS conversions
    FROM campaigns c
    LEFT JOIN responses r ON r.campaign_id = c.campaign_id
    GROUP BY c.channel
)
SELECT
    b.channel,
    b.campaigns,
    r.responses,
    r.conversions,
    r.conversions / NULLIF(r.responses, 0) AS response_conversion_rate,
    b.total_budget,
    b.total_budget / NULLIF(r.responses, 0) AS cost_per_response
FROM campaign_budget b
JOIN response_per_channel r ON r.channel = b.channel
ORDER BY response_conversion_rate DESC, responses DESC;

-- Customer segment value
SELECT
    c.customer_segment,
    COUNT(DISTINCT c.customer_id) AS customers,
    COUNT(DISTINCT t.customer_id) AS purchasing_customers,
    COUNT(DISTINCT t.customer_id) / COUNT(DISTINCT c.customer_id) AS purchaser_rate,
    COALESCE(SUM(t.amount), 0) AS transaction_value
FROM customers c
LEFT JOIN transactions t ON t.customer_id = c.customer_id
GROUP BY c.customer_segment
ORDER BY transaction_value DESC;

-- Support volume, resolution, and CSAT by category
SELECT
    category,
    COUNT(*) AS tickets,
    AVG(resolution_date IS NOT NULL) AS resolution_rate,
    AVG(TIMESTAMPDIFF(HOUR, created_date, resolution_date)) AS average_resolution_hours,
    AVG(satisfaction_score) AS average_csat
FROM support_tickets
GROUP BY category
ORDER BY tickets DESC;
