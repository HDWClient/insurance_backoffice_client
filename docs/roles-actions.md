> Last Updated: 2026-04-20
>
> ⚠️ **Open questions:** (1) GLOBAL role scope does not exist in Prisma schema — all roles are ORG-scoped. (2) `is_root_admin` flag does not exist in `cms_users`. Both must be resolved before implementation. See [open-questions.md](../source-of-truth/open-questions.md).

# Feature: RBAC (Roles & Permissions)

## Purpose
Dynamic, DB-driven role-based access control. Roles are scoped (GLOBAL or ORG), composed of permissions, and assigned to users. No hardcoded permission logic in business code.

---
## Concepts

| Concept | Description |
|---------|-------------|
| Permission | An atomic capability: `MODULE_ACTION` (e.g. `MEMBER_CREATE`) |
| Role | A named collection of permissions with a scope (GLOBAL or ORG) |
| Role Assignment | A user → role mapping, optionally scoped to an org |
| System Role | A built-in role (seeded at startup) — cannot be deleted or modified |

---

## Endpoints

### Permissions
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| GET | `/permissions` | `ROLE_MANAGE` | List all permission codes |

### Roles
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| GET | `/roles` | `ROLE_MANAGE` | List roles (scoped or all) |
| POST | `/roles` | `ROLE_MANAGE` | Create custom role |
| PUT | `/roles/{id}` | `ROLE_MANAGE` | Update role (non-system only) |
| DELETE | `/roles/{id}` | `ROLE_MANAGE` | Delete role (non-system only) |
| POST | `/roles/{id}/permissions` | `ROLE_MANAGE` | Add permission to role |
| DELETE | `/roles/{id}/permissions/{permId}` | `ROLE_MANAGE` | Remove permission from role |

### Role Assignments
| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| POST | `/users/{id}/roles` | `ROLE_ASSIGN` | Assign role to user |
| DELETE | `/users/{id}/roles/{roleId}` | `ROLE_ASSIGN` | Remove role from user |
| GET | `/users/{id}/roles` | `USER_READ` | Get user's roles |

---

## Role Scoping Rules

| Role Scope | `organization_id` in `roles` | `organization_id` in `user_roles` |
|------------|------------------------------|-----------------------------------|
| GLOBAL | NULL | NULL |
| ORG | UUID of org | UUID of org |

- A GLOBAL role applies across all orgs
- An ORG role only grants permissions within the specific org it's assigned for

---

## `@RequiresPermission` — Custom Authorization Annotation

Spring's `@PreAuthorize` is not used — our permissions are DB-driven and Spring Security has no knowledge of them. Instead we use a custom annotation backed by an AOP aspect.

**Annotation:**
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresPermission {
    String value(); // permission code e.g. "MEMBER_CREATE"
}
```

**AOP Aspect:**
```java
@Around("@annotation(requiresPermission)")
public Object checkPermission(ProceedingJoinPoint pjp, RequiresPermission requiresPermission) {
    UUID userId = SecurityContextHolder // extract from Authentication
    UUID orgId  = OrgContextHolder      // extract from request-scoped context

    if (!authorizationService.hasAccess(userId, orgId, requiresPermission.value())) {
        throw new UnauthorizedException("Insufficient permission: " + requiresPermission.value());
    }
    return pjp.proceed();
}
```

**Usage — on service methods (not controllers):**
```java
@RequiresPermission("MEMBER_CREATE")
public MemberResponse createMember(CreateMemberRequest req) { ... }

@RequiresPermission("BULK_UPLOAD")
public BulkUploadResponse submitFile(MultipartFile file) { ... }

@RequiresPermission("AUDIT_READ")
public Page<AuditLog> getAuditLogs(AuditFilter filter) { ... }
```

**Why on services, not controllers:** Controllers handle HTTP mapping. Authorization is a business-layer concern — putting it on services means it's enforced regardless of how the method is called (HTTP, internal, bulk processor, etc.).

---

## Authorization Service Logic

```java
boolean hasAccess(UUID userId, UUID orgId, String permissionCode) {
    // 1. Root admin bypass
    if (userRepository.findById(userId).isRootAdmin()) return true;

    // 2. Fetch all effective permissions for user in this org context
    // Query: user_roles → roles → role_permissions → permissions
    // Where: user_roles.user_id = userId
    //   AND: user_roles.organization_id = orgId OR user_roles.organization_id IS NULL

    Set<String> effectivePermissions = rbacRepository.findPermissions(userId, orgId);

    return effectivePermissions.contains(permissionCode);
}
```

---

## System Roles (Seeded at Startup)

| Role Name | Scope | Permissions |
|-----------|-------|-------------|
| `ROOT_ADMIN` | GLOBAL | All permissions |
| `ORG_ADMIN` | ORG | All org-scoped permissions |
| `ORG_VIEWER` | ORG | All READ permissions |
| `MEMBER_MANAGER` | ORG | MEMBER_*, DEPENDENT_* |
| `BULK_OPERATOR` | ORG | BULK_UPLOAD, BULK_READ, MEMBER_* |

> Note: Exact permission sets to be finalized — update this table when confirmed.

---

## Privilege Escalation Prevention

- A user can only assign roles that they themselves hold
- A user cannot assign ROOT_ADMIN role (only DB seeding can create root admins)
- System roles cannot be deleted or have their permissions modified

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Delete role with active assignments | 400 — revoke assignments first |
| Modify system role | 400 — system roles are immutable |
| Assign role from different org | 400 — scope mismatch |
| User has no roles | All permission checks return false (except root admin) |
| Circular role assignment | Not possible — roles are flat, not hierarchical |

---

## Audit Events

| Action | Trigger |
|--------|---------|
| `ROLE_CREATE` | New role created |
| `ROLE_UPDATE` | Role name or permissions changed |
| `ROLE_DELETE` | Role removed |
| `ROLE_ASSIGNED` | Role assigned to user |
| `ROLE_REVOKED` | Role removed from user |
