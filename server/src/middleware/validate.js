import { ApiError } from '../utils/ApiError.js';

/** validate(zodSchema, 'body' | 'query' | 'params') */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) fields[issue.path.join('.') || '_'] = issue.message;
      const first = result.error.issues[0];
      const where = first.path.length ? `${first.path.join('.')}: ` : '';
      return next(new ApiError(422, `${where}${first.message}`, 'VALIDATION_ERROR', fields));
    }
    req[source] = result.data;
    next();
  };
