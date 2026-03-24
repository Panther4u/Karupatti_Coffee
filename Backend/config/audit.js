/**
 * Audit log helper — writes AuditLog entries for mutations.
 */

const AuditLog = require("../models/AuditLog");

/**
 * Log an action to the audit trail.
 * @param {Object} params
 * @param {string} params.action - e.g. "create", "update", "delete"
 * @param {string} params.entity - e.g. "Order", "Product"
 * @param {string} [params.entityId] - ID of the affected document
 * @param {Object} [params.user] - req.user (decoded JWT)
 * @param {Object} [params.details] - extra context
 */
async function logAudit({ action, entity, entityId, user, details }) {
  try {
    await AuditLog.create({
      userId: user?.id || null,
      userName: user?.username || "system",
      action,
      entity,
      entityId: entityId ? String(entityId) : "",
      details,
    });
  } catch (err) {
    // Never let audit failures break the main flow
    console.error("Audit log write failed:", err.message);
  }
}

module.exports = { logAudit };
