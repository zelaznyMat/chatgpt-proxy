import OpenAI from "openai";
import fetch from "node-fetch"; // konieczne!

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Funkcja pobierająca produkty z Shopera
async function fetchProducts() {
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
  return data.list || [];  // zwraca tablicę produktów
}

// Funkcja prostego wyszukiwania pasujących produktów
function searchProducts(products, query) {
  query = query.toLowerCase();
  return products.filter(p => {
    const text = (p.name + ' ' + (p.short_description || '') + ' ' + (p.description || '')).toLowerCase();
    return text.includes(query);
  });
}

// Główna obsługa żądania
export default async function handler(req, res) {
  // CORS nagłówki
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Brak parametru message" });

  try {
    // 1. Pobieramy produkty
    const products = await fetchProducts();

    // 2. Wyszukujemy pasujące produkty
    let matchedProducts = searchProducts(products, message);
    if (matchedProducts.length === 0) {
      // jeśli nie znajdzie nic, weź kilka losowych produktów
      matchedProducts = products.slice(0, 5);
    } else {
      matchedProducts = matchedProducts.slice(0, 5); // max 5 produktów
    }

    // 3. Budujemy opis produktów
    const productDescriptions = matchedProducts.map(p => {
      const productUrl = `https://lalkametoo.pl/product/${p.product_id}`;
      const imgUrl = p.main_image ? p.main_image.path : "brak zdjęcia";
      return `- **${p.name}**\nCena: ${p.price} zł\nOpis: ${p.short_description || p.description || "brak opisu"}\nZdjęcie: ${imgUrl}\nLink: ${productUrl}\n`;
    }).join("\n\n");

    // 4. Przygotowujemy system prompt
    const systemMessage = {
      role: "system",
      content: `
Jesteś doradcą klienta sklepu lalkametoo.pl.
Na podstawie poniższych produktów odpowiedz klientowi uprzejmie i profesjonalnie.
Jeśli pytanie nie pasuje do żadnego produktu, wyjaśnij to uprzejmie.

Dostępne produkty:
${productDescriptions}
      `.trim()
    };

    const messages = [
      systemMessage,
      { role: "user", content: message }
    ];

    // 5. Wywołujemy ChatGPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error("OpenAI error:", error);
    return res.status(500).json({ error: "Błąd serwera: " + (error.message || "nieznany") });
  }
}
