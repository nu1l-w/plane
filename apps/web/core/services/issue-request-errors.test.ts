import { afterEach, describe, expect, it, vi } from "vitest";
import { APIService } from "./api.service";
import { IssueService } from "./issue/issue.service";
import { UserService } from "./user.service";

afterEach(() => vi.restoreAllMocks());

describe("work item list request errors", () => {
  it.each([
    ["project", () => new IssueService().getIssues("workspace", "project", {})],
    ["profile", () => new UserService().getUserProfileIssues("workspace", "user", {})],
  ])("preserves %s cancellation errors and server response data", async (_name, fetchIssues) => {
    const canceled = new Error("canceled");
    const get = vi.spyOn(APIService.prototype, "get").mockRejectedValueOnce(canceled);

    await expect(fetchIssues()).rejects.toBe(canceled);

    const payload = { error: "Access denied" };
    get.mockRejectedValueOnce({ response: { data: payload } });
    await expect(fetchIssues()).rejects.toBe(payload);
  });
});
