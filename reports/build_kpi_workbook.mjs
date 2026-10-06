import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = new URL("..", import.meta.url).pathname.replace(/^\//, "");
const dataDir = `${root}/data/processed`;
const outputDir = `${root}/reports`;

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ""; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field); if (row.some(v => v !== "")) rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...values] = rows;
  return values.map(valuesRow => Object.fromEntries(headers.map((header, index) => [header, valuesRow[index] ?? ""])));
}

async function readCsv(name) { return parseCsv(await fs.readFile(`${dataDir}/${name}`, "utf8")); }
const [customers, campaigns, responses, tickets, transactions] = await Promise.all([
  readCsv("customers_clean.csv"), readCsv("campaigns_clean.csv"), readCsv("responses_clean.csv"),
  readCsv("support_tickets_clean.csv"), readCsv("transactions_clean.csv"),
]);

const sum = (items, accessor) => items.reduce((total, item) => total + accessor(item), 0);
const group = (items, key) => items.reduce((map, item) => {
  const value = key(item); if (!map.has(value)) map.set(value, []); map.get(value).push(item); return map;
}, new Map());
const campaignById = new Map(campaigns.map(c => [c.campaign_id, c]));
const resolved = tickets.filter(t => t.resolution_date);
const validCsat = tickets.filter(t => t.satisfaction_score);
const transactionValue = sum(transactions, t => Number(t.amount));

const latestTransactionDate = transactions.map(t => t.transaction_date).sort().at(-1);
const latestTransactionMonth = latestTransactionDate.slice(0, 7);
const [latestYear, latestMonthNumber, latestDay] = latestTransactionDate.split("-").map(Number);
const latestMonthEndDay = new Date(Date.UTC(latestYear, latestMonthNumber, 0)).getUTCDate();
const latestMonthIsPartial = latestDay < latestMonthEndDay;
const monthly = [...group(transactions, t => t.transaction_date.slice(0, 7)).entries()]
  .map(([month, rows]) => [month, rows.length, sum(rows, t => Number(t.amount)), month === latestTransactionMonth && latestMonthIsPartial ? "Partial" : "Complete"])
  .sort((a, b) => a[0].localeCompare(b[0]));
const completeMonthlyCount = monthly.filter(row => row[3] === "Complete").length;
const channel = [...group(responses, r => campaignById.get(r.campaign_id)?.channel ?? "Unknown").entries()]
  .map(([name, rows]) => [name, rows.length, sum(rows, r => Number(r.converted)), sum(rows, r => Number(r.converted)) / rows.length])
  .sort((a, b) => b[3] - a[3]);
const support = [...group(tickets, t => t.category).entries()]
  .map(([name, rows]) => {
    const categoryCsat = rows.filter(r => r.satisfaction_score);
    return [name, rows.length, rows.filter(r => r.resolution_date).length / rows.length, categoryCsat.length ? sum(categoryCsat, r => Number(r.satisfaction_score)) / categoryCsat.length : null];
  }).sort((a, b) => b[1] - a[1]);

const workbook = Workbook.create();
const dashboard = workbook.worksheets.add("Dashboard");
const data = workbook.worksheets.add("Data");
for (const sheet of [dashboard, data]) { sheet.showGridLines = false; sheet.getRange("A:Z").format.font = { name: "Arial", size: 10, color: "#1F2937" }; }

dashboard.getRange("A2:L2").merge();
dashboard.getRange("A2").values = [["Customer Operations Analytics"]];
dashboard.getRange("A2").format = { font: { name: "Arial", size: 16, bold: true, color: "#0F172A" } };
dashboard.getRange("A3").values = [[`Validated records through ${latestTransactionDate}; latest month is ${latestMonthIsPartial ? "partial" : "complete"}`]];
dashboard.getRange("A3").format = { font: { italic: true, color: "#64748B" } };

const kpis = [
  ["KPI", "Value"],
  ["Customers", customers.length], ["Campaigns", campaigns.length], ["Responses", responses.length],
  ["Response conversion rate", sum(responses, r => Number(r.converted)) / responses.length],
  ["Transaction value (BDT)", transactionValue], ["Average transaction value (BDT)", transactionValue / transactions.length],
  ["Tickets", tickets.length], ["Ticket resolution rate", resolved.length / tickets.length],
  ["Average CSAT", sum(validCsat, t => Number(t.satisfaction_score)) / validCsat.length],
];
dashboard.getRange(`A5:B${4 + kpis.length}`).values = kpis;
dashboard.getRange("A5:B5").format = { fill: "#1D4ED8", font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange("A5:B14").format.borders = { preset: "outside", style: "thin", color: "#CBD5E1" };
dashboard.getRange("B6:B8").format.numberFormat = "#,##0";
dashboard.getRange("B9").format.numberFormat = "0.0%";
dashboard.getRange("B10:B11").format.numberFormat = "#,##0";
dashboard.getRange("B12").format.numberFormat = "#,##0";
dashboard.getRange("B13").format.numberFormat = "0.0%";
dashboard.getRange("B14").format.numberFormat = "0.00";

dashboard.getRange("A17:D17").values = [["Month", "Transactions", "Transaction value (BDT)", "Period status"]];
dashboard.getRange(`A18:D${17 + monthly.length}`).values = monthly;
dashboard.getRange("A17:D17").format = { fill: "#0F766E", font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange(`C18:C${17 + monthly.length}`).format.numberFormat = "#,##0";

dashboard.getRange("E17:H17").values = [["Channel", "Responses", "Conversions", "Conversion rate"]];
dashboard.getRange(`E18:H${17 + channel.length}`).values = channel;
dashboard.getRange("E17:H17").format = { fill: "#0F766E", font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange(`H18:H${17 + channel.length}`).format.numberFormat = "0.0%";

dashboard.getRange("A33:D33").values = [["Support category", "Tickets", "Resolution rate", "Average CSAT"]];
dashboard.getRange(`A34:D${33 + support.length}`).values = support;
dashboard.getRange("A33:D33").format = { fill: "#7C3AED", font: { bold: true, color: "#FFFFFF" } };
dashboard.getRange(`C34:C${33 + support.length}`).format.numberFormat = "0.0%";
dashboard.getRange(`D34:D${33 + support.length}`).format.numberFormat = "0.00";

dashboard.getRange("A16:H16").format.borders = { bottom: { style: "medium", color: "#94A3B8" } };
dashboard.getRange("A32:H32").format.borders = { bottom: { style: "medium", color: "#94A3B8" } };
dashboard.getRange("J5").values = [["Notes"]];
dashboard.getRange("J5").format = { font: { bold: true, color: "#0F172A" } };
dashboard.getRange("J6:L11").merge();
dashboard.getRange("J6").values = [["Transaction value is not net revenue because refunds are not linked to refund amounts. Campaign-attributed revenue cannot be calculated because transactions have no campaign identifier. Missing CSAT is excluded from the average."]];
dashboard.getRange("J6").format = { wrapText: true, verticalAlignment: "top", font: { color: "#475569" } };

const trend = dashboard.charts.add("line", [
  dashboard.getRange(`A17:A${17 + completeMonthlyCount}`),
  dashboard.getRange(`C17:C${17 + completeMonthlyCount}`),
]);
trend.title = "Monthly transaction value (complete months)"; trend.hasLegend = false; trend.setPosition("E5", "L14");
trend.yAxis = { numberFormatCode: "0.0,,\"M\"", numberFormatSourceLinked: false, textStyle: { typeface: "Arial" } };
const channelChart = dashboard.charts.add("bar", [
  dashboard.getRange(`E17:E${17 + channel.length}`),
  dashboard.getRange(`F17:F${17 + channel.length}`),
  dashboard.getRange(`G17:G${17 + channel.length}`),
]);
channelChart.title = "Responses and conversions by channel"; channelChart.hasLegend = true; channelChart.setPosition("E19", "L31");
channelChart.yAxis = { numberFormatCode: "#,##0", numberFormatSourceLinked: false, textStyle: { typeface: "Arial" } };

data.getRange("A1:B1").merge(); data.getRange("A1").values = [["Source data summary"]];
data.getRange("A1").format = { fill: "#334155", font: { bold: true, color: "#FFFFFF", size: 14 } };
data.getRange("A3:C3").values = [["Dataset", "Rows", "Source"]];
data.getRange("A4:C8").values = [
  ["Customers", customers.length, "data/processed/customers_clean.csv"], ["Campaigns", campaigns.length, "data/processed/campaigns_clean.csv"],
  ["Responses", responses.length, "data/processed/responses_clean.csv"], ["Support tickets", tickets.length, "data/processed/support_tickets_clean.csv"],
  ["Transactions", transactions.length, "data/processed/transactions_clean.csv"],
];
data.getRange("A3:C3").format = { fill: "#64748B", font: { bold: true, color: "#FFFFFF" } };
data.getRange("A10:D10").values = [["Metric definition", "Numerator", "Denominator", "Notes"]];
data.getRange("A11:D14").values = [
  ["Response conversion rate", "Converted response records", "Valid response records", "Binary converted flag"],
  ["Ticket resolution rate", "Tickets with a resolution timestamp", "All tickets", "Unresolved tickets remain in denominator"],
  ["Average CSAT", "Valid satisfaction-score total", "Valid satisfaction-score count", "Missing scores excluded"],
  ["Transaction value", "Positive transaction amounts", "Not applicable", "Not net revenue"],
];
data.getRange("A10:D10").format = { fill: "#64748B", font: { bold: true, color: "#FFFFFF" } };

for (const sheet of [dashboard, data]) {
  sheet.getUsedRange().format.autofitColumns();
  sheet.getUsedRange().format.autofitRows();
}
dashboard.getRange("A:A").format.columnWidth = 28; dashboard.getRange("B:B").format.columnWidth = 20;
dashboard.getRange("J:L").format.columnWidth = 18;
data.getRange("A:A").format.columnWidth = 28; data.getRange("B:B").format.columnWidth = 32;
data.getRange("C:C").format.columnWidth = 34; data.getRange("D:D").format.columnWidth = 46;
workbook.recalculate();
await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/customer_operations_kpi_dashboard.xlsx`);
const preview = await workbook.render({ sheetName: "Dashboard", range: "A1:L42", scale: 1.5, format: "png" });
await fs.writeFile(`${outputDir}/customer_operations_kpi_dashboard_preview.png`, new Uint8Array(await preview.arrayBuffer()));
const dataPreview = await workbook.render({ sheetName: "Data", range: "A1:D14", scale: 1.5, format: "png" });
await fs.writeFile(`${outputDir}/customer_operations_kpi_data_preview.png`, new Uint8Array(await dataPreview.arrayBuffer()));
const check = await workbook.inspect({ kind: "table", range: "Dashboard!A1:L42", include: "values,formulas", tableMaxRows: 42, tableMaxCols: 12 });
await fs.writeFile(`${outputDir}/customer_operations_kpi_dashboard_check.ndjson`, check.ndjson);
