import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const CLIENT_ID = Deno.env.get("CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("CLIENT_SECRET");
const REFRESH_TOKEN = Deno.env.get("REFRESH_TOKEN");
const EMAIL = Deno.env.get("EMAIL");

// Konfiguracja klienta SMTP
const client = new SMTPClient({
  connection: {
    hostname: "smtp.gmail.com",  // SMTP server dla Gmaila
    port: 465,                   // Port TLS
    tls: true,                   // Połączenie TLS
    auth: {
      username: EMAIL,           // Użyj swojego e-maila
      password: REFRESH_TOKEN,   // Użyj tokenu odświeżania (jeśli to on jest używany jako hasło)
    },
  },
});

async function sendEmail(to: string, subject: string, text: string) {
  try {
    await client.send({
      from: EMAIL,       // Adres nadawcy
      to,                // Adres odbiorcy
      subject,           // Temat
      content: text,     // Treść wiadomości tekstowej
      html: `<p>${text}</p>`,  // Opcjonalnie możesz dodać treść w HTML
    });

    await client.close();  // Zamknij połączenie
    return "Email sent successfully!";
  } catch (error) {
    throw new Error(`Error sending email: ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { to, subject, message } = await req.json();
  if (!to || !subject || !message) {
    return new Response("Invalid request body", { status: 400 });
  }

  try {
    const result = await sendEmail(to, subject, message);
    return new Response(JSON.stringify({ success: true, result }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
});
