export enum FeatureInputType {
  COUNT_RANGE = 'COUNT_RANGE',
  YES_NO = 'YES_NO',
}

export enum FeatureCategory {
  IDENTITY = 'IDENTITY',
  PRESENCE = 'Presence',
}

export interface FeatureDefinition {
  label: string;
  category: FeatureCategory;
  inputType: FeatureInputType;
  order: number;
}

export const FEATURE_DEFINITIONS: Record<string, FeatureDefinition> = {
  // IDENTITY Category
  header_images: {
    label: 'Header Images',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 1,
  },
  our_specialization: {
    label: 'Our Specialization',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.YES_NO,
    order: 2,
  },
  website: {
    label: 'Website',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.YES_NO,
    order: 3,
  },
  our_testimonials: {
    label: 'Our Testimonials',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 4,
  },
  our_clients: {
    label: 'Our Clients',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 5,
  },
  our_target_domains: {
    label: 'Our Target Domains',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 6,
  },
  files: {
    label: 'Files',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 7,
  },

  history: {
    label: 'History',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 10,
  },
  guiding_principals: {
    label: 'Guiding Principals',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 11,
  },
  achievements: {
    label: 'Achievements',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 12,
  },
  brand_stories: {
    label: 'Brand Stories',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 13,
  },
  management_team: {
    label: 'Management Team',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 14,
  },
    strategic_needs: {
    label: 'Strategic Needs',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 8,
  },
  make_it_better: {
    label: 'Make it Better',
    category: FeatureCategory.IDENTITY,
    inputType: FeatureInputType.YES_NO,
    order: 9,
  },

  // Presence Category
  locations: {
    label: 'Locations',
    category: FeatureCategory.PRESENCE,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 15,
  },
  social_links: {
    label: 'Social Links',
    category: FeatureCategory.PRESENCE,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 16,
  },
  committees: {
    label: 'Committee/s',
    category: FeatureCategory.PRESENCE,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 17,
  },
  hierarchy: {
    label: 'Hierarchy',
    category: FeatureCategory.PRESENCE,
    inputType: FeatureInputType.YES_NO,
    order: 18,
  },
  announcement: {
    label: 'Announcement',
    category: FeatureCategory.PRESENCE,
    inputType: FeatureInputType.YES_NO,
    order: 19,
  },
  campaign: {
    label: 'Campaign',
    category: FeatureCategory.PRESENCE,
    inputType: FeatureInputType.YES_NO,
    order: 20,
  },
  showcase: {
    label: 'Showcase',
    category: FeatureCategory.PRESENCE,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 21,
  },
  faqs: {
    label: 'Faqs',
    category: FeatureCategory.PRESENCE,
    inputType: FeatureInputType.COUNT_RANGE,
    order: 22,
  },
};

// Helper to get all feature keys
export const FEATURE_KEYS = Object.keys(FEATURE_DEFINITIONS);
