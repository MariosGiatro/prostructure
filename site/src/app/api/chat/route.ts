import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_API_KEY = "AIzaSyCPo5I7BxKFfwOJ7DW97-rs0AOyrrg99X0";
const MODEL = "gemini-3.1-flash-lite-preview";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ── Tool declarations ───────────────────────────────────────────────

const searchProteinDeclaration = {
  name: "search_protein",
  description:
    "Search the UniProt database for proteins matching a free-text query. " +
    "Useful for finding proteins by name, gene, disease, organism, function, etc. " +
    "Returns a list of matching protein entries with accession IDs, names, genes, and organisms.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description:
          'Free-text search query for UniProt, e.g. "insulin human", "BRCA1", "kinase AND organism_id:9606".',
      },
      limit: {
        type: Type.NUMBER,
        description: "Maximum number of results to return (1-25). Default 5.",
      },
    },
    required: ["query"],
  },
};

const getProteinDeclaration = {
  name: "get_protein",
  description:
    "Fetch full details for a single protein from UniProt by its accession ID (e.g. P01308, Q9Y6K9). " +
    "Returns protein name, gene, organism, function, sequence length, subcellular location, " +
    "and available 3D structures from PDB.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      accession: {
        type: Type.STRING,
        description: "UniProt accession ID, e.g. P01308.",
      },
    },
    required: ["accession"],
  },
};

const tools = [
  { functionDeclarations: [searchProteinDeclaration, getProteinDeclaration] },
];

// ── UniProt tool implementations ────────────────────────────────────

async function searchProtein(query: string, limit = 5) {
  const size = Math.min(Math.max(limit, 1), 25);
  const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}&size=${size}&format=json&fields=accession,protein_name,gene_names,organism_name,length`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    return { error: `UniProt search failed: ${res.status} ${res.statusText}` };
  }
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (data.results ?? []).map((entry: any) => ({
    accession: entry.primaryAccession,
    name:
      entry.proteinDescription?.recommendedName?.fullName?.value ??
      entry.proteinDescription?.submissionNames?.[0]?.fullName?.value ??
      "Unknown",
    gene:
      entry.genes?.[0]?.geneName?.value ??
      entry.genes?.[0]?.orfNames?.[0]?.value ??
      "N/A",
    organism: entry.organism?.scientificName ?? "N/A",
    length: entry.sequence?.length ?? null,
  }));
  return { total: data.results?.length ?? 0, results };
}

export type PdbStructure = {
  pdbId: string;
  method: string;
  resolution: string | null;
  chains: string;
  imageUrl: string;
  viewerUrl: string;
};

function pdbImageUrl(pdbId: string): string {
  const id = pdbId.toLowerCase();
  const mid = id.substring(1, 3);
  return `https://cdn.rcsb.org/images/structures/${mid}/${id}/${id}_assembly-1.jpeg`;
}

function molstarViewerUrl(pdbId: string): string {
  return `https://molstar.org/viewer/?pdb=${pdbId.toUpperCase()}&preset=default`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPdbStructures(uniprotEntry: any): PdbStructure[] {
  const xrefs = uniprotEntry.uniProtKBCrossReferences ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return xrefs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((x: any) => x.database === "PDB")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .slice(0, 12)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((x: any) => {
      const props = Object.fromEntries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (x.properties ?? []).map((p: any) => [p.key, p.value]),
      );
      return {
        pdbId: x.id,
        method: props.Method ?? "Unknown",
        resolution: props.Resolution !== "-" ? props.Resolution ?? null : null,
        chains: props.Chains ?? "",
        imageUrl: pdbImageUrl(x.id),
        viewerUrl: molstarViewerUrl(x.id),
      };
    });
}

async function getProtein(accession: string) {
  const url = `https://rest.uniprot.org/uniprotkb/${encodeURIComponent(accession)}.json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    return {
      error: `UniProt lookup failed for ${accession}: ${res.status} ${res.statusText}`,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e: any = await res.json();
  const functionComments =
    e.comments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.filter((c: any) => c.commentType === "FUNCTION")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => c.texts?.map((t: any) => t.value).join(" "))
      .flat() ?? [];
  const subcellular =
    e.comments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.filter((c: any) => c.commentType === "SUBCELLULAR LOCATION")
      .map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) =>
          c.subcellularLocations
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ?.map((l: any) => l.location?.value)
            .filter(Boolean) ?? [],
      )
      .flat() ?? [];

  const structures = extractPdbStructures(e);

  return {
    accession: e.primaryAccession,
    name:
      e.proteinDescription?.recommendedName?.fullName?.value ??
      e.proteinDescription?.submissionNames?.[0]?.fullName?.value ??
      "Unknown",
    gene:
      e.genes?.[0]?.geneName?.value ??
      e.genes?.[0]?.orfNames?.[0]?.value ??
      "N/A",
    organism: e.organism?.scientificName ?? "N/A",
    sequenceLength: e.sequence?.length ?? null,
    function: functionComments,
    subcellularLocation: subcellular,
    structures,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, args: any) {
  switch (name) {
    case "search_protein":
      return await searchProtein(args.query, args.limit);
    case "get_protein":
      return await getProtein(args.accession);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── POST handler ────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userMessage: string = body.message ?? "";
    if (!userMessage.trim()) {
      return Response.json({ error: "Empty message" }, { status: 400 });
    }

    const history: { role: string; text: string }[] = body.history ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = [
      ...history.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.text }],
      })),
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ];

    const config = {
      tools,
      systemInstruction:
        "You are a helpful protein biology assistant. " +
        "When the user asks about proteins, genes, diseases, or biological pathways, " +
        "use the UniProt tools to look up real data before answering. " +
        "Always use get_protein to fetch full details (including 3D structures) when discussing a specific protein. " +
        "Cite accession IDs when referencing proteins. " +
        "If the user's question is not biology related, answer normally without tool use.",
    };

    const MAX_TOOL_ROUNDS = 8;
    let collectedStructures: PdbStructure[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config,
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        return Response.json({
          reply: "No response from model.",
          structures: collectedStructures,
        });
      }

      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        return Response.json({
          reply: response.text ?? "",
          structures: collectedStructures,
        });
      }

      contents.push(candidate.content);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const functionResponseParts: any[] = [];

      for (const fc of functionCalls) {
        const result = await executeTool(
          fc.name!,
          fc.args as Record<string, unknown>,
        );

        if (
          fc.name === "get_protein" &&
          "structures" in result &&
          Array.isArray(result.structures)
        ) {
          collectedStructures = [
            ...collectedStructures,
            ...result.structures,
          ];
        }

        functionResponseParts.push({
          functionResponse: {
            name: fc.name,
            response: { result },
            id: fc.id,
          },
        });
      }

      contents.push({ role: "user", parts: functionResponseParts });
    }

    return Response.json({
      reply:
        "Reached maximum tool-use rounds. Please try a simpler question.",
      structures: collectedStructures,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
