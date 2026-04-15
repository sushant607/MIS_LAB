import fs from "node:fs/promises";
import path from "node:path";
import { Builder, By, until } from "selenium-webdriver";

const BASE_URL = process.env.SELENIUM_BASE_URL || "http://localhost:8080";
const ACTION_DELAY_MS = 1000;

const OUTPUT_DIR = path.resolve("selenium-tests", "artifacts");

async function pause(ms = ACTION_DELAY_MS) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVisible(driver, locator, timeout = 20000) {
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
}

async function diagnostic() {
  const driver = await new Builder().forBrowser("chrome").build();

  try {
    console.log("🔍 Starting Diagnostic Script...");

    await driver.manage().window().setRect({ width: 1440, height: 960 });
    await driver.manage().setTimeouts({ pageLoad: 60000, script: 30000 });

    // Navigate to signup
    console.log("📍 Navigating to signup page...");
    await driver.get(`${BASE_URL}/signup`);
    await pause();

    // Fill basic fields
    console.log("📍 Filling basic fields...");
    const nameInput = await waitForVisible(driver, By.id("name"));
    await nameInput.sendKeys("Test User");
    await pause();

    const emailInput = await waitForVisible(driver, By.id("email"));
    await emailInput.sendKeys("test@example.com");
    await pause();

    const passwordInput = await waitForVisible(driver, By.id("password"));
    await passwordInput.sendKeys("Password123");
    await pause();

    const confirmPasswordInput = await waitForVisible(
      driver,
      By.id("confirmPassword"),
    );
    await confirmPasswordInput.sendKeys("Password123");
    await pause();

    // Now inspect the department dropdown area
    console.log("\n📍 Inspecting Department Dropdown...");

    // Get all buttons on the page
    const allButtons = await driver.findElements(By.xpath("//button"));
    console.log(`✅ Found ${allButtons.length} buttons on the page`);

    // Try to find the department section
    const departmentLabel = await driver.findElements(
      By.xpath("//label[contains(text(), 'Department')]"),
    );
    console.log(`✅ Found ${departmentLabel.length} "Department" label(s)`);

    if (departmentLabel.length > 0) {
      // Get the parent form group
      const formGroup = await departmentLabel[0].findElement(
        By.xpath("ancestor::div[contains(@class, 'space-y')]"),
      );
      const innerHtml = await formGroup.getAttribute("outerHTML");
      console.log("\n📋 Department Form Group HTML:");
      console.log(innerHtml.substring(0, 500) + "...\n");

      // Find buttons near the department label
      const nearbyButtons = await driver.findElements(
        By.xpath(
          "//label[contains(text(), 'Department')]/following::button[1]",
        ),
      );
      console.log(
        `✅ Found ${nearbyButtons.length} button(s) next to Department label`,
      );

      if (nearbyButtons.length > 0) {
        console.log("🖱️  Clicking Department dropdown button...");
        await nearbyButtons[0].click();
        await pause(1500); // Wait longer to see dropdown

        // Now inspect what appeared
        console.log("\n📋 Inspecting dropdown after click...");

        // Look for any role="option" elements
        const options = await driver.findElements(
          By.xpath("//div[@role='option']"),
        );
        console.log(
          `✅ Found ${options.length} option elements with role="option"`,
        );

        if (options.length > 0) {
          console.log("📋 Option texts:");
          for (let i = 0; i < Math.min(options.length, 10); i++) {
            const text = await options[i].getText();
            const html = await options[i].getAttribute("outerHTML");
            console.log(`  [${i}]: "${text}" - ${html.substring(0, 100)}...`);
          }
        }

        // Look for any popover/portal content
        const portals = await driver.findElements(
          By.xpath("//div[contains(@style, 'position')]"),
        );
        console.log(
          `✅ Found ${portals.length} positioned elements (potential portals)`,
        );

        // Try to find elements by common Radix UI selectors
        const contentElements = await driver.findElements(
          By.xpath("//*[@role='listbox']"),
        );
        console.log(`✅ Found ${contentElements.length} listbox elements`);

        const menuElements = await driver.findElements(
          By.xpath("//*[@role='menu']"),
        );
        console.log(`✅ Found ${menuElements.length} menu elements`);

        // Take screenshot
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        const image = await driver.takeScreenshot();
        const screenshotPath = path.join(OUTPUT_DIR, "diagnostic-dropdown.png");
        await fs.writeFile(screenshotPath, image, "base64");
        console.log(`📸 Screenshot saved: ${screenshotPath}`);

        // Get page source
        const pageSource = await driver.getPageSource();
        const sourceFile = path.join(OUTPUT_DIR, "page-source.html");
        await fs.writeFile(sourceFile, pageSource);
        console.log(`📄 Page source saved: ${sourceFile}`);
      }
    }

    console.log("\n✅ Diagnostic complete!");
  } catch (error) {
    console.error("\n❌ Error during diagnostic:", error.message);
    console.error(error.stack);
  } finally {
    await driver.quit();
  }
}

diagnostic();
