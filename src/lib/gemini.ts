import { GoogleGenAI, Type, FunctionDeclaration, Content } from "@google/genai";
import { store } from "./store";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getContractsDecl: FunctionDeclaration = {
  name: "get_user_contracts",
  description: "Returns the user's currently active insurance contracts/policies.",
  parameters: { type: Type.OBJECT, properties: {} }
};

const getBelongingsDecl: FunctionDeclaration = {
  name: "get_user_belongings",
  description: "Returns the user's declared belongings to assess against coverage.",
  parameters: { type: Type.OBJECT, properties: {} }
};

const declareBelongingDecl: FunctionDeclaration = {
  name: "declare_new_belonging",
  description: "Declares a newly purchased item or belonging to the user's profile.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name/description of the item." },
      value: { type: Type.NUMBER, description: "Estimated financial value in USD." },
      category: { type: Type.STRING, description: "Category (e.g. Electronics, Jewelry, Art, Furniture)." }
    },
    required: ["name", "value", "category"]
  }
};

const generateQuoteDecl: FunctionDeclaration = {
  name: "generate_quote",
  description: "Generates an estimated premium quote for a new standalone policy based on category and total value required.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: "Category of insurance (e.g. Electronics, Jewelry)." },
      totalValue: { type: Type.NUMBER, description: "Total value to be covered." }
    },
    required: ["category", "totalValue"]
  }
};

const updateContractDecl: FunctionDeclaration = {
  name: "update_contract_coverage",
  description: "Increases or modifies the coverage limit of an existing contract. It requires the precise contractId.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      contractId: { type: Type.STRING, description: "The ID of the contract to update." },
      newLimit: { type: Type.NUMBER, description: "The new desired coverage limit in USD." }
    },
    required: ["contractId", "newLimit"]
  }
};

const createContractDecl: FunctionDeclaration = {
  name: "create_contract",
  description: "Creates and adds a newly agreed upon insurance contract to the user's account.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING, description: "The type/name of the contract (e.g. 'Standalone Jewelry Policy')." },
      category: { type: Type.STRING, description: "The exact category of belongings this contract covers (e.g. 'Jewelry', 'Electronics')." },
      limit: { type: Type.NUMBER, description: "The coverage limit in USD." },
      premium: { type: Type.NUMBER, description: "The annual premium cost in USD." }
    },
    required: ["type", "category", "limit", "premium"]
  }
};

const deleteContractDecl: FunctionDeclaration = {
  name: "delete_contract",
  description: "Deletes or cancels an existing insurance contract from the user's account.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      contractId: { type: Type.STRING, description: "The ID of the contract to delete." }
    },
    required: ["contractId"]
  }
};

const updateBelongingDecl: FunctionDeclaration = {
  name: "update_belonging",
  description: "Updates an existing belonging's details (name, value, or category).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "The ID of the belonging to update." },
      name: { type: Type.STRING, description: "The new name/description (optional)." },
      value: { type: Type.NUMBER, description: "The new estimated value (optional)." },
      category: { type: Type.STRING, description: "The new category (optional)." }
    },
    required: ["id"]
  }
};

const deleteBelongingDecl: FunctionDeclaration = {
  name: "delete_belonging",
  description: "Deletes a belonging from the user's profile.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "The ID of the belonging to delete." }
    },
    required: ["id"]
  }
};

const internalDocs = `
**CerIAse Internal Policies & Guidelines**
- Assurance Habitation: limite standard de couverture de 300 000 €. Les appareils électroniques de grande valeur sont couverts par les biens personnels généraux, mais la couverture est généralement plafonnée à 2 000 € par article, sauf s'ils sont explicitement déclarés.
- Objets de valeur (ex: Bijoux): Nécessite une couverture séparée. Si un seul bijou dépasse 5 000 €, il DOIT être déclaré avec une politique autonome (Standalone).
- Détection des lacunes de couverture: Si l'utilisateur déclare un bien dont la valeur dépasse la limite par article sous sa police actuelle (par exemple, un ordinateur de 4000 € sur une assurance habitation standard), l'assistant DOIT recommander soit d'augmenter la limite de base, soit d'ajouter une couverture spécifique pour objets de valeur.
- Protocole d'action: Lors de la recommandation d'une mise à jour, proposez de faire une simulation (quote). Si l'utilisateur accepte, appelez update_contract_coverage, ou si la mise à jour pose problème pour le prix, utilisez delete_contract sur l'ancien et create_contract pour le nouveau. Toujours valider les changements avec l'utilisateur avant d'exécuter.
- Ton: Professionnel, empathique, clair. Parlez comme si vous parliez sur une enceinte intelligente ou téléphone, en français. Soyez concis et naturel.
- Règle: Ne mentionnez jamais les noms d'outils internes ou de fonctions que vous utilisez (par exemple, ne dites pas "Je vais appeler create_contract"). Gardez cette mécanique interne complètement cachée de l'utilisateur.
`;

export async function processGeminiTurn(
  contents: Content[],
  onToolCallStart: (toolName: string) => void
): Promise<Content[]> {
  const tools = [
    getContractsDecl,
    getBelongingsDecl,
    declareBelongingDecl,
    updateBelongingDecl,
    deleteBelongingDecl,
    generateQuoteDecl,
    updateContractDecl,
    createContractDecl,
    deleteContractDecl
  ];

  let currentContents = [...contents];
  let isDone = false;
  let safetyCounter = 0;

  while (!isDone && safetyCounter < 5) {
    safetyCounter++;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: currentContents,
      config: {
        systemInstruction: `You are CerIAse, an intelligent voice-based insurance assistant.\n${internalDocs}`,
        tools: [{ functionDeclarations: tools }],
      }
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      // Add the model's turn to history exactly as returned by the API to preserve thought signatures
      if (response.candidates && response.candidates[0]?.content) {
        currentContents.push(response.candidates[0].content);
      } else {
        const modelTurn: Content = {
          role: "model",
          parts: response.functionCalls.map(c => ({ functionCall: c }))
        };
        let textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
        if (textPart && typeof textPart.text === 'string') {
          modelTurn.parts!.unshift({ text: textPart.text });
        }
        currentContents.push(modelTurn);
      }

      // Execute tools
      const functionResponses = [];
      for (const call of response.functionCalls) {
        onToolCallStart(call.name);
        let result = {};
        try {
          if (call.name === "get_user_contracts") {
            result = { contracts: store.getState().contracts };
          } else if (call.name === "get_user_belongings") {
            result = { belongings: store.getState().belongings };
          } else if (call.name === "declare_new_belonging") {
            const args = call.args as any;
            const newId = store.addBelonging(args.name, args.value, args.category);
            result = { success: true, newId, action: "Belonging declared successfully" };
          } else if (call.name === "update_belonging") {
            const args = call.args as any;
            const ok = store.updateBelonging(args.id, args.name, args.value, args.category);
            result = { success: ok, message: ok ? "Belonging updated successfully." : "Belonging ID not found." };
          } else if (call.name === "delete_belonging") {
            const args = call.args as any;
            const ok = store.deleteBelonging(args.id);
            result = { success: ok, message: ok ? "Belonging deleted successfully." : "Belonging ID not found." };
          } else if (call.name === "generate_quote") {
            const args = call.args as any;
            result = store.simulateQuote(args.category, args.totalValue);
          } else if (call.name === "update_contract_coverage") {
            const args = call.args as any;
            const res = store.updateContractLimit(args.contractId, args.newLimit);
            result = { success: res.success, message: res.success ? `Contract updated. New premium is $${res.premium}` : "Contract ID not found." };
          } else if (call.name === "create_contract") {
            const args = call.args as any;
            const newId = store.createContract(args.type, args.category, args.limit, args.premium);
            result = { success: true, newId, message: "New contract successfully added." };
          } else if (call.name === "delete_contract") {
            const args = call.args as any;
            const ok = store.deleteContract(args.contractId);
            result = { success: ok, message: ok ? "Contract cancelled successfully." : "Contract ID not found." };
          } else {
             result = { error: "Unknown function" };
          }
        } catch (err: any) {
             result = { error: err.message };
        }
        
        functionResponses.push({
          name: call.name,
          response: result
        });
      }

      // Add the user's turn containing the tool responses
      currentContents.push({
        role: "user",
        parts: functionResponses.map(r => ({ functionResponse: r }))
      });
      
    } else {
      isDone = true;
      if (response.text) {
        currentContents.push({
          role: "model",
          parts: [{ text: response.text }]
        });
      }
    }
  }

  return currentContents;
}
