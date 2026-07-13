# Do Not Declare PASS Without Runtime Evidence

The following are explicitly insufficient for `REVENUE_RELEASE_READY=YES`:

- a walkthrough-video change;
- a successful local build;
- unit tests only;
- fixture or synthetic webhook tests;
- identifiers containing `test`, `sandbox`, `fixture`, `mock` or `example`;
- a generated ZIP without post-build manifest verification;
- a source SHA without deployment and live-build SHA evidence.
