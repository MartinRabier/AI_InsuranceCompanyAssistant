export type Contract = {
  id: string;
  type: string;
  category?: string;
  coverageLimit: number;
  deductible: number;
  active: boolean;
  premium: number;
};

export type Belonging = {
  id: string;
  name: string;
  value: number;
  category: string;
};

export type CoverageStatus = 'covered' | 'partial' | 'not_covered';

export type BelongingWithCoverage = Belonging & { coverageStatus: CoverageStatus };

export type AppState = {
  contracts: Contract[];
  belongings: Belonging[];
};

class Store {
  state: AppState = {
    contracts: [],
    belongings: [],
  };

  listeners: Set<{ (): void }> = new Set();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  emit = () => {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  };

  getBelongingsWithCoverage = (): BelongingWithCoverage[] => {
    const hasHomeowners = this.state.contracts.some(c => c.type.toLowerCase().includes("home"));
    
    // Dynamically calculate specific coverage per category
    const categoryLimits: Record<string, number> = {};
    for (const c of this.state.contracts) {
       const typeLower = c.type.toLowerCase();
       // If it's a specific item/category policy (not general homeowners)
       if (!typeLower.includes("home")) {
          const matchedCats = new Set<string>();
          if (c.category) {
            matchedCats.add(c.category.toLowerCase());
          } else {
            for (const b of this.state.belongings) {
               const catLower = b.category.toLowerCase();
               const cleanType = typeLower.replace('policy', '').replace('standalone', '').replace('valuable personal property', '').replace(/[^\w\s]/g, '').trim();
               
               // Match category if it's explicitly named in the policy type
               if (typeLower.includes(catLower) || catLower.includes(cleanType) || cleanType.includes(catLower)) {
                   matchedCats.add(catLower);
               }
            }
          }
          // Apply this contract's limit to all matching categories
          for (const cat of matchedCats) {
             categoryLimits[cat] = (categoryLimits[cat] || 0) + c.coverageLimit;
          }
       }
    }

    // Determine total value per category to see if limits are breached
    const categoryTotals: Record<string, number> = {};
    for (const b of this.state.belongings) {
       const catLower = b.category.toLowerCase();
       categoryTotals[catLower] = (categoryTotals[catLower] || 0) + b.value;
    }

    return this.state.belongings.map(b => {
      let status: CoverageStatus = 'not_covered';
      const catLower = b.category.toLowerCase();
      
      const specificLimit = categoryLimits[catLower] || 0;
      const totalCatValue = categoryTotals[catLower] || 0;
      
      if (specificLimit > 0) {
         if (specificLimit >= totalCatValue) {
            status = 'covered';
         } else {
            status = 'partial'; // Limit exceeded for this category's total value
         }
      } else if (hasHomeowners) {
         // Fallback default homeowners rules based on internal docs
         if (catLower === "jewelry" && b.value > 5000) {
            status = 'not_covered'; // Must be scheduled
         } else if (b.value <= 2000) {
            status = 'covered'; // Standard limits for items
         } else {
            status = 'partial'; // Exceeds standard per-item limit
         }
      }

      return { ...b, coverageStatus: status };
    });
  }

  getState = () => ({
    ...this.state,
    belongingsWithCoverage: this.getBelongingsWithCoverage()
  });

  generateMockData = () => {
    this.state = {
      contracts: [
        {
          id: "POL-Home-1092",
          type: "Homeowners Insurance",
          coverageLimit: 350000,
          deductible: 1000,
          active: true,
          premium: 1250,
        },
        {
          id: "POL-Jewelry-5441",
          type: "Valuable Personal Property (Jewelry)",
          category: "Jewelry",
          coverageLimit: 5000,
          deductible: 0,
          active: true,
          premium: 150,
        },
      ],
      belongings: [
        {
          id: "BEL-101",
          name: "MacBook Pro M3 Max",
          value: 3999,
          category: "Electronics",
        },
        {
          id: "BEL-102",
          name: "Diamond Engagement Ring",
          value: 6500,
          category: "Jewelry",
        },
        {
          id: "BEL-103",
          name: "Sony A7IV Camera",
          value: 1500,
          category: "Electronics",
        },
      ],
    };
    this.emit();
  };

  addBelonging = (name: string, value: number, category: string) => {
    const id = `BEL-${Math.floor(Math.random() * 900) + 100}`;
    this.state.belongings = [
      ...this.state.belongings,
      { id, name, value, category },
    ];
    this.emit();
    return id;
  };

  updateBelonging = (id: string, name?: string, value?: number, category?: string) => {
    let ok = false;
    this.state.belongings = this.state.belongings.map(b => {
      if (b.id === id) {
        ok = true;
        return {
          ...b,
          ...(name !== undefined && { name }),
          ...(value !== undefined && { value }),
          ...(category !== undefined && { category }),
        };
      }
      return b;
    });
    this.emit();
    return ok;
  };

  deleteBelonging = (id: string) => {
    const initialLength = this.state.belongings.length;
    this.state.belongings = this.state.belongings.filter(b => b.id !== id);
    const ok = this.state.belongings.length < initialLength;
    this.emit();
    return ok;
  };

  createContract = (type: string, category: string, limit: number, premium: number) => {
    const id = `POL-${type.split(' ')[0]}-${Math.floor(Math.random() * 9000) + 1000}`;
    this.state.contracts = [
      ...this.state.contracts,
      {
        id,
        type,
        category,
        coverageLimit: limit,
        deductible: 0, // Simplified for now
        active: true,
        premium
      }
    ];
    this.emit();
    return id;
  };

  deleteContract = (contractId: string) => {
    const initialLength = this.state.contracts.length;
    this.state.contracts = this.state.contracts.filter(c => c.id !== contractId);
    const success = this.state.contracts.length < initialLength;
    this.emit();
    return success;
  };

  updateContractLimit = (contractId: string, newLimit: number) => {
    let ok = false;
    let updatedPremium = 0;
    this.state.contracts = this.state.contracts.map((c) => {
      if (c.id === contractId) {
        ok = true;
        // Use consistent 3% logic, matching the simulateQuote tool
        const diff = newLimit - c.coverageLimit;
        const newPremium = c.premium + (diff > 0 ? diff * 0.03 : 0);
        updatedPremium = Math.round(newPremium);
        return { ...c, coverageLimit: newLimit, premium: updatedPremium };
      }
      return c;
    });
    this.emit();
    return { success: ok, premium: updatedPremium };
  };

  simulateQuote = (category: string, totalValue: number) => {
    return {
      type: `Standalone ${category} Policy`,
      estimatedPremium: Math.round(totalValue * 0.03),
      suggestedCoverage: totalValue,
    };
  };
}

export const store = new Store();
