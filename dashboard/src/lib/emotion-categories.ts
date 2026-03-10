/**
 * Maps Hume-style emotions to four quadrants for analytics.
 * Edit EMOTION_TO_QUADRANT to change categorization.
 * Quadrants: PHE, PLE, UPLE, UPHE.
 */
export type Quadrant =
  | "pleasantHighEnergy"
  | "pleasantLowEnergy"
  | "unpleasantLowEnergy"
  | "unpleasantHighEnergy";

/** Editable dictionary: emotion label → quadrant. Add or change entries as needed. */
export const EMOTION_TO_QUADRANT: Record<string, Quadrant> = {
  // Unpleasant, low energy (UPLE)
  Sadness: "unpleasantLowEnergy",
  Boredom: "unpleasantLowEnergy",
  Tiredness: "unpleasantLowEnergy",
  Disappointment: "unpleasantLowEnergy",
  Distress: "unpleasantLowEnergy",
  Shame: "unpleasantLowEnergy",
  Guilt: "unpleasantLowEnergy",
  Pain: "unpleasantLowEnergy",
  "Empathic Pain": "unpleasantLowEnergy",
  Confusion: "unpleasantLowEnergy",
  Doubt: "unpleasantLowEnergy",
  Awkwardness: "unpleasantLowEnergy",
  Embarrassment: "unpleasantLowEnergy",
  Contempt: "unpleasantLowEnergy",
  Disgust: "unpleasantLowEnergy",
  Horror: "unpleasantLowEnergy",
  "Surprise (negative)": "unpleasantLowEnergy",
  // Pleasant, low energy (PLE)
  Calmness: "pleasantLowEnergy",
  Contentment: "pleasantLowEnergy",
  Satisfaction: "pleasantLowEnergy",
  Relief: "pleasantLowEnergy",
  "Aesthetic Appreciation": "pleasantLowEnergy",
  Contemplation: "pleasantLowEnergy",
  Concentration: "pleasantLowEnergy",
  Love: "pleasantLowEnergy",
  Nostalgia: "pleasantLowEnergy",
  Romance: "pleasantLowEnergy",
  Sympathy: "pleasantLowEnergy",
  Admiration: "pleasantLowEnergy",
  Adoration: "pleasantLowEnergy",
  Realization: "pleasantLowEnergy",
  Entrancement: "pleasantLowEnergy",
  Awe: "pleasantLowEnergy",
  // Pleasant, high energy (PHE)
  Excitement: "pleasantHighEnergy",
  Joy: "pleasantHighEnergy",
  Amusement: "pleasantHighEnergy",
  Triumph: "pleasantHighEnergy",
  Pride: "pleasantHighEnergy",
  Desire: "pleasantHighEnergy",
  Interest: "pleasantHighEnergy",
  "Surprise (positive)": "pleasantHighEnergy",
  Ecstasy: "pleasantHighEnergy",
  // Unpleasant, high energy (UPHE)
  Anger: "unpleasantHighEnergy",
  Anxiety: "unpleasantHighEnergy",
  Fear: "unpleasantHighEnergy",
  Envy: "unpleasantHighEnergy",
  Craving: "unpleasantHighEnergy",
  Determination: "unpleasantHighEnergy",
};

/** Legacy type for chart keys; maps to quadrants. */
export type EmotionCategory =
  | "lowEnergyUnpleasant"
  | "lowEnergyPleasant"
  | "highEnergyPleasant"
  | "highEnergyUnpleasant";

const QUADRANT_TO_LEGACY: Record<Quadrant, EmotionCategory> = {
  unpleasantLowEnergy: "lowEnergyUnpleasant",
  pleasantLowEnergy: "lowEnergyPleasant",
  pleasantHighEnergy: "highEnergyPleasant",
  unpleasantHighEnergy: "highEnergyUnpleasant",
};

export function getEmotionCategory(emotionLabel: string): EmotionCategory {
  const q = EMOTION_TO_QUADRANT[emotionLabel] ?? "pleasantLowEnergy";
  return QUADRANT_TO_LEGACY[q];
}

export function getQuadrant(emotionLabel: string): Quadrant {
  return EMOTION_TO_QUADRANT[emotionLabel] ?? "pleasantLowEnergy";
}

/** Quadrant order for stacking: PHE, PLE, UPLE, UPHE. */
export const QUADRANT_ORDER: Quadrant[] = [
  "pleasantHighEnergy",
  "pleasantLowEnergy",
  "unpleasantLowEnergy",
  "unpleasantHighEnergy",
];

export const EMOTION_CATEGORY_COLORS: Record<EmotionCategory, string> = {
  lowEnergyUnpleasant: "#3b82f6",
  lowEnergyPleasant: "#22c55e",
  highEnergyPleasant: "#eab308",
  highEnergyUnpleasant: "#ef4444",
};

export const EMOTION_CATEGORY_LABELS: Record<EmotionCategory, string> = {
  lowEnergyUnpleasant: "Sad",
  lowEnergyPleasant: "Content",
  highEnergyPleasant: "Happy",
  highEnergyUnpleasant: "Angry",
};

/** Quadrant labels for tooltips. */
export const QUADRANT_LABELS: Record<Quadrant, string> = {
  pleasantHighEnergy: "Pleasant, high energy",
  pleasantLowEnergy: "Pleasant, low energy",
  unpleasantLowEnergy: "Unpleasant, low energy",
  unpleasantHighEnergy: "Unpleasant, high energy",
};

/** Reverse map: quadrant → list of emotion labels (for pie tooltip breakdown). */
export function getEmotionsInQuadrant(quadrant: Quadrant): string[] {
  return Object.entries(EMOTION_TO_QUADRANT)
    .filter(([, q]) => q === quadrant)
    .map(([label]) => label)
    .sort();
}

export const ALL_EMOTIONS = Object.keys(EMOTION_TO_QUADRANT) as readonly string[];
