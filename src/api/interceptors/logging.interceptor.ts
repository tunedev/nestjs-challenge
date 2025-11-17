import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = performance.now();

    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.log(
            `[${method}] ${url} - Total execution time: ${performance.now() - now} ms`,
          ),
        ),
      );
  }
}
