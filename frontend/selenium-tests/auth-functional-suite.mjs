import fs from "node:fs/promises";
import path from "node:path";
import { Builder, By, Key, until } from "selenium-webdriver";
import * as XLSX from "xlsx";

const BASE_URL = process.env.SELENIUM_BASE_URL || "http://localhost:8080";
const ACTION_DELAY_MS = Number(process.env.SELENIUM_ACTION_DELAY_MS || 500);
const OUTPUT_DIR = path.resolve("selenium-tests", "artifacts");

const VALID_USER = {
  name: `FT User ${Date.now()}`,
  email: `ft.user.${Date.now()}@example.com`,
  password: "ValidPassword@123",
  department: "support team A",
  role: "Employee",
  skills: ["troubleshooting", "networking"],
};

function nowIso() {
  return new Date().toISOString();
}

function toResultRow({
  id,
  feature,
  scenario,
  steps,
  testData,
  expected,
  actual,
  status,
}) {
  return {
    "Test Case ID": id,
    Feature: feature,
    "Test Scenario": scenario,
    "Steps to Execute": steps,
    "Test Data (Input)": testData,
    "Expected Result": expected,
    "Actual Result": actual,
    Status: status,
  };
}

function applySheetLayout(sheet, widths) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  if (sheet["!ref"]) {
    sheet["!autofilter"] = { ref: sheet["!ref"] };
  }
}

async function pause(ms = ACTION_DELAY_MS) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVisible(driver, locator, timeout = 15000) {
  const el = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(el), timeout);
  return el;
}

async function clearAndType(driver, id, value) {
  const input = await waitForVisible(driver, By.id(id));
  await input.clear();
  await pause(100);
  await input.sendKeys(value);
  await pause(100);
}

async function clickByText(driver, text) {
  const btn = await waitForVisible(
    driver,
    By.xpath(`//button[contains(normalize-space(.), '${text}')]`),
    15000,
  );
  await driver.executeScript("arguments[0].scrollIntoView(true);", btn);
  await pause(150);
  await btn.click();
}

async function selectDepartmentRoleAndSkills(driver) {
  const deptButton = await waitForVisible(
    driver,
    By.xpath("//label[contains(text(), 'Department')]/following::button[1]"),
  );
  await deptButton.click();
  await pause(400);
  await driver.actions().sendKeys(Key.ARROW_DOWN).perform();
  await pause(100);
  await driver.actions().sendKeys(Key.ENTER).perform();

  const roleButton = await waitForVisible(
    driver,
    By.xpath("//label[contains(text(), 'Role')]/following::button[1]"),
  );
  await roleButton.click();
  await pause(400);
  await driver.actions().sendKeys(Key.ARROW_DOWN).perform();
  await pause(100);
  await driver.actions().sendKeys(Key.ENTER).perform();

  for (const skill of VALID_USER.skills) {
    const skillsButton = await waitForVisible(
      driver,
      By.xpath("//label[contains(text(), 'Skills')]/following::button[1]"),
    );
    await skillsButton.click();
    await pause(400);
    await driver.actions().sendKeys(skill[0].toUpperCase()).perform();
    await pause(100);
    await driver.actions().sendKeys(Key.ENTER).perform();
    await pause(300);
  }
}

async function getPageText(driver) {
  const body = await waitForVisible(driver, By.tagName("body"), 10000);
  return body.getText();
}

async function saveScreenshot(driver, name) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const image = await driver.takeScreenshot();
  const filePath = path.join(OUTPUT_DIR, name);
  await fs.writeFile(filePath, image, "base64");
  return filePath;
}

async function resetAppState(driver) {
  await driver.get(`${BASE_URL}/login`);
  await driver.executeScript(
    "window.localStorage.clear(); window.sessionStorage.clear();",
  );
  await driver.manage().deleteAllCookies();
  await pause(150);
}

async function runCase(driver, def, testFn) {
  try {
    await resetAppState(driver);
    const actual = await testFn();
    return toResultRow({ ...def, actual, status: "PASS" });
  } catch (err) {
    const actual = err instanceof Error ? err.message : String(err);
    try {
      await saveScreenshot(driver, `${def.id.toLowerCase()}-failed.png`);
    } catch {
      // Ignore screenshot errors to keep suite execution alive.
    }
    return toResultRow({ ...def, actual, status: "FAIL" });
  }
}

async function tc01_signupSuccess(driver) {
  await driver.get(`${BASE_URL}/signup`);
  await pause();
  await clearAndType(driver, "name", VALID_USER.name);
  await clearAndType(driver, "email", VALID_USER.email);
  await clearAndType(driver, "password", VALID_USER.password);
  await clearAndType(driver, "confirmPassword", VALID_USER.password);
  await selectDepartmentRoleAndSkills(driver);
  await clickByText(driver, "Create Account");
  await driver.wait(until.urlContains("/dashboard"), 20000);
  const url = await driver.getCurrentUrl();
  if (!url.includes("/dashboard")) {
    throw new Error(`Expected dashboard redirect, got ${url}`);
  }
  return `Redirected to ${url}`;
}

async function tc02_signupMissingDepartment(driver) {
  await driver.get(`${BASE_URL}/signup`);
  await pause();
  await clearAndType(driver, "name", `No Dept ${Date.now()}`);
  await clearAndType(driver, "email", `nodept.${Date.now()}@example.com`);
  await clearAndType(driver, "password", VALID_USER.password);
  await clearAndType(driver, "confirmPassword", VALID_USER.password);
  await clickByText(driver, "Create Account");
  const text = await getPageText(driver);
  if (!text.includes("Department is required")) {
    throw new Error("Expected 'Department is required' validation message");
  }
  return "Validation shown: Department is required";
}

async function tc03_signupPasswordMismatch(driver) {
  await driver.get(`${BASE_URL}/signup`);
  await pause();
  await clearAndType(driver, "name", `Mismatch ${Date.now()}`);
  await clearAndType(driver, "email", `mismatch.${Date.now()}@example.com`);
  await clearAndType(driver, "password", VALID_USER.password);
  await clearAndType(driver, "confirmPassword", "DifferentPassword@123");
  const deptButton = await waitForVisible(
    driver,
    By.xpath("//label[contains(text(), 'Department')]/following::button[1]"),
  );
  await deptButton.click();
  await pause(300);
  await driver.actions().sendKeys(Key.ARROW_DOWN).perform();
  await driver.actions().sendKeys(Key.ENTER).perform();
  await clickByText(driver, "Create Account");
  const text = await getPageText(driver);
  if (!text.includes("Passwords do not match")) {
    throw new Error("Expected 'Passwords do not match' validation message");
  }
  return "Validation shown: Passwords do not match";
}

async function tc04_loginSuccess(driver) {
  await driver.get(`${BASE_URL}/login`);
  await pause();
  await clearAndType(driver, "email", VALID_USER.email);
  await clearAndType(driver, "password", VALID_USER.password);
  await clickByText(driver, "Sign In");
  await driver.wait(until.urlContains("/dashboard"), 20000);
  const url = await driver.getCurrentUrl();
  return `Redirected to ${url}`;
}

async function tc05_loginInvalidPassword(driver) {
  await driver.get(`${BASE_URL}/login`);
  await pause();
  await clearAndType(driver, "email", VALID_USER.email);
  await clearAndType(driver, "password", "WrongPassword@999");
  await clickByText(driver, "Sign In");
  await pause(1000);
  const text = await getPageText(driver);
  if (!text.includes("Invalid credentials")) {
    throw new Error("Expected 'Invalid credentials' message");
  }
  return "Validation shown: Invalid credentials";
}

async function tc06_loginMissingPassword(driver) {
  await driver.get(`${BASE_URL}/login`);
  await pause();
  await clearAndType(driver, "email", VALID_USER.email);
  await clearAndType(driver, "password", "   ");
  await clickByText(driver, "Sign In");
  await pause(800);
  const text = await getPageText(driver);
  if (!text.includes("Password is required")) {
    throw new Error("Expected 'Password is required' validation message");
  }
  return "Validation shown: Password is required";
}

async function writeExcelReport(executionRows) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const workbook = XLSX.utils.book_new();

  const summaryRows = executionRows.map((row) => ({
    "Test Case ID": row["Test Case ID"],
    Feature: row.Feature,
    "Test Scenario": row["Test Scenario"],
    "Expected Result": row["Expected Result"],
    "Actual Result": row["Actual Result"],
    Status: row.Status,
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  applySheetLayout(summarySheet, [12, 10, 28, 42, 42, 10]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const executionSheet = XLSX.utils.json_to_sheet(executionRows);
  applySheetLayout(executionSheet, [12, 10, 24, 48, 45, 38, 38, 10]);
  XLSX.utils.book_append_sheet(workbook, executionSheet, "Detailed");

  const reportPath = path.join(OUTPUT_DIR, "auth-functional-results.xlsx");
  XLSX.writeFile(workbook, reportPath);
  return reportPath;
}

async function runSuite() {
  const driver = await new Builder().forBrowser("chrome").build();
  const results = [];

  const cases = [
    {
      id: "TC01",
      feature: "Signup",
      scenario: "Valid signup",
      steps:
        "1) Open /signup 2) Fill all required fields with valid data 3) Click Create Account",
      testData: `name=${VALID_USER.name}; email=${VALID_USER.email}; password=${VALID_USER.password}; department=${VALID_USER.department}; role=employee; skills=troubleshooting,networking`,
      expected: "User is redirected to /dashboard after Create Account",
      fn: () => tc01_signupSuccess(driver),
    },
    {
      id: "TC02",
      feature: "Signup",
      scenario: "Missing department",
      steps:
        "1) Open /signup 2) Fill name,email,password,confirm password 3) Do not select department 4) Click Create Account",
      testData: "department=<not selected>; other fields valid",
      expected: "Department is required validation is shown",
      fn: () => tc02_signupMissingDepartment(driver),
    },
    {
      id: "TC03",
      feature: "Signup",
      scenario: "Password mismatch",
      steps:
        "1) Open /signup 2) Fill valid values 3) Set confirm password different from password 4) Submit",
      testData:
        "password=ValidPassword@123; confirmPassword=DifferentPassword@123",
      expected: "Passwords do not match validation is shown",
      fn: () => tc03_signupPasswordMismatch(driver),
    },
    {
      id: "TC04",
      feature: "Login",
      scenario: "Valid login",
      steps: "1) Open /login 2) Enter valid email/password 3) Click Sign In",
      testData: `email=${VALID_USER.email}; password=${VALID_USER.password}`,
      expected: "User is redirected to /dashboard",
      fn: () => tc04_loginSuccess(driver),
    },
    {
      id: "TC05",
      feature: "Login",
      scenario: "Invalid password",
      steps:
        "1) Open /login 2) Enter valid email + wrong password 3) Click Sign In",
      testData: `email=${VALID_USER.email}; password=WrongPassword@999`,
      expected: "Invalid credentials message is shown",
      fn: () => tc05_loginInvalidPassword(driver),
    },
    {
      id: "TC06",
      feature: "Login",
      scenario: "Missing password",
      steps:
        "1) Open /login 2) Enter email only 3) Keep password blank/whitespace 4) Click Sign In",
      testData: `email=${VALID_USER.email}; password=<blank>`,
      expected: "Password is required validation is shown",
      fn: () => tc06_loginMissingPassword(driver),
    },
  ];

  try {
    console.log("\\n🚀 Running Auth Functional Suite (6 test cases)...\\n");
    await driver.manage().window().setRect({ width: 1440, height: 960 });
    await driver.manage().setTimeouts({ pageLoad: 60000, script: 30000 });

    for (const c of cases) {
      console.log(`▶ ${c.id} - ${c.feature}: ${c.scenario}`);
      const row = await runCase(
        driver,
        {
          id: c.id,
          feature: c.feature,
          scenario: c.scenario,
          steps: c.steps,
          testData: c.testData,
          expected: c.expected,
        },
        c.fn,
      );
      results.push(row);
      console.log(`  ${row.Status} - ${row["Actual Result"]}`);
    }

    const reportPath = await writeExcelReport(results);
    const passCount = results.filter((r) => r.Status === "PASS").length;
    const failCount = results.length - passCount;

    console.log("\\n================ Summary ================");
    console.log(`Total: ${results.length}`);
    console.log(`PASS:  ${passCount}`);
    console.log(`FAIL:  ${failCount}`);
    console.log(`Excel report: ${reportPath}`);
    console.log("=========================================\\n");

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await driver.quit();
  }
}

runSuite().catch((err) => {
  console.error("Suite crashed:", err);
  process.exit(1);
});
