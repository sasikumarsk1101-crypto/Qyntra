# Qyntra QA Test Engineer

## Run locally

Open PowerShell in this folder and run:

```powershell
.\run-qyntra.ps1
```

The script compiles the Java 21 backend into a temporary folder and serves the app at [http://localhost:8080](http://localhost:8080). Sign in to the QA workspace with any non-empty demo username and password; the QA Test Engineer runner animates for five seconds before opening the dashboard.

At startup, configure a Developer username and password when prompted. The password is entered as a secure PowerShell prompt, is not stored in source files, and is cleared from the launch process environment when the server exits. Developers sign in at [http://localhost:8080/developer.html](http://localhost:8080/developer.html). Their assigned-bug workspace supports project filtering, report and attachment viewing, status/fix updates, and developer comments. Developer credentials are checked by the Java server and its login session is held in an HttpOnly cookie.

## AI screenshot-to-test-case drafts

The launch script asks for an OpenAI API key securely. Press Enter to run without AI, or enter a key to enable screenshot analysis. The key is available only to the Java server process and is removed from the PowerShell environment when the server exits.

In **Test Cases → AI Draft**, upload one to five PNG, JPG, or WEBP screenshots (900 KB max each) and describe the expected workflow. OpenAI generates cases using the project test-case template: feature, prerequisites, steps, expected result, tester/developer comments, and three test/fix cycles. Unrun results and comments are left blank or marked not run. Review the drafts before saving. Screenshot analysis requires an OpenAI account with access to `gpt-4o-mini`.

## Projects and data

Use the project selector in the top bar or **Projects** menu to switch projects or add a new project. Test cases, bugs, test plans, and notes are filtered to the active project. Each test case gets a project-wide generated number and stores feature, prerequisites, test data, steps, expected result, bug details, comments, and IT1–IT3 test/fix results. Attach up to three PDF, Word, Excel, CSV, or text report documents (500 KB each); PDFs open in a new tab and other files can be downloaded from **View full test case & documents**. Use **Edit this test report** to update results, comments, and attach more documents. Browser workspace data is stored in local storage on this device, so the QA and Developer portals share updates in the same browser profile; different devices/browsers do not share records. QA login is a demo flow, not production authentication.
