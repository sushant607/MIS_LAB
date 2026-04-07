const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const pdf = require('pdf-parse');
const { HuggingFaceTransformersEmbeddings } = require('@langchain/community/embeddings/huggingface_transformers');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const getCollection = require('../config/Chroma');
const parser = require("../upload");
const { log } = require('console');

// Existing upload route (keep as-is)
router.post("/", parser.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });
    res.json({
      url: req.file.path,
      public_id: req.file.filename,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error('Upload route error:', error);
    res.status(500).json({ msg: "Server error during file upload", error: error.message });
  }
});

// ---------- IMPROVED RAG HELPERS ----------
function normalizeTicketsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.tickets)) return payload.tickets;
  return [];
}

async function fetchAssignedTickets(authHeader, baseUrl) {
  const url = `${(baseUrl || 'http://localhost:5000').replace(/\/$/, '')}/api/tickets?scope=me`;
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
    credentials: 'include',
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Tickets fetch failed (${r.status}): ${t}`);
  }
  return normalizeTicketsPayload(await r.json());
}

async function downloadBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function extractFromPdf(url) {
  const buf = await downloadBuffer(url);
  const data = await pdf(buf);
  return data.text || '';
}

async function extractFromTextLike(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
  return await r.text();
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// IMPROVED: Better text cleaning and preprocessing
function cleanAndNormalizeText(text) {
  return text
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/[^\w\s\-.,!?()]/g, ' ')       // Remove special chars but keep basic punctuation
    .replace(/\b\w{1}\b/g, '')              // Remove single character words
    .replace(/\s+/g, ' ')                   // Clean up extra spaces again
    .trim()
    .toLowerCase();                         // Normalize case for better matching
}

// IMPROVED: Better extraction with metadata preservation
async function extractTextFromUrl(url, filename) {
  const lower = (filename || '').toLowerCase();
  let rawText = '';
  
  if (lower.endsWith('.pdf')) {
    rawText = await extractFromPdf(url);
  } else if (lower.endsWith('.txt') || lower.endsWith('.html') || lower.endsWith('.md')) {
    const txt = await extractFromTextLike(url);
    rawText = lower.endsWith('.html') ? stripHtml(txt) : txt;
  } else {
    try { 
      rawText = await extractFromTextLike(url); 
    } catch { 
      return { text: '', metadata: {} }; 
    }
  }

  // Extract metadata from content structure
  const lines = rawText.split('\n');
  const metadata = {
    hasHeadings: /^#+\s|^[A-Z\s]+$/.test(rawText),
    hasNumbers: /\d+/.test(rawText),
    hasCodeBlocks: /```|<code>/.test(rawText),
    lineCount: lines.length,
    wordCount: rawText.split(/\s+/).length
  };

  return {
    text: rawText,
    cleanText: cleanAndNormalizeText(rawText),
    metadata
  };
}

// IMPROVED: Semantic chunking with overlap and context preservation
function semanticChunkText(text, { size = 600, overlap = 100, minChunkSize = 150 } = {}) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';
  let currentSize = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    const sentenceSize = sentence.length;

    // If adding this sentence would exceed size, finalize current chunk
    if (currentSize + sentenceSize > size && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.trim());
      
      // Create overlap by including last few sentences
      const overlapSentences = sentences.slice(Math.max(0, i - 2), i);
      currentChunk = overlapSentences.join(' ') + ' ';
      currentSize = currentChunk.length;
    }

    currentChunk += sentence + ' ';
    currentSize += sentenceSize + 1;
  }

  // Add final chunk if it has content
  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  }

  // Fallback to simple chunking if semantic chunking produces too few chunks
  if (chunks.length === 0 && text.length > minChunkSize) {
    return simpleChunkText(text, { size, overlap });
  }

  return chunks;
}

function simpleChunkText(text, { size = 600, overlap = 100 } = {}) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, Math.min(i + size, text.length)));
    i += Math.max(1, size - overlap);
  }
  return chunks;
}

let EMB;
function getEmbeddings() {
  if (!EMB) {
    EMB = new HuggingFaceTransformersEmbeddings({ 
      model: 'Xenova/all-MiniLM-L6-v2',
      // You could also try: 'Xenova/all-mpnet-base-v2' for better quality (but slower)
    });
  }
  return EMB;
}

// IMPROVED: Enhanced indexing with better metadata and duplicate detection
async function ensureUserIndex({ tickets, userId, project, size = 600, overlap = 100, reindex }) {
  const collection = await getCollection();
  
  if (reindex) {
    try {
      const existing = await collection.get();
      const idsToDelete = (existing?.ids || []).filter(id => id.includes(`:u:${userId}:`));
      if (idsToDelete.length) await collection.delete({ ids: idsToDelete });
    } catch (e) {
      console.warn('Reindex delete warning:', e?.message);
    }
  }

  const chunks = [];
  const seen = new Set();
  const contentHashes = new Set(); // Prevent duplicate content
  
  for (const ticket of tickets) {
    const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
    
    for (let ai = 0; ai < attachments.length; ai++) {
      const a = attachments[ai];
      const url = typeof a === 'string' ? a : a?.url;
      const filename = typeof a === 'string' ? undefined : a?.filename;
      console.log(a);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      
      try {
        const { text, cleanText, metadata: extractMetadata } = await extractTextFromUrl(url, filename);
        
        if (!text?.trim() || text.length < 50) continue;

        // Create content hash to avoid duplicate content from different URLs
        const contentHash = require('crypto').createHash('md5').update(cleanText).digest('hex');
        if (contentHashes.has(contentHash)) continue;
        contentHashes.add(contentHash);

        // Use semantic chunking for better coherent pieces
        const parts = semanticChunkText(text, { size, overlap });
        
        parts.forEach((part, pi) => {
          const chunkClean = cleanAndNormalizeText(part);
          if (chunkClean.length < 50) return; // Skip very short chunks
          
          chunks.push({
            id: `${String(ticket._id || ticket.id)}:a${ai}:p${pi}:u:${userId}`,
            text: part, // Original text for display
            searchText: chunkClean, // Cleaned text for embedding
            metadata: {
              project: project || 'tickets',
              userId: String(userId),
              ticketId: String(ticket._id || ticket.id),
              ticketTitle: ticket.title || ticket.name || 'Untitled',
              ticketDescription: (ticket.description || '').substring(0, 200),
              url, 
              filename: filename || null,
              chunkIndex: pi,
              totalChunks: parts.length,
              contentType: (filename || '').split('.').pop()?.toLowerCase() || 'unknown',
              ...extractMetadata
            },
          });
        });
      } catch (e) {
        console.warn(`Failed to extract from ${filename}:`, e.message);
      }
    }
  }

  if (!chunks.length) return { added: 0 };

  // Use cleaned text for embeddings but store original for display
  const vectors = await getEmbeddings().embedDocuments(chunks.map(c => c.searchText));
  await collection.add({
    ids: chunks.map(c => c.id),
    documents: chunks.map(c => c.text), // Store original text
    metadatas: chunks.map(c => c.metadata),
    embeddings: vectors,
  });
  
  return { added: chunks.length };
}

// IMPROVED: Query expansion and better retrieval
async function expandQuery(originalQuery) {
  // Simple query expansion - add common synonyms and variations
  const expansions = {
    'error': ['error', 'issue', 'problem', 'bug', 'failure'],
    'fix': ['fix', 'solve', 'resolve', 'repair', 'solution'],
    'install': ['install', 'setup', 'configure', 'deploy'],
    'login': ['login', 'authentication', 'auth', 'signin', 'access'],
    'database': ['database', 'db', 'sql', 'data', 'table'],
    'api': ['api', 'endpoint', 'service', 'rest', 'http'],
    'user': ['user', 'account', 'profile', 'customer', 'client']
  };

  const words = originalQuery.toLowerCase().split(/\s+/);
  const expandedWords = new Set(words);

  words.forEach(word => {
    Object.entries(expansions).forEach(([key, synonyms]) => {
      if (synonyms.includes(word)) {
        synonyms.forEach(syn => expandedWords.add(syn));
      }
    });
  });

  return Array.from(expandedWords).join(' ');
}

// ---------- MAIN IMPROVED RAG ENDPOINT ----------
router.post('/tickets/me/rag/query', async (req, res) => {
  try {
    const { 
      query, 
      topK = 8,  // Increased from 5 
      project = 'tickets', 
      size = 600, // Reduced chunk size for better precision
      overlap = 100, // Reduced overlap
      reindex = false, 
      ensureIndex = true,
      useQueryExpansion = true
    } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }

    const userId = String(req.user?.id || 'anon');
    const authHeader = req.headers.authorization;
    const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';

    console.log('RAG Query:', { query, userId, ensureIndex });

    // 1) Fetch assigned tickets
    const tickets = await fetchAssignedTickets(authHeader, baseUrl);
    console.log('Tickets found:', tickets.length);

    // 2) Ensure index if requested
    if (ensureIndex) {
      const indexResult = await ensureUserIndex({ tickets, userId, project, size, overlap, reindex });
      console.log('Index result:', indexResult);
    }

    // 3) IMPROVED: Query expansion and multiple search strategies
    const expandedQuery = useQueryExpansion ? await expandQuery(query) : query;
    const cleanQuery = cleanAndNormalizeText(query);
    
    console.log('Original query:', query);
    console.log('Expanded query:', expandedQuery);
    console.log('Clean query:', cleanQuery);

    const collection = await getCollection();
    
    // Try multiple search approaches and combine results
    const searchQueries = [
      cleanQuery,           // Cleaned original
      query.toLowerCase(),  // Simple lowercase
      ...(expandedQuery !== query ? [expandedQuery] : []) // Expanded if different
    ];

    let allResults = [];
    
    for (const searchQuery of searchQueries) {
      try {
        const qvec = await getEmbeddings().embedQuery(searchQuery);
        const results = await collection.query({
          queryEmbeddings: [qvec],
          nResults: Math.ceil(Number(topK) * 1.5), // Get more results per query
          where: { userId },
        });

        if (results?.documents?.[0]?.length) {
          const docs = results.documents[0];
          const metas = results.metadatas[0];
          const distances = results.distances?.[0] || [];
          
          docs.forEach((doc, i) => {
            allResults.push({
              document: doc,
              metadata: metas[i],
              distance: distances[i] || 1,
              query: searchQuery
            });
          });
        }
      } catch (e) {
        console.warn(`Search failed for query: ${searchQuery}`, e.message);
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = new Map();
    allResults.forEach(result => {
      const id = result.metadata?.ticketId + ':' + result.metadata?.url + ':' + result.metadata?.chunkIndex;
      if (!uniqueResults.has(id) || uniqueResults.get(id).distance > result.distance) {
        uniqueResults.set(id, result);
      }
    });

    const finalResults = Array.from(uniqueResults.values())
      .sort((a, b) => (a.distance || 1) - (b.distance || 1))
      .slice(0, topK);

    if (!finalResults.length) {
      return res.json({
        query, topK, ticketsCount: tickets.length,
        answer: 'No relevant information found in assigned ticket attachments. Try rephrasing your question or check if the relevant documents are attached to your tickets.',
        sources: [],
      });
    }

    // 4) IMPROVED: Better context preparation and answer generation
    const model = new ChatGoogleGenerativeAI({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.1, // Lower temperature for more focused answers
    });

    // Create rich context with metadata
    const contextParts = finalResults.map((result, i) => {
      const meta = result.metadata;
      const doc = result.document;
      
      return `[Source ${i + 1}] ${meta.ticketTitle ? `Ticket: "${meta.ticketTitle}"` : ''} ${meta.filename ? `File: ${meta.filename}` : ''}\n${doc.substring(0, 800)}`;
    });

    const context = contextParts.join('\n\n---\n\n');

    // Enhanced system prompt
    const systemPrompt = `You are a helpful assistant analyzing technical documentation and ticket attachments. 

INSTRUCTIONS:
- Answer based ONLY on the provided context from ticket attachments
- Be specific and provide actionable information when possible
- Reference sources using [1], [2], etc. format
- If the context doesn't contain enough information, say so clearly
- Focus on practical solutions and troubleshooting steps
- Maintain technical accuracy`;

    const userPrompt = `Context from ticket attachments:
${context}

User Question: ${query}

Please provide a comprehensive answer based on the context above. Include specific references to sources [1], [2], etc. If you need more information, suggest what type of documentation might help.`;

    const sys = { role: 'system', content: systemPrompt };
    const usr = { role: 'user', content: userPrompt };
    
    const resp = await model.invoke([sys, usr]);
    const answer = typeof resp?.content === 'string' ? resp.content : (resp?.content?.[0]?.text || '');

    // Enhanced source information
    const sources = finalResults.map((result, i) => ({
      index: i + 1,
      url: result.metadata?.url || null,
      filename: result.metadata?.filename || null,
      ticketId: result.metadata?.ticketId || null,
      ticketTitle: result.metadata?.ticketTitle || null,
      contentType: result.metadata?.contentType || null,
      chunkIndex: result.metadata?.chunkIndex || 0,
      relevanceScore: result.distance ? (1 - result.distance).toFixed(3) : null
    }));

    return res.json({ 
      query, 
      expandedQuery: useQueryExpansion ? expandedQuery : undefined,
      topK, 
      ticketsCount: tickets.length, 
      answer, 
      sources,
      searchStrategies: searchQueries.length
    });

  } catch (e) {
    console.error('RAG query failed:', e);
    return res.status(500).json({ error: 'Query failed', details: e.message });
  }
});

module.exports = router;