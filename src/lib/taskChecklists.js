export const TASK_TYPE_CHECKLISTS = {
  UI: [
    "Confirm responsive layout on key breakpoints",
    "Validate design tokens and spacing",
    "Review accessibility states (focus, hover)",
    "Verify copy and labels are final",
  ],
  AUTH: [
    "Confirm authentication flow works end-to-end",
    "Validate session handling and logout",
    "Check error messaging and lockout states",
    "Verify role-based access rules",
  ],
  API: [
    "Validate request/response contracts",
    "Add or update API tests",
    "Confirm error handling and status codes",
    "Review performance impact and logs",
  ],
  REFACTOR: [
    "Document impacted modules",
    "Confirm no functional regressions",
    "Run targeted regression tests",
    "Remove unused code paths",
  ],
  CHART: [
    "Validate chart data mappings",
    "Review axes, legends, and labels",
    "Check edge cases (empty or null data)",
    "Verify color palette and contrast",
  ],
  FULL_STACK: [
    "Verify database/API model integration",
    "Validate UI state and user feedback",
    "Test end-to-end workflow from frontend to backend",
    "Check error handling across all layers",
  ],
  THIRD_PARTY: [
    "Verify API credentials and secrets management",
    "Test payload contracts and rate limit handling",
    "Verify webhook/callback listener reliability",
    "Add fallback and failure logging",
  ],
  BUSINESS_LOGIC: [
    "Verify business rules and validation logic",
    "Test edge cases and invalid inputs",
    "Ensure audit trail / logging of business operations",
    "Confirm calculation correctness and precision",
  ],
  DATABASE: [
    "Review Prisma schema changes / migrations",
    "Check index optimization on queried fields",
    "Verify data integrity constraints",
    "Run local seed/migration test",
  ],
  BUG_FIX: [
    "Reproduce reported bug issue",
    "Implement targeted root-cause fix",
    "Verify fix resolves issue without side effects",
    "Add regression check",
  ],
  DEVOPS: [
    "Verify environment variables and build config",
    "Test CI/CD pipeline steps",
    "Check deployment scripts and container settings",
    "Confirm production build succeeds cleanly",
  ],
  TESTING: [
    "Write unit/integration test cases",
    "Verify test coverage for critical paths",
    "Ensure tests run cleanly in build pipeline",
    "Verify edge-case assertion coverage",
  ],
  PERFORMANCE: [
    "Benchmark response time / render latency",
    "Optimize heavy queries or re-renders",
    "Verify memory and bundle size impact",
    "Test under load/concurrent requests",
  ],
  DOCUMENTATION: [
    "Write or update developer documentation",
    "Update API schemas or architecture diagrams",
    "Provide clear usage examples",
    "Review document clarity with team",
  ],
};

export function getChecklistForTaskType(taskType) {
  if (!taskType) {
    return [];
  }

  return TASK_TYPE_CHECKLISTS[taskType] ?? [];
}

