describe("Dummy home fixture preparation", () => {
  it("creates one completed basic conversation", async () => {
    const heading = $('//h1[normalize-space()="Let\'s get started"]');
    await heading.waitForDisplayed({ timeout: 30_000 });

    const main = $("main");
    await main.waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
      async () => {
        const text = await main.getText();
        return (
          text.includes("ModelABC") &&
          !text.includes("app-server is not connected")
        );
      },
      {
        timeout: 30_000,
        timeoutMsg: "The desktop App Server should be ready before sending",
      },
    );

    const message = $('textarea[aria-label="Message"]');
    await message.waitForDisplayed({ timeout: 10_000 });
    await message.setValue("Fixture basic conversation [[example:basic]]");

    const send = $('button[aria-label="Send"]');
    await browser.waitUntil(async () => send.isEnabled(), {
      timeout: 10_000,
      timeoutMsg: "Send should become enabled for the fixture message",
    });
    await send.click();

    await browser.waitUntil(
      async () =>
        (await main.getText()).includes(
          "This is a fixed response from the dummy provider.",
        ),
      {
        timeout: 30_000,
        timeoutMsg: "The basic DummyProvider response should be persisted",
      },
    );
    await browser.waitUntil(
      async () => !(await $('button[aria-label="Stop"]').isExisting()),
      {
        timeout: 10_000,
        timeoutMsg: "The fixture turn should finish before the runner exits",
      },
    );
  });
});
