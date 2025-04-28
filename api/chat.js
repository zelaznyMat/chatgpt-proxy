  // … wcześniejsze importy i fetchProducts …

  // 2. Tokenowa, lepsza wyszukiwarka produktów
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
    // … CORS i walidacja …

    // 1) Pobieramy wszystkie aktywne produkty
    const products = await fetchProducts();

    // 2) Szukamy pasujących produktów po tokenach
    let found = searchProducts(products, message);
    if (found.length === 0) {
      // jeśli nic nie trafiło, daj 5 losowych
      found = products.sort(() => 0.5 - Math.random()).slice(0,5);
    } else {
      found = found.slice(0,5);
    }

    // … dalej budujesz productDescriptions i wywołujesz GPT-4 …
