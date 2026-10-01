import { describe, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import { IssueRelationStore } from "./relation.store";

vi.mock("@/lib/store-context", () => ({ store: {} }));

const emptyRelations = () => ({ blocked_by: [], blocking: [], duplicate: [], relates_to: [] });

const makeStore = () =>
  new IssueRelationStore({
    rootIssueStore: { issues: { addIssue: vi.fn() } },
    activity: { fetchActivities: vi.fn() },
  } as unknown as ConstructorParameters<typeof IssueRelationStore>[0]);

describe("kanban blocking relations", () => {
  it("extracts and deduplicates both relation directions", () => {
    const store = makeStore();
    store.extractRelationsFromIssues([
      {
        id: "blocked",
        issue_relation: [{ id: "blocker", relation_type: "blocked_by" }],
        issue_related: [
          { id: "blocker", relation_type: "blocking" },
          { id: "another", relation_type: "blocking" },
          { id: "unrelated", relation_type: "relates_to" },
        ],
      } as TIssue,
    ]);

    expect(store.getRelationByIssueIdRelationType("blocked", "blocked_by")).toEqual(["blocker", "another"]);
  });

  it("preserves loaded relations when a response does not expand them", () => {
    const store = makeStore();
    store.relationMap = { blocked: { ...emptyRelations(), blocked_by: ["blocker"] } };
    store.extractRelationsFromIssues([{ id: "blocked" } as TIssue]);
    expect(store.getRelationByIssueIdRelationType("blocked", "blocked_by")).toEqual(["blocker"]);
  });

  it("clears stale relations when expanded arrays are empty", () => {
    const store = makeStore();
    store.relationMap = { blocked: { ...emptyRelations(), blocked_by: ["blocker"] } };
    store.extractRelationsFromIssues([{ id: "blocked", issue_relation: [], issue_related: [] } as unknown as TIssue]);
    expect(store.getRelationByIssueIdRelationType("blocked", "blocked_by")).toBeUndefined();
  });

  it("updates both cards after creating a blocking relation", async () => {
    const store = makeStore();
    vi.spyOn(store.issueRelationService, "createIssueRelations").mockResolvedValue([{ id: "blocked" } as TIssue]);
    await store.createRelation("workspace", "project", "blocker", "blocking", ["blocked"]);
    expect(store.getRelationByIssueIdRelationType("blocked", "blocked_by")).toEqual(["blocker"]);
    expect(store.getRelationByIssueIdRelationType("blocker", "blocking")).toEqual(["blocked"]);
  });

  it.each(["blocking", "blocked_by"] as const)("removes the correct reverse relation from %s", async (type) => {
    const store = makeStore();
    const reverse = type === "blocking" ? "blocked_by" : "blocking";
    store.relationMap = {
      source: { ...emptyRelations(), [type]: ["target"] },
      target: { ...emptyRelations(), [reverse]: ["source", "other"] },
    };
    await store.removeRelation("workspace", "project", "source", type, "target", true);
    expect(store.getRelationByIssueIdRelationType("source", type)).toEqual([]);
    expect(store.getRelationByIssueIdRelationType("target", reverse)).toEqual(["other"]);
  });

  it("does not remove another blocker when the reverse relation is absent", async () => {
    const store = makeStore();
    store.relationMap = {
      source: { ...emptyRelations(), blocking: ["target"] },
      target: { ...emptyRelations(), blocked_by: ["other"] },
    };
    await store.removeRelation("workspace", "project", "source", "blocking", "target", true);
    expect(store.getRelationByIssueIdRelationType("target", "blocked_by")).toEqual(["other"]);
  });
});
