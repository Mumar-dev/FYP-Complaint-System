import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  message: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();
    const smtpPort = process.env.SMTP_PORT?.trim();

    // If SMTP missing, strictly fallback to generic console mapping ensuring app doesn't crash during DEV
    if (!smtpHost || !smtpUser) {
      console.log(`\n================================`);
      console.log(`[Mock Email] Sent to ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Message:\n${options.message}`);
      console.log(`================================\n`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailOptions = {
      from: `Complaint Management Team <${smtpUser}>`,
      to: options.to,
      subject: options.subject,
      text: options.message,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    // Re-throw safely so the top-level generic try/catch natively catches and evaluates failure without blocking thread
    throw error;
  }
};
