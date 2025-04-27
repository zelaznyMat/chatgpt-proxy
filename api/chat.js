// api/chat.js
import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Brak parametru message" });

  // Pobranie treści sklepu
  let shopText = "";
  try {
    const pageRes = await fetch("https://lalkametoo.pl");
    const html = await pageRes.text();
    shopText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 3000);
  } catch(e) {
    console.error("Błąd podczas pobierania strony sklepu:", e);
  }

  // System prompt z treścią sklepu
  const systemMessage = {
    role: "system",
    content: `
Jesteś asystentem dla klientów detalicznych sklepu lalkametoo.pl.
Na podstawie poniższej treści oferty i informacji ze strony udzielaj pomocnych odpowiedzi:

=== TREŚĆ SKLEPU ===
${shopText}
=== KONIEC TREŚCI ===
    `.trim()
  };

  const messages = [
    systemMessage,
    { role: "user", content: message }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",         // teraz używamy gpt-4
      messages
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });
  } catch (e) {
    console.error("OpenAI error:", e);
    if (e.code === "insufficient_quota" || e.status === 429) {
      return res.status(429).json({ error: "Przekroczono limit zapytań. Spróbuj później." });
    }
    return res.status(500).json({ error: "Błąd podczas kontaktu z OpenAI" });
  }
}
