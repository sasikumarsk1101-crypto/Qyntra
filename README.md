# Qyntra QA Test Engineer

## Run locally

Open PowerShell in this folder and run:

```powershell
.\run-qyntra.ps1
```

The script compiles the Java 21 backend into a temporary folder and serves the app at [http://localhost:8080](http://localhost:8080). Sign in to the QA workspace with any non-empty demo username and password; the QA Test Engineer runner animates for five seconds before opening the dashboard.

At startup, configure a Developer username and password when prompted. The password is entered as a secure PowerShell prompt, is not stored in source files, and is cleared from the launch process environment when the server exits. Developers sign in at [http://localhost:8080/developer.html](http://localhost:8080/developer.html), or use **Switch to Developer** in the QA dashboard profile menu. Their assigned-bug workspace supports project filtering, report and attachment viewing, status/fix updates, and developer comments. Developer credentials are checked by the Java server and its login session is held in an HttpOnly cookie.

## Gemini chat and spreadsheet test cases

The launch script asks securely for a Google Gemini API key. Press Enter to run without AI, or enter a key to enable Gemini. The key is available only to the Java server process and is removed from the PowerShell environment when the server exits. The default model is `gemini-2.5-flash`; set `GEMINI_MODEL` before launch to select another compatible Gemini model.

In **Add New → Test case → AI draft**, chat with Gemini, optionally attach up to five PNG, JPG, or WEBP screenshots (900 KB max each), and ask for test cases from the screen. Gemini returns an editable spreadsheet-style table. Download the cases as Excel-compatible CSV, adjust individual cells, and add the reviewed cases to the project. Test-case CSV/JSON imports open an editable preview before saving and can be sent to Gemini for review.

## Projects and data

Use the project selector in the top bar or **Projects** menu to switch projects or add a new project. Test cases, bugs, test plans, and notes are filtered to the active project. Each test case gets a project-wide generated number and stores feature, prerequisites, test data, steps, expected result, bug details, comments, and IT1–IT3 test/fix results. Attach up to three PDF, Word, Excel, CSV, or text report documents (500 KB each); PDFs open in a new tab and other files can be downloaded from **View full test case & documents**. Use **Edit this test report** to update results, comments, and attach more documents. Browser workspace data is stored in local storage on this device, so the QA and Developer portals share updates in the same browser profile; different devices/browsers do not share records. QA login is a demo flow, not production authentication.

Bug reports capture priority, QA status, assignee, reproduction steps, expected and actual results, tester comments, and developer fix status. Attach up to five PNG, JPG, or WEBP screenshots (900 KB each). After saving, choose **Add another bug** or **View saved report**. Use **Bulk add** for shared report details across multiple titles, or **Import** with CSV/JSON; the bug import tab provides a downloadable CSV template.

Use **Add New** in the QA workspace navigation to open the dedicated record-creation page. Select **Bug report** or **Test case**, then choose the template, bulk, AI draft (test cases), or import workflow. Bug tracker status and priority filters use custom keyboard-accessible dropdown menus.
