export const HEADYBEE_TEMPLATES: {
  [x: string]: HeadyBeeTemplate;
};
export type HeadyBeeTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  projectionType: string;
  thumbnailUrl: string;
  /**
   * - 0–100 Sacred Geometry alignment score
   */
  sacredGeometryScore: number;
  recommendedRoles: string[];
  recommendedTiers: string[];
  colorPalette: object;
  typography: object;
  animationPresets: object;
  widgetLayout: {
    columns: object;
    responsive: object;
    widgets: object[];
  };
  headySwarmConfig: {
    swarmId: string;
    secondarySwarms: string[];
  };
  navigationItems: object[];
};