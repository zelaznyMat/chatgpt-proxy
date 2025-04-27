// api/chat.js
import OpenAI from "openai";
import fetch from "node-fetch";   // fetch w Node.js

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
  if (!message) {
    return res.status(400).json({ error: "Brak parametru message" });
  }

  // 1. Pobieramy stronę lalkametoo.pl
  let shopHtml = "";
  try {
    const pageRes = await fetch("https://lalkametoo.pl");
    shopHtml = await pageRes.text();
  } catch(e) {
    console.error("Błąd pobierania strony sklepu:", e);
    // Możemy kontynuować nawet bez kontentu sklepu
  }

  // 2. Wyciągamy sam tekst (usuwamy tagi HTML)
  const shopText = shopHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 3000);  // limit do ~3000 znaków

  // 3. Przygotowujemy system prompt z kontentem
  const systemMessage = {
    role: "system",
    content: `
Jesteś asystentem dla klientów detalicznych sklepu lalkametoo.pl. 
Na podstawie poniższego opisu oferty oraz informacji ze strony sklepu udzielaj konkretnych, przyjaznych porad dla osób indywidualnych:

=== TREŚĆ SKLEPU (skrócona) ===
${shopText}
=== KONIEC TREŚCI ===
    `.trim()
  };

  // 4. Zbieramy wiadomości do OpenAI
  const messages = [
    systemMessage,
    { role: "user", content: message }
  ];

  // 5. Wywołujemy ChatGPT
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages
    });
    return res.status(200).json({
      reply: completion.choices[0].message.content
    });
  } catch (e) {
    console.error("OpenAI error:", e);
    return res.status(500).json({ error: "Błąd podczas kontaktu z OpenAI" });
  }
}
