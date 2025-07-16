import { HealthReport } from './health-checks.ts'

interface EmailData {
  from: string
  to: string
  subject: string
  html: string
}

export async function sendHealthReportEmail(healthReport: HealthReport, resendApiKey: string): Promise<void> {
  const emailTo = Deno.env.get('HEALTH_CHECK_EMAIL_TO') || 'admin@daystart.app'
  const emailFrom = Deno.env.get('HEALTH_CHECK_EMAIL_FROM') || 'onboarding@resend.dev'

  const subject = `DayStart Health Check - ${healthReport.overall_status.toUpperCase()} - ${new Date().toLocaleDateString()}`

  const html = generateEmailHTML(healthReport)

  const emailData: EmailData = {
    from: emailFrom,
    to: emailTo,
    subject,
    html
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailData)
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`Failed to send email via Resend: ${response.status} ${response.statusText} - ${errorData}`)
  }

  const result = await response.json()
  console.log('Email sent successfully:', result.id)
}

function generateEmailHTML(healthReport: HealthReport): string {
  const statusEmoji = {
    healthy: '✅',
    warning: '⚠️',
    critical: '🚨'
  }

  const statusColor = {
    healthy: '#10B981',
    warning: '#F59E0B',
    critical: '#EF4444'
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatMetrics = (metrics: Record<string, any> | undefined) => {
    if (!metrics) return ''
    
    return Object.entries(metrics)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `<strong>${key}:</strong> <pre>${JSON.stringify(value, null, 2)}</pre>`
        }
        return `<strong>${key}:</strong> ${value}`
      })
      .join('<br>')
  }

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DayStart Health Check Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .summary {
            background: #f8fafc;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .summary-item {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        .summary-number {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .check-item {
            margin: 15px 0;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid;
        }
        .check-item.healthy {
            background: #f0fdf4;
            border-left-color: #10B981;
        }
        .check-item.warning {
            background: #fffbeb;
            border-left-color: #F59E0B;
        }
        .check-item.critical {
            background: #fef2f2;
            border-left-color: #EF4444;
        }
        .check-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .check-status {
            margin-left: 10px;
            font-weight: bold;
        }
        .check-message {
            margin-bottom: 10px;
        }
        .check-metrics {
            font-size: 14px;
            color: #6b7280;
        }
        .recommendations {
            background: #eff6ff;
            border: 1px solid #dbeafe;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        .recommendations h3 {
            margin-top: 0;
            color: #1e40af;
        }
        .recommendations ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
        pre {
            background: #f3f4f6;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DayStart Health Check Report</h1>
            <div class="status-badge" style="background-color: ${statusColor[healthReport.overall_status]}; color: white;">
                ${statusEmoji[healthReport.overall_status]} ${healthReport.overall_status.toUpperCase()}
            </div>
            <p>Generated on ${formatTimestamp(healthReport.timestamp)}</p>
        </div>

        <div class="summary">
            <h2>Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-number" style="color: #10B981;">${healthReport.summary.healthy_count}</div>
                    <div>Healthy</div>
                </div>
                <div class="summary-item">
                    <div class="summary-number" style="color: #F59E0B;">${healthReport.summary.warning_count}</div>
                    <div>Warning</div>
                </div>
                <div class="summary-item">
                    <div class="summary-number" style="color: #EF4444;">${healthReport.summary.critical_count}</div>
                    <div>Critical</div>
                </div>
                <div class="summary-item">
                    <div class="summary-number">${healthReport.summary.total_checks}</div>
                    <div>Total Checks</div>
                </div>
            </div>
        </div>

        <h2>Health Check Results</h2>
        ${healthReport.checks.map(check => `
            <div class="check-item ${check.status}">
                <div class="check-header">
                    <span>${statusEmoji[check.status]}</span>
                    <span class="check-status">${check.component.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
                <div class="check-message">${check.message}</div>
                ${check.metrics ? `
                    <div class="check-metrics">
                        ${formatMetrics(check.metrics)}
                    </div>
                ` : ''}
                <div style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
                    Checked at: ${formatTimestamp(check.timestamp)}
                </div>
            </div>
        `).join('')}

        ${healthReport.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>Recommendations</h3>
                <ul>
                    ${healthReport.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        <div class="footer">
            <p>This report was automatically generated by the DayStart health check system.</p>
            <p>For questions or concerns, please contact the development team.</p>
        </div>
    </div>
</body>
</html>
  `
} 