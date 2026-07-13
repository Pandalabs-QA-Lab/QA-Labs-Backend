const service = require('../services/attachments.service');
const HttpError = require('../lib/httpError');

async function upload(req, res) {
  if (!req.file) throw new HttpError(400, 'No file provided');
  const { projectId, testCaseId, bugId } = req.body;
  if (!projectId) throw new HttpError(400, 'projectId is required');
  const attachment = await service.uploadAttachment(req.workspaceId, req.actor, { projectId, testCaseId, bugId }, req.file);
  res.status(201).json({
    id: attachment.id,
    filename: attachment.filename,
    mimetype: attachment.mimetype,
    size: attachment.size,
    url: `/api/attachments/${attachment.id}/download`,
  });
}

async function download(req, res) {
  const attachment = await service.getAttachmentForDownload(req.workspaceId, req.params.id);
  res.download(attachment.path, attachment.filename);
}

async function remove(req, res) {
  await service.deleteAttachment(req.workspaceId, req.params.id);
  res.status(204).send();
}

module.exports = { upload, download, remove };
