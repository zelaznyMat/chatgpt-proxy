// api/chat.js
import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 1. Pobiera aktywne produkty z Twojego sklepu
async function fetchProducts() {
  const res = await fetch(
    'https://lalkametoo.pl/webapi/rest/products?filter[active]=1',
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.SHOPER_API_TOKEN
      }
    }
  );
  const data = await res.json();
  return data.list || [];  // tablica produktów
}

// 2. Proste filtrowanie po zapytaniu
function searchProducts(products, query) {
  const q = query.toLowerCase();
  return products.filter(p => {
    const hay = (
      p.name + ' ' +
      (p.short_description || '') + ' ' +
      (p.description || '')
    ).toLowerCase();
    return hay.includes(q);
  });
}

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

  try {
    // 1) pobieramy
    const products = await fetchProducts();

    // 2) szukamy
    let found = searchProducts(products, message);
    if (found.length === 0) found = products.slice(0, 5);
    else found = found.slice(0, 5);

    // 3) budujemy opis
    const productDescriptions = found.map(p => {
      const url = `https://lalkametoo.pl/product/${p.product_id}`;
      const img = p.main_image?.path || "";
      const desc = p.short_description || p.description || "– brak opisu –";
      return `- **${p.name}**\nCena: ${p.price} zł\nOpis: ${desc}\nZdjęcie: ${img}\nLink: ${url}\n`;
    }).join("\n");

    // 4) system prompt
    const systemMessage = {
      role: "system",
      content: `
Jesteś doradcą klienta sklepu lalkametoo.pl.
Odpowiadaj na podstawie poniższej listy produktów (nazwa, cena, opis, zdjęcie, link).
Jeśli klient pyta o coś, czego nie ma – powiedz to uprzejmie.

Dostępne produkty:
${productDescriptions}
      `.trim()
    };

    // 5) wywołanie GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        systemMessage,
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    console.error("OpenAI error:", err);
    const code = err.code === "insufficient_quota" ? 429 : 500;
    return res.status(code).json({
      error: err.message || "Błąd serwera"
    });
  }
}
