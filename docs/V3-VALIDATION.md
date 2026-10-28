# Cycle V3 — validation and data contract

## Compatibility

- `cycle.v1` and `version: 1` retained; hydration never writes a migration.
- Optional observation flags distinguish explicit negative answers from missing legacy answers.
- Existing flow/sexual observations, notes and import markers survive backup round trips.
- Conflicting import or same-day multi-tab versions are retained in `backupConflicts` and included in exports.
- Corrupt or unsupported documents block writes and remain exportable in their original form.
- Drafts are memory-only, survive internal navigation and are not saved observations. Reload warns before discarding them.

## Conservative interpretation

- Ongoing or ambiguous menstrual episodes do not enter the duration average.
- A completed episode requires contiguous observed flow and an explicit no-flow day immediately after it.
- Sparse history, excluded intervals, long absences and high variability suspend predictions.
- No multi-cycle fixed-duration period projections. Optional ovulation/fertile intervals carry uncertainty and are not contraception.
- Pattern comparisons use the same signal on both sides, disjoint energy samples, fixed windows and repeated evidence across cycles.
- Missing data, adequate data without a pattern, and supported observations have distinct UI states.

## Verification

- 58 unit/regression tests: storage, legacy observations, corruption, backup/conflicts, episodes, predictions, insights and wellness.
- 107 browser assertions: 320/375/390/430/1440 px, onboarding, restore/export, draft navigation, check-in, focus, settings, offline, refresh, legacy hydration, write failures, multi-tab and insight evidence navigation.
- No JavaScript errors or external application requests in the local browser suite.
- Typecheck, ESLint and production Webpack build pass. PostCSS configuration follows the installed Next.js documentation; Webpack avoids the environment's Turbopack port-binding failure.
- All browser contexts are isolated. Fixtures are synthetic; screenshots stay outside the repository.

## Limits

- Native Safari/iOS installation and screen readers still need device validation.
- localStorage and exported JSON are not encrypted. A private backup remains important.
- No probabilistic or medical calibration is claimed for calendar estimates.
- Historical ambiguous episodes stay ambiguous until the person supplies missing observations.
- Source deletion does not erase previous Git commits, historical deployments or assets already downloaded by other devices. The new service worker retires old Cycle caches on activation.
