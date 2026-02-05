
import { RawCompanyData, CompanyAnalysis, PLATFORMS_CONFIG, VisibilityLevel, PlatformScore, PerformanceLevel } from '../types';

const COLUMN_SYNONYMS: Record<string, string[]> = {
  name: ["entreprise", "nom", "enseigne", "société", "etablissement"],
  city: ["ville", "commune", "city", "localité"],
  activity: ["activité", "secteur", "type", "métier"],
  naf: ["naf", "code naf", "ape"],
  Facebook: ["facebook", "fb"],
  LinkedIn: ["linkedin", "li"],
  Instagram: ["instagram", "insta"],
  "Site Web": ["site web", "site", "www"],
  "Google My Business": ["google my business", "gmb", "google business", "fiche google"],
  "Pages Jaunes": ["pages jaunes", "pj"],
  YouTube: ["youtube", "yt"],
  TripAdvisor: ["tripadvisor", "trip advisor", "ta"]
};

const findActualHeader = (row: RawCompanyData, targetKey: string): string | null => {
  const actualKeys = Object.keys(row);
  const synonyms = COLUMN_SYNONYMS[targetKey] || [targetKey.toLowerCase()];
  for (const key of actualKeys) {
    const k = key.toLowerCase().trim();
    if (synonyms.some(s => k === s)) return key;
  }
  const isPlatform = ["Facebook", "LinkedIn", "Instagram", "Google My Business", "YouTube", "TripAdvisor", "Pages Jaunes", "Site Web"].includes(targetKey);
  for (const key of actualKeys) {
    const k = key.toLowerCase().trim();
    if (synonyms.some(s => k.startsWith(s) || k.includes(s))) {
      if (isPlatform && (k.includes("lien") || k.includes("url") || k.includes("http") || k.includes("link"))) continue;
      return key;
    }
  }
  return null;
};

const getSafeValue = (row: RawCompanyData, targetKey: string): string => {
  const header = findActualHeader(row, targetKey);
  return header ? (row[header] || "").toString().trim() : "";
};

/**
 * Mappe les valeurs brutes vers le système 0, 25, 50, 75, 100
 */
export const getPerformanceDetails = (value: string | undefined): { level: PerformanceLevel; score: number } => {
  if (!value || value === "") return { level: 'Absent', score: 0 };
  const v = value.toUpperCase().trim();
  
  // Correspondances directes
  if (v === "100" || v === "A" || v === "EXCELLENT") return { level: 'Actif', score: 100 };
  if (v === "75" || v === "B" || v === "BON") return { level: 'Actif', score: 75 };
  if (v === "50" || v === "P" || v === "MOYEN") return { level: 'Passif', score: 50 };
  if (v === "25" || v === "I" || v === "FAIBLE") return { level: 'Passif', score: 25 };
  if (v === "0" || v === "X" || v === "ABSENT") return { level: 'Absent', score: 0 };

  // Fallback heuristique
  if (["OUI", "YES", "CERT"].includes(v)) return { level: 'Actif', score: 100 };
  if (["NON", "NO"].includes(v)) return { level: 'Absent', score: 0 };
  
  return { level: 'Passif', score: 50 };
};

/**
 * Générateur de plan d'action basé sur la légende client
 */
export const getRecommendations = (platforms: PlatformScore[]): string[] => {
  const recs: string[] = [];
  
  platforms.sort((a, b) => a.score - b.score).forEach(p => {
    if (p.score < 100) {
      switch(p.name) {
        case 'Site Web':
          if (p.score === 0) recs.push("URGENT : Créer un site web vitrine moderne et responsive.");
          else if (p.score === 25) recs.push("Site Web : Actualiser les informations obsolètes et corriger les erreurs techniques.");
          else if (p.score === 50) recs.push("Site Web : Enrichir le contenu (histoire, tarifs détaillés) et moderniser le design.");
          else if (p.score === 75) recs.push("Site Web : Intégrer un module de réservation en ligne ou un blog actif.");
          break;
        case 'Google My Business':
          if (p.score === 0) recs.push("GMB : Créer une fiche d'établissement pour apparaître sur Google Maps.");
          else if (p.score === 25) recs.push("GMB : Réclamer la propriété de votre fiche pour sécuriser vos infos.");
          else if (p.score === 50) recs.push("GMB : Compléter la fiche (photos, description) pour booster le SEO local.");
          else if (p.score === 75) recs.push("GMB : Répondre systématiquement aux avis et publier des posts hebdomadaires.");
          break;
        case 'Facebook':
          if (p.score <= 25) recs.push("Facebook : Créer une page professionnelle avec photo de couverture.");
          else if (p.score === 50) recs.push("Facebook : Relancer l'activité (dernière publication trop ancienne).");
          else if (p.score === 75) recs.push("Facebook : Améliorer l'interaction avec les abonnés et la qualité visuelle.");
          break;
        case 'Instagram':
          if (p.score <= 50) recs.push("Instagram : Publier des stories régulières pour humaniser votre enseigne.");
          break;
        case 'TripAdvisor':
          if (p.score > 0 && p.score < 100) recs.push("TripAdvisor : Certifier votre compte propriétaire pour répondre aux avis.");
          break;
      }
    }
  });

  return recs.slice(0, 4);
};

export const parseGoogleSheetsUrl = (url: string): string => {
  const idMatch = url.match(/\/d\/(.*?)(\/|$)/);
  return idMatch ? `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv` : '';
};

export const getVisibilityMetadata = (score: number) => {
  if (score < 35) return { level: VisibilityLevel.LOW, comment: "Présence numérique insuffisante." };
  if (score < 65) return { level: VisibilityLevel.MODERATE, comment: "Maturité moyenne, manque de régularité." };
  return { level: VisibilityLevel.DYNAMIC, comment: "Excellente maîtrise des outils digitaux." };
};

export const processData = (rawData: RawCompanyData[]): CompanyAnalysis[] => {
  const cleanData = rawData.filter(row => getSafeValue(row, "name") !== "");
  
  const platformAverages: Record<string, number> = {};
  PLATFORMS_CONFIG.forEach(p => {
    const total = cleanData.reduce((acc, row) => acc + getPerformanceDetails(getSafeValue(row, p.key)).score, 0);
    platformAverages[p.key] = total / cleanData.length;
  });

  return cleanData.map(row => {
    const platforms: PlatformScore[] = PLATFORMS_CONFIG.map(p => {
      const val = getSafeValue(row, p.key);
      const perf = getPerformanceDetails(val);
      return {
        name: p.key,
        status: perf.score > 0 ? 'present' : 'absent',
        performance: perf.level,
        score: perf.score,
        average: platformAverages[p.key],
        color: p.color,
        icon: p.icon,
        raw: val
      };
    });

    const overallScore = Math.round(platforms.reduce((acc, p) => acc + p.score, 0) / platforms.length);
    const meta = getVisibilityMetadata(overallScore);

    return {
      name: getSafeValue(row, "name"),
      city: getSafeValue(row, "city") || "N/C",
      activity: getSafeValue(row, "activity") || "N/C",
      naf: getSafeValue(row, "naf") || "N/C",
      overallScore,
      platforms,
      visibilityLevel: meta.level as any,
      comment: meta.comment
    };
  });
};
