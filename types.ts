
export interface RawCompanyData {
  "Entreprise": string;
  "Ville"?: string;
  "Code NAF"?: string;
  "Activité"?: string;
  "Facebook"?: string;
  "LinkedIn"?: string;
  "Instagram"?: string;
  "Site Web"?: string;
  "Google My Business"?: string;
  "Pages Jaunes"?: string;
  "YouTube"?: string;
  "TripAdvisor"?: string;
  [key: string]: string | undefined;
}

export type PerformanceLevel = 'Actif' | 'Passif' | 'Absent';

export interface PlatformScore {
  name: string;
  status: 'present' | 'absent';
  performance: PerformanceLevel;
  score: number; // 0, 50, or 100
  average: number;
  color: string;
  icon: string;
  raw: string;
}

export interface CompanyAnalysis {
  name: string;
  city: string;
  naf: string;
  activity: string;
  overallScore: number;
  platforms: PlatformScore[];
  visibilityLevel: 'Faible' | 'Modéré' | 'Dynamique';
  comment: string;
}

export enum VisibilityLevel {
  LOW = 'Faible',
  MODERATE = 'Modéré',
  DYNAMIC = 'Dynamique'
}

export const PLATFORMS_CONFIG = [
  { key: 'Facebook', color: '#1877F2', icon: 'Facebook' },
  { key: 'LinkedIn', color: '#0A66C2', icon: 'Linkedin' },
  { key: 'Instagram', color: '#E4405F', icon: 'Instagram' },
  { key: 'Site Web', color: '#3b82f6', icon: 'Globe' },
  { key: 'Google My Business', color: '#4285F4', icon: 'MapPin' },
  { key: 'Pages Jaunes', color: '#FFD700', icon: 'Phone' },
  { key: 'YouTube', color: '#FF0000', icon: 'Youtube' },
  { key: 'TripAdvisor', color: '#00AF87', icon: 'Plane' }
];
