// embedding.js
const { HuggingFaceTransformersEmbeddings } = require('@langchain/community/embeddings/huggingface_transformers');

// Xenova models run fully local via transformers.js
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: 'Xenova/all-MiniLM-L6-v2', // small, fast, 384-dim
  // optional: device: 'cpu'
});

async function embedQuery(text) {
  return embeddings.embedQuery(text); // returns number[] for single text
}

async function embedDocuments(texts) {
  return embeddings.embedDocuments(texts); // returns number[][]
}

module.exports = { embedQuery, embedDocuments };
