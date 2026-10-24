import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'

export type ParsedTxn = {
  date: string                // YYYY-MM-DD
  description: string
  amount: number              // always positive
  type: 'EXPENSE' | 'INCOME'
  suggestedCategorySlug: string | null
  confidence: number          // 0..1
}

export type GeminiCategory = {
  slug: string
  name: string
  kind: 'EXPENSE' | 'INCOME'
}

const DEFAULT_MODEL = 'gemini-3.8-flash'

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    transactions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: {
            type: SchemaType.STRING,
            description: 'ISO date, format YYYY-MM-DD',
          },
          description: {
            type: SchemaType.STRING,
            description: 'Short merchant/payee description from the statement line',
          },
          amount: {
            type: SchemaType.NUMBER,
            description: 'Positive amount in rupees',
          },
          type: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['EXPENSE', 'INCOME'],
          },
          suggestedCategorySlug: {
            type: SchemaType.STRING,
            nullable: true,
            description: 'Best matching slug from the provided category list, or null if unsure',
          },
          confidence: {
            type: SchemaType.NUMBER,
            description: 'Confidence of the category suggestion, 0.0 to 1.0',
          },
        },
        required: ['date', 'description', 'amount', 'type', 'confidence'],
      },
    },
  },
  required: ['transactions'],
}

function buildPrompt(categories: GeminiCategory[]): string {
  const catList = categories.length
    ? categories.map((c) => `- ${c.slug}  —  "${c.name}"  (${c.kind})`).join('\n')
    : '(no categories defined)'

  return `You are an expert bank-statement parser for an Indian personal-finance app.

TASK
Analyze the attached bank statement and extract EVERY individual transaction. The statement may be a PDF (possibly multi-page, possibly a table), a CSV, or plain text.

For each transaction output:
- date: ISO calendar date in YYYY-MM-DD. Infer the year from the statement header if the row only shows DD/MM.
- description: a short, human readable merchant/payee (strip trailing reference numbers, UTR, long IDs — keep only the recognizable name). Example: "UPI-SWIGGY-1234567890" → "Swiggy".
- amount: positive number only. Never negative. Use the "type" field to indicate direction.
- type: "EXPENSE" if money LEFT the account (debit, withdrawal, payment, DR). "INCOME" if money ENTERED the account (credit, deposit, salary, received, CR).
- suggestedCategorySlug: pick the single best-matching slug from the CATEGORY LIST below. If none fit confidently, return null. NEVER invent a slug not in the list.
- confidence: 0.0 to 1.0. Use ≥0.85 only when you are very sure (e.g. "SWIGGY" → food is obvious). Use ≤0.5 for guesses. Use 0.0 and null slug if truly uncategorizable.

RULES
- Only use EXPENSE-kind categories for EXPENSE transactions, and INCOME-kind for INCOME transactions.
- Skip these rows entirely: opening balance, closing balance, carried-forward, running balance totals, page headers, summary totals, interest-earned summaries without a date, statement-period labels.
- If a row looks like an inter-account transfer (e.g. "SELF TRANSFER", "NEFT to own account"), still output it as EXPENSE with suggestedCategorySlug = null and low confidence — the user will reclassify.
- Return ALL transactions you find, in chronological order (oldest first). Do not deduplicate.
- Dates must be real: if a row is ambiguous, prefer DD/MM/YYYY (Indian format).

CATEGORY LIST (slug — name — kind):
${catList}

Return a single JSON object matching the required schema. No prose, no markdown.`
}

export async function parseStatementWithGemini(input: {
  fileData: string          // base64
  mimeType: string
  categories: GeminiCategory[]
}): Promise<{ transactions: ParsedTxn[]; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment')
  }

  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.1,
    },
  })

  const prompt = buildPrompt(input.categories)
  const parts: Array<
    | { inlineData: { mimeType: string; data: string } }
    | { text: string }
  > = []

  const mime = input.mimeType.toLowerCase()
  if (mime === 'application/pdf' || mime.startsWith('image/')) {
    parts.push({ inlineData: { mimeType: input.mimeType, data: input.fileData } })
  } else {
    const asText = Buffer.from(input.fileData, 'base64').toString('utf-8')
    const trimmed = asText.length > 180_000 ? asText.slice(0, 180_000) : asText
    parts.push({ text: `BANK STATEMENT CONTENT (${input.mimeType}):\n\n${trimmed}` })
  }
  parts.push({ text: prompt })

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
  })

  const text = result.response.text()
  let payload: { transactions: ParsedTxn[] }
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(
      `Gemini returned unparseable output. First 300 chars: ${text.slice(0, 300)}`,
    )
  }

  const txns = Array.isArray(payload?.transactions) ? payload.transactions : []
  const cleaned = txns
    .map((t) => normalizeTxn(t))
    .filter((t): t is ParsedTxn => t !== null)

  return { transactions: cleaned, modelUsed: modelName }
}

function normalizeTxn(t: Partial<ParsedTxn>): ParsedTxn | null {
  if (!t || typeof t !== 'object') return null
  const date = typeof t.date === 'string' ? t.date.trim() : ''
  const description = typeof t.description === 'string' ? t.description.trim() : ''
  const amount = typeof t.amount === 'number' ? Math.abs(t.amount) : NaN
  const type = t.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
  const confidence =
    typeof t.confidence === 'number' && isFinite(t.confidence)
      ? Math.max(0, Math.min(1, t.confidence))
      : 0
  const suggestedCategorySlug =
    typeof t.suggestedCategorySlug === 'string' && t.suggestedCategorySlug.trim()
      ? t.suggestedCategorySlug.trim()
      : null

  if (!date || !isValidIsoDate(date)) return null
  if (!description) return null
  if (!isFinite(amount) || amount <= 0) return null

  return { date, description, amount, type, suggestedCategorySlug, confidence }
}

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !isNaN(d.getTime())
}
