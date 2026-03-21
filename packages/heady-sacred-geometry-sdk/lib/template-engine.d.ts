export class TemplateEngine {
  constructor(options?: {});
  weights: any;
  limits: any;
  templates: any[];
  loadTemplates(input: any): this;
  score(template: object): number;
  select(situation: string, limit?: number): any[];
  coverageReport(situations?: any[]): {};
  rankAll(): {
    id: any;
    name: any;
    score: number;
  }[];
}