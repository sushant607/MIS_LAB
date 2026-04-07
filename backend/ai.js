const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');

const fetch = require('node-fetch');

// In-memory conversation store
const conversations = {};
const getHistory = (userId) => conversations[userId] || [];
const appendHistory = (userId, role, content) => {
  if (!conversations[userId]) conversations[userId] = [];
  conversations[userId].push({ role, content, ts: new Date().toISOString() });
  if (conversations[userId].length > 200) {
    conversations[userId] = conversations[userId].slice(-200);
  }
};

function buildMessages(userId, userText, userRole) {
  const system = new SystemMessage(`
You are an IT helpdesk assistant. Follow these rules strictly:
- The user you are currently interacting with is a ${userRole}. Treat them accordingly.

- Core behavior:
  - Be clear, and professional in all replies. Ask one or two focused questions at a time. Do not create tickets until all required fields are explicitly confirmed. Always prefer clarification over guessing.

- When the user asks for help or hints at an issue:
  1) Determine if the issue is ticket-worthy. If unsure, ask a brief clarifying question first. Suggest the creation of a ticket to the user and then upon confirmation, try to create one.
  2) Collect and confirm these fields before any ticket creation. Don't just ask, make your own suggestion alongside asking too:
     - Department: one of ['support team A','software team','network team','infrastructure team','hardware team','database team'].
     - Complaint details: a short title (1 line) and a brief description (2–4 lines).
     - Priority: one of ['low','medium','high','urgent']. If unspecified, ask; do not assume.
     - Role-aware assignment:
       -As soon as the department is selected and the role is manager/admin, immediately call fetchAssignees with department=<chosen>. Do this before asking for confirmation. Present the returned users as a numbered list, ask for a pick by number or user id, and store assignedTo. Only then proceed to the final summary and confirmation.
  3) Use a two-step confirmation:
     - Summarize the gathered fields back to the user and ask "Confirm to create the ticket?" with Yes/No options.
     - Only after an explicit Yes, call create_ticket with the confirmed values. If No, ask what to change.
  4) Feel free to infer the fields for the ticket based on what you think would be appropriate and suggest them to the user before creating the ticket
  5) Avoid doing everything in one message, use multiple replies like a normal conversation
  6) In case the user is a manager, make sure you call the fetch assignees tool and give the user a choice of ticket assignees before you create the ticket

- Constraints:
  - Employees: do not request assignedTo. Managers/Admins: require assignedTo and block creation until provided.
  - If the user asks non-ticket questions (e.g., status checks), use the appropriate tool but do not create tickets.
  - If the user says "create a ticket" without giving department and complaint details (and assignedTo for manager/admin), ask for those first and do not call create_ticket yet.
  - If you do call fetchRecommendedAssignees, call it only after you have enough context for the tickets. Make sure you ask the user whether they want some suggestions for assignees first

- Tool usage policy:
  - Only call create_ticket after explicit user confirmation and after all required fields are collected and validated. Include assignedTo only when the role is manager/admin.

- Response style:
  - Some examples to gather information. Do not use directly, instead paraphrase them:
    - "Available assignees for <Dept>: 1) <Name> (id=<id>) — <count> open 2) <Name> (id=<id>) — <count> open … Pick a number or paste the id."
  - Before the tool call, summarize:
    - "Summary: Dept=<X>, Title=<Y>, Desc=<Z>, Priority=<P>[, AssignedTo=<A>]. Confirm to create the ticket?"

Adhere to this flow on every ticket request. Do not bypass confirmation or required fields.
`);

  const historyTurns = getHistory(userId) || [];

  const history = historyTurns
    .map((turn) => {
      if (!turn || !turn.role || !turn.content) return null;
      if (turn.role === 'user') return new HumanMessage(String(turn.content));
      if (turn.role === 'assistant') return new AIMessage(String(turn.content));
      // Drop any accidental 'system' entries from history to satisfy Gemini
      return null;
    })
    .filter(Boolean);

  const current = new HumanMessage(String(userText || '').trim());

  // Ensure: exactly one system message at index 0
  const messages = [system, ...history, current].filter(Boolean);

  // Final guard: no SystemMessage after index 0
  const hasBadSystem = messages.slice(1).some(
    (m) => typeof m._getType === 'function' && m._getType() === 'system'
  );
  if (hasBadSystem) {
    // remove any stray system messages just in case
    return [system, ...history.filter(
      (m) => !(typeof m._getType === 'function' && m._getType() === 'system')
    ), current].filter(Boolean);
  }
  return messages;
}

const VALID_DEPARTMENTS = [
  'support team A',
  'software team',
  'network team',
  'infrastructure team',
  'hardware team',
  'database team',
];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Robust fetch across Node versions
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try { fetchFn = require('node-fetch'); }
  catch { console.error('Please install node-fetch'); process.exit(1); }
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const structuredModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  systemInstruction:
    `You are a helpdesk assistant designed to assist users. You will be asked for help with various technical issues. You must try to resolve trivial issues like login fails, connection issues, etc with helpful troubleshooting.
If the problem is more complex, suggest creating a ticket and help the user create a ticket using the create_ticket tool provided to you with the correct fields. Do not jump straight to creating a ticket, first ensure you gather all the relvant information and then
attempt to create a ticket. Ideally to create a ticket, you must have a description of the problem, the priority, the department to which the ticket should be assigned and some tags. Be helpful in your replies. Only create a ticket when you can't resolve the issue`,
});


const createTicketFunctionDeclarations = [
  {
    name: 'create_ticket',
    description: 'Create a helpdesk ticket from user text.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: VALID_PRIORITIES },
        department: {
          type: 'string',
          enum: VALID_DEPARTMENTS,
          description: 'Which team should handle this issue',
        },
      },
      required: ['title', 'description', 'priority', 'department'],
    },
  },
];

// Structured parse helper (returns { title, description, priority, department })
async function parseCreateTicketArgs(req, userText) {
  const userId = req.user?.id || 'anon';
  // Minimal ephemeral history; this parser is stateless for robustness
  const chat = structuredModel.startChat({
    tools: [{ functionDeclarations: createTicketFunctionDeclarations }],
    history: [{ role: 'user', parts: [{ text: String(userText || '') }] }],
  });

  const result = await chat.sendMessage(userText);
  const response = await result.response;
  const functionCalls = response.functionCalls?.() || [];

  if (!functionCalls.length || functionCalls[0].name !== 'create_ticket') {
    // Tolerate multi-turn flow while gathering fields
    throw new Error('Need more details before creating a ticket');
  }
  const args = functionCalls[0].args || {};

  // Basic normalization
  if (!args.title || !args.description || !args.priority || !args.department) {
    throw new Error('Incomplete ticket fields after parsing');
  }
  if (!VALID_PRIORITIES.includes(args.priority)) {
    throw new Error(`Invalid priority: ${args.priority}`);
  }
  if (!VALID_DEPARTMENTS.includes(args.department)) {
    throw new Error(`Invalid department: ${args.department}`);
  }
  return args;
}

// Helper to POST to your API
async function postTicketToAPI(req, payload) {
  const resp = await fetchFn('http://localhost:5000/api/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers.authorization || '',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Ticket API error: ${resp.status} ${resp.statusText} ${text}`.trim());
  }
  return resp.json().catch(() => ({}));
}

function summarizeTicket(args, apiResult) {
  const id = apiResult?.ticket_id || '(pending id)';
  return `Ticket created successfully.
ID: ${id}
Title: ${args.title}
Priority: ${args.priority}
Department: ${args.department}`;
}

// === TOOL DEFINITIONS ===

const queryMyTicketsRagTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context not available');

    const resp = await fetch(`${BASE.replace(/\/$/, '')}/api/upload/tickets/me/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || ''
      },
      body: JSON.stringify({
        query: String(input.query || '').trim(),
        topK: input.topK ?? 5
      }),
      credentials: 'include'
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(JSON.stringify(json));
    // Return compact structure; the model will ground answers on these snippets
    return {
      topK: json.topK,
      items: (json.results || []).map(r => ({
        text: r.text,
        source: r?.metadata?.url || r?.metadata?.filename || 'unknown',
        ticketId: r?.metadata?.ticketId,
        score: r?.score
      }))
    };
  },
  {
    name: 'queryMyTicketsRag',
    description: 'Retrieve the most relevant snippets from the current user’s ticket attachments already indexed for RAG. Provide me the exact quuery of user',
    schema: z.object({
      query: z.string().min(1, 'query is required'),
      topK: z.number().int().min(1).max(20).optional(),
    }),
  }
);

// Optional: index my assigned tickets (batch) before querying
const indexMyTicketsRagTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context not available');

    const resp = await fetch(`${BASE.replace(/\/$/, '')}/api/upload/tickets/me/rag/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || ''
      },
      body: JSON.stringify({
        project: input.project || 'tickets',
        size: input.size ?? 800,
        overlap: input.overlap ?? 150,
        reindex: input.reindex ?? false
      }),
      credentials: 'include'
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(JSON.stringify(json));
    return json;
  },
  {
    name: 'indexMyTicketsRag',
    description: 'Index attachments from tickets assigned to the current user into the vector store for RAG.',
    schema: z.object({
      project: z.string().optional(),
      size: z.number().int().min(200).max(2000).optional(),
      overlap: z.number().int().min(0).max(800).optional(),
      reindex: z.boolean().optional()
    }),
  }
);

// Tool: Connect Gmail (returns authorize URL)
const connectGmailTool = tool(
  async (_input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context missing');
    const r = await fetch('http://localhost:5000/api/gmail/auth/url', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: req.headers.authorization || '' 
      }
    });
    const text = await r.text();
    if (!r.ok) throw new Error(text);
    const { url } = JSON.parse(text);
    return `Open this link to connect Gmail: ${url}`;
  },
  {
    name: 'connectGmail',
    description: 'Generate a one-time Gmail consent URL for the current user.',
    schema: z.object({})
  }
);


// Tool: Fetch gmail mails (improved structure and filtering)
const fetchGmailTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context missing');
    
    try {
      console.log('📧 Fetching Gmail messages...');
      
      const requestBody = {
        limit: Math.min(input?.limit ?? 5, 5), // Cap at 10 as requested
        windowDays: input?.windowDays ?? 7,
        unreadOnly: input?.unreadOnly ?? false, // Changed default to false for better results
        forceBootstrap: input?.forceBootstrap ?? false
      };

      const r = await fetch('http://localhost:5000/api/gmail/fetch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: req.headers.authorization || '' 
        },
        body: JSON.stringify(requestBody)
      });

      if (!r.ok) {
        const errorText = await r.text();
        throw new Error(`Gmail fetch failed: ${r.status} - ${errorText}`);
      }

      const json = await r.json();
      const candidates = json.candidates || [];

      if (candidates.length === 0) {
        return "No emails found in your Gmail inbox for the specified criteria.";
      }

      // Enhanced filtering for "TICKET" keyword (case-insensitive, multiple variations)
      const ticketKeywords = ['ticket', 'TICKET', 'Ticket', 'support', 'SUPPORT', 'Support', 'issue', 'ISSUE', 'Issue'];
      const ticketEmails = candidates.filter(email => {
        if (!email.title && !email.subject) return false;
        
        const subject = (email.title || email.subject || '').toLowerCase();
        const body = (email.description || email.body || '').toLowerCase();
        
        // Check if any ticket keyword exists in subject or body
        return ticketKeywords.some(keyword => 
          subject.includes(keyword.toLowerCase()) || 
          body.includes(keyword.toLowerCase())
        );
      });

      // Structure the response for better readability
      const formatEmails = (emails, title) => {
        if (emails.length === 0) return '';
        
        const formatted = emails.slice(0, 10).map((email, index) => {
          const sender = email.sender || email.from || 'Unknown Sender';
          const subject = email.title || email.subject || 'No Subject';
          const date = email.date ? new Date(email.date).toLocaleDateString() : 'No Date';
          const snippet = (email.description || email.body || '').substring(0, 100) + '...';
          
          return `${index + 1}. **From:** ${sender}
   **Subject:** ${subject}
   **Date:** ${date}
   **Preview:** ${snippet}
   **ID:** ${email.id || 'N/A'}`;
        }).join('\n\n');

        return `## ${title} (${emails.length})\n\n${formatted}`;
      };

      let response = '';
      
      if (input?.ticketsOnly) {
        response = formatEmails(ticketEmails, 'Ticket-Related Emails');
        if (ticketEmails.length === 0) {
          response = "No ticket-related emails found. Emails are filtered by keywords: 'ticket', 'support', 'issue' in subject or body.";
        }
      } else {
        // Show all emails first, then ticket-related ones
        response = formatEmails(candidates, 'Recent Emails');
        
        if (ticketEmails.length > 0) {
          response += '\n\n---\n\n' + formatEmails(ticketEmails, 'Ticket-Related Emails Found');
          response += '\n\n💡 **Tip:** You can create tickets from these emails using the create tickets tool.';
        }
      }

      console.log(`📧 Successfully fetched ${candidates.length} emails, ${ticketEmails.length} ticket-related`);
      return response;

    } catch (error) {
      console.error('Gmail fetch error:', error);
      throw new Error(`Failed to fetch Gmail: ${error.message}`);
    }
  },
  {
    name: 'fetchGmail',
    description: 'Fetch recent Gmail messages in a structured format showing sender and subject. Automatically identifies ticket-related emails.',
    schema: z.object({
      limit: z.number().min(1).max(10).optional().describe('Number of emails to fetch (max 10, default 10)'),
      windowDays: z.number().min(1).max(30).optional().describe('Days back to search (default 7)'),
      unreadOnly: z.boolean().optional().describe('Only unread emails (default false)'),
      ticketsOnly: z.boolean().optional().describe('Only show ticket-related emails (default false)'),
      forceBootstrap: z.boolean().optional().describe('Force refresh from Gmail API (default false)')
    })
  }
);

// Enhanced helper function for better email parsing
function parseEmailForTicket(email) {
  const subject = email.title || email.subject || '';
  const body = email.description || email.body || '';
  const sender = email.sender || email.from || '';
  
  // Enhanced parsing logic
  let title = subject.replace(/^(re:|fwd?:|ticket:|support:|issue:)/i, '').trim();
  if (!title) {
    title = 'Email Support Request';
  }
  
  // Limit title length
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }
  
  // Create comprehensive description
  let description = '';
  
  if (sender) {
    description += `**From:** ${sender}\n`;
  }
  
  if (subject && subject !== title) {
    description += `**Original Subject:** ${subject}\n`;
  }
  
  if (email.date) {
    description += `**Date:** ${new Date(email.date).toLocaleString()}\n`;
  }
  
  description += '\n**Email Content:**\n';
  
  if (body) {
    // Clean up HTML and format body
    let cleanBody = body
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit description length
    if (cleanBody.length > 1500) {
      cleanBody = cleanBody.substring(0, 1497) + '...';
    }
    
    description += cleanBody;
  } else {
    description += '[No email content available]';
  }
  
  // Determine priority based on email content
  const urgentKeywords = ['urgent', 'emergency', 'critical', 'asap', 'immediately', 'down', 'outage', 'broken'];
  const highKeywords = ['important', 'priority', 'needed', 'required', 'problem', 'issue', 'error', 'failed'];
  
  const contentLower = (subject + ' ' + body).toLowerCase();
  let priority = 'medium';
  
  if (urgentKeywords.some(keyword => contentLower.includes(keyword))) {
    priority = 'urgent';
  } else if (highKeywords.some(keyword => contentLower.includes(keyword))) {
    priority = 'high';
  }
  
  // Determine department based on content
  const departmentKeywords = {
    'network team': ['network', 'wifi', 'ethernet', 'connection', 'internet', 'vpn', 'firewall'],
    'database team': ['database', 'sql', 'mysql', 'postgres', 'db', 'query', 'backup'],
    'infrastructure team': ['server', 'cloud', 'aws', 'deployment', 'hosting', 'infrastructure'],
    'hardware team': ['hardware', 'computer', 'laptop', 'printer', 'monitor', 'keyboard', 'mouse'],
    'software team': ['software', 'application', 'app', 'code', 'bug', 'development', 'programming'],
    'support team A': ['login', 'password', 'access', 'account', 'user', 'permission', 'authentication']
  };
  
  let department = 'support team A'; // default
  
  for (const [dept, keywords] of Object.entries(departmentKeywords)) {
    if (keywords.some(keyword => contentLower.includes(keyword))) {
      department = dept;
      break;
    }
  }
  
  return {
    title,
    description,
    priority,
    department,
    tags: ['Email'], // Add email tag
    originalEmail: {
      id: email.id,
      sender,
      subject,
      date: email.date
    }
  };
}

// Tool: Create tickets from Gmail with improved filtering and parsing
const createTicketsFromGmailTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context missing');

    try {
      console.log('🎫 Creating tickets from Gmail...');

      // 1. Fetch emails with expanded parameters
      const fetchBody = {
        limit: Math.min(input?.limit ?? 20, 50), // Allow more for filtering
        windowDays: input?.windowDays ?? 7,
        unreadOnly: input?.unreadOnly ?? false, // Changed default for better results
        forceBootstrap: input?.forceBootstrap ?? false
      };

      const fetchResp = await fetch('http://localhost:5000/api/gmail/fetch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: req.headers.authorization || '' 
        },
        body: JSON.stringify(fetchBody)
      });

      if (!fetchResp.ok) {
        const errText = await fetchResp.text();
        throw new Error(`Gmail fetch failed: ${fetchResp.status} - ${errText}`);
      }

      const fetchJson = await fetchResp.json();
      const allEmails = fetchJson.candidates || [];

      if (allEmails.length === 0) {
        return 'No emails found to process for ticket creation.';
      }

      // 2. Enhanced filtering for ticket-worthy emails
      const ticketKeywords = [
        'ticket', 'support', 'issue', 'problem', 'help', 'error', 
        'bug', 'broken', 'not working', 'failed', 'urgent', 'request'
      ];

      const ticketWorthyEmails = allEmails.filter(email => {
        const subject = (email.title || email.subject || '').toLowerCase();
        const body = (email.description || email.body || '').toLowerCase();
        const content = subject + ' ' + body;
        
        // Must contain at least one ticket keyword
        const hasTicketKeyword = ticketKeywords.some(keyword => 
          content.includes(keyword.toLowerCase())
        );
        
        // Additional filters
        const isNotAutoReply = !content.includes('auto-reply') && 
                               !content.includes('out of office') &&
                               !content.includes('vacation');
        
        const hasMinimumContent = content.length > 20;
        
        return hasTicketKeyword && isNotAutoReply && hasMinimumContent;
      });

      console.log(`📧 Found ${ticketWorthyEmails.length} ticket-worthy emails out of ${allEmails.length} total`);

      if (ticketWorthyEmails.length === 0) {
        return `Analyzed ${allEmails.length} emails but found none that appear to be ticket requests. 
Looking for keywords: ${ticketKeywords.join(', ')}
Try checking if emails contain support-related terms in subject or body.`;
      }

      // 3. Create tickets with enhanced error handling
      const results = {
        total: ticketWorthyEmails.length,
        successful: [],
        failed: [],
        details: []
      };

      for (const email of ticketWorthyEmails.slice(0, 10)) { // Limit to 10 tickets max
        try {
          const ticketData = parseEmailForTicket(email);
          
          // Add user-specified overrides
          if (input?.priority && ['low', 'medium', 'high', 'urgent'].includes(input.priority)) {
            ticketData.priority = input.priority;
          }
          if (input?.department) {
            ticketData.department = input.department;
          }
          if (input?.assignedTo) {
            ticketData.assignedTo = input.assignedTo;
          }

          console.log(`Creating ticket for email: ${ticketData.title}`);

          const ticketResp = await fetch('http://localhost:5000/api/tickets', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              Authorization: req.headers.authorization || '' 
            },
            body: JSON.stringify(ticketData)
          });

          const ticketJson = await ticketResp.json();

          if (ticketResp.ok) {
            results.successful.push({
              ticketId: ticketJson.ticket_id || ticketJson._id,
              title: ticketData.title,
              emailSender: ticketData.originalEmail.sender,
              priority: ticketData.priority,
              department: ticketData.department
            });
          } else {
            throw new Error(ticketJson.message || ticketJson.error || 'Unknown ticket creation error');
          }

        } catch (error) {
          console.error(`Failed to create ticket for email ${email.id}:`, error.message);
          results.failed.push({
            emailId: email.id,
            sender: email.sender || email.from,
            subject: email.title || email.subject,
            error: error.message
          });
        }
      }

      // 4. Format comprehensive response
      let response = `## 📧 Gmail Ticket Creation Results\n\n`;
      response += `**Processed:** ${results.total} ticket-worthy emails\n`;
      response += `**Successfully Created:** ${results.successful.length} tickets\n`;
      response += `**Failed:** ${results.failed.length} tickets\n\n`;

      if (results.successful.length > 0) {
        response += `### ✅ Successfully Created Tickets:\n`;
        results.successful.forEach((ticket, index) => {
          response += `${index + 1}. **ID:** ${ticket.ticketId}\n`;
          response += `   **Title:** ${ticket.title}\n`;
          response += `   **From:** ${ticket.emailSender}\n`;
          response += `   **Priority:** ${ticket.priority} | **Department:** ${ticket.department}\n\n`;
        });
      }

      if (results.failed.length > 0) {
        response += `### ❌ Failed Ticket Creation:\n`;
        results.failed.forEach((failed, index) => {
          response += `${index + 1}. **Email:** ${failed.subject}\n`;
          response += `   **From:** ${failed.sender}\n`;
          response += `   **Error:** ${failed.error}\n\n`;
        });
      }

      if (results.successful.length === 0 && results.failed.length > 0) {
        response += `\n💡 **Troubleshooting Tips:**\n`;
        response += `- Ensure emails contain clear problem descriptions\n`;
        response += `- Check if ticket creation permissions are properly set\n`;
        response += `- Verify department assignments are valid\n`;
      }

      return response;

    } catch (error) {
      console.error('Gmail ticket creation error:', error);
      throw new Error(`Failed to create tickets from Gmail: ${error.message}`);
    }
  },
  {
    name: 'createTicketsFromGmail',
    description: 'Fetch Gmail emails and automatically create tickets from support-related messages. Uses intelligent filtering and parsing.',
    schema: z.object({
      limit: z.number().min(1).max(50).optional().describe('Max emails to analyze (default 20)'),
      windowDays: z.number().min(1).max(30).optional().describe('Days back to search (default 7)'),
      unreadOnly: z.boolean().optional().describe('Only process unread emails (default false)'),
      forceBootstrap: z.boolean().optional().describe('Force refresh from Gmail (default false)'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Override priority for all tickets'),
      department: z.enum(['support team A', 'software team', 'network team', 'infrastructure team', 'hardware team', 'database team']).optional().describe('Override department for all tickets'),
      assignedTo: z.string().optional().describe('Assign all tickets to specific user ID (manager/admin only)')
    })
  }
);

// Tool: Fetch recommended assignees for a department (manager/admin flow)
const fetchRecommendedAssigneesTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context missing');
    const { department } = input || {};
    if (!department) throw new Error('department is required');

    const url = `http://localhost:5000/api/tickets/recommend-assignees?department=${encodeURIComponent(department)}`;
    const r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: req.headers.authorization || '' }
    });
    const json = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(json));

    const options = (json.recommendations || []).map((u, idx) => ({
      index: idx + 1,
      id: u._id,
      name: u.name,
      email: u.email,
      assignedCount: u.assignedTicketCount
    }));
    return {
      department,
      count: options.length,
      options,
      summary: options.length
        ? 'Here are a list of the recommended assignee\'s for this issue, whom would like to assign it to?\n' + options.map(o => `${o.index}) ${o.name} (id=${o.id}) — ${o.assignedCount} open`).join('\n')
        : 'No eligible assignees found for this department'
    };
  },
  {
    name: 'fetchRecommendedAssignees',
    description: 'Fetch top recommended assignees for a department to pick assignedTo (manager/admin only).only fetch employee under that department and not managers/admins',
    schema: z.object({ department: z.string() })
  }
);

const fetchMyTicketsTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error("Request context not available");

    try {
      console.log('🔧 Fetching user tickets...');
      const headers = { 'Authorization': req.headers.authorization };
      const query = new URLSearchParams({ scope: 'me' });

      if (input.status) query.append('status', input.status);
      if (input.priority) query.append('priority', input.priority);
      if (input.keywords?.length > 0) query.append('keywords', input.keywords.join('+'));
      
      const response = await fetch(`http://localhost:5000/api/tickets?${query.toString()}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tickets = data.tickets || [];
      
      if (tickets.length === 0) {
        return "No tickets found for you";
      }
      
      // Sort tickets by createdAt descending (most recent first)
      const sorted = [...tickets].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0);
        const dateB = new Date(b.createdAt || b.created_at || 0);
        return dateB - dateA;
      });

      const recent = sorted.slice(0, 5);

      const ticketLines = recent.map((t, idx) =>
        `${idx + 1}. [ID: ${t.ticket_id || t._id || 'N/A'}] "${t.title}" | Priority: ${t.priority} | Status: ${t.status}`
      ).join('\n');

      const summary = `You have ${tickets.length} ticket(s).\nMost recent tickets:\n${ticketLines}`;

      console.log('User tickets fetched successfully');
      return summary;
    } catch (error) {
      console.error('Error fetching user tickets:', error.message);
      throw error;
    }
  },
  {
    name: "fetchMyTickets",
    description: "Fetches tickets assigned to or created by the current user",
    schema: z.object({
      status: z.string().optional().describe("Filter by status: 'open', 'in_progress', 'resolved'"),
      priority: z.string().optional().describe("Filter by priority: 'low', 'medium', 'high', 'urgent'"),
      keywords: z.array(z.string()).optional().describe("Filter by tickets having certain keywords(max 3)")
    }),
  }
);

const fetchTeamTicketsTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error("Request context not available");

    try {
      // Check permissions
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return "Sorry, only managers and admins can view team tickets.";
      }
      
      console.log('🔧 Fetching team tickets...');
      const headers = { 'Authorization': req.headers.authorization };
      const query = new URLSearchParams({ scope: 'team' });
      
      if (input.status) query.append('status', input.status);
      if (input.priority) query.append('priority', input.priority);
      if (input.keywords?.length > 0) query.append('keywords', input.keywords.join('+'));
      
      const response = await fetch(`http://localhost:5000/api/tickets?${query.toString()}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tickets = data.tickets || [];
      
      if (tickets.length === 0) {
        return "No tickets found for your team.";
      }
      
      // Sort tickets by createdAt descending (most recent first)
      const sorted = [...tickets].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0);
        const dateB = new Date(b.createdAt || b.created_at || 0);
        return dateB - dateA;
      });

      const recent = sorted.slice(0, 5);

      const ticketLines = recent.map((t, idx) =>
        `${idx + 1}. "${t.title}" | Priority: ${t.priority} | Status: ${t.status}`
      ).join('\n');

      const summary = `You have ${tickets.length} ticket(s).\nMost recent tickets:\n${ticketLines}`;
      
      console.log('Team tickets fetched successfully');
      return summary;
    } catch (error) {
      console.error('Error fetching team tickets:', error.message);
      throw error;
    }
  },
  {
    name: "fetchTeamTickets",
    description: "Fetches tickets for the user's team/department (managers and admins only)",
    schema: z.object({
      status: z.string().optional().describe("Filter by status: 'open', 'in_progress', 'resolved'"),
      priority: z.string().optional().describe("Filter by priority: 'low', 'medium', 'high', 'urgent'"),
      keywords: z.array(z.string()).optional().describe("Filter by tickets having certain keywords(max 3)")
    }),
  }
);

// New LangChain tool (keeps existing tools unchanged)
const createTicketTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    const rawUserMessage = config?.configurable?.rawUserMessage || '';
    if (!req) throw new Error('Request context not available');

    // If args are incomplete, parse them from the user message via Structured API
    let args = { ...input };
    const needParse =
      !args.title || !args.description || !args.priority || !args.department;

    if (needParse) {
      if (!rawUserMessage) throw new Error('Missing user message for parsing');
      args = await parseCreateTicketArgs(req, rawUserMessage);
    }

    // Guard for manager/admin: assignedTo must be provided
    if ((req.user.role === 'manager' || req.user.role === 'admin') && !args.assignedTo) {
      throw new Error('assignedTo required for manager/admin before creating ticket');
    }

    // POST to API (server enforces RBAC/department policy)
    const result = await postTicketToAPI(req, args);
    return summarizeTicket(args, result);
  },
{
    name: 'createTicket',
    description:
      'Create a helpdesk ticket. Use only when you have all the relevant information and the user explicitly requests the creation of a ticket.',
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      tags: z.array(z.enum(['VPN', 'Database', 'Installation', 'General', 'Wifi/Ethernet', 'Authentication']))
              .optional().describe("Tags describing the issue of the ticket, max 3"),
      department: z.enum([
        'support team A',
        'software team',
        'network team',
        'infrastructure team',
        'hardware team',
        'database team',
      ]).optional(),
      assignedTo: z.string().optional().describe("Only use when user is a manager, should contain the ID of an employee to assign the ticket to")
    }),
  }
);

// === MAIN CHATBOT SETUP ===

function setupChatbotRoutes(app) {
  console.log('🚀 Initializing AI Chatbot...');

  // Create tools map for easy access
const toolsMap = {
  fetchMyTickets: fetchMyTicketsTool,
  fetchTeamTickets: fetchTeamTicketsTool,
  createTicket: createTicketTool,
  connectGmail: connectGmailTool,
  fetchGmail: fetchGmailTool,
  createTicketsFromGmail: createTicketsFromGmailTool,
  // retrieveDocuments: retrieveDocumentsTool,
  // ingestDocuments: ingestDocumentsTool,
  fetchRecommendedAssignees: fetchRecommendedAssigneesTool,
  queryMyTicketsRag: queryMyTicketsRagTool,
  indexMyTicketsRag: indexMyTicketsRagTool
};

const llm = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  temperature: 0.1,
  apiKey: process.env.GOOGLE_API_KEY
}).withConfig({
  tools: [
    // retrieveDocumentsTool,
    // ingestDocumentsTool,
    fetchRecommendedAssigneesTool,
    fetchMyTicketsTool,
    fetchTeamTicketsTool,
    createTicketTool,
    connectGmailTool,
    fetchGmailTool,
    createTicketsFromGmailTool,
    queryMyTicketsRagTool,
    indexMyTicketsRagTool
  ]
});


  app.post("/api/ai-chat", async (req, res) => {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: "Message is required as a non-empty string." });
    }
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
  
    appendHistory(userId, "user", message.trim());
  
    try {
      const messages = buildMessages(userId, message, userRole);

      // just making sure
      const types = messages.map((m) => (typeof m._getType === 'function' ? m._getType() : 'unknown'));
      // If the first isn’t 'system' or any other 'system' appears later, bail fast:
      if (types[0] !== 'system' || types.slice(1).includes('system')) {
        console.error('Invalid message order/types:', types);
        return res.json({
          reply: 'Internal error: prompt ordering issue. Please try again.',
          error: 'System message must be first and only one system message allowed',
          timestamp: new Date().toISOString()
        });
      }
      const response = await llm.invoke(messages, { configurable: { req } });
  
      const toolCalls = response.tool_calls || [];
      if (toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        const toolName = toolCall.name;
        const toolArgs = toolCall.args || {};
      
        if (toolsMap[toolName]) {
          try {
            const toolResult = await toolsMap[toolName].invoke(toolArgs, {
              configurable: { req, rawUserMessage: message },
            });
      
            const reply = typeof toolResult === 'string'
              ? toolResult
              : (toolResult?.summary || JSON.stringify(toolResult));
      
            appendHistory(userId, 'assistant', reply);
            return res.json({ reply, toolUsed: toolName, timestamp: new Date().toISOString() });
          } catch (toolError) {
            const errorReply = `I encountered an error: ${toolError.message}`;
            appendHistory(userId, 'assistant', errorReply);
            return res.json({ reply: errorReply, error: toolError.message, timestamp: new Date().toISOString() });
          }
        }
      }  
      const reply = typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0]?.text || "I'm here to help with your tickets!")
          : "I'm here to help with your tickets!";
      appendHistory(userId, "assistant", reply);
      return res.json({ reply, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("AI Chat Error:", err);
      const reply = "I'm sorry, I'm having trouble processing your request right now. Please try again.";
      return res.json({ reply, error: err.message, timestamp: new Date().toISOString() });
    }
  });
  
  console.log('AI Chatbot setup complete');
}

module.exports = { setupChatbotRoutes };
