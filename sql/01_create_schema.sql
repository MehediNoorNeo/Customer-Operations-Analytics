-- Customer Operations Analytics: MySQL 8+ reporting schema
CREATE DATABASE IF NOT EXISTS customer_operations_analytics;
USE customer_operations_analytics;

CREATE TABLE customers (
    customer_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    city VARCHAR(100) NOT NULL,
    signup_date DATE,
    customer_segment VARCHAR(50) NOT NULL
);

CREATE TABLE campaigns (
    campaign_id VARCHAR(20) PRIMARY KEY,
    campaign_name VARCHAR(150) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    campaign_date DATE NOT NULL,
    budget DECIMAL(14,2) NOT NULL,
    objective VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    target_audience VARCHAR(100) NOT NULL
);

CREATE TABLE responses (
    response_id VARCHAR(20) PRIMARY KEY,
    customer_id VARCHAR(20) NOT NULL,
    campaign_id VARCHAR(20) NOT NULL,
    response_date DATE NOT NULL,
    response_type VARCHAR(50) NOT NULL,
    converted TINYINT NOT NULL,
    CONSTRAINT chk_response_converted CHECK (converted IN (0, 1)),
    CONSTRAINT fk_responses_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    CONSTRAINT fk_responses_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
    INDEX idx_responses_date (response_date),
    INDEX idx_responses_campaign (campaign_id)
);

CREATE TABLE support_tickets (
    ticket_id VARCHAR(20) PRIMARY KEY,
    customer_id VARCHAR(20) NOT NULL,
    created_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    resolution_date DATE,
    satisfaction_score DECIMAL(3,1),
    CONSTRAINT chk_satisfaction_score CHECK (satisfaction_score IS NULL OR satisfaction_score BETWEEN 1 AND 5),
    CONSTRAINT fk_tickets_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    INDEX idx_tickets_created_date (created_date),
    INDEX idx_tickets_status (status)
);

CREATE TABLE transactions (
    transaction_id VARCHAR(20) PRIMARY KEY,
    customer_id VARCHAR(20) NOT NULL,
    transaction_date DATE NOT NULL,
    product VARCHAR(150) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    CONSTRAINT chk_transaction_amount CHECK (amount > 0),
    CONSTRAINT fk_transactions_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    INDEX idx_transactions_date (transaction_date),
    INDEX idx_transactions_customer (customer_id)
);
