// Mirrors the frontend's useNotifications().sendNotification(): skips
// self-notifications and matches recipient by display name (kept for
// backward compatibility with the existing "recipient is a name string"
// convention rather than a hard userId FK).
async function sendNotification(tx, { workspaceId, recipient, sender, type, entityId, entityName, message, projectId }) {
  if (!recipient) return null;
  if (sender && recipient.trim().toLowerCase() === sender.trim().toLowerCase()) return null;
  return tx.notification.create({
    data: { workspaceId, recipient, sender, type, entityId, entityName, message, projectId },
  });
}

module.exports = { sendNotification };
