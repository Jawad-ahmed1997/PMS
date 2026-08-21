import { runAiManagerDiagnosis } from "@/lib/aiManagerService";

/**
 * Backward compatibility alias for AI Doctor -> AI Manager
 */
export async function runAiDoctorDiagnosis(params) {
  return runAiManagerDiagnosis(params);
}
