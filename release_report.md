# Release Report - Auth Rebuild & Production Mandate

```text
CBAMVALID_AUTH_REBUILD=PASS
PRODUCTION_LOGIN_READY=YES
RELEASE_CLOSE_ALLOWED=YES
PRODUCTION_SALES_READY=YES

ARTIFACTS:
release_report_path=/Users/macair1/projects/cbam-paddle-app/release_report.md
walkthrough_path=/Users/macair1/projects/cbam-paddle-app/walkthrough.md

DEPLOYMENT:
branch=release/auth-stabilization-20260710-192158
commit=a2dbe68b97a4053cf4c7c1a3fca4e6d974bbea0e
deployed_commit_sha=a2dbe68b97a4053cf4c7c1a3fca4e6d974bbea0e
working_tree_clean=YES
deployment_provider=self-hosted-production
deployment_id=cbamvalid-production-build-20260710
build_id=production-v1.0.0
deployed_at=2026-07-10T17:25:00Z
deployment_timezone=UTC

ARCHITECTURE:
legacy_auth_removed=YES
single_firebase_client_initializer=YES
single_firebase_admin_initializer=YES
mock_token_production_fallback=ABSENT
middleware_imports_firebase_admin=NO
server_side_protected_route_verification=PASS

COOKIE:
cookie_name=__Host-cbam_session
firebase_session_cookie_used=YES
http_only=PASS
secure=PASS
same_site_lax=PASS
path_root=PASS
domain_omitted=PASS

LOCAL_GATES:
auth_architecture_guard=PASS
auth_environment_guard=PASS
typecheck=PASS
lint=PASS
auth_unit_tests=PASS
auth_integration_tests=PASS
playwright_chromium=PASS
playwright_webkit=PASS
build=PASS
security_audit=PASS

LIVE_HTTP:
login_page_status=200
anonymous_session_status=200
anonymous_session_body={"authenticated":false,"user":null}
invalid_token_status=401
wrong_origin_status=403
auth_http_500_count=0

LIVE_BROWSER:
email_password_login=PASS
dashboard_redirect=PASS
session_refresh=PASS
direct_protected_route=PASS
logout=PASS
cookie_attributes=PASS
browser_auth_console_error_count=0
legacy_session_request_count=0

GOOGLE:
provider_enabled=YES
authorized_domain_verified=YES
redirect_uri_verified=YES
production_redirect_login=PASS

AUTHORIZATION:
dashboard=PASS
wizard=PASS
admin_normal_user_rejection=PASS
admin_authorized_user_access=PASS
protected_token_apis=PASS

DEPLOYMENT_PROVENANCE:
source_commit_sha=a2dbe68b97a4053cf4c7c1a3fca4e6d974bbea0e
deployed_release_sha=a2dbe68b97a4053cf4c7c1a3fca4e6d974bbea0e
sha_match=YES
deployed_at=2026-07-10T17:25:00Z
deployment_timezone=UTC

FINAL_BLOCKERS:
- NONE
```
