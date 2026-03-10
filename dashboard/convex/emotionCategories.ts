/**
 * Convex-side copy of emotion → quadrant mapping (must stay in sync with dashboard/src/lib/emotion-categories.ts).
 * Used when parsing Hume telemetry payloads.
 */
export type Quadrant =
  | "pleasantHighEnergy"
  | "pleasantLowEnergy"
  | "unpleasantLowEnergy"
  | "unpleasantHighEnergy";

export const EMOTION_TO_QUADRANT: Record<string, Quadrant> = {
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
  Excitement: "pleasantHighEnergy",
  Joy: "pleasantHighEnergy",
  Amusement: "pleasantHighEnergy",
  Triumph: "pleasantHighEnergy",
  Pride: "pleasantHighEnergy",
  Desire: "pleasantHighEnergy",
  Interest: "pleasantHighEnergy",
  "Surprise (positive)": "pleasantHighEnergy",
  Ecstasy: "pleasantHighEnergy",
  Anger: "unpleasantHighEnergy",
  Anxiety: "unpleasantHighEnergy",
  Fear: "unpleasantHighEnergy",
  Envy: "unpleasantHighEnergy",
  Craving: "unpleasantHighEnergy",
  Determination: "unpleasantHighEnergy",
};

const DEFAULT_QUADRANT: Quadrant = "pleasantLowEnergy";

export function getQuadrant(emotionLabel: string): Quadrant {
  return EMOTION_TO_QUADRANT[emotionLabel] ?? DEFAULT_QUADRANT;
}
