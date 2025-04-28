// api/chat.js
import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 1. Funkcja pobierająca aktywne produkty
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
  return data.list || [];
}

// 2. Tokenowa, oceniająca trafność wyszukiwarka
function searchProducts(products, query) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 1);

  const scored = products.map(p => {
    const hay = (
      p.name + ' ' +
      (p.short_description || '') + ' ' +
      (p.description || '')
    ).toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score++;
    }
    return { product: p, score };
  });

  const matched = scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.product);

  return matched;
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
    // 1) Pobieramy produkty
    const products = await fetchProducts();

    // 2) Filtrujemy i wybieramy do 5 najlepszych
    let found = searchProducts(products, message);
    if (found.length === 0) {
      // gdy brak trafień → losowe 5 jako propozycje
      found = products.sort(() => 0.5 - Math.random()).slice(0, 5);
    } else {
      found = found.slice(0, 5);
    }

    // 3) Przygotowujemy tekst do prompta
    const productDescriptions = found.map(p => {
      const url = `https://lalkametoo.pl/product/${p.product_id}`;
      const img = p.main_image?.path || "";
      const desc = p.short_description || p.description || "– brak opisu –";
      return `- **${p.name}**\nCena: ${p.price} zł\nOpis: ${desc}\nZdjęcie: ${img}\nLink: ${url}`;
    }).join("\n\n");

    // 4) Nowy, ulepszony system prompt – zawsze prezentujemy listę produktów:
    const systemMessage = {
      role: "system",
      content: `
Jesteś doradcą klienta sklepu lalkametoo.pl.
Zawsze przedstaw poniższą listę produktów jako propozycje:
${productDescriptions}

Jeśli klient pyta o coś konkretnego, wskaż najbardziej pasujące produkty z tej listy. 
Jeżeli zapytanie nie pasuje dokładnie, zaproponuj alternatywy, podając nazwę, cenę, krótki opis, zdjęcie i link.
      `.trim()
    };

    // 5) Wywołujemy GPT-4
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
