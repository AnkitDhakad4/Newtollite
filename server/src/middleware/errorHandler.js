class AppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

class VersionConflictError extends AppError {
  constructor(message = 'Resource state has been modified by another user.', currentResource = null) {
    super(message, 409, { currentResource });
    this.name = 'VersionConflictError';
  }
}

class WorkflowRuleError extends AppError {
  constructor(message, details = null) {
    super(message, 422, details);
    this.name = 'WorkflowRuleError';
  }
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const message = err.message || 'Internal Server Error';

  if (statusCode === 500) {
    console.error('[ServerError]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.name || 'API_ERROR',
    details: err.details || null
  });
}

module.exports = {
  AppError,
  VersionConflictError,
  WorkflowRuleError,
  errorHandler
};

