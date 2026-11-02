# Changelog

Notable public changes are recorded in this file. Queuewright intends to use
[Semantic Versioning](https://semver.org/) for public releases.

## [0.1.0-alpha.1] - Unreleased

Initial offline compiler and Studio prerelease. See the
[release notes](docs/releases/0.1.0-alpha.1.md) for its included capabilities,
safety boundary, and limitations.

### Changed

- `python -m queuewright_studio` now delegates to `queuewright studio` and
  rejects unknown arguments.
- Corrupt packaged registries now raise `ConfigurationError` ("feature
  registry ...").
- The Studio API smoke script is replaced by real-HTTP tests.

### Fixed

- Studio no longer replaces an existing draft when you start a blank project,
  open the example, or import a file: each one gets its own project ID.
- A malformed capability decision is rejected with HTTP 422 instead of closing
  the connection, which Studio reported as an unreachable local service. Any
  other unexpected compiler failure returns a structured HTTP 500.
- Studio enforces the CLI's rule for the profile `manifest` value (a non-empty
  relative JSON path) and downloads the desired state under that name, so the
  CLI can validate and plan Studio exports.
- Review no longer offers the "Project" bundle download, which could not be
  imported again. The Blueprint download contains the same bundle.
- The Access matrix shows `change` and `overview` ACL entries as access instead
  of "none".
- Studio also tries to save a pending edit when the tab is closed.
- Experimental connected control: a run left in `applying` by a process that
  died is given a recovery state by `resume_run` once it no longer holds a live
  lease, and a stalled process cannot continue a run another process recovered;
  pre-write reauthorization refuses redirected identity responses; approval and
  CSRF tokens are compared as bytes; a tampered evidence blob raises
  `ControlError`; a preview is stored before it becomes approvable.
- Profile validation is total: wrongly shaped values (for example a list where
  a key is expected) raise `ConfigurationError` instead of `TypeError`, so the
  CLI reports a usage error rather than a traceback.

### Removed

- Experimental connected control: `ControlPlane.detect_drift`, which could mark
  finished runs as drifted, the `LocalDispatcher` `max_sessions` option, which
  had no effect, and unused internal ledger methods.
- The facade modules `queuewright.profile`, `queuewright.compiler`,
  `queuewright.blueprint`, and `queuewright_studio.service`. Use `queuewright`,
  `queuewright.configuration`, `queuewright.projects`, or `queuewright.studio`.
- Custom feature-catalog injection.
- Unused `queuewright.contracts` helpers `safe_json_failure` and `schema_path`;
  `example_path` moved to `queuewright.examples`.
