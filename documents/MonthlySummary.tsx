import React from "react";
import { Document, Page, Footer, Head, Spacer } from "@htmldocs/react";

interface CompanyTotal {
  name: string;
  hours: number;
}

interface DailyEntry {
  dateLabel: string;
  totalHours: number;
  notes?: string[];
  companies: Array<{
    name: string;
    hours: number;
  }>;
}

interface SummaryPeriod {
  label: string;
  monthName: string;
  year: number;
}

interface WorkerSummary {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface SummaryTotals {
  totalHours: number;
  totalTrackedDays: number;
  averageHours: number;
  noteCount: number;
}

type HTMLDocsComponent<Props> = React.FC<Props> & {
  PreviewProps?: Props;
  fileName?: string;
};

interface MonthlySummaryProps {
  worker: WorkerSummary;
  period: SummaryPeriod;
  totals: SummaryTotals;
  companies: CompanyTotal[];
  dailyEntries: DailyEntry[];
}

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#475569",
  marginBottom: "4px",
};

const valueStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#0f172a",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "18px",
  padding: "20px",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
  border: "1px solid #e2e8f0",
};

const headingStyle: React.CSSProperties = {
  fontSize: "24px",
  margin: 0,
  color: "#0f172a",
};

const subheadingStyle: React.CSSProperties = {
  fontSize: "16px",
  margin: 0,
  color: "#475569",
};

const tableHeadingStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
  padding: "10px 0",
};

const tableCellStyle: React.CSSProperties = {
  padding: "10px 0",
  borderTop: "1px solid #e2e8f0",
  fontSize: "14px",
  color: "#1f2937",
};

const MonthlySummary: HTMLDocsComponent<MonthlySummaryProps> = ({
  worker,
  period,
  totals,
  companies,
  dailyEntries,
}) => {
  return (
    <Document size="A4" orientation="portrait" margin="2.2cm">
      <Head>
        <style>
          {`
            * { box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              color: #0f172a;
              background-color: #f8fafc;
              margin: 0;
            }
            h1, h2, h3, h4, h5, h6 { margin: 0; }
            table { width: 100%; border-collapse: collapse; }
            ul { margin: 6px 0 0 18px; }
          `}
        </style>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </Head>
      <Page
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
            paddingBottom: "12px",
            borderBottom: "4px solid #2563eb",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "9999px",
                backgroundColor: "#dbeafe",
                color: "#1d4ed8",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Resumen mensual de horas
            </div>
            <div>
              <h1 style={headingStyle}>{worker.name}</h1>
              <p style={subheadingStyle}>{period.label}</p>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "16px",
              borderRadius: "16px",
              backgroundColor: "#f8fafc",
              minWidth: "200px",
            }}
          >
            <div>
              <div style={labelStyle}>Correo</div>
              <div style={valueStyle}>{worker.email ?? "-"}</div>
            </div>
            <div>
              <div style={labelStyle}>Teléfono</div>
              <div style={valueStyle}>{worker.phone ?? "-"}</div>
            </div>
            <div>
              <div style={labelStyle}>Rol</div>
              <div style={valueStyle}>{worker.role ?? "Colaborador"}</div>
            </div>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "18px",
          }}
        >
          <div style={cardStyle}>
            <div style={labelStyle}>Horas totales</div>
            <div style={{ ...valueStyle, fontSize: "26px" }}>
              {totals.totalHours.toFixed(2)} h
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Días registrados</div>
            <div style={{ ...valueStyle, fontSize: "26px" }}>
              {totals.totalTrackedDays}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Promedio diario</div>
            <div style={{ ...valueStyle, fontSize: "26px" }}>
              {totals.averageHours.toFixed(2)} h
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Notas registradas</div>
            <div style={{ ...valueStyle, fontSize: "26px" }}>
              {totals.noteCount}
            </div>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 style={{ ...headingStyle, fontSize: "18px" }}>Horas por empresa</h2>
          <table>
            <thead>
              <tr>
                <th style={tableHeadingStyle}>Empresa</th>
                <th style={{ ...tableHeadingStyle, textAlign: "right" }}>Horas</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.name}>
                  <td style={tableCellStyle}>{company.name}</td>
                  <td style={{ ...tableCellStyle, textAlign: "right", fontWeight: 600 }}>
                    {company.hours.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ ...headingStyle, fontSize: "18px" }}>Detalle diario</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {dailyEntries.map((entry) => (
              <div
                key={entry.dateLabel}
                style={{
                  ...cardStyle,
                  padding: "16px",
                  borderRadius: "16px",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <div style={{ ...labelStyle, marginBottom: "2px" }}>Fecha</div>
                    <div style={{ ...valueStyle, fontSize: "18px" }}>{entry.dateLabel}</div>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: "2px", textAlign: "right" }}>
                      Horas del día
                    </div>
                    <div style={{ ...valueStyle, fontSize: "18px", textAlign: "right" }}>
                      {entry.totalHours.toFixed(2)} h
                    </div>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style={tableHeadingStyle}>Empresa</th>
                      <th style={{ ...tableHeadingStyle, textAlign: "right" }}>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.companies.map((company) => (
                      <tr key={company.name}>
                        <td style={tableCellStyle}>{company.name}</td>
                        <td style={{ ...tableCellStyle, textAlign: "right" }}>
                          {company.hours.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {entry.notes && entry.notes.length > 0 ? (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ ...labelStyle, marginBottom: "4px" }}>Notas</div>
                    <ul>
                      {entry.notes.map((note) => (
                        <li key={note} style={{ fontSize: "13px", color: "#475569" }}>
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
        <Spacer height="12px" />
      </Page>
      <Footer>
        {({ currentPage, totalPages }) => (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 32px",
              fontSize: "12px",
              color: "#64748b",
              borderTop: "1px solid #e2e8f0",
              backgroundColor: "rgba(248, 250, 252, 0.9)",
            }}
          >
            <span>Generado automáticamente por G6T-Salary</span>
            <span>
              Página {currentPage} de {totalPages}
            </span>
          </div>
        )}
      </Footer>
    </Document>
  );
};

MonthlySummary.PreviewProps = {
  worker: {
    name: "María González",
    email: "maria.gonzalez@example.com",
    phone: "+34 600 123 456",
    role: "Desarrolladora Senior",
  },
  period: {
    label: "Marzo 2024",
    monthName: "Marzo",
    year: 2024,
  },
  totals: {
    totalHours: 168,
    totalTrackedDays: 22,
    averageHours: 7.6,
    noteCount: 5,
  },
  companies: [
    { name: "TechNova", hours: 92 },
    { name: "Innova Corp", hours: 54 },
    { name: "Consulting Partners", hours: 22 },
  ],
  dailyEntries: [
    {
      dateLabel: "1 de marzo, 2024",
      totalHours: 7.5,
      companies: [
        { name: "TechNova", hours: 4.5 },
        { name: "Innova Corp", hours: 3 },
      ],
      notes: ["Reunión de planificación Q2", "Entrega sprint semanal"],
    },
    {
      dateLabel: "2 de marzo, 2024",
      totalHours: 8,
      companies: [
        { name: "TechNova", hours: 5 },
        { name: "Consulting Partners", hours: 3 },
      ],
      notes: ["Soporte a equipo de datos"],
    },
    {
      dateLabel: "3 de marzo, 2024",
      totalHours: 7,
      companies: [{ name: "Innova Corp", hours: 7 }],
    },
  ],
};

MonthlySummary.fileName = "resumen-horas-g6t.pdf";

export default MonthlySummary;
