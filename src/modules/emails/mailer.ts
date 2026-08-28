import nodemailer from "nodemailer";
import type { SenderAccount } from "@prisma/client";
import { decrypt } from "../../lib/crypto.js";

export async function sendEmail(sender: SenderAccount, recipient: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpSecure,
    auth: { user: sender.smtpUser, pass: decrypt(sender.encryptedSmtpPassword) },
    pool: true,
    maxConnections: 1
  });
  try {
    const info = await transporter.sendMail({ from: { name: sender.name, address: sender.email }, to: recipient, subject, html });
    const previewUrl = typeof info.response === "string"
      ? (nodemailer.getTestMessageUrl as (value: unknown) => string | false)(info) || null
      : null;
    return { messageId: info.messageId, previewUrl };
  } finally {
    transporter.close();
  }
}
