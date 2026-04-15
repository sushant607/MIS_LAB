# Functional Testing Guide - MIS_LAB

## Overview

Functional testing validates that key user workflows function correctly end-to-end. We use **Selenium WebDriver** with Chrome to automate user interactions and verify expected behavior.

## Features Currently Tested

### 1. **User Signup** (NEW) ✨

**File:** `selenium-tests/signup-flow.mjs`

- Validates user registration with all required fields
- Tests form submission and success confirmation
- Uses unique test data (timestamp-based) to avoid conflicts

### 2. **New Ticket Creation** (Existing)

**File:** `selenium-tests/new-ticket-flow.mjs`

- Tests login flow
- Navigates to ticket creation page
- Validates ticket submission

## Prerequisites

### 1. Backend Server Running

The backend API must be running on `http://localhost:5000`:

```bash
cd .\backend
npm run dev
# Wait for: "Server running on http://localhost:5000"
```

### 2. Frontend Dev Server Running

In another terminal, start the frontend:

```bash
cd .\frontend
npm run dev
# Should be available on http://localhost:8081
```

### 3. Chrome/Chromium Installed

```bash
# Windows: Already installed or use choco install chromium
# Mac: brew install chromium
# Linux: apt-get install chromium-browser

# Dependencies already in package.json:
# - selenium-webdriver
# - Node.js 18+
```

## Running Tests

### Run Signup Test

```bash
npm run test:selenium:signup
```

### Run Ticket Test

```bash
npm run test:selenium:new-ticket
```

### Run All Tests

```bash
npm run test:selenium:all
```

### Run with Custom Configuration

```bash
# Change base URL
SELENIUM_BASE_URL=http://your-server:8081 npm run test:selenium:signup

# Add action delay (default 700ms - useful for slow environments)
SELENIUM_ACTION_DELAY_MS=1500 npm run test:selenium:signup

# For login-based tests, override credentials
SELENIUM_LOGIN_EMAIL=your@email.com SELENIUM_LOGIN_PASSWORD=yourpass npm run test:selenium:new-ticket
```

## Test Output

### Success Output Example

```
🚀 Starting Signup Flow Test...
⏱️  Action delay: 700ms
📍 Step 1: Navigating to signup page...
✅ Signup page loaded
📍 Step 2: Filling name field...
✅ Name entered: QA Test User 1234567890
...
✨ SIGNUP FLOW TEST PASSED! ✨
```

### Failure Handling

- On failure, a screenshot is automatically saved to `selenium-tests/artifacts/`
- Error message and stack trace are logged
- Exit code: 1 (indicates failure)

## Test Structure

Each test follows this pattern:

```
1. Setup (window size, timeouts)
2. Navigate to page
3. Locate and interact with elements
4. Verify success state
5. Screenshot on failure
6. Cleanup
```

## Key Testing Functions

### `waitForVisible(driver, locator, timeout)`

Waits for element to be located AND visible before interacting with it.

### `safeClick(driver, locator)`

Safely clicks elements with proper waits and delays to avoid timing issues.

### `pause(ms)`

Adds configurable delays between actions to simulate realistic user behavior.

### `saveFailureScreenshot(driver, fileName)`

Saves screenshot to `artifacts/` folder for debugging failures.

## Best Practices Applied

✅ **Unique Test Data** - Uses timestamps to prevent email conflicts  
✅ **Explicit Waits** - Waits for elements to be visible before interaction  
✅ **Error Handling** - Screenshots on failure for debugging  
✅ **Realistic Delays** - Configurable action delays simulate real users  
✅ **Clear Logging** - Step-by-step output shows test progress  
✅ **Exit Codes** - Proper exit codes for CI/CD integration

## Next Features to Test

Recommendations for additional functional tests:

### Priority 1 (Critical)

- ❌ **Login with Invalid Credentials** - Validates error handling
- ❌ **View All Tickets** - List and filter functionality

### Priority 2 (Important)

- ❌ **Assign Ticket** - Manager workflow
- ❌ **Update Ticket Status** - Ticket lifecycle
- ❌ **Department Filtering** - Dashboard filtering

### Priority 3 (Nice to Have)

- ❌ **Notification Management** - Mark as read, delete
- ❌ **Employee Management** - CRUD operations
- ❌ **Gmail Integration** - Token refresh flows

## Debugging Failed Tests

### Backend Not Running

**Error:** "Network error. Please check your connection"

**Solution:** Start the backend server before running tests:

```bash
cd .\backend
npm run dev
# Wait until you see "Server running on http://localhost:5000"

# Then in a NEW terminal, run the test
cd .\frontend
npm run test:selenium:signup
```

### Step 1: Check Screenshot

```bash
# Open the artifact after test failure
open selenium-tests/artifacts/signup-failure.png
```

### Step 2: Increase Delay

```bash
# Elements might not load fast enough
SELENIUM_ACTION_DELAY_MS=2000 npm run test:selenium:signup
```

### Step 3: Check Selectors

Look at HTML in browser DevTools and compare with test XPath/ID selectors.

### Step 4: Manual Test

Run the flow manually in browser to understand expected behavior.

## CI/CD Integration Example

### GitHub Actions

```yaml
- name: Run Functional Tests
  run: |
    npm run test:selenium:all
  env:
    SELENIUM_BASE_URL: http://localhost:8081
```

## Common Issues & Solutions

| Issue                       | Solution                                        |
| --------------------------- | ----------------------------------------------- |
| "No such element"           | ✅ Selector changed in UI - update XPath/ID     |
| Timeout waiting for element | ✅ Increase `SELENIUM_ACTION_DELAY_MS`          |
| Chrome crashes              | ✅ Ensure Chromium installed, check disk space  |
| Test email already exists   | ✅ Uses timestamp, shouldn't happen. Check DB.  |
| Wrong base URL              | ✅ Set `SELENIUM_BASE_URL` environment variable |

## File Structure

```
frontend/
└── selenium-tests/
    ├── signup-flow.mjs           ← User registration test
    ├── new-ticket-flow.mjs       ← Ticket creation test
    └── artifacts/                ← Screenshots on failure
        ├── signup-failure.png
        └── new-ticket-failure.png
```
