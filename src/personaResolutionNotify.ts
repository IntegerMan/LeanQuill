/** D-15: gate concise UI toasts when persona resolution produced warnings or errors. */

export function shouldNotifyPersonaResolutionIssues(
  warnings: readonly string[],
  errors: readonly string[],
): boolean {
  return warnings.length + errors.length > 0;
}
