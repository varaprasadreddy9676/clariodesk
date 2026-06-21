import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const email = "admin@demo.test";
const password = "demo-password";

async function login(page: import("@playwright/test").Page) {
  const response = await page.request.post(
    "http://localhost:4000/api/auth/login",
    {
      data: { email, password },
    },
  );
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript((auth) => {
    localStorage.setItem("clariodesk.auth", JSON.stringify(auth));
  }, session);
  return session as { token: string };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueLabel(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

async function seedTimelineMessage(
  page: import("@playwright/test").Page,
  token: string,
) {
  const channelsResponse = await page.request.get(
    "http://localhost:4000/api/channels",
    {
      headers: { authorization: `Bearer ${token}` },
    },
  );
  expect(channelsResponse.ok()).toBeTruthy();
  const channels = (await channelsResponse.json()) as Array<{
    id: string;
    title: string;
    status: string;
  }>;
  const channel =
    channels.find(
      (item) => item.title === "Koala closure" && item.status !== "archived",
    ) ?? channels.find((item) => item.status !== "archived");
  expect(channel).toBeTruthy();

  const seedResponse = await page.request.post(
    `http://localhost:4000/api/channels/${channel!.id}/dev-seed-message`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  );
  expect(seedResponse.ok()).toBeTruthy();
  return channel!;
}

test("phones page shows connected gateway and sync-ready state", async ({
  page,
}) => {
  await login(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Phones" }).click();
  await expect(
    page.getByRole("heading", { name: "WhatsApp connection" }),
  ).toBeVisible();
  await expect(page.getByText("Clario Gateway Support")).toBeVisible();
  await expect(page.locator(".phone-hero")).toContainText("Connected");
  await expect(page.getByText("Add or manage phone routes")).toBeVisible();
});

test("phones page can add a gateway route", async ({ page }) => {
  await login(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Phones" }).click();
  await page.getByText("Add or manage phone routes").click();
  const displayName = uniqueLabel("E2E Phone");
  const providerInstanceId = `e2e-${randomUUID()}`;
  await page.getByPlaceholder("Display name").fill(displayName);
  await page.getByPlaceholder("Gateway instance id").fill(providerInstanceId);
  await page.getByRole("button", { name: "Add route" }).click();
  await expect(page.getByText("Phone route created")).toBeVisible();
});

test("chat context panel opens without mapping controls", async ({ page }) => {
  await login(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Inbox" }).click();
  await expect(page.getByText("Client A - Support Group")).toBeVisible();
  await page.locator(".channel-row").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open chat" }).click();
  await page.getByLabel("Show context panel").click();
  await page.getByRole("tab", { name: "Channel" }).click();
  await expect(
    page.getByRole("heading", { name: "Channel Health" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Map group" })).toHaveCount(0);
});

test("search can find messages and navigate back into the inbox", async ({
  page,
}) => {
  await login(page);
  await page.goto("/");

  await page.locator(".nav-item").filter({ hasText: "Search" }).click();
  await page.getByPlaceholder("Search text").fill("help");
  await page.locator("main .primary-action").click();
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
  const messagesGroup = page.locator(".split-list .context-section").first();
  await expect(messagesGroup.getByRole("button").first()).toContainText(
    "Need help with the onboarding checklist.",
  );
  await messagesGroup.getByRole("button").first().click();
  await expect(
    page.getByRole("heading", { name: "Client A - Support Group" }),
  ).toBeVisible();
});

test("clients page can create a client and project", async ({ page }) => {
  await login(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Clients" }).click();
  const clientName = uniqueLabel("E2E Client");
  await page.getByPlaceholder("Client name").fill(clientName);
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByText(clientName)).toBeVisible();

  const clientRow = page
    .locator(".data-row")
    .filter({ hasText: clientName })
    .first();
  const projectName = uniqueLabel("E2E Project");
  await clientRow.getByPlaceholder("Project name").fill(projectName);
  await clientRow.getByRole("button", { name: "Add project" }).click();
  await expect(clientRow.getByText(projectName)).toBeVisible();
});

test("team page can create a user", async ({ page }) => {
  await login(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Team" }).click();
  const displayName = uniqueLabel("E2E Agent");
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@demo.test`;
  await page.getByPlaceholder("Display name").fill(displayName);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Temporary password").fill("password123");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText(displayName)).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});

test("reports page refreshes summary and settings show the live session", async ({
  page,
}) => {
  await login(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Open tickets")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText(/Workspace /)).toBeVisible();
  await page.getByRole("button", { name: "Refresh data" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("message context menu can create a ticket from a chat item", async ({
  page,
}) => {
  const session = await login(page);
  const channel = await seedTimelineMessage(page, session.token);
  await page.goto("/");

  await page.getByRole("button", { name: "Inbox" }).click();
  await page
    .locator(".channel-row strong")
    .filter({ hasText: new RegExp(`^${escapeRegExp(channel.title)}$`) })
    .click();
  await expect(page.locator(".message-bubble").first()).toBeVisible();
  await page.locator(".message-bubble").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Create ticket" }).click();
  await page.getByRole("button", { name: "Tickets" }).click();
  await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
  await expect(page.locator(".table-list > article").first()).toContainText(
    "Need help with the onboarding checklist.",
  );
});

test("message context menu can create a private note from a chat item", async ({
  page,
}) => {
  const session = await login(page);
  const channel = await seedTimelineMessage(page, session.token);
  await page.goto("/");

  await page.getByRole("button", { name: "Inbox" }).click();
  await page
    .locator(".channel-row strong")
    .filter({ hasText: new RegExp(`^${escapeRegExp(channel.title)}$`) })
    .click();
  await expect(page.locator(".message-bubble").first()).toBeVisible();
  await page.locator(".message-bubble").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Reply privately" }).click();
  await expect(page.getByPlaceholder("Add an internal note")).toBeVisible();
  const note = `QA note ${Date.now()}`;
  await page.getByPlaceholder("Add an internal note").fill(note);
  await page.getByRole("button", { name: "Save internal note" }).click();
  const createdNote = page.locator(".message-note").filter({ hasText: note });
  await expect(createdNote).toContainText(note);
  await expect(createdNote).toContainText("Internal note");
});

test("reply composer can queue and cancel a delayed outbox reply", async ({
  page,
}) => {
  const session = await login(page);
  const channel = await seedTimelineMessage(page, session.token);
  await page.goto("/");

  const beforeResponse = await page.request.get(
    "http://localhost:4000/api/ops/summary",
    {
      headers: { authorization: `Bearer ${session.token}` },
    },
  );
  expect(beforeResponse.ok()).toBeTruthy();
  const beforeSummary = (await beforeResponse.json()) as {
    outbox: { byStatus: Record<string, number> };
  };
  const beforeWaiting = beforeSummary.outbox.byStatus.waiting_delay ?? 0;

  await page.getByRole("button", { name: "Inbox" }).click();
  await page
    .locator(".channel-row strong")
    .filter({ hasText: new RegExp(`^${escapeRegExp(channel.title)}$`) })
    .click();

  await expect(page.locator(".message-bubble").first()).toBeVisible();
  const body = `Reply test ${Date.now()}`;
  await page.getByPlaceholder("Reply to the WhatsApp group").fill(body);

  const sendResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/outbox") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send to WhatsApp" }).click();
  const sendResponse = await sendResponsePromise;
  expect(sendResponse.ok()).toBeTruthy();
  const sent = (await sendResponse.json()) as { outboxId: string };
  expect(sent.outboxId).toBeTruthy();

  const afterResponse = await page.request.get(
    "http://localhost:4000/api/ops/summary",
    {
      headers: { authorization: `Bearer ${session.token}` },
    },
  );
  expect(afterResponse.ok()).toBeTruthy();
  const afterSummary = (await afterResponse.json()) as {
    outbox: { byStatus: Record<string, number> };
  };
  expect(
    afterSummary.outbox.byStatus.waiting_delay ?? 0,
  ).toBeGreaterThanOrEqual(beforeWaiting + 1);

  const cancelResponse = await page.request.post(
    `http://localhost:4000/api/outbox/${sent.outboxId}/cancel`,
    {
      headers: { authorization: `Bearer ${session.token}` },
    },
  );
  expect(cancelResponse.ok()).toBeTruthy();
});
