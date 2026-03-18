import { computeQfAllocationsFromAggregates, isqrt } from "../src/services/qfService.js";

function agg(campaignId: number, contributor: string, amountWei: string) {
  return { campaignId, contributorAddress: contributor, amountWei };
}

describe("Quadratic Funding (QF)", () => {
  test("QF calculation accuracy: (sum sqrt)^2", () => {
    // campaign 1: two contributors: 4 and 9 => (2 + 3)^2 = 25
    const res = computeQfAllocationsFromAggregates(
      [agg(1, "a", "4"), agg(1, "b", "9")],
      0n
    );
    const c1 = res.allocations.find((x) => x.campaignId === 1)!;
    expect(c1.qfScoreWei).toBe("25");
    expect(c1.totalContributedWei).toBe("13");
    expect(c1.contributorCount).toBe(2);
  });

  test("Multiple small contributors outrank one large contributor (same total)", () => {
    // A: four contributors * 25 => sqrt(25)=5 => (5+5+5+5)^2=400
    // B: one contributor 100 => sqrt(100)=10 => (10)^2=100
    const res = computeQfAllocationsFromAggregates(
      [
        agg(1, "a1", "25"),
        agg(1, "a2", "25"),
        agg(1, "a3", "25"),
        agg(1, "a4", "25"),
        agg(2, "b1", "100"),
      ],
      0n
    );
    const a = res.allocations.find((x) => x.campaignId === 1)!;
    const b = res.allocations.find((x) => x.campaignId === 2)!;
    expect(BigInt(a.qfScoreWei)).toBeGreaterThan(BigInt(b.qfScoreWei));
  });

  test("Matching funds distributed proportionally to QF score", () => {
    // campaign1 score=400, campaign2 score=100, total=500
    // pool=1000 => alloc1=800, alloc2=200
    const res = computeQfAllocationsFromAggregates(
      [
        agg(1, "a1", "25"),
        agg(1, "a2", "25"),
        agg(1, "a3", "25"),
        agg(1, "a4", "25"),
        agg(2, "b1", "100"),
      ],
      1000n
    );
    const a = res.allocations.find((x) => x.campaignId === 1)!;
    const b = res.allocations.find((x) => x.campaignId === 2)!;
    expect(a.matchingAllocationWei).toBe("800");
    expect(b.matchingAllocationWei).toBe("200");
  });

  test("Edge case: single contributor", () => {
    // sqrt(49)=7 => 49
    const res = computeQfAllocationsFromAggregates([agg(1, "a", "49")], 500n);
    expect(res.allocations).toHaveLength(1);
    expect(res.allocations[0]!.qfScoreWei).toBe("49");
    // only campaign => gets full pool
    expect(res.allocations[0]!.matchingAllocationWei).toBe("500");
  });

  test("Edge case: zero contributions (empty dataset)", () => {
    const res = computeQfAllocationsFromAggregates([], 500n);
    expect(res.totalScoreWei).toBe("0");
    expect(res.allocations).toHaveLength(0);
  });

  test("Large dataset precision: bigint math stays stable", () => {
    // Construct many contributors with large but valid wei amounts.
    // We only check invariants: allocations sum <= pool, all non-negative.
    const aggregates = [];
    for (let i = 0; i < 5000; i++) {
      // 10^18 + i
      aggregates.push(agg(1, `a${i}`, (10n ** 18n + BigInt(i)).toString()));
    }
    for (let i = 0; i < 5000; i++) {
      aggregates.push(agg(2, `b${i}`, (10n ** 17n + BigInt(i)).toString()));
    }
    const pool = 10n ** 21n;
    const res = computeQfAllocationsFromAggregates(aggregates, pool);
    const sumAlloc = res.allocations.reduce((acc, x) => acc + BigInt(x.matchingAllocationWei), 0n);
    expect(sumAlloc).toBeLessThanOrEqual(pool);
    for (const x of res.allocations) {
      expect(BigInt(x.matchingAllocationWei)).toBeGreaterThanOrEqual(0n);
    }
  });
});

describe("isqrt", () => {
  test("isqrt matches floor(sqrt(n)) for small values", () => {
    const cases: Array<[bigint, bigint]> = [
      [0n, 0n],
      [1n, 1n],
      [2n, 1n],
      [3n, 1n],
      [4n, 2n],
      [15n, 3n],
      [16n, 4n],
      [17n, 4n],
      [100n, 10n],
      [101n, 10n],
    ];
    for (const [n, expected] of cases) {
      expect(isqrt(n)).toBe(expected);
    }
  });
});

