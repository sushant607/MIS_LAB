// config/chroma.js
const { CloudClient } = require("chromadb");
require("dotenv").config();

// const client = new ChromaClient({
//   apiKey: process.env.CHROMA_API_KEY,
//   baseUrl: "https://cloud.chromadb.com",  // Chroma Cloud URL
//   tenant: process.env.CHROMA_TENANT
// });

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY,
  tenant:  process.env.CHROMA_TENANT,
  database: 'SIH'
});

// getOrCreateCollection is async and returns the collection
async function getCollection() {
  return await client.getOrCreateCollection({
    name: process.env.CHROMA_DATABASE,
  });
}

module.exports = getCollection;
