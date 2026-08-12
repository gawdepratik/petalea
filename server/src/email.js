const nodemailer = require("nodemailer");

const devMode = process.env.EMAIL_DEV_MODE === "true";

const transporter = devMode
  ? null
  : nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 25),
      secure: false, // STARTTLS, not implicit TLS
      requireTLS: true,
      auth: undefined, // the M365 relay connector authenticates by source IP, not credentials
      tls: { minVersion: "TLSv1.2" }
    });

async function sendMail({ to, subject, text, html }) {
  if (devMode) {
    console.log(`[EMAIL_DEV_MODE] Would send to ${to}: ${subject}\n${text}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html
  });
}

module.exports = { sendMail };
