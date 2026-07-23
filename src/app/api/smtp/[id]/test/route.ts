import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import nodemailer from "nodemailer";
import { resolveBounceAddress } from "@/lib/mailer";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await prisma.smtpConfig.findUnique({ where: { id } });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (config.mode === "SMTP") {
      const password = config.passwordEnc ? decrypt(config.passwordEnc) : "";
      if (!password) {
        return NextResponse.json(
          { success: false, message: "No SMTP password token configured" },
          { status: 400 }
        );
      }

      const transporter = nodemailer.createTransport({
        host: config.host || "smtp.zeptomail.com",
        port: config.port || 587,
        secure: config.secure,
        auth: {
          user: config.username || "emailapikey",
          pass: password,
        },
        connectionTimeout: 10000,
      });

      await transporter.verify();
      return NextResponse.json({
        success: true,
        message: "SMTP connection verified successfully!",
      });
    } else {
      const rawApiToken = config.apiTokenEnc ? decrypt(config.apiTokenEnc) : "";
      const apiToken = rawApiToken.replace(/^Zoho-enczapikey\s+/i, "").trim();
      if (!apiToken) {
        return NextResponse.json(
          { success: false, message: "No API token configured" },
          { status: 400 }
        );
      }

      if (!config.bounceAddress?.trim()) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Set a Bounce Address on this config (ZeptoMail → Domains). Example: bounce@bounce.yourdomain.com",
          },
          { status: 400 }
        );
      }

      const apiUrl = getZeptoApiUrl(config.region);
      const bounceAddress = resolveBounceAddress(config);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Zoho-enczapikey ${apiToken}`,
        },
        body: JSON.stringify({
          from: { address: `test@${config.domain}` },
          to: [{ email_address: { address: "test@example.com" } }],
          subject: "Test",
          bounce_address: bounceAddress,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string; details?: Array<{ message?: string; target?: string }> };
        message?: string;
      };

      if (!res.ok) {
        const d = data?.error?.details?.[0];
        const detail = d
          ? `${d.message}${d.target ? ` [${d.target}]` : ""}`
          : data?.error?.message || data.message || `HTTP ${res.status}`;
        return NextResponse.json(
          { success: false, message: `ZeptoMail API Error: ${detail}` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "ZeptoMail API connection verified successfully!",
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
