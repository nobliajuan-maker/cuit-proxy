const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3000;

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

// SCORE
function scoreMatch(busqueda, nombre) {
  let score = 0;
  const palabras = busqueda.split(" ");

  for (let p of palabras) {
    if (nombre.includes(p)) score++;
  }

  return score;
}

// ENDPOINT
app.get("/buscar", async (req, res) => {

  const nombre = (req.query.nombre || "").toUpperCase();

  try {

    const url = `https://www.cuitonline.com/search/${encodeURIComponent(nombre)}`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    let resultados = [];

    $("a").each((_, el) => {

      const texto = $(el).text().toUpperCase();

      const match = texto.match(/\d{2}-\d{8}-\d{1}/);

      if (match) {

        const cuit = match[0];

        if (!validarCUIT(cuit)) return;

        resultados.push({
          nombre: texto,
          cuit: cuit
        });
      }
    });

    if (resultados.length === 0) {
      return res.json({ estado: "No encontrado" });
    }

    let mejor = null;
    let mejorScore = 0;

    resultados.forEach(r => {
      const score = scoreMatch(nombre, r.nombre);
      if (score > mejorScore) {
        mejor = r;
        mejorScore = score;
      }
    });

    res.json({
      estado: resultados.length > 1
        ? "Aproximado (varias opciones)"
        : "Exacto",
      encontrado: mejor.nombre,
      cuit: mejor.cuit,
      opciones: resultados.length
    });

  } catch (err) {
    res.json({
      estado: "Error",
      error: err.message
    });
  }

});

app.listen(PORT, () => {
  console.log("Proxy corriendo");
});