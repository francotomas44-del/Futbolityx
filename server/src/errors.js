export class HttpError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function registerErrorHandler(app) {
  app.setErrorHandler(function (error, request, reply) {
    var status = error.statusCode || 500;
    var isServerError = status >= 500;
    var code = error.code || (status === 400 ? "bad_request" : "internal_error");

    if (isServerError) {
      request.log.error({ err: error }, "request failed");
    }

    var payload = {
      error: {
        code: code,
        message: isServerError ? "Error interno del servidor." : error.message,
        requestId: request.id
      }
    };

    if (error.validation) {
      payload.error.code = "validation_error";
      payload.error.message = "Solicitud invalida.";
      payload.error.details = error.validation;
    } else if (error.details) {
      payload.error.details = error.details;
    }

    reply.code(status).send(payload);
  });

  app.setNotFoundHandler(function (request, reply) {
    reply.code(404).send({
      error: {
        code: "not_found",
        message: "Ruta no encontrada.",
        requestId: request.id
      }
    });
  });
}
