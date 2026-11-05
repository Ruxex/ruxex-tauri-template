import assert from "node:assert/strict";

describe("Ruxex desktop smoke flow", () => {
  it("shows the initial composer with an accessible send action", async () => {
    const heading = $("//h1[normalize-space()=\"Let's get started\"]");
    await heading.waitForDisplayed({ timeout: 30_000 });

    const message = $('textarea[aria-label="Message"]');
    await message.waitForDisplayed({ timeout: 10_000 });
    const send = $('button[aria-label="Send"]');
    await send.waitForDisplayed({ timeout: 10_000 });

    assert.equal(await heading.getText(), "Let's get started");
    assert.equal(await message.isEnabled(), true);
    assert.equal(await send.isEnabled(), false);
  });

  it("creates a dummy-provider thread from the composer", async () => {
    const message = $('textarea[aria-label="Message"]');
    await message.waitForDisplayed({ timeout: 30_000 });
    await message.setValue("E2E dummy provider smoke");

    const send = $('button[aria-label="Send"]');
    await browser.waitUntil(async () => send.isEnabled(), {
      timeout: 10_000,
      timeoutMsg: "Send should become enabled after entering a message",
    });
    await send.click();

    await browser.waitUntil(
      async () => (await browser.getUrl()).includes("#/chat/"),
      {
        timeout: 30_000,
        timeoutMsg: "The dummy-provider send flow should navigate to a thread",
      },
    );
    assert.match(await browser.getUrl(), /#\/chat\/[^/]+/);
  });
});
