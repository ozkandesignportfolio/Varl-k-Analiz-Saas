
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** N/A
- **Date:** 2026-02-27
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Login with valid credentials redirects to Dashboard
- **Test Code:** [TC001_Login_with_valid_credentials_redirects_to_Dashboard.py](./TC001_Login_with_valid_credentials_redirects_to_Dashboard.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login attempt failed - 'Invalid login credentials' message displayed on the login page.
- After submitting credentials the application did not navigate to the dashboard; current URL remains '/login'.
- Protected dashboard content ('Dashboard') is not visible on the page.
- No successful authentication observed with the provided credentials; the user remains on the login form.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/29ed1fd5-95c4-48f5-811c-7d3c12c61197
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Login with invalid credentials shows authentication error
- **Test Code:** [TC002_Login_with_invalid_credentials_shows_authentication_error.py](./TC002_Login_with_invalid_credentials_shows_authentication_error.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/2cfb0c44-514c-463c-ae98-9976ddf4d05e
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 After login, user can access a protected route via in-app navigation
- **Test Code:** [TC007_After_login_user_can_access_a_protected_route_via_in_app_navigation.py](./TC007_After_login_user_can_access_a_protected_route_via_in_app_navigation.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- ASSERTION: Login failed - 'Invalid login credentials' error displayed after submitting the provided test credentials.
- ASSERTION: Authenticated session not established - the application did not redirect to /dashboard; current URL remains /login.
- ASSERTION: Protected page access (/assets) could not be verified because authentication failed and navigation to the protected area could not be performed.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/94b9bcb6-cf5f-4c72-9e4d-73b5d89c1801
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Save a new asset and verify it is listed on /assets
- **Test Code:** [TC008_Save_a_new_asset_and_verify_it_is_listed_on_assets.py](./TC008_Save_a_new_asset_and_verify_it_is_listed_on_assets.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - 'Invalid login credentials' message displayed after submitting credentials
- Dashboard page did not load after login - current URL remains /login
- Assets creation test could not be performed because the user is not authenticated and dashboard was not reachable
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/25f3f0d8-dad5-447e-ba9b-bf713c1b6f7f
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Create a maintenance rule for an asset and verify it appears in the list
- **Test Code:** [TC010_Create_a_maintenance_rule_for_an_asset_and_verify_it_appears_in_the_list.py](./TC010_Create_a_maintenance_rule_for_an_asset_and_verify_it_appears_in_the_list.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - 'Invalid login credentials' message is displayed on the login page.
- Dashboard page did not load after authentication attempt; current URL remains /login.
- Maintenance functionality could not be tested because the user is not authenticated and the dashboard was not reachable.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/e34e5ca0-6852-499a-b9e7-b8d029fea411
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Create a maintenance rule with interval and next due date and verify calculated next maintenance date is shown
- **Test Code:** [TC011_Create_a_maintenance_rule_with_interval_and_next_due_date_and_verify_calculated_next_maintenance_date_is_shown.py](./TC011_Create_a_maintenance_rule_with_interval_and_next_due_date_and_verify_calculated_next_maintenance_date_is_shown.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - 'Failed to fetch' error displayed on the login page after submitting credentials
- Dashboard page did not load after signing in; current URL remains '/login'
- Maintenance rules list not reachable because the user is not authenticated / dashboard is inaccessible
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/9c1dc30b-8560-4553-b4dc-2998aae2c0bd
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 Validate required interval when creating a maintenance rule (empty interval)
- **Test Code:** [TC012_Validate_required_interval_when_creating_a_maintenance_rule_empty_interval.py](./TC012_Validate_required_interval_when_creating_a_maintenance_rule_empty_interval.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Dashboard page not reached after login — current URL remains '/login' and the login form is visible.
- Maintenance navigation item not present because the application remained on the login page.
- Clicking 'Giriş Yap' did not navigate away from the login page; authentication flow did not complete.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/0b648b43-aeca-4708-9bf7-081a9d0d22dc
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Validate interval cannot be negative when creating a maintenance rule
- **Test Code:** [TC013_Validate_interval_cannot_be_negative_when_creating_a_maintenance_rule.py](./TC013_Validate_interval_cannot_be_negative_when_creating_a_maintenance_rule.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - 'Invalid login credentials' message displayed after submitting credentials
- Dashboard page did not load after sign-in; current URL remains the login page
- Unable to reach Maintenance page to test negative interval validation because authentication did not succeed
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/5e313bf9-1ea8-43c7-abdc-0a63343a239b
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Create a service log with asset, notes, and cost (without upload)
- **Test Code:** [TC015_Create_a_service_log_with_asset_notes_and_cost_without_upload.py](./TC015_Create_a_service_log_with_asset_notes_and_cost_without_upload.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - 'Invalid login credentials' message displayed after submitting credentials
- Dashboard page did not load after sign-in; current URL remains /login
- Services page not accessible because the user did not authenticate successfully
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/66b08fde-df46-4b95-9cb0-2289ee4ee37e
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 Validation: attempt to save a service entry without selecting an asset
- **Test Code:** [TC017_Validation_attempt_to_save_a_service_entry_without_selecting_an_asset.py](./TC017_Validation_attempt_to_save_a_service_entry_without_selecting_an_asset.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - 'Invalid login credentials' message displayed after submitting test credentials
- Dashboard page not reached - current URL remains /login after sign in
- Unable to access Services or create service entry because authentication did not succeed
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/9f368493-e9f6-4192-8a68-7e7276c70180
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019 Filter documents list by Warranty type
- **Test Code:** [TC019_Filter_documents_list_by_Warranty_type.py](./TC019_Filter_documents_list_by_Warranty_type.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/7acede92-404a-4d32-87f4-5cb551b30abc
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020 Delete an existing document from the list
- **Test Code:** [TC020_Delete_an_existing_document_from_the_list.py](./TC020_Delete_an_existing_document_from_the_list.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - application displayed "Invalid login credentials" after submitting test credentials.
- Dashboard page did not load after login; current URL remains "/login".
- Documents page could not be reached because authentication did not succeed.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/277e2e99-af57-4c63-afae-d7b25c6f323f
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC022 Dashboard loads and shows KPI widgets for an authenticated user
- **Test Code:** [TC022_Dashboard_loads_and_shows_KPI_widgets_for_an_authenticated_user.py](./TC022_Dashboard_loads_and_shows_KPI_widgets_for_an_authenticated_user.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - 'Invalid login credentials' message displayed on the login page after submitting credentials.
- Dashboard not reached - URL remains '/login' and does not contain '/dashboard' after sign-in attempt.
- KPI and Timeline checks could not be performed because the dashboard did not load.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/7a975df8-babe-4b3f-87a0-08300e937944
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC023 Change dashboard date range updates visible metrics
- **Test Code:** [TC023_Change_dashboard_date_range_updates_visible_metrics.py](./TC023_Change_dashboard_date_range_updates_visible_metrics.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/d73518d7-785f-492d-bdfe-56b5addc55ef
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC027 Dashboard shows an empty state when there is no asset/service data
- **Test Code:** [TC027_Dashboard_shows_an_empty_state_when_there_is_no_assetservice_data.py](./TC027_Dashboard_shows_an_empty_state_when_there_is_no_assetservice_data.py)
- **Test Error:** TEST FAILURE

ASSERTIONS:
- Login failed - 'Invalid login credentials' error displayed after submitting credentials.
- Dashboard page did not load after login - URL does not contain '/dashboard'.
- Empty-state verification could not be performed because the account could not be accessed due to authentication failure.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/ae0cb8f7-cdb8-4e9c-8249-e74ba4af8501/14b6f216-ef03-4879-a539-364c158b29a8
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **20.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---