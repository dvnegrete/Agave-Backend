import { Injectable, Logger } from '@nestjs/common';

/**
 * EmailApiService
 *
 * Servicio para interactuar con APIs de email (SendGrid, Mailgun, etc.)
 * Actualmente soporta SendGrid para envío de respuestas
 */
@Injectable()
export class EmailApiService {
  private readonly logger = new Logger(EmailApiService.name);
  private readonly sendgridApiKey: string;
  private readonly sendgridApiUrl = 'https://api.sendgrid.com/v3';

  constructor() {
    this.sendgridApiKey = process.env.SENDGRID_API_KEY || '';
  }

  /**
   * Envía un email usando SendGrid API
   */
  async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    from?: string;
    html?: string;
  }): Promise<void> {
    const fromEmail =
      params.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@agave.com';

    try {
      const response = await fetch(`${this.sendgridApiUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.sendgridApiKey}`,
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: params.to }],
              subject: params.subject,
            },
          ],
          from: { email: fromEmail },
          content: [
            {
              type: 'text/plain',
              value: params.text,
            },
            ...(params.html
              ? [
                  {
                    type: 'text/html',
                    value: params.html,
                  },
                ]
              : []),
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `SendGrid API error (${response.status}): ${error}`,
        );
      }

      this.logger.log(`Email sent successfully to ${params.to}`);
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica que la API key esté configurada
   */
  isConfigured(): boolean {
    return !!this.sendgridApiKey;
  }
}
