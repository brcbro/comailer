import nodemailer from "nodemailer";
import { decrypt } from "@/lib/crypto";

export interface SmtpConfigForMailer {
  mode: string;
  region: string;
  host?: string | null;
  port?: number | null;
  secure: boolean;
  username?: string | null;
  passwordEnc?: string | null;
  apiTokenEnc?: string | null;
  domain: string;
  bounceAddress?: string | null;
}

/** Resolve ZeptoMail bounce address. Must match Domains → bounce address in the agent. */
export function resolveBounceAddress(smtpConfig: SmtpConfigForMailer): string {
  const configured = smtpConfig.bounceAddress?.trim();
  if (configured) return configured;
  // ZeptoMail expects prefix@bounce.<domain>, not bounce@domain
  return `bounce@bounce.${smtpConfig.domain}`;
}

function formatZeptoError(resData: Record<string, unknown>, status: number): string {
  const err = resData?.error as
    | { message?: string; details?: Array<{ message?: string; target?: string; code?: string }> }
    | string
    | undefined;
  if (err && typeof err === "object") {
    const d = err.details?.[0];
    if (d?.message) {
      const target = d.target ? ` [${d.target}]` : "";
      const code = d.code ? ` (${d.code})` : "";
      return `${d.message}${target}${code}`;
    }
    if (err.message) return err.message;
  }
  if (typeof err === "string") return err;
  if (typeof resData.message === "string") return resData.message;
  return `HTTP ${status} failed`;
}

export interface SendMailOptions {
  smtpConfig: SmtpConfigForMailer;
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  toName?: string | null;
  subject: string;
  body: string;
  bodyType: "HTML" | "TEXT";
}

function getZeptoApiUrl(region: string = "com"): string {
  switch (region.toLowerCase()) {
    case "eu":
      return "https://api.zeptomail.eu/v1.1/email";
    case "in":
      return "https://api.zeptomail.in/v1.1/email";
    case "com.cn":
      return "https://api.zeptomail.com.cn/v1.1/email";
    default:
      return "https://api.zeptomail.com/v1.1/email";
  }
}

export async function sendEmail(options: SendMailOptions): Promise<{ messageId?: string }> {
  const { smtpConfig, fromEmail, fromName, toEmail, toName, subject, body, bodyType } = options;

  if (smtpConfig.mode === "SMTP") {
    const password = smtpConfig.passwordEnc ? decrypt(smtpConfig.passwordEnc) : "";
    if (!password) {
      throw new Error("SMTP password token is missing or decryption failed");
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host || "smtp.zeptomail.com",
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.username || "emailapikey",
        pass: password,
      },
    });

    const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
    const toHeader = toName ? `"${toName}" <${toEmail}>` : toEmail;

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromHeader,
      to: toHeader,
      subject,
    };

    if (bodyType === "HTML") {
      mailOptions.html = body;
    } else {
      mailOptions.text = body;
    }

    const info = await transporter.sendMail(mailOptions);
    return { messageId: info.messageId };
  } else {
    // ZeptoMail API mode
    const rawApiToken = smtpConfig.apiTokenEnc ? decrypt(smtpConfig.apiTokenEnc) : "";
    // Users often paste the full "Zoho-enczapikey <token>" value; strip if present.
    const apiToken = rawApiToken.replace(/^Zoho-enczapikey\s+/i, "").trim();
    if (!apiToken) {
      throw new Error("ZeptoMail API token is missing or decryption failed");
    }

    const apiUrl = getZeptoApiUrl(smtpConfig.region);
    const bounceAddress = resolveBounceAddress(smtpConfig);

    const payload: Record<string, unknown> = {
      bounce_address: bounceAddress,
      from: {
        address: fromEmail,
        name: fromName || fromEmail,
      },
      to: [
        {
          email_address: {
            address: toEmail,
            name: toName || toEmail,
          },
        },
      ],
      subject,
      track_opens: false,
      track_clicks: false,
    };

    if (bodyType === "HTML") {
      payload.htmlbody = body;
    } else {
      payload.textbody = body;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const resData = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(`ZeptoMail API error: ${formatZeptoError(resData, response.status)}`);
    }

    const dataArr = resData.data;
    const first =
      Array.isArray(dataArr) && dataArr[0] && typeof dataArr[0] === "object"
        ? (dataArr[0] as { request_id?: string })
        : null;
    return {
      messageId:
        (typeof resData.request_id === "string" ? resData.request_id : null) ||
        first?.request_id ||
        "zeptomail_api",
    };
  }
}
