const service = require('../services/comments.service');
const { listCommentsSchema, createCommentSchema } = require('../validators/comments.validators');

async function list(req, res) {
  const parsed = listCommentsSchema.parse(req.query);
  const comments = await service.listComments(req.workspaceId, req.params.projectId, parsed.entityType, parsed.entityId);
  res.json(comments);
}

async function create(req, res) {
  const parsed = createCommentSchema.parse(req.body);
  const comment = await service.addComment(req.workspaceId, req.params.projectId, req.actor, parsed);
  res.status(201).json(comment);
}

async function remove(req, res) {
  await service.deleteComment(req.workspaceId, req.params.projectId, req.actor, req.params.id);
  res.status(204).send();
}

module.exports = { list, create, remove };
