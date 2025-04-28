import OpenAI from "openai";
import fetch from "node-fetch"; // potrzebny, bo na Vercel backend nie ma fetch domyślnie

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Funkcja pobierająca aktywne produkty z Shopera
async function fetchProducts() {
  try {
    const res = await fetch(
      'https://lalkametoo.shoper.pl/webapi/rest/products?filter[active]=1',
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.SHOPER_API_TOKEN
        }
      }
    );
    const data = await res.json();
    return data.list || [];
  } catch (error) {
    console.error('Błąd pobierania produktów:', error);
    return [];
  }
}

export default async function handler(req, res) {
  // CORS - obsługa przeglądarki
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Brak wiadomości" });

  // Pobieramy produkty ze sklepu
  const products = await fetchProducts();

  // Tworzymy opis produktów do prompta
  const productDescriptions = products.slice(0, 20).map(p => {
    return `- ${p.name}: ${p.short_description || p.description || "brak opisu"}`;
  }).join('\n');

  const systemContent = `
Jesteś pomocnym asystentem dla klientów sklepu lalkametoo.pl.
Oto aktualna oferta sklepu:

${productDescriptions}

Na podstawie powyższych informacji odpowiadaj klientom detalicznym.
Jeśli pytanie dotyczy produktu spoza listy lub brak jest danych, uprzejmie poinformuj o tym.
  `.trim();

  const messages = [
    { role: "system", content: systemContent },
    { role: "user", content: message }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
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
