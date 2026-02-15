/**
 * Simulate all possible run outcomes and log how final profit is decided, step by step.
 * Loads .env (STACKS_RECIPIENT_ADDRESS, SCALE_K, etc.); run from server: npx tsx scripts/simulate-outcomes.ts
 */
import "dotenv/config";
import {
  SCALE_K,
  MIN_LEVEL_BEFORE_STOP,
  MAX_QUESTIONS,
  getCostStx,
  getBaseRewardStx,
  computeProfit,
  computeMilestoneBonus,
} from "../src/config/tokenomics.js";

const STX_USD = 0.275; // approximate for log display

type TimeBucket = 1.5 | 1.2 | 1.0;
type QuestionOutcome =
  | { kind: "correct"; timeBucket: TimeBucket; ratio: number }
  | { kind: "wrong" }
  | { kind: "timeout" };

function runSimulation(
  scenarioName: string,
  questions: { levelIndex: number; outcome: QuestionOutcome; allowedTimeSec?: number }[]
): void {
  console.log("\n" + "=".repeat(80));
  console.log(`SCENARIO: ${scenarioName}`);
  console.log("=".repeat(80));

  let totalSpentStx = 0;
  let totalEarnedStx = 0;
  let completedLevels = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const level = q.levelIndex;
    const levelNum = level + 1;
    const costStx = getCostStx(level);
    const baseRewardStx = getBaseRewardStx(level);

    // Step 1: Payment (every question is paid before answering)
    totalSpentStx += costStx;
    console.log(`\n--- Question ${i + 1} (Level ${levelNum}) ---`);
    console.log(`  1. PAYMENT: User pays level-${levelNum} cost = ${costStx.toFixed(4)} STX`);
    console.log(`     (Base cost × K/100; level ${levelNum} base from tokenomics table)`);
    console.log(`     Running total spent = ${totalSpentStx.toFixed(4)} STX`);

    if (q.outcome.kind === "correct") {
      const mult = q.outcome.timeBucket;
      const earnedThis = baseRewardStx * mult;
      totalEarnedStx += earnedThis;
      completedLevels += 1;
      console.log(`  2. ANSWER: Correct (no timeout).`);
      console.log(`     Time ratio (solve/allowed) = ${q.outcome.ratio.toFixed(2)} → bucket: ${mult}×`);
      console.log(`     Base reward (level ${levelNum}) = ${baseRewardStx.toFixed(4)} STX`);
      console.log(`     Earned this question = baseReward × ${mult} = ${earnedThis.toFixed(4)} STX`);
      console.log(`     Running total earned = ${totalEarnedStx.toFixed(4)} STX`);
    } else if (q.outcome.kind === "wrong") {
      console.log(`  2. ANSWER: Wrong (user selected wrong option).`);
      console.log(`     Earned this question = 0 (wrong → no reward).`);
      console.log(`     Running total earned = ${totalEarnedStx.toFixed(4)} STX (unchanged).`);
      console.log(`  3. RUN ENDS: Wrong answer → run ends immediately.`);
      console.log(`     Current level cost (${costStx.toFixed(4)} STX) is LOST (already paid, no refund).`);
      console.log(`     Earlier earned (${totalEarnedStx.toFixed(4)} STX) is KEPT.`);
      break;
    } else {
      console.log(`  2. ANSWER: Timeout (submitted after allowed time).`);
      console.log(`     Treated as wrong: run ends, earned this question = 0.`);
      console.log(`     Running total earned = ${totalEarnedStx.toFixed(4)} STX (unchanged).`);
      console.log(`  3. RUN ENDS: Timeout = wrong → run ends immediately.`);
      console.log(`     Current level cost (${costStx.toFixed(4)} STX) is LOST.`);
      break;
    }

    const profitSoFar = totalEarnedStx - totalSpentStx;
    console.log(`  3. Profit so far = earned − spent = ${totalEarnedStx.toFixed(4)} − ${totalSpentStx.toFixed(4)} = ${profitSoFar.toFixed(4)} STX`);
  }

  // Final settlement
  console.log("\n--- FINAL SETTLEMENT ---");
  console.log(`  Total spent (all questions paid) = ${totalSpentStx.toFixed(4)} STX`);
  console.log(`  Total earned (correct answers only, with time multiplier) = ${totalEarnedStx.toFixed(4)} STX`);
  const profit = computeProfit(totalEarnedStx, totalSpentStx);
  console.log(`  Profit = totalEarned − totalSpent = ${totalEarnedStx.toFixed(4)} − ${totalSpentStx.toFixed(4)} = ${profit.toFixed(4)} STX`);
  if (STX_USD) console.log(`  (≈ $${(profit * STX_USD).toFixed(4)} at $${STX_USD}/STX)`);

  const milestoneBonus = computeMilestoneBonus(completedLevels);
  if (milestoneBonus > 0) {
    console.log(`  Milestone bonus (${completedLevels} completed): ${milestoneBonus.toFixed(4)} STX`);
    console.log(`  Total with bonus (if stop): ${(profit + milestoneBonus).toFixed(4)} STX`);
  }
  console.log("");
}

function main(): void {
  console.log("\n" + "#".repeat(80));
  console.log("# UNTIL — Outcome simulation (all possible run endings)");
  console.log("# How final profit is decided: step-by-step logs");
  console.log("#".repeat(80));

  const recipient = process.env.STACKS_RECIPIENT_ADDRESS ?? "(not set)";
  const scaleK = process.env.SCALE_K ?? "100";
  console.log("\nConfig (from .env):");
  console.log(`  STACKS_RECIPIENT_ADDRESS = ${recipient}`);
  console.log(`  (Payments are verified on-chain to this address; not used in profit math.)`);
  console.log(`  SCALE_K = ${scaleK} (effective K used: ${SCALE_K})`);
  console.log(`  All cost/reward amounts below are base × (K/100).`);
  console.log(`  MIN_LEVEL_BEFORE_STOP = ${MIN_LEVEL_BEFORE_STOP} (user can only stop after completing this many levels).`);
  console.log(`  MAX_QUESTIONS = ${MAX_QUESTIONS}.`);

  const fast = (level: number): QuestionOutcome => ({ kind: "correct", timeBucket: 1.5, ratio: 0.5 });
  const mid = (level: number): QuestionOutcome => ({ kind: "correct", timeBucket: 1.2, ratio: 0.75 });
  const slow = (level: number): QuestionOutcome => ({ kind: "correct", timeBucket: 1.0, ratio: 0.95 });

  // Scenario 1: All correct fast, stop at 4
  runSimulation("All correct (1.5× fast), stop at level 4", [
    { levelIndex: 0, outcome: fast(0) },
    { levelIndex: 1, outcome: fast(1) },
    { levelIndex: 2, outcome: fast(2) },
    { levelIndex: 3, outcome: fast(3) },
  ]);

  // Scenario 2: All correct slow, stop at 4 (break-even)
  runSimulation("All correct (1.0× slow), stop at level 4", [
    { levelIndex: 0, outcome: slow(0) },
    { levelIndex: 1, outcome: slow(1) },
    { levelIndex: 2, outcome: slow(2) },
    { levelIndex: 3, outcome: slow(3) },
  ]);

  // Scenario 3: Wrong at level 1
  runSimulation("Wrong answer at level 1 (run ends immediately)", [
    { levelIndex: 0, outcome: { kind: "wrong" } },
  ]);

  // Scenario 4: Correct L1–L3, wrong at L4
  runSimulation("Correct L1–L3 (fast), wrong at level 4 — earned kept, L4 cost lost", [
    { levelIndex: 0, outcome: fast(0) },
    { levelIndex: 1, outcome: fast(1) },
    { levelIndex: 2, outcome: fast(2) },
    { levelIndex: 3, outcome: { kind: "wrong" } },
  ]);

  // Scenario 5: Timeout at level 2
  runSimulation("Correct L1, timeout at level 2 (treated as wrong, run ends)", [
    { levelIndex: 0, outcome: fast(0) },
    { levelIndex: 1, outcome: { kind: "timeout" } },
  ]);

  // Scenario 6: All correct 1.2×, stop at 6
  runSimulation("All correct (1.2× mid), stop at level 6", [
    { levelIndex: 0, outcome: mid(0) },
    { levelIndex: 1, outcome: mid(1) },
    { levelIndex: 2, outcome: mid(2) },
    { levelIndex: 3, outcome: mid(3) },
    { levelIndex: 4, outcome: mid(4) },
    { levelIndex: 5, outcome: mid(5) },
  ]);

  // Scenario 7: Full run all fast, stop at 10
  runSimulation("All correct (1.5×), stop at level 10 (max run)", [
    ...Array.from({ length: MAX_QUESTIONS }, (_, i) => ({ levelIndex: i, outcome: fast(i) as QuestionOutcome })),
  ]);

  // Scenario 8: Full run all slow (loss)
  runSimulation("All correct (1.0×), stop at level 10 — break-even per question, but costs rise", [
    ...Array.from({ length: MAX_QUESTIONS }, (_, i) => ({ levelIndex: i, outcome: slow(i) as QuestionOutcome })),
  ]);

  // Scenario 9: Mixed speeds, stop at 4
  runSimulation("Mixed: L1–L2 fast (1.5×), L3 mid (1.2×), L4 slow (1.0×), stop at 4", [
    { levelIndex: 0, outcome: fast(0) },
    { levelIndex: 1, outcome: fast(1) },
    { levelIndex: 2, outcome: mid(2) },
    { levelIndex: 3, outcome: slow(3) },
  ]);

  // Scenario 10: Wrong at level 5 (had completed 4)
  runSimulation("Correct L1–L4 (fast), wrong at level 5 — one mistake erases earlier profit", [
    { levelIndex: 0, outcome: fast(0) },
    { levelIndex: 1, outcome: fast(1) },
    { levelIndex: 2, outcome: fast(2) },
    { levelIndex: 3, outcome: fast(3) },
    { levelIndex: 4, outcome: { kind: "wrong" } },
  ]);

  console.log("\n" + "#".repeat(80));
  console.log("# Summary: Possible run outcomes");
  console.log("#   • End by STOP (user chooses stop after level ≥ 4): profit = earned − spent; can add milestone.");
  console.log("#   • End by WRONG: run ends; earned so far kept; current level cost lost.");
  console.log("#   • End by TIMEOUT: same as wrong (0 for that question, run ends).");
  console.log("#   • Profit formula is always: totalEarned − totalSpent (no platform fee).");
  console.log("#".repeat(80) + "\n");
}

main();
