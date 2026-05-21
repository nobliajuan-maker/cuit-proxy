const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// validar CUIT
function validarCUIT(cuit) {
  const clean = cuit.replace(/-/g, "");
  if (clean.length !== 11) return false;

  const mult = [5,4,3,2,7,6,5,4,3,2];
  let total = 0;

  for (let i=0; i<10; i++) {
    total += parseInt(clean[i]) * mult[i];
  }

  let mod = 11 - (total % 11);
  if (mod === 11) mod = 0;
  if (mod === 10) mod = 9;

  return mod === parseInt(clean[10]);
}

// extraer cuit del html
function extraerCUIT(html) {

  const regex = /\d{2}-\d{8}-\d{1}/g;
  const matches = html.match(regex);

  if (!matches) return null;

  for (let cuit of matches) {
    if (validarCUIT(cuit)) {
      return cuit;
    }
  }

  return null;
}

// endpoint
app.get("/buscar", async (req, res) => {

  const nombre = (req.query.nombre || "");

  try {

    // 🔹 1. BUSCAR EN BING
    const query = `site:cuitonline.com ${nombre}`;
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    const searchRes = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = searchRes.data;

    // 🔹 2. EXTRAER LINK DE CUITONLINE
    const linkMatch = html.match(/https:\/\/www\.cuitonline\.com\/detalle\/[^\"]+/);

    if (!linkMatch) {
      return res.json({ estado: "No encontrado (sin link)" });
    }

    const link = linkMatch[0];

    // 🔹 3. ENTRAR AL LINK
    const pageRes = await axios.get(link, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const htmlDetalle = pageRes.data;

    // 🔹 4. EXTRAER CUIT
    const cuit = extraerCUIT(htmlDetalle);

    if (!cuit) {
      return res.json({ estado: "No encontrado (sin cuit en página)" });
    }

    res.json({
      estado: "Exacto",
      cuit,
      fuente: "cuitonline",
      link
    });

  } catch (err) {

    res.json({
      estado: "Error",
      error: err.message
    });
  }

});

app.listen(PORT, () => {
  console.log("Proxy scraping profundo ✅");
});

