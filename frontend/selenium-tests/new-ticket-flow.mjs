import fs from "node:fs/promises";
import path from "node:path";
import { Builder, By, Key, until } from "selenium-webdriver";

const BASE_URL = process.env.SELENIUM_BASE_URL || "http://localhost:8080";
const LOGIN_EMAIL =
  process.env.SELENIUM_LOGIN_EMAIL || "sushant_network@gmail.com";
const LOGIN_PASSWORD = process.env.SELENIUM_LOGIN_PASSWORD || "123@Password";
const ACTION_DELAY_MS = Number(process.env.SELENIUM_ACTION_DELAY_MS || 700);

const NEW_TICKET = {
  title: `Selenium Network Ticket ${Date.now()}`,
  description:
    "Automated Selenium test ticket for network team. Please ignore; this verifies login and ticket creation flow without attachments.",
  departmentLabel: "network team",
};

const OUTPUT_DIR = path.resolve("selenium-tests", "artifacts");

async function pause(ms = ACTION_DELAY_MS) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVisible(driver, locator, timeout = 20000) {
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
}

async function safeClick(driver, locator, timeout = 20000) {
  const element = await waitForVisible(driver, locator, timeout);
  await driver.wait(until.elementIsEnabled(element), timeout);
  await pause();
  await element.click();
  await pause();
}

async function saveFailureScreenshot(
  driver,
  fileName = "new-ticket-failure.png",
) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const image = await driver.takeScreenshot();
  const targetPath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(targetPath, image, "base64");
  return targetPath;
}

async function runNewTicketFlow() {
  const driver = await new Builder().forBrowser("chrome").build();

  try {
    console.log(`Running Selenium with action delay: ${ACTION_DELAY_MS}ms`);
    await driver.manage().window().setRect({ width: 1440, height: 960 });
    await driver.manage().setTimeouts({ pageLoad: 60000, script: 30000 });

    await driver.get(`${BASE_URL}/login`);
    await pause();

    const emailInput = await waitForVisible(driver, By.id("email"));
    const passwordInput = await waitForVisible(driver, By.id("password"));

    await emailInput.clear();
    await pause();
    await emailInput.sendKeys(LOGIN_EMAIL);
    await pause();

    await passwordInput.clear();
    await pause();
    await passwordInput.sendKeys(LOGIN_PASSWORD);
    await pause();

    await safeClick(
      driver,
      By.xpath(
        "//button[@type='submit' and contains(normalize-space(.), 'Sign In')]",
      ),
    );

    await driver.wait(until.urlContains("/dashboard"), 30000);
    await pause();

    await safeClick(
      driver,
      By.xpath("//button[contains(normalize-space(.), 'New Ticket')]"),
    );

    await driver.wait(until.urlContains("/tickets/new"), 20000);
    await pause();

    const titleInput = await waitForVisible(driver, By.id("title"));
    await titleInput.clear();
    await pause();
    await titleInput.sendKeys(NEW_TICKET.title);
    await pause();

    const descriptionInput = await waitForVisible(driver, By.id("description"));
    await descriptionInput.clear();
    await pause();
    await descriptionInput.sendKeys(NEW_TICKET.description, Key.TAB);
    await pause();

    // Department is a Radix Select trigger rendered as a combobox button.
    await safeClick(
      driver,
      By.xpath(
        "//label[contains(normalize-space(.), 'Department')]/following::button[@role='combobox'][1]",
      ),
    );

    await safeClick(
      driver,
      By.xpath(
        "//*[(@role='option' or @data-radix-collection-item) and contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'network team')]",
      ),
    );

    await safeClick(
      driver,
      By.xpath(
        "//button[@type='submit' and contains(normalize-space(.), 'Create Ticket')]",
      ),
    );

    await driver.wait(until.urlContains("/dashboard/tickets"), 30000);
    await pause();

    console.log(
      "Selenium flow completed: employee login + new network ticket created without attachments.",
    );
  } catch (error) {
    const screenshotPath = await saveFailureScreenshot(driver);
    console.error("Selenium flow failed.");
    console.error(`Screenshot: ${screenshotPath}`);
    throw error;
  } finally {
    await driver.quit();
  }
}

runNewTicketFlow().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
