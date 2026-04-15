import { SetMetadata } from "@nestjs/common";

export const TRANSACTIONAL_META = "db.transactional";

/**
 * Marks a handler (or controller class) so {@link TransactionalInterceptor}
 * wraps the request in a DB transaction with RLS claims injected via
 * `set_config('request.jwt.claims', ..., true)`.
 */
export const Transactional = (): ClassDecorator & MethodDecorator =>
  SetMetadata(TRANSACTIONAL_META, true);
