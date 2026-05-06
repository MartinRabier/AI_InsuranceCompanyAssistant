export type Contract = {
  id: string;
  type: string;
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
    const hasHomeowners = this.state.contracts.some(c => c.type.includes("Homeowners"));
    const jewelryContractLimit = this.state.contracts.filter(c => c.type.includes("Jewelry")).reduce((sum, c) => sum + c.coverageLimit, 0);

    return this.state.belongings.map(b => {
      let status: CoverageStatus = 'not_covered';
      
      if (b.category === 'Jewelry') {
         if (jewelryContractLimit >= b.value) status = 'covered';
         else if (jewelryContractLimit > 0) status = 'partial';
      } else {
         // Default logic for other things falling under Homeowners (capped at $2000 normally)
         if (hasHomeowners) {
           if (b.value <= 2000) status = 'covered';
           else status = 'partial';
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

  createContract = (type: string, limit: number, premium: number) => {
    const id = `POL-${type.split(' ')[0]}-${Math.floor(Math.random() * 9000) + 1000}`;
    this.state.contracts = [
      ...this.state.contracts,
      {
        id,
        type,
        coverageLimit: limit,
        deductible: 0, // Simplified for now
        active: true,
        premium
      }
    ];
    this.emit();
    return id;
  };

  updateContractLimit = (contractId: string, newLimit: number) => {
    let ok = false;
    this.state.contracts = this.state.contracts.map((c) => {
      if (c.id === contractId) {
        ok = true;
        // Increase premium by 5% of the limit change (simple mock logic)
        const diff = newLimit - c.coverageLimit;
        const newPremium = c.premium + (diff > 0 ? diff * 0.05 : 0);
        return { ...c, coverageLimit: newLimit, premium: Math.round(newPremium) };
      }
      return c;
    });
    this.emit();
    return ok;
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
