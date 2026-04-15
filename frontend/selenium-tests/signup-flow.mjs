import fs from "node:fs/promises";
import path from "node:path";
import { Builder, By, Key, until } from "selenium-webdriver";

const BASE_URL = process.env.SELENIUM_BASE_URL || "http://localhost:8080";
const ACTION_DELAY_MS = Number(process.env.SELENIUM_ACTION_DELAY_MS || 700);

// Unique test data to avoid conflicts with existing users
const NEW_USER = {
  name: `QA Test User ${Date.now()}`,
  email: `qa.test.${Date.now()}@example.com`,
  password: "ValidPassword@123",
  department: "support team A", // Must match DEPARTMENTS in SignupPage
  role: "employee", // Must match ROLES.value in SignupPage
  skills: ["troubleshooting", "networking"],
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

async function saveFailureScreenshot(driver, fileName = "signup-failure.png") {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const image = await driver.takeScreenshot();
  const targetPath = path.join(OUTPUT_DIR, fileName);
  await fs.writeFile(targetPath, image, "base64");
  console.log(`📸 Screenshot saved: ${targetPath}`);
  return targetPath;
}

async function runSignupFlow() {
  const driver = await new Builder().forBrowser("chrome").build();

  try {
    console.log("🚀 Starting Signup Flow Test...");
    console.log(`⏱️  Action delay: ${ACTION_DELAY_MS}ms`);

    // Setup
    await driver.manage().window().setRect({ width: 1440, height: 960 });
    await driver.manage().setTimeouts({ pageLoad: 60000, script: 30000 });

    // Step 1: Navigate to signup page
    console.log("📍 Step 1: Navigating to signup page...");
    await driver.get(`${BASE_URL}/signup`);
    await pause();
    console.log("✅ Signup page loaded");

    // Step 2: Fill in name field
    console.log("📍 Step 2: Filling name field...");
    const nameInput = await waitForVisible(driver, By.id("name"));
    await nameInput.clear();
    await pause();
    await nameInput.sendKeys(NEW_USER.name);
    await pause();
    console.log(`✅ Name entered: ${NEW_USER.name}`);

    // Step 3: Fill in email field
    console.log("📍 Step 3: Filling email field...");
    const emailInput = await waitForVisible(driver, By.id("email"));
    await emailInput.clear();
    await pause();
    await emailInput.sendKeys(NEW_USER.email);
    await pause();
    console.log(`✅ Email entered: ${NEW_USER.email}`);

    // Step 4: Fill in password field
    console.log("📍 Step 4: Filling password field...");
    const passwordInput = await waitForVisible(driver, By.id("password"));
    await passwordInput.clear();
    await pause();
    await passwordInput.sendKeys(NEW_USER.password);
    await pause();
    console.log("✅ Password entered");

    // Step 5: Fill in confirm password field
    console.log("📍 Step 5: Filling confirm password field...");
    const confirmPasswordInput = await waitForVisible(
      driver,
      By.id("confirmPassword"),
    );
    await confirmPasswordInput.clear();
    await pause();
    await confirmPasswordInput.sendKeys(NEW_USER.password);
    await pause();
    console.log("✅ Confirm password entered");

    // Step 6: Select department
    console.log("📍 Step 6: Selecting department...");
    try {
      // Find the button that triggers the department dropdown
      const departmentButton = await waitForVisible(
        driver,
        By.xpath(
          "//label[contains(text(), 'Department')]/following::button[1]",
        ),
        10000,
      );

      // Scroll into view
      await driver.executeScript(
        "arguments[0].scrollIntoView(true);",
        departmentButton,
      );
      await pause(300);

      // Click to open dropdown
      await departmentButton.click();
      await pause(800);

      // Use keyboard navigation: arrow down twice to get to "support team A", then enter
      // Wait a bit for dropdown to fully render
      await pause(300);

      // Press down arrow to navigate to first option (if there's a default highlighted)
      await driver.actions().sendKeys(Key.ARROW_DOWN).perform();
      await pause(200);

      // Press enter to select
      await driver.actions().sendKeys(Key.ENTER).perform();
      await pause(500);

      console.log(`✅ Department selected using keyboard`);
    } catch (error) {
      console.error("Failed to select department:", error.message);
      throw error;
    }

    // Step 7: Select role
    console.log("📍 Step 7: Selecting role...");
    try {
      // Find the role button
      const roleButton = await waitForVisible(
        driver,
        By.xpath("//label[contains(text(), 'Role')]/following::button[1]"),
        10000,
      );

      // Scroll into view
      await driver.executeScript(
        "arguments[0].scrollIntoView(true);",
        roleButton,
      );
      await pause(300);

      // Click to open
      await roleButton.click();
      await pause(800);

      // "Employee" is typically the first option after the placeholder
      await driver.actions().sendKeys(Key.ARROW_DOWN).perform();
      await pause(200);
      await driver.actions().sendKeys(Key.ENTER).perform();
      await pause(500);

      console.log(`✅ Role selected: Employee`);
    } catch (error) {
      console.error("Failed to select role:", error.message);
      throw error;
    }

    // Step 8: Select skills
    console.log("📍 Step 8: Selecting skills...");
    try {
      // Skills dropdown has multiple selections - we need to select each skill
      for (const skill of NEW_USER.skills) {
        const skillsButton = await waitForVisible(
          driver,
          By.xpath("//label[contains(text(), 'Skills')]/following::button[1]"),
          10000,
        );

        // Scroll into view
        await driver.executeScript(
          "arguments[0].scrollIntoView(true);",
          skillsButton,
        );
        await pause(300);

        // Click to open
        await skillsButton.click();
        await pause(800);

        // Use keyboard to find and select the skill
        // "Troubleshooting" starts with 't', "Networking" starts with 'n'
        const firstLetter = skill[0].toUpperCase();

        // Type to jump to option
        await driver.actions().sendKeys(firstLetter).perform();
        await pause(300);

        // Press enter to select
        await driver.actions().sendKeys(Key.ENTER).perform();
        await pause(600);
      }

      console.log(`✅ Skills selected: ${NEW_USER.skills.join(", ")}`);
    } catch (error) {
      console.error("Failed to select skills:", error.message);
      throw error;
    }

    await pause(500);

    // Step 9: Submit signup form
    console.log("📍 Step 9: Submitting signup form...");
    const submitButton = await waitForVisible(
      driver,
      By.xpath(
        "//button[@type='submit' and contains(normalize-space(.), 'Create Account')]",
      ),
      10000,
    );
    await submitButton.click();
    console.log("✅ Form submitted");

    // Step 10: Wait for success (redirect to dashboard)
    console.log("📍 Step 10: Waiting for signup confirmation...");
    try {
      // Add a longer wait for redirect
      await pause(2000);

      // Check if we redirected to dashboard
      const url = await driver.getCurrentUrl();
      console.log(`📍 Current URL after submission: ${url}`);

      // Wait for dashboard URL
      await driver.wait(until.urlContains("/dashboard"), 15000);
      console.log("✅ Successfully redirected to dashboard");
    } catch (redirectError) {
      // If redirect fails, check for form errors
      console.log("⚠️  Redirect wait timed out, checking for errors...");

      // Check for network error specifically
      const bodyText = await driver.findElement(By.tagName("body")).getText();
      if (
        bodyText.includes("Network error") ||
        bodyText.includes("network error") ||
        bodyText.includes("check your connection")
      ) {
        throw new Error(
          `Backend API is not accessible. Ensure backend server is running on http://localhost:5000\n` +
            `To start backend: cd backend && npm run dev\n` +
            `Current backend URL: http://localhost:5000/api`,
        );
      }

      // Check for error alert on the page
      const errorAlerts = await driver.findElements(
        By.xpath(
          "//div[@class='alert' or contains(@class, 'Alert')]//div[contains(text(), 'Error') or contains(text(), 'error') or contains(@class, 'text-red')]",
        ),
      );

      if (errorAlerts.length > 0) {
        const errorText = await errorAlerts[0].getText();
        throw new Error(`Registration error on form: ${errorText}`);
      }

      // Check for any text containing "error" or "invalid"
      const pageText = await driver.findElement(By.tagName("body")).getText();
      if (
        pageText.includes("error") ||
        pageText.includes("Error") ||
        pageText.includes("invalid")
      ) {
        // Take screenshot for debugging
        await saveFailureScreenshot(driver, "signup-error-detected.png");
        throw new Error(
          "Error detected on page after form submission. Check screenshot.",
        );
      }

      // If no error but also no redirect, try checking the current URL
      const currentUrl = await driver.getCurrentUrl();
      if (currentUrl.includes("/signup")) {
        throw new Error(
          `Form submission failed - still on signup page: ${currentUrl}`,
        );
      }

      throw redirectError;
    }

    // Step 11: Verification - check final state
    console.log("📍 Step 11: Verifying registration success...");
    const finalUrl = await driver.getCurrentUrl();
    console.log(`✅ Final URL confirmed: ${finalUrl}`);

    if (!finalUrl.includes("/dashboard")) {
      throw new Error(`Expected to be on dashboard, but at: ${finalUrl}`);
    }

    console.log("\n✨ SIGNUP FLOW TEST PASSED! ✨\n");
    console.log("Test Summary:");
    console.log(`  User Name: ${NEW_USER.name}`);
    console.log(`  User Email: ${NEW_USER.email}`);
    console.log(`  Department: ${NEW_USER.department}`);
    console.log(`  Role: ${NEW_USER.role}`);
    console.log("  Status: ✅ REGISTERED SUCCESSFULLY");
  } catch (error) {
    console.error("\n❌ SIGNUP FLOW TEST FAILED! ❌\n");
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);

    await saveFailureScreenshot(driver);
    process.exit(1);
  } finally {
    await driver.quit();
  }
}

// Run the test
runSignupFlow().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
