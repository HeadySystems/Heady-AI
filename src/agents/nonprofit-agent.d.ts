/**
 * NonprofitConsultantAgent
 *
 * Extends the system's BaseAgent pattern. To stay decoupled from the
 * specific BaseAgent import path (which may vary across Heady™ builds),
 * we implement the same interface: { id, skills, describe(), handle(), getStatus() }
 * and delegate to BaseAgent when available.
 */
export class NonprofitConsultantAgent {
  constructor(BaseAgentClass: any);
  id: string;
  skills: string[];
  _description: string;
  history: any[];
  _BaseAgentClass: any;
  _delegate: any;
  describe(): string;
  handle(input: object): object;
  _execute(input: any): Promise<{
    agentId: string;
    taskType: string;
    status: string;
    error: string;
    timestamp: string;
    template?: undefined;
    inputs_received?: undefined;
    inputs_missing?: undefined;
    output_sections?: undefined;
    constraints?: undefined;
    vertical?: undefined;
    guidance?: undefined;
  } | {
    agentId: string;
    taskType: string;
    status: string;
    template: {
      id: any;
      name: any;
      category: any;
      complexity: any;
      role: any;
    };
    inputs_received: string[];
    inputs_missing: any;
    output_sections: any;
    constraints: any;
    vertical: string;
    guidance: string;
    timestamp: string;
    error?: undefined;
  }>;
  listTemplates(): {
    id: any;
    name: any;
    category: any;
    complexity: any;
    role: any;
    inputs: any;
    output_section_count: any;
  }[];
  getTemplate(id: any): any;
  /**
   * Get agent status (matches BaseAgent interface).
   */
  getStatus(): {
    id: string;
    skills: string[];
    template_count: number;
    invocations: number;
    successRate: number;
    vertical: string;
  };
}
export namespace TEMPLATE_CATALOG {
  let templates: never[];
}
export const TEMPLATE_INDEX: Map<any, any>;
//# sourceMappingURL=nonprofit-agent.d.ts.map