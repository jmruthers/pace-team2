-- TM01 — App shell, auth, layout
-- RLS verification queries
--
-- run_id:   019e4d63-6b73-7386-a6b9-42ae494835c8
-- slice_id: TM01
--
-- These queries validate that Row Level Security policies on tables touched by
-- TM01 are correctly scoped. Execute against the dev-db as the test user
-- (not service-role) to confirm RLS enforcement.
--
-- NOTE: rbac_apps, rbac_app_pages, and rbac_organisation_roles are
-- platform-global tables with no organisation_id column and are not subject
-- to per-org RLS policies. They are verified via persistence.test.ts instead.

-- ---------------------------------------------------------------------------
-- 1. core_organisations — authenticated user can read their own org row
-- ---------------------------------------------------------------------------
-- requirement_ref: AC-04, §8 — OrganisationServiceProvider reads org membership
-- Run as: test admin user (not service-role)
-- Expected: 1 row returned (the seeded test org)

SELECT
    o.id,
    o.name,
    o.display_name
FROM core_organisations o
INNER JOIN core_member m ON m.organisation_id = o.id
INNER JOIN core_person p ON p.id = m.person_id
WHERE p.user_id = auth.uid()
  AND o.id = '{{world.org.id}}';  -- substitute with seeded org id at runtime

-- ---------------------------------------------------------------------------
-- 2. core_member — authenticated user can read their own membership
-- ---------------------------------------------------------------------------
-- requirement_ref: AC-04, BR-04 — OrganisationServiceProvider resolves memberships
-- Run as: test admin user (not service-role)
-- Expected: 1 row returned

SELECT
    m.id,
    m.organisation_id,
    m.person_id,
    m.membership_status
FROM core_member m
WHERE m.organisation_id = '{{world.org.id}}'  -- substitute at runtime
ORDER BY m.id;

-- ---------------------------------------------------------------------------
-- 3. core_person — authenticated user can read their own person row
-- ---------------------------------------------------------------------------
-- requirement_ref: AC-04 — user identity resolved from core_person
-- Run as: test admin user (not service-role)
-- Expected: 1 row returned (own person record)

SELECT
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.email
FROM core_person p
WHERE p.user_id = auth.uid();

-- ---------------------------------------------------------------------------
-- 4. cross-org isolation — user cannot read another org's members
-- ---------------------------------------------------------------------------
-- requirement_ref: BR-01, BR-03 — org data must not bleed across tenant boundaries
-- Run as: test admin user (not service-role)
-- Expected: 0 rows (no member rows for a different org visible to this user)

SELECT
    m.id,
    m.organisation_id
FROM core_member m
WHERE m.organisation_id != '{{world.org.id}}'  -- substitute at runtime
LIMIT 5;

-- ---------------------------------------------------------------------------
-- 5. rbac_apps — readable without org scope (platform-global table)
-- ---------------------------------------------------------------------------
-- requirement_ref: AC-04, §8 — RBAC engine reads rbac_apps; no org filter required
-- Run as: service-role (RLS not applied for platform-global tables)
-- Expected: row with name = 'TEAM' and is_active = true

SELECT
    id,
    name,
    is_active
FROM rbac_apps
WHERE name = 'TEAM';

-- ---------------------------------------------------------------------------
-- 6. rbac_app_pages — readable without org scope (platform-global table)
-- ---------------------------------------------------------------------------
-- requirement_ref: AC-04, §8 — PagePermissionGuard reads rbac_app_pages
-- Run as: service-role
-- Expected: 0 or 1 row for page_name = 'home'; absence is expected pre-release

SELECT
    rap.id,
    rap.page_name,
    rap.app_id,
    ra.name AS app_name
FROM rbac_app_pages rap
INNER JOIN rbac_apps ra ON ra.id = rap.app_id
WHERE ra.name = 'TEAM'
  AND rap.page_name = 'home';
