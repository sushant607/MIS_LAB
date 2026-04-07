const express = require('express');
const getCollection = require("../config/Chroma");

const router = express.Router();

  
// POST /api/documents
// Add/upload documents with text and metadata, including embeddings array
router.post('/',  async (req, res) => {
  try {
    const { ids, documents, metadatas } = req.body;
    if (!Array.isArray(ids) || !Array.isArray(documents) || !Array.isArray(metadatas)) {
      return res.status(400).json({ error: 'ids, documents, metadatas must be arrays' });
    }

    const collection = await getCollection();
    // console.log(collection);
    await collection.add({
      ids,
      documents,
      metadatas,
    });

    res.json({
      message: 'Documents added successfully',
      count: documents.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message || String(error),
    });
  }
});

// POST /api/documents/search
// Search documents by embedding similarity; expects "embedding" and optional "project"
router.post("/search", async (req, res) => {
  try {
    const { embedding, project, topK = 5 } = req.body;
    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: 'embedding must be a vector array' });
    }

    const collection = await getCollection();

    const queryResult = await collection.query({
      queryEmbeddings: [embedding],
      nResults: topK,
      where: project ? { project } : undefined,
    });

    res.json(queryResult);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message || String(error),
    });
  }
});

module.exports = router;

