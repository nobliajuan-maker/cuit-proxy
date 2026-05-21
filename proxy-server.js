const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// ARCHIVO CACHE
const CACHE_FILE = "cache.json";

// cargar cache
function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE));
  } catch {
    return [];
  }
}

// guardar cache
function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

let cache = loadCache();

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

// limpiar texto
function limpiar(texto) {
  return texto.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

// localidad
function extraerLocalidad(texto) {

  const localidades = [
    "BUENOS AIRES",
    "CABA",
    "CIUDAD AUTONOMA",
    "CORDOBA",
    "ROSARIO",
    "SANTA FE",
    "MENDOZA",
    "TUCUMAN",
    "SALTA",
    "LA PLATA",
    "MAR DEL PLATA"
  ];

  for (let loc of localidades) {
    if (texto.includes(loc)) {
      return loc;
    }
  }

  return "";
}

// extraer resultados
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
      localidad: extraerLocalidad(contexto),
      score: scoreMatch(nombre, contexto)
    });

  });

  return resultados;
}

// buscar en cache
function buscarEnCache(nombre) {
  return cache.find(e => e.nombre === nombre);
}

// guardar en cache
function guardarEnCache(nombre, data) {

  const existe = buscarEnCache(nombre);

  if (!existe && data.cuit) {
    cache.push({
      nombre,
      ...data
    });

    saveCache(cache);
    console.log("Guardado en cache ✅", nombre);
  }
}

// ENDPOINT
app.get("/buscar", async (req, res) => {

  const nombre = (req.query.nombre || "").toUpperCase();

  // 🔥 1. BUSCAR EN CACHE
  const enCache = buscarEnCache(nombre);

  if (enCache) {
    return res.json({
      estado: "Cache",
      ...enCache,
      fuente: "cache"
    });
  }

  try {

    // 🔥 2. BUSCAR EN BING
    const query = `site:cuitonline.com ${nombre}`;
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
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

    const resultFinal = {
      nombre,
      cuit: mejor.cuit,
      encontrado: mejor.contexto,
      localidad: mejor.localidad,
      opciones: resultados.length,
      estado: resultados.length > 1
        ? "Aproximado (múltiples CUIT)"
        : "Exacto"
    };

    // 🔥 3. GUARDAR EN CACHE
    guardarEnCache(nombre, resultFinal);

    res.json(resultFinal);

  } catch (err) {
    res.json({
      estado: "Error",
      error: err.message
    });
  }

});

app.listen(PORT, () => {
  console.log("Proxy con cache funcionando ✅");
});
``
