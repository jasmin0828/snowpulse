import type { CoreComparisons } from "./scoring.ts";

type Pattern = "BROAD_GROWTH" | "EXISTING_INTENSITY" | "BROADER_PARTICIPATION" | "COOLING" | "MIXED";

function signal(comparison: CoreComparisons[keyof CoreComparisons]): number | null {
  return comparison.cappedGrowthPct;
}

function above(value: number | null, threshold: number): boolean {
  return value !== null && value >= threshold;
}

function flat(value: number | null): boolean {
  return value !== null && Math.abs(value) <= 10;
}

export function classifyPattern(comparisons: CoreComparisons): Pattern {
  const tx = signal(comparisons.txCount);
  const addresses = signal(comparisons.activeAddresses);
  const senders = signal(comparisons.activeSenders);
  if ([tx, addresses, senders].every((value) => value !== null && value <= -10)) return "COOLING";
  if ([tx, addresses, senders].every((value) => value !== null && value >= 10)) return "BROAD_GROWTH";
  if (above(tx, 20) && flat(addresses) && flat(senders)) return "EXISTING_INTENSITY";
  if (above(addresses, 20) && above(senders, 10) && flat(tx)) return "BROADER_PARTICIPATION";
  return "MIXED";
}

export function generateExplanation(comparisons: CoreComparisons): {
  pattern: Pattern;
  headline: string;
  explanation: string;
  nextQuestion: string;
} {
  const pattern = classifyPattern(comparisons);
  switch (pattern) {
    case "BROAD_GROWTH":
      return {
        pattern,
        headline: "Broad-based activity growth",
        explanation: "Activity increased across both transaction volume and participant metrics, suggesting broad-based growth in the measured period.",
        nextQuestion: "Which contracts contributed most to the transaction increase?",
      };
    case "EXISTING_INTENSITY":
      return {
        pattern,
        headline: "Higher activity intensity",
        explanation: "Transaction activity increased without comparable participant growth, suggesting higher activity intensity among existing participants.",
        nextQuestion: "Did higher activity translate into higher fees or contract deployments?",
      };
    case "BROADER_PARTICIPATION":
      return {
        pattern,
        headline: "Broader but lighter participation",
        explanation: "Participant counts increased faster than transaction volume, suggesting broader but relatively light activity.",
        nextQuestion: "Is address growth concentrated in a small set of applications?",
      };
    case "COOLING":
      return {
        pattern,
        headline: "Broad activity cooling",
        explanation: "Transactions and participant activity declined together, indicating broad cooling during the measured period.",
        nextQuestion: "Which contracts or metrics contributed most to the activity decline?",
      };
    case "MIXED":
      return {
        pattern,
        headline: "Mixed activity signals",
        explanation: "Activity signals are mixed, so the network merits observation but does not show a broad directional move.",
        nextQuestion: "Which metric or chain segment explains the divergence between transaction and participant trends?",
      };
  }
}
