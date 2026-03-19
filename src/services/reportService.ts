import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { Child, VaccineStatus } from "../types/vaccine";
import { getStatusSummary } from "./matchingService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

function computeAge(dob: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - dob.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(totalDays / 30.44);
    const weeks = Math.floor(totalDays / 7);

    if (months >= 12) {
        const years = Math.floor(months / 12);
        const rem = months % 12;
        return rem > 0 ? `${years}y ${rem}m` : `${years}y`;
    }
    if (months >= 1) return `${months} month${months !== 1 ? "s" : ""}`;
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
}

const STATUS_COLORS: Record<VaccineStatus["status"], string> = {
    given: "#16A34A", // green-600
    overdue: "#DC2626", // red-600
    upcoming: "#6B7280", // gray-500
    missing: "#D97706", // amber-600
};

const STATUS_LABELS: Record<VaccineStatus["status"], string> = {
    given: "Given ✓",
    overdue: "Overdue",
    upcoming: "Upcoming",
    missing: "Missing",
};

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

/**
 * Generates an HTML report, converts it to PDF using expo-print,
 * and opens the native share sheet via expo-sharing.
 */
export async function generateVaccineReport(
    child: Child,
    statuses: VaccineStatus[]
): Promise<void> {
    const summary = getStatusSummary(statuses);

    // Group vaccines by WHO milestone to make the table more readable
    const grouped = new Map<string, VaccineStatus[]>();
    for (const s of statuses) {
        const label = s.whoVaccine.recommendedAgeLabel;
        if (!grouped.has(label)) grouped.set(label, []);
        grouped.get(label)!.push(s);
    }

    // Build the table rows
    let tableRowsHTML = "";
    for (const [milestone, items] of grouped.entries()) {
        // Milestone sub-header
        tableRowsHTML += `
      <tr class="milestone-row">
        <td colspan="4"><strong>${milestone}</strong></td>
      </tr>
    `;

        // Items in this milestone
        for (const s of items) {
            const { whoVaccine, status, givenRecord, dueDate } = s;
            const color = STATUS_COLORS[status];
            const label = STATUS_LABELS[status];

            let dateText = "";
            if (status === "given" && givenRecord) {
                dateText = formatDate(givenRecord.dateAdministered);
            } else if (status === "overdue" && s.weeksOverdue !== null) {
                dateText = `<span style="color: ${color}">${s.weeksOverdue} weeks overdue</span>`;
            } else if (status === "upcoming") {
                dateText = `Due ${formatDate(dueDate)}`;
            } else {
                dateText = "Missing record";
            }

            tableRowsHTML += `
        <tr>
          <td>
            <div class="vaccine-name">${whoVaccine.vaccineName}</div>
            <div class="disease-name">Protects against: ${whoVaccine.disease}</div>
          </td>
          <td style="color: ${color}; font-weight: bold;">${label}</td>
          <td>${dateText}</td>
          <td>${whoVaccine.isMandatory ? "Yes" : "Optional"}</td>
        </tr>
      `;
        }
    }

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VaccineGuard Report - ${child.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1F2937;
          line-height: 1.5;
          margin: 0;
          padding: 40px;
        }

        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 2px solid #0077B6;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #0077B6;
          margin: 0 0 8px 0;
          font-size: 28px;
        }
        .header p {
          margin: 0;
          color: #6B7280;
          font-size: 14px;
        }
        .report-date {
          text-align: right;
          color: #4B5563;
          font-size: 14px;
          margin: 0;
        }

        /* Patient Info & Summary Cards */
        .top-section {
          display: flex;
          gap: 30px;
          margin-bottom: 40px;
        }
        .info-card {
          flex: 1;
          background-color: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 20px;
        }
        .info-card h2 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #374151;
          border-bottom: 1px solid #E5E7EB;
          padding-bottom: 8px;
        }
        .info-row {
          display: flex;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .info-label {
          width: 100px;
          color: #6B7280;
          font-weight: 500;
        }
        .info-value {
          color: #111827;
          font-weight: 600;
        }
        
        /* Summary Grid */
        .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .summary-item {
          padding: 12px;
          border-radius: 8px;
          text-align: center;
        }
        .summary-item.given { background-color: #F0FDF4; color: #16A34A; }
        .summary-item.overdue { background-color: #FEF2F2; color: #DC2626; }
        .summary-item.upcoming { background-color: #EFF6FF; color: #2563EB; }
        .summary-item.missing { background-color: #FFFBEB; color: #D97706; }
        .summary-count {
          font-size: 24px;
          font-weight: bold;
          margin: 0;
        }
        .summary-label {
          font-size: 12px;
          margin: 0;
          opacity: 0.9;
        }

        /* Table */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 40px;
          font-size: 13px;
        }
        th {
          background-color: #F3F4F6;
          text-align: left;
          padding: 12px;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #D1D5DB;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #E5E7EB;
          vertical-align: top;
        }
        .milestone-row td {
          background-color: #F9FAFB;
          color: #4B5563;
          padding: 8px 12px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #D1D5DB;
        }
        .vaccine-name {
          font-weight: 600;
          color: #111827;
          margin-bottom: 4px;
        }
        .disease-name {
          font-size: 11px;
          color: #6B7280;
        }

        /* Footer (repeats on every printed page via CSS page margins) */
        @page {
          margin: 40px;
          @bottom-center {
            content: "This report is generated by VaccineGuard for reference purposes only. It is NOT a medical document. Please consult a qualified pediatrician or healthcare provider before making any medical decisions. WHO schedule data is based on the 2024 EPI recommendations.";
            font-size: 10px;
            color: #9CA3AF;
            text-align: center;
          }
        }
        
        /* Fallback footer for rendering engines that don't support @page margins perfectly */
        .footer {
          margin-top: 40px;
          padding: 20px;
          background-color: #F9FAFB;
          border-radius: 8px;
          border: 1px solid #E5E7EB;
          font-size: 11px;
          color: #6B7280;
          text-align: center;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>

      <div class="header">
        <div>
          <h1>🛡️ VaccineGuard</h1>
          <p>Immunization Summary Report</p>
        </div>
        <div>
          <p class="report-date">Generated: <strong>${formatDate(new Date())}</strong></p>
        </div>
      </div>

      <div class="top-section">
        <div class="info-card">
          <h2>Patient Details</h2>
          <div class="info-row">
            <div class="info-label">Name</div>
            <div class="info-value">${child.name}</div>
          </div>
          <div class="info-row">
            <div class="info-label">DOB</div>
            <div class="info-value">${formatDate(child.dateOfBirth)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Age</div>
            <div class="info-value">${computeAge(child.dateOfBirth)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Sex</div>
            <div class="info-value">${child.gender.charAt(0).toUpperCase() + child.gender.slice(1)}</div>
          </div>
        </div>

        <div class="info-card">
          <h2>Schedule Summary</h2>
          <div class="summary-grid">
            <div class="summary-item given">
              <p class="summary-count">${summary.given}</p>
              <p class="summary-label">Given ✓</p>
            </div>
            <div class="summary-item overdue">
              <p class="summary-count">${summary.overdue}</p>
              <p class="summary-label">Overdue ⚠️</p>
            </div>
            <div class="summary-item upcoming">
              <p class="summary-count">${summary.upcoming}</p>
              <p class="summary-label">Upcoming 📅</p>
            </div>
            <div class="summary-item missing">
              <p class="summary-count">${summary.missing}</p>
              <p class="summary-label">Missing ❌</p>
            </div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40%">Vaccine</th>
            <th style="width: 20%">Status</th>
            <th style="width: 25%">Date / Info</th>
            <th style="width: 15%">WHO Core</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHTML}
        </tbody>
      </table>

      <div class="footer">
        <strong>Disclaimer:</strong> This report is generated by VaccineGuard for reference purposes only. 
        It is NOT a medical document. Please consult a qualified pediatrician or healthcare provider 
        before making any medical decisions. WHO schedule data is based on the 2024 EPI recommendations.
      </div>

    </body>
    </html>
  `;

    try {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                mimeType: "application/pdf",
                dialogTitle: `${child.name}'s Vaccination Report`,
                UTI: "com.adobe.pdf",
            });
        } else {
            Alert.alert("PDF Saved", `Report saved to: ${uri}`);
        }
    } catch (error) {
        console.error("[reportService] PDF generation failed:", error);
        Alert.alert("Error", "Failed to generate the PDF report. Please try again.");
    }
}
