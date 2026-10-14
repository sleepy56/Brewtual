import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const details = error instanceof HttpException ? error.getResponse() : null;
    if (status >= 500) this.logger.error(`Request ${response.getHeader('X-Request-Id')} failed`, error instanceof Error ? error.stack : undefined);
    const message = typeof details === 'object' && details && 'message' in details
      ? details.message : typeof details === 'string' ? details : 'An unexpected error occurred';
    response.status(status).json({ statusCode: status, message, path: request.path, requestId: response.getHeader('X-Request-Id') });
  }
}
