# Known issues in Queuewright 0.1.0-alpha.1

Thanks for testing Queuewright. This page lists what does not work yet, how to
work around it, and how to report a problem. Queuewright is offline only: it
never connects to a Zammad system, so nothing here can change a live tenant.

## What changed recently, so it does not surprise you

- **A draft that does not validate reopens with a notice.** Studio saves your
  draft after every change, including while it shows a validation error. If you
  close the tab in that state, the draft opens again next time with the message
  "Your last draft does not validate yet". Fix the problem it names, and
  validation and exports work again.
- **Some governance choices are locked.** On the Governance sheet you cannot
  exclude a capability that your design still uses, for example Organization or
  Fields and core workflows while fields exist. Hover over the greyed-out
  Include box to see why. Remove what uses it first.
- **Every role keeps at least one service.** In the Access matrix, "none" is
  greyed out for a role's last remaining service. Give the role another service
  first if you want to remove this one.

## What does not work yet

| Problem | Workaround |
| --- | --- |
| Removing the only service in Structure leaves no roles, and validation fails with "at least one managed role is required". | Add a service again; the error clears. |
| If you exclude "Fields and core workflows" on the Governance sheet and later turn on triggers, scheduled reviews or report profiles, validation fails with "requires enabled dependency fields-core-workflows". | Include "Fields and core workflows" again on the Governance sheet. |
| Stopping Studio's local service with Ctrl-C prints a long error trace. | Harmless; the service has stopped. |
| Starting Studio's local service a second time prints an "Address already in use" error trace. | Another copy is already running on port 8765. Stop it, or keep using it. |
| The Structure inspector mentions a generated "handoff role" for each service, but none is created. | Ignore that line; access comes from the Access matrix. |
| Weekly reviews are always scheduled for Monday 07:00 Europe/Berlin, whatever time zone you set on the Organization sheet. | Edit the exported files if you need another schedule. |
| The classification features suggest university-style values (students, faculty, professional services), and sensitive-area handling picks a service whose name contains "security". | Edit the values in the exported files. |
| Plan files written with `plan --output` can only be read by your own user account. | Change the file's permissions before sharing it. |
| `plan --output` can fail with "cannot write plan output" on USB sticks or network shares formatted as FAT or exFAT, and on some network drives. | Write the plan to your local disk, then copy it. |
| Third-party JSON Schema validators cannot find the referenced schemas by themselves. | Load all five Queuewright schema files (they ship with the package, next to its schema notes) into your validator before validating. |
| There is no `--version` option, and the local service writes no log. | See "Reporting a bug" for how to find the version. Copy error text from the Studio screen. |
| Windows is not supported in this alpha. | Use macOS or Linux. |
| Studio has been checked with automated tests, but nobody has yet reviewed it by hand on small screens, with keyboard only, or with reduced motion. | Please report anything that looks wrong or is hard to use. |

Drafts live only in your browser, for the address `http://127.0.0.1:5173`.
There is no delete button: clearing that site's browser data removes all drafts.
Do not put passwords, tenant addresses, or customer data into a project.

## Reporting a bug

Open an issue at <https://github.com/sebastianspicker/queuewright-zammad/issues>
with the "Bug report" form. Please include:

1. **What you did**: the smallest set of steps that shows the problem. If it
   happened in Studio, name the sheet (for example Features or Access) and the
   control you used.
2. **What you saw**: the exact error text. In Studio, copy the message shown
   under "Validation" in the title block or on the Review sheet, and any notice
   on the Start sheet. On the command line, copy the full output.
3. **What you expected** instead.
4. **Version**: run `git rev-parse --short HEAD` in your checkout, and
   `.venv/bin/python -m pip show queuewright` for the package version.
5. **Environment**: operating system, `python3 --version`, `node --version`,
   and your browser with its version.
6. **A project file, if you can share one.** If the project validates, download
   it from the Review sheet and attach it, after checking that it contains no
   real names, addresses, or customer data. Downloads are disabled while the
   project does not validate; then the steps from point 1 are enough.

Security problems go through the private process described in the
repository's security policy, not a public issue.
