const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// delay helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// VALIDAR CUIT
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

// limpiar html
function limpiar(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// score
function scoreMatch(busqueda, texto) {
  let score = 0;
  const palabras = busqueda.split(" ");

  for (let p of palabras) {
    if (texto.includes(p)) score++;
  }

  return score;
}

// extraer
function extraer(html, nombre) {

  const regex = /\d{2}-\d{8}-\d{1}/g;
  const matches = html.match(regex);

  if (!matches) return [];

  const resultados = [];

  matches.forEach(cuit => {

    if (!validarCUIT(cuit)) return;

    const idx = html.indexOf(cuit);
    let contexto = html.substring(idx - 200, idx + 200).toUpperCase();

    contexto = limpiar(contexto);

    resultados.push({
      cuit,
      contexto,
      score: scoreMatch(nombre, contexto)
    });

  });

  return resultados;
}

// ENDPOINT
app.get("/buscar", async (req, res) => {

  const nombre = (req.query.nombre || "").toUpperCase();

  try {

    const query = `site:cuitonline.com ${nombre}`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    // pequeño delay (evita 429)
    await sleep(2000);

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-AR,es;q=0.9",
        "Connection": "keep-alive"
      }
    });

    const html = response.data;

    const resultados = extraer(html, nombre);

    if (resultados.length === 0) {
      return res.json({ estado: "No encontrado" });
    }

    let mejor = resultados[0];

    resultados.forEach(r => {
      if (r.score > mejor.score) {
        mejor = r;
      }
    });

    res.json({
      estado: resultados.length > 1
        ? "Aproximado (múltiples CUIT)"
        : "Exacto",
      cuit: mejor.cuit,
      encontrado: mejor.contexto,
      opciones: resultados.length
    });

  } catch (err) {

    if (err.response?.status === 429) {
      return res.json({
        estado: "Bloqueado temporalmente (Google)",
        mensaje: "Reintentar en unos segundos"
      });
    }

    res.json({
      estado: "Error",
      error: err.message
    });
  }

});

app.listen(PORT, () => {
  console.log("Proxy funcionando ✅");
});
``
