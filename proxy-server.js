const express = require("express");
const axios = require("axios");

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
function scoreMatch(busqueda, texto) {
  let score = 0;
  const palabras = busqueda.split(" ");

  for (let p of palabras) {
    if (texto.includes(p)) score++;
  }

  return score;
}

// EXTRAER CUITS
function extraer(html, nombre) {

  const regex = /\d{2}-\d{8}-\d{1}/g;
  const matches = html.match(regex);

  if (!matches) return [];

  const resultados = [];

  matches.forEach(cuit => {

    if (!validarCUIT(cuit)) return;

    const index = html.indexOf(cuit);
    const contexto = html.substring(index - 150, index + 150).toUpperCase();

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

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
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
  console.log("Proxy funcionando ✅");
});
